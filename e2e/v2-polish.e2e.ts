import { test, expect } from "@playwright/test";

test("landing page accurately describes already playable practice features",async({page})=>{
  await page.goto("/");
  await expect(page.locator(".edition")).toContainText("四人联机练习版");
  await expect(page.locator(".preview-note"))
    .toContainText("已支持四人联机、Bot 练习和虚拟积分结算");
  await expect(page.locator(".preview-note")).toContainText("正式新马地区家规仍待确认");
  await expect(page.locator(".table-caption")).toContainText("实际开房后可联机出牌");
  await expect(page.locator(".feature")).toHaveCount(6);
});

test("reduced-motion gameplay remains responsive, readable and interactive",async({page})=>{
  test.setTimeout(120_000);
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/");
  await page.getByRole("textbox",{name:"你的昵称"}).fill("Motion QA");
  await page.getByRole("button",{name:/创建私人房间/}).click();
  await page.getByRole("button",{name:/补满练习机器人/}).click();
  await page.getByRole("button",{name:"我准备好了"}).click();
  await page.getByRole("button",{name:"四人准备后开局"}).click();
  await expect(page.locator(".mj-game")).toBeVisible();
  await expect(page.locator(".mj-avatar-bot")).toHaveCount(3);

  const motion=await page.evaluate(()=>{
    if(!matchMedia("(prefers-reduced-motion: reduce)").matches){
      throw new Error("reduced motion emulation not active");
    }
    const tile=document.querySelector<HTMLButtonElement>(".mj-hand button.mj-tile")!;
    const action=document.querySelector<HTMLButtonElement>(".mj-action")!;
    const botSeat=document.querySelector<HTMLElement>(".mj-seat-right")!;
    const bot=botSeat.querySelector<HTMLElement>(".mj-avatar-bot")!;
    tile.classList.add("mj-tile-arriving");
    botSeat.classList.add("mj-seat-turn");
    const tileAnimation=getComputedStyle(tile).animationName;
    const botAnimation=getComputedStyle(bot).animationName;
    const tileTransition=getComputedStyle(tile).transitionDuration;
    const actionTransition=getComputedStyle(action).transitionDuration;
    tile.classList.remove("mj-tile-arriving");
    botSeat.classList.remove("mj-seat-turn");
    return {tileAnimation,botAnimation,tileTransition,actionTransition};
  });
  expect(motion.tileAnimation).toBe("none");
  expect(motion.botAnimation).toBe("none");
  expect(parseFloat(motion.tileTransition)).toBe(0);
  expect(parseFloat(motion.actionTransition)).toBe(0);

  for(const [width,height] of [[1366,768],[844,390],[915,412],[390,844]]){
    await page.setViewportSize({width,height});
    const geom=await page.evaluate(()=>{
      const selectors=[".mj-board",".mj-controls",".mj-center",".mj-seat-top .mj-river",
        ".mj-seat-right .mj-river",".mj-seat-bottom .mj-river",
        ".mj-seat-left .mj-river",".mj-hand button"];
      return {screen:innerHeight,scrollHeight:document.documentElement.scrollHeight,
        visible:selectors.map(selector=>{
          const r=document.querySelector(selector)!.getBoundingClientRect();
          return {selector,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
            width:r.width,height:r.height};
        })};
    });
    expect(geom.scrollHeight,width+"x"+height+" must have no document scroll")
      .toBeLessThanOrEqual(height+2);
    for(const r of geom.visible){
      expect(r.width,width+"x"+height+" "+r.selector+" readable width").toBeGreaterThan(0);
      expect(r.height,width+"x"+height+" "+r.selector+" readable height").toBeGreaterThan(0);
      expect(r.top,width+"x"+height+" "+r.selector+" no top clipping").toBeGreaterThanOrEqual(-2);
      expect(r.bottom,width+"x"+height+" "+r.selector+" no bottom clipping")
        .toBeLessThanOrEqual(height+2);
      expect(r.left,width+"x"+height+" "+r.selector+" no left clipping").toBeGreaterThanOrEqual(-2);
      expect(r.right,width+"x"+height+" "+r.selector+" no right clipping")
        .toBeLessThanOrEqual(width+2);
    }
  }

  await page.setViewportSize({width:844,height:390});
  await page.locator(".mj-hand button").first().click();
  await expect(page.locator(".mj-hand button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.getByRole("button",{name:/打出所选牌/})).toBeEnabled();
  await page.screenshot({path:"test-results/v2-screenshots/reduced-motion-844x390.png",fullPage:false});
});
