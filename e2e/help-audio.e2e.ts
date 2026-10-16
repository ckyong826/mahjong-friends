import {test,expect} from "@playwright/test";

test("how-to and Practice fan help open from ?, audio toggle unlocked by tap",async({page})=>{
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("textbox",{name:"你的昵称"}).fill("Game Help QA");
  await page.getByRole("button",{name:/创建私人房间/}).click();
  await expect(page).toHaveURL(new RegExp("/room/[A-HJ-NP-Z2-9]{6}$"));
  await page.getByRole("button",{name:/补满练习机器人/}).click();
  await page.getByRole("button",{name:"我准备好了"}).click();
  await page.getByRole("button",{name:"四人准备后开局"}).click();
  await expect(page.locator(".mj-game")).toBeVisible();

  const help=page.getByRole("button",{name:"玩法与算番说明"});
  const sound=page.getByRole("button",{name:/音效/});
  await expect(sound).toHaveAttribute("aria-pressed","false");
  for(const [width,height] of [[1366,768],[844,390],[390,844]]){
    await page.setViewportSize({width,height});
    await help.click();
    const dialog=page.getByRole("dialog",{name:"麻将玩法与练习番数说明"});
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("四人好友麻将 · 基本操作")).toBeVisible();
    await dialog.getByRole("button",{name:"练习算番"}).click();
    await expect(dialog.getByText("Practice v1")).toBeVisible();
    await expect(dialog.getByText(/每单位积分/)).toBeVisible();
    const geometry=await dialog.boundingBox();
    expect(geometry).not.toBeNull();
    expect(geometry!.x).toBeGreaterThanOrEqual(-2);
    expect(geometry!.y).toBeGreaterThanOrEqual(-2);
    expect(geometry!.x+geometry!.width).toBeLessThanOrEqual(width+2);
    expect(geometry!.y+geometry!.height).toBeLessThanOrEqual(height+2);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(help).toBeFocused();
  }
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed","true");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed","false");
  await page.locator(".mj-hand button").first().click();
  await expect(page.locator(".mj-hand button[aria-pressed=true]")).toHaveCount(1);
});
