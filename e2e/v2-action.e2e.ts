import { expect,test } from "@playwright/test";

test("keyboard and touch-safe tile selection never auto-discards, landscape targets fit",async({page})=>{
  test.setTimeout(100_000);
  await page.setViewportSize({width:844,height:390});
  await page.goto("/");
  await page.getByRole("textbox",{name:"你的昵称"}).fill("Action Tester");
  await page.getByRole("button",{name:/创建私人房间/}).click();
  await expect(page).toHaveURL(/\/room\/[A-HJ-NP-Z2-9]{6}$/);
  const code=new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByRole("button",{name:/补满练习机器人/}).click();
  await page.getByRole("button",{name:"我准备好了"}).click();
  await page.getByRole("button",{name:"四人准备后开局"}).click();
  await expect(page.locator(".mj-game")).toBeVisible();
  const before=await page.evaluate(async roomCode=>{
    const token=localStorage.getItem("mahjong-friends:room:"+roomCode);
    const response=await fetch("/api/rooms/"+roomCode,{headers:{authorization:"Bearer "+token}});
    return (await response.json() as {game:{version:number}}).game.version;
  },code);

  const tiles=page.locator(".mj-hand button");
  await expect(tiles).toHaveCount(14);
  const confirm=page.getByRole("button",{name:/打出所选牌/});
  await expect(confirm).toBeDisabled();
  const initialActions=page.locator(".mj-game .mj-action").first();
  const touchTargets=await Promise.all([tiles.first(),initialActions].map(async locator=>
    locator.evaluate(el=>{const r=el.getBoundingClientRect();return {height:r.height,width:r.width}})));
  expect(touchTargets[0].width).toBeGreaterThanOrEqual(40);
  expect(touchTargets[0].height).toBeGreaterThanOrEqual(40);
  expect(touchTargets[1].height).toBeGreaterThanOrEqual(39);

  await tiles.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tiles.nth(0)).toHaveAttribute("aria-pressed","true");
  await page.keyboard.press("ArrowRight");
  await expect(tiles.nth(1)).toHaveAttribute("aria-pressed","true");
  await page.keyboard.press("Escape");
  await expect(page.locator(".mj-hand button[aria-pressed='true']")).toHaveCount(0);
  await expect(confirm).toBeDisabled();

  await tiles.first().click();
  await expect(tiles.first()).toHaveAttribute("aria-pressed","true");
  await expect(confirm).toBeEnabled();
  await expect(page.getByRole("button",{name:"取消选牌"})).toBeVisible();
  await page.screenshot({path:"test-results/v2-screenshots/844x390-selected-action.png",fullPage:false});
  await page.getByRole("button",{name:"取消选牌"}).click();
  await expect(confirm).toBeDisabled();
  await tiles.first().click();
  // The server's action version MUST remain unchanged across all hand
  // navigation/taps until the player explicitly confirms the discard.
  const afterSelecting=await page.evaluate(async roomCode=>{
    const token=localStorage.getItem("mahjong-friends:room:"+roomCode);
    const response=await fetch("/api/rooms/"+roomCode,{headers:{authorization:"Bearer "+token}});
    return (await response.json() as {game:{version:number}}).game.version;
  },code);
  expect(afterSelecting).toBe(before);
  await confirm.click();
  await expect.poll(async()=>page.evaluate(async roomCode=>{
    const token=localStorage.getItem("mahjong-friends:room:"+roomCode);
    const response=await fetch("/api/rooms/"+roomCode,{headers:{authorization:"Bearer "+token}});
    return (await response.json() as {game:{version:number}}).game.version;
  },code),{timeout:10_000}).toBeGreaterThan(before);

  expect(await page.evaluate(()=>document.documentElement.scrollHeight))
    .toBeLessThanOrEqual(392);
});
