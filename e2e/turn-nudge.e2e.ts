import {test,expect} from "@playwright/test";

test("after 30 seconds, guest reminds only active host, white screen pulses once",async({page,browser})=>{
  test.setTimeout(115_000);
  const guestContext=await browser.newContext({viewport:{width:844,height:390}});
  const guest=await guestContext.newPage();
  try{
    await page.goto("/");
    await page.getByRole("textbox",{name:"你的昵称"}).fill("房主提醒验证");
    await page.getByRole("button",{name:/创建私人房间/}).click();
    await expect(page).toHaveURL(new RegExp("/room/[A-HJ-NP-Z2-9]{6}$"));
    const code=new URL(page.url()).pathname.split("/").at(-1)!;
    await guest.goto("/room/"+code);
    await guest.getByRole("textbox",{name:"你的昵称"}).fill("提醒出牌的人");
    await guest.getByRole("button",{name:"加入这桌"}).click();
    await page.getByRole("button",{name:/补满练习机器人/}).click();
    await page.getByRole("button",{name:"我准备好了"}).click();
    await guest.getByRole("button",{name:"我准备好了"}).click();
    await page.getByRole("button",{name:"四人准备后开局"}).click();
    await expect(page.locator(".mj-game")).toBeVisible();
    await expect(guest.locator(".mj-game")).toBeVisible();
    await expect(page.locator(".mj-attention-overlay")).toHaveCount(0);
    const nudge=guest.getByRole("button",{name:/提醒 房主提醒验证 轮到出牌/});
    await expect(nudge).toBeHidden();
    await expect(nudge).toBeVisible({timeout:42_000});
    await nudge.click();
    await expect(page.getByRole("alert",{name:"轮到你出牌了"})).toBeVisible({timeout:10_000});
    await expect(page.getByText("其他玩家正在等你")).toBeVisible();
    await expect(guest.getByText("已提醒当前玩家出牌")).toBeVisible();
    await expect(page.locator(".mj-attention-overlay")).toHaveCount(0,{timeout:5_000});
    await expect(nudge).toBeHidden();
    // The actor's screen must never turn white as a side effect.
    await expect(guest.locator(".mj-attention-overlay")).toHaveCount(0);
  }finally{await guestContext.close();}
});
