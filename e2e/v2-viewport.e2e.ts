import { test, expect } from "@playwright/test";

test("active Mahjong table fits desktop and phone landscape in one viewport",async({page})=>{
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("textbox",{name:"你的昵称"}).fill("Viewport Tester");
  await page.getByRole("button",{name:/创建私人房间/}).click();
  await page.getByRole("button",{name:/补满练习机器人/}).click();
  await expect(page.locator(".lobby-bot-seat")).toHaveCount(3);
  await page.getByRole("button",{name:"我准备好了"}).click();
  await page.getByRole("button",{name:"四人准备后开局"}).click();
  await expect(page.locator(".mj-game")).toBeVisible();
  await expect(page.locator(".mj-river")).toHaveCount(4);

  for(const [width,height] of [[1366,768],[1440,900],[844,390],[915,412],[390,844]]){
    await page.setViewportSize({width,height});
    const geom=await page.evaluate(()=>{
      const box=(selector:string)=>{
        const element=document.querySelector(selector);
        if(!element)throw Error("Missing required gameplay region "+selector);
        const r=element.getBoundingClientRect();
        const style=getComputedStyle(element);
        return {selector,left:r.left,top:r.top,right:r.right,bottom:r.bottom,
          width:r.width,height:r.height,display:style.display,visibility:style.visibility};
      };
      const required=[
        ".mj-game",".mj-board",".mj-center",".mj-hand",".mj-controls",
        ".mj-seat-top .mj-river",".mj-seat-right .mj-river",
        ".mj-seat-bottom .mj-river",".mj-seat-left .mj-river",
        ".mj-hand button",".mj-controls .mj-action"
      ];
      return {width:innerWidth,height:innerHeight,
        documentHeight:document.documentElement.scrollHeight,bodyHeight:document.body.scrollHeight,
        boxes:required.map(box),
        handButtons:[...document.querySelectorAll(".mj-hand button")].map(e=>{
          const r=e.getBoundingClientRect();
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};
        })
      };
    });
    const tag=width+"x"+height;
    expect(geom.documentHeight,tag+" document must not vertically scroll").toBeLessThanOrEqual(height+2);
    expect(geom.bodyHeight,tag+" body must not vertically scroll").toBeLessThanOrEqual(height+2);
    for(const rect of geom.boxes) {
      expect(rect.width,tag+" "+rect.selector+" width").toBeGreaterThan(0);
      expect(rect.height,tag+" "+rect.selector+" height").toBeGreaterThan(0);
      expect(rect.top,tag+" "+rect.selector+" top").toBeGreaterThanOrEqual(-2);
      expect(rect.bottom,tag+" "+rect.selector+" bottom").toBeLessThanOrEqual(height+2);
      expect(rect.left,tag+" "+rect.selector+" left").toBeGreaterThanOrEqual(-2);
      expect(rect.right,tag+" "+rect.selector+" right").toBeLessThanOrEqual(width+2);
    }
    for(const rect of geom.handButtons) {
      expect(rect.left,tag+" hand tile left").toBeGreaterThanOrEqual(-2);
      expect(rect.right,tag+" hand tile right").toBeLessThanOrEqual(width+2);
      expect(rect.bottom,tag+" hand tile bottom").toBeLessThanOrEqual(height+2);
    }
    await page.screenshot({path:"test-results/v2-screenshots/"+tag+".png",fullPage:false});
  }
  // Keep the actual one-tile select & confirmation path after viewport reflow.
  await page.setViewportSize({width:844,height:390});
  await page.locator(".mj-hand button").first().click();
  await expect(page.locator(".mj-hand button[aria-pressed='true']")).toHaveCount(1);
  await page.getByRole("button",{name:/打出所选牌/}).click();
  await expect.poll(async()=>page.locator(".mj-river .mj-tile").count()).toBeGreaterThan(0);
});
