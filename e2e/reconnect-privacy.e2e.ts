import { test, expect } from "@playwright/test";

interface Snapshot {
  viewerId:string;
  room:{code:string;state:string;players:Array<{id:string;seat:string}>};
  game?:{
    version:number;currentPlayerId:string;
    players:Array<{id:string;hand?:Array<{id:string}>;concealedCount:number}>;
  };
}
async function readMySnapshot(page:import("@playwright/test").Page,roomCode:string):Promise<Snapshot> {
  return page.evaluate(async(code)=>{
    const token=localStorage.getItem("mahjong-friends:room:"+code);
    if(!token)throw new Error("Missing authenticated reconnect token");
    const response=await fetch("/api/rooms/"+code,{
      headers:{authorization:"Bearer "+token},cache:"no-store"
    });
    if(!response.ok)throw new Error("Authenticated snapshot failed: "+response.status);
    return await response.json() as Snapshot;
  },roomCode);
}

test("two humans and two bots: reload preserves identity and never leaks another hand",async({page,browser})=>{
  test.setTimeout(120_000);
  const guestContext=await browser.newContext({viewport:{width:844,height:390}});
  const guest=await guestContext.newPage();
  try{
    await page.goto("/");
    await page.getByRole("textbox",{name:"你的昵称"}).fill("房主安全测试");
    await page.getByRole("button",{name:/创建私人房间/}).click();
    // Creating a room is asynchronous: waiting only for the click can read
    // the old "/" pathname, causing the guest to navigate to /room/ instead.
    await expect(page).toHaveURL(/\\/room\\/[A-HJ-NP-Z2-9]{6}$/);
    const roomCode=new URL(page.url()).pathname.split("/").at(-1)!;

    await guest.goto("/room/"+roomCode);
    await guest.getByRole("textbox",{name:"你的昵称"}).fill("重连测试玩家");
    await guest.getByRole("button",{name:"加入这桌"}).click();
    await expect(guest.locator(".lobby-seat")).toHaveCount(4);
    await page.getByRole("button",{name:/补满练习机器人/}).click();
    await expect(page.locator(".lobby-bot-seat")).toHaveCount(2);
    await page.getByRole("button",{name:"我准备好了"}).click();
    await guest.getByRole("button",{name:"我准备好了"}).click();
    await page.getByRole("button",{name:"四人准备后开局"}).click();
    await expect(guest.locator(".mj-game")).toBeVisible();
    await expect(guest.locator(".mj-connection-connected")).toBeVisible();

    const first=await readMySnapshot(guest,roomCode);
    expect(first.room.code).toBe(roomCode);
    expect(first.game).toBeDefined();
    const own=first.game!.players.find(p=>p.id===first.viewerId);
    expect(own?.hand?.length).toBeGreaterThan(0);
    expect(first.game!.players.filter(p=>Array.isArray(p.hand))).toHaveLength(1);
    expect(first.game!.players.filter(p=>p.id!==first.viewerId)
      .every(p=>p.hand===undefined)).toBe(true);
    await expect(guest.locator(".mj-concealed")).toHaveCount(3);

    // Public code alone grants neither a private snapshot nor a fifth seat.
    const guards=await guest.evaluate(async code=>{
      const noAuth=await fetch("/api/rooms/"+code,{cache:"no-store"});
      const invalid=await fetch("/api/rooms/"+code,{
        headers:{authorization:"Bearer "+"0".repeat(64)},cache:"no-store"
      });
      const lateJoin=await fetch("/api/rooms/"+code+"/join",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({nickname:"未经邀请者"})
      });
      return [noAuth.status,invalid.status,lateJoin.status];
    },roomCode);
    expect(guards).toEqual([401,401,409]);

    // Reload is a real new HTTP snapshot and WebSocket subscription, not
    // merely preserved React in-memory UI state.
    await guest.reload();
    await expect(guest.locator(".mj-game")).toBeVisible();
    await expect(guest.locator(".mj-connection-connected")).toBeVisible();
    const restored=await readMySnapshot(guest,roomCode);
    expect(restored.viewerId).toBe(first.viewerId);
    expect(restored.room.players.find(p=>p.id===first.viewerId)?.seat)
      .toBe(first.room.players.find(p=>p.id===first.viewerId)?.seat);
    expect(restored.game!.players.find(p=>p.id===restored.viewerId)?.hand?.map(t=>t.id))
      .toEqual(own?.hand?.map(t=>t.id));
    expect(restored.game!.players.filter(p=>Array.isArray(p.hand))).toHaveLength(1);
    await expect(guest.locator(".mj-concealed")).toHaveCount(3);

    // Server acknowledges host's real discard; reconnected guest receives
    // subsequent state without learning host's concealed hand.
    await page.locator(".mj-hand button").first().click();
    await page.getByRole("button",{name:/打出所选牌/}).click();
    await expect.poll(async()=>{
      const snapshot=await readMySnapshot(guest,roomCode);
      return snapshot.game?.version??-1;
    },{timeout:15_000}).toBeGreaterThan(restored.game!.version);
    const after=await readMySnapshot(guest,roomCode);
    expect(after.game!.players.filter(p=>Array.isArray(p.hand))).toHaveLength(1);
    expect(after.game!.players.find(p=>p.id!==after.viewerId)?.hand).toBeUndefined();
  }finally{
    await guestContext.close();
  }
});
