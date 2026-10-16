import { test, expect, type Browser, type Page } from "@playwright/test";

interface GameSnapshot {
  viewerId:string;
  room:{
    code:string;
    state:"waiting"|"playing"|"settlement";
    players:Array<{id:string;nickname:string;ready:boolean}>;
    roundNumber?:number;
  };
  game?:{
    phase:"discard"|"claims"|"ended";
    version:number;
    currentPlayerId:string;
    myAvailableClaims:unknown|null;
    players:Array<{id:string;hand?:Array<{id:string}>}>;
  };
}

async function readRoom(page:Page,code:string):Promise<GameSnapshot> {
  return page.evaluate(async(roomCode)=>{
    const token=localStorage.getItem("mahjong-friends:room:"+roomCode);
    if(!token)throw new Error("Missing private room identity");
    const r=await fetch("/api/rooms/"+roomCode,{
      headers:{authorization:"Bearer "+token},cache:"no-store"
    });
    if(!r.ok)throw new Error("Private snapshot error: "+r.status+" "+await r.text());
    return await r.json();
  },code) as Promise<GameSnapshot>;
}
async function connectBotSocket(page:Page,code:string):Promise<void> {
  await page.evaluate(async(roomCode)=>{
    const token=localStorage.getItem("mahjong-friends:room:"+roomCode);
    if(!token)throw new Error("Missing private room identity");
    const t=await fetch("/api/rooms/"+roomCode+"/socket-ticket",{
      method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},
      body:"{}"
    });
    if(!t.ok)throw new Error("Ticket request failed: "+await t.text());
    const data=await t.json() as {ticket:string};
    const proto=location.protocol==="https:"?"wss:":"ws:";
    const socket=new WebSocket(proto+"//"+location.host+"/api/rooms/"+roomCode+"/ws?ticket="+data.ticket);
    await new Promise<void>((resolve,reject)=>{
      socket.onopen=()=>resolve();
      socket.onerror=()=>reject(new Error("Bot WebSocket upgrade failed"));
    });
    (window as Window & {__mahjongBotSocket?:WebSocket}).__mahjongBotSocket=socket;
  },code);
}
async function sendBotAction(page:Page,action:Record<string,unknown>):Promise<void> {
  await page.evaluate(data=>{
    const socket=(window as Window & {__mahjongBotSocket?:WebSocket}).__mahjongBotSocket;
    if(!socket||socket.readyState!==WebSocket.OPEN)throw new Error("Bot socket disconnected");
    socket.send(JSON.stringify({type:"game_action",action:{...data,actionId:crypto.randomUUID()}}));
  },action);
}

/** Each seat owns an isolated browser context, localStorage identity and WebSocket. */
async function fourPlayers(browser:Browser):Promise<{pages:Page[];close:()=>Promise<void>}> {
  const contexts=await Promise.all(
    Array.from({length:4},()=>browser.newContext({viewport:{width:1280,height:900}}))
  );
  const pages=await Promise.all(contexts.map(ctx=>ctx.newPage()));
  return {pages,close:async()=>{await Promise.all(contexts.map(ctx=>ctx.close()));}};
}

