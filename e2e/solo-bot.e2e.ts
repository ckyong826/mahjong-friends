import { expect, test } from "@playwright/test";

test("solo practice: host fills three seats, bots play real turns and reload preserves them",async({page})=>{
  test.setTimeout(100_000);
  await page.goto("/");
  await page.getByRole("textbox",{name:"你的昵称"}).fill("Solo Tester");
  await page.getByRole("button",{name:/创建私人房间/}).click();
  await expect(page).toHaveURL(/\/room\/[A-HJ-NP-Z2-9]{6}$/);
  const code=new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByRole("button",{name:/补满练习机器人/}).click();
  await expect(page.locator(".lobby-bot-seat")).toHaveCount(3);
  await expect(page.getByText("已加入 3 位初级练习机器人")).toBeVisible();
  await page.getByRole("button",{name:"我准备好了"}).click();
  await expect(page.getByRole("button",{name:"四人准备后开局"})).toBeEnabled();
  await page.getByRole("button",{name:"四人准备后开局"}).click();
  await expect(page.locator(".mj-game")).toBeVisible();
  await expect(page.locator(".mj-river")).toHaveCount(4);
  await expect(page.locator(".mj-concealed")).toHaveCount(3);
  // The host is East and therefore dealer in the first round.
  await page.locator(".mj-hand button").first().click();
  await page.getByRole("button",{name:/打出所选牌/}).click();
  await expect(page.locator(".mj-seat-bottom .mj-river .mj-tile")).toHaveCount(1);
  // The server Durable Object alarm, not a fake frontend move, advances bots.
  await expect.poll(async()=>{
    return page.evaluate(async(roomCode)=>{
      const token=localStorage.getItem("mahjong-friends:room:"+roomCode);
      const response=await fetch("/api/rooms/"+roomCode,{
        cache:"no-store",headers:{authorization:"Bearer "+token}
      });
      const data=await response.json() as {game?:{version:number}};
      return data.game?.version??0;
    },code);
  },{timeout:20_000,intervals:[200,400,800]}).toBeGreaterThan(1);
  await page.reload();
  await expect(page.locator(".mj-game")).toBeVisible();
  await expect(page.locator(".mj-river")).toHaveCount(4);
  // A legitimate Bot Chow/Pong/Kong can move the initial discard out of
  // the human's river. Persistence must conserve the tile in a river or
  // public meld, not assume it remains where it was originally discarded.
  await expect.poll(async()=>page.evaluate(async(roomCode)=>{
    const token=localStorage.getItem("mahjong-friends:room:"+roomCode);
    const response=await fetch("/api/rooms/"+roomCode,{
      headers:{authorization:"Bearer "+token},cache:"no-store"
    });
    const snapshot=await response.json() as {
      game?:{players:Array<{discards:unknown[];melds:Array<{tileCount:number}>}>}
    };
    return snapshot.game?.players.reduce((n,p)=>
      n+p.discards.length+p.melds.reduce((m,meld)=>m+meld.tileCount,0),0)??0;
  },code),{timeout:10_000}).toBeGreaterThan(0);
  await expect(page.locator(".mj-seat-right .mj-seat-header")).toContainText("🤖");
});
