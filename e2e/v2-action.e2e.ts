import { expect,test } from "@playwright/test";

test("two taps discard, other tile reselects, keyboard stays safe, right dock does not resize",async({page})=>{
  test.setTimeout(120_000);
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

  const gameVersion=()=>page.evaluate(async roomCode=>{
    const token=localStorage.getItem("mahjong-friends:room:"+roomCode);
    const response=await fetch("/api/rooms/"+roomCode,{
      headers:{authorization:"Bearer "+token},cache:"no-store"
    });
    return (await response.json() as {game:{version:number}}).game.version;
  },code);
  const before=await gameVersion();
  const tiles=page.locator(".mj-hand button.mj-tile");
  const confirm=page.getByRole("button",{name:"打出所选牌"});
  const cancel=page.getByRole("button",{name:"取消选牌"});
  await expect(tiles).toHaveCount(14);
  await expect(confirm).toHaveCount(1);
  await expect(confirm).toBeDisabled();
  await expect(cancel).toBeDisabled();

  const rect=()=>page.evaluate(()=>{
    const button=document.querySelector(".mj-discard-fixed")!.getBoundingClientRect();
    const hand=document.querySelector(".mj-hand")!.getBoundingClientRect();
    const controls=document.querySelector(".mj-controls")!.getBoundingClientRect();
    const board=document.querySelector(".mj-board")!.getBoundingClientRect();
    return {button:{x:button.x,y:button.y,width:button.width,height:button.height},
      hand:{left:hand.left,right:hand.right,top:hand.top,bottom:hand.bottom},
      controls:{left:controls.left,right:controls.right,top:controls.top,bottom:controls.bottom},
      boardBottom:board.bottom,documentHeight:document.documentElement.scrollHeight};
  });
  const stable=await rect();
  expect(stable.button.width).toBeGreaterThanOrEqual(66);
  expect(stable.button.height).toBeGreaterThanOrEqual(40);
  expect(stable.button.x).toBeGreaterThanOrEqual(stable.hand.right-2);
  expect(stable.button.x+stable.button.width).toBeLessThanOrEqual(stable.controls.right+2);
  expect(stable.controls.top).toBeGreaterThanOrEqual(stable.boardBottom-2);
  expect(stable.documentHeight).toBeLessThanOrEqual(392);

  // Arrow navigation selects; keyboard activation of the tile cannot discard
  // accidentally. Keyboard users can explicitly press the fixed confirm dock.
  await tiles.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tiles.first()).toHaveAttribute("aria-pressed","true");
  await page.keyboard.press("ArrowRight");
  await expect(tiles.nth(1)).toHaveAttribute("aria-pressed","true");
  await page.keyboard.press("Enter");
  await expect(tiles.nth(1)).toHaveAttribute("aria-pressed","true");
  expect(await gameVersion()).toBe(before);
  await page.keyboard.press("Escape");
  await expect(page.locator('.mj-hand button[aria-pressed="true"]')).toHaveCount(0);
  await expect(confirm).toBeDisabled();

  await tiles.first().click();
  await expect(tiles.first()).toHaveAttribute("aria-pressed","true");
  await expect(confirm).toBeEnabled();
  await expect(cancel).toBeEnabled();
  expect(await rect()).toEqual(stable);
  expect(await gameVersion()).toBe(before);

  // Pressing a *different* tile changes the choice; no implicit discard.
  await tiles.nth(1).click();
  await expect(tiles.first()).toHaveAttribute("aria-pressed","false");
  await expect(tiles.nth(1)).toHaveAttribute("aria-pressed","true");
  expect(await gameVersion()).toBe(before);
  expect(await rect()).toEqual(stable);
  await cancel.click();
  await expect(confirm).toBeDisabled();
  expect(await rect()).toEqual(stable);

  // The second pointer click on the same selected tile submits precisely one
  // version-checked discard through the existing server-authoritative path.
  await tiles.first().click();
  await expect(tiles.first()).toHaveAttribute("aria-pressed","true");
  await page.screenshot({path:"test-results/v2-screenshots/844x390-selected-fixed-dock.png",fullPage:false});
  await tiles.first().click();
  await expect.poll(gameVersion,{timeout:10_000}).toBeGreaterThan(before);
  await expect(confirm).toBeDisabled();
  expect(await rect()).toEqual(stable);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight))
    .toBeLessThanOrEqual(392);
});