test("four real browsers can invite, ready, play one whole round and restart",async({browser,request})=>{
  test.setTimeout(240_000);
  const health=await request.get("/api/health");
  expect(health.ok()).toBe(true);
  expect((await health.json()).status).toBe("ok");

  const {pages,close}=await fourPlayers(browser);
  const names=["东家","南家","西家","北家"];
  try {
    const [host]=pages;
    await host.goto("/");
    await host.getByRole("textbox",{name:"你的昵称"}).fill(names[0]);
    await host.getByRole("button",{name:/创建私人房间/}).click();
    await expect(host).toHaveURL(/\/room\/[A-HJ-NP-Z2-9]{6}$/);
    const code=new URL(host.url()).pathname.split("/").at(-1)!;
    expect(code).toHaveLength(6);

    for(let i=1;i<4;i++){
      await pages[i].goto("/room/"+code);
      await pages[i].getByRole("textbox",{name:"你的昵称"}).fill(names[i]);
      await pages[i].getByRole("button",{name:"加入这桌"}).click();
      await expect(pages[i].getByRole("heading",{name:/房间/})).toBeVisible();
    }
    await expect(host.locator(".lobby-seat").filter({hasText:"北家"})).toBeVisible();
    for(const page of pages) {
      await page.getByRole("button",{name:"我准备好了"}).click();
    }
    await expect(host.getByRole("button",{name:"四人准备后开局"})).toBeEnabled();
    await host.getByRole("button",{name:"四人准备后开局"}).click();

    await Promise.all(pages.map(p=>expect(p.locator(".mj-game")).toBeVisible()));
    for(const page of pages) {
      await expect(page.locator(".mj-river")).toHaveCount(4);
      await expect(page.locator(".mj-concealed")).toHaveCount(3);
      await expect(page.locator(".mj-hand")).toBeVisible();
    }
    // Phone layout still shows all four separate face-up rivers.
    await host.setViewportSize({width:390,height:844});
    await expect(host.locator(".mj-river")).toHaveCount(4);
    const mobileWidth=await host.locator(".mj-board").evaluate(el=>el.getBoundingClientRect().width);
    expect(mobileWidth).toBeLessThanOrEqual(390);
    await host.setViewportSize({width:1280,height:900});

    // First real tap+confirm action from the host's own concealed hand.
    await host.locator(".mj-hand button").first().click();
    await host.getByRole("button",{name:/打出所选牌/}).click();
    await expect(host.locator(".mj-seat-bottom .mj-river .mj-tile")).toHaveCount(1);
    await expect(host.locator(".mj-seat-bottom .mj-river-line[data-line='1'] .mj-tile")).toHaveCount(1);
    await expect(host.locator(".mj-seat-bottom .mj-river-line .mj-tile-latest")).toHaveCount(1);
    for(const page of pages) {
      await expect(page.locator('[aria-label="东家 的弃牌区"] .mj-river .mj-tile')).toHaveCount(1);
      await expect(page.locator('[aria-label="东家 的弃牌区"] .mj-river-line[data-line="1"]')).toHaveCount(1);
      await expect(page.locator(".mj-river[data-seat]")).toHaveCount(4);
    }

    // A separate verified socket for each context plays legal discards/passes
    // until the server finishes and settles the same physical game.
    await Promise.all(pages.map(p=>connectBotSocket(p,code)));
    const identity=await Promise.all(pages.map(async p=>(await readRoom(p,code)).viewerId));
    let finished=false;
    for(let step=0;step<280;step++){
      const room=await readRoom(host,code);
      const game=room.game;
      if(!game)throw new Error("Round missing after start");
      if(game.phase==="ended" && room.room.state==="settlement") {
        finished=true;
        break;
      }
      let actor=-1;
      let action:Record<string,unknown>;
      if(game.phase==="claims") {
        action={type:"claim",kind:"pass",expectedVersion:game.version};
        for(let i=0;i<4;i++){
          const own=await readRoom(pages[i],code);
          if(own.game?.myAvailableClaims) {
            actor=i;
            action.expectedVersion=own.game.version;
            break;
          }
        }
        if(actor<0)throw new Error("Claim window without an eligible pending responder");
      } else if(game.phase==="discard") {
        actor=identity.indexOf(game.currentPlayerId);
        if(actor<0)throw new Error("Current seat is not one of the four authenticated browsers");
        const own=await readRoom(pages[actor],code);
        const hand=own.game?.players.find(p=>p.id===identity[actor])?.hand;
        if(!hand?.length)throw new Error("Active player has no concealed tile");
        action={type:"discard",tileId:hand[0].id,expectedVersion:own.game!.version};
      } else {
        throw new Error("Unexpected game phase: "+game.phase);
      }
      const before=game.version;
      await sendBotAction(pages[actor],action);
      await expect.poll(async()=> (await readRoom(host,code)).game?.version??-1,
        {timeout:10_000,intervals:[75,150,250]}).toBeGreaterThan(before);
    }
    expect(finished,"Full physical deck should eventually end a round").toBe(true);

    await expect(host.locator(".mj-results")).toBeVisible();
    await expect(host.locator(".mj-settlement-totals")).toBeVisible();
    await expect(host.getByText("练习计分，非正式家规")).toBeVisible();

    for(const p of pages)await p.getByRole("button",{name:"准备下一局"}).click();
    await expect(host.getByRole("button",{name:"所有人准备好后开下一局"})).toBeEnabled();
    await host.getByRole("button",{name:"所有人准备好后开下一局"}).click();
    await expect.poll(async()=> (await readRoom(host,code)).room.roundNumber).toBe(2);
    await expect(host.locator(".mj-results")).toHaveCount(0);
  }finally{
    await close();
  }
});
