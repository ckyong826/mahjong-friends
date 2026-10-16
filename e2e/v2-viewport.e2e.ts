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
    const board=geom.boxes.find(rect=>rect.selector===".mj-board")!;
    const controls=geom.boxes.find(rect=>rect.selector===".mj-controls")!;
    const center=geom.boxes.find(rect=>rect.selector===".mj-center")!;
    const hand=geom.boxes.find(rect=>rect.selector===".mj-hand")!;
    // A CSS grid can collapse the entire table to its 4px borders while
    // technically staying "visible" and non-scrolling. Catch that regression.
    expect(board.height,tag+" usable physical table height")
      .toBeGreaterThan(height<550?height*.34:height*.35);
    expect(center.height,tag+" readable center/turn indicator").toBeGreaterThan(40);
    expect(board.bottom,tag+" board must come BEFORE bottom controls")
      .toBeLessThanOrEqual(controls.top+3);
    expect(hand.top,tag+" hand must stay in the BOTTOM quarter/third of scene")
      .toBeGreaterThan(height*.60);
    for(const rect of geom.handButtons) {
      expect(rect.left,tag+" hand tile left").toBeGreaterThanOrEqual(-2);
      expect(rect.right,tag+" hand tile right").toBeLessThanOrEqual(width+2);
      expect(rect.bottom,tag+" hand tile bottom").toBeLessThanOrEqual(height+2);
    }
    const stage=await page.evaluate(()=>{
      const host=document.querySelector(".mj-board")!.getBoundingClientRect();
      const selectors=[
        ".mj-seat-top .mj-discard-panel",
        ".mj-seat-left .mj-discard-panel",
        ".mj-center",
        ".mj-seat-right .mj-discard-panel",
        ".mj-seat-bottom .mj-discard-panel"
      ];
      return selectors.map(selector=>{
        const node=document.querySelector(selector)!;
        const r=node.getBoundingClientRect();
        const style=getComputedStyle(node);
        return {selector,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
          width:r.width,height:r.height,hiddenScroll:style.overflowY==="hidden",
          withinBoard:r.left>=host.left-2&&r.right<=host.right+2&&
            r.top>=host.top-2&&r.bottom<=host.bottom+2};
      });
    });
    expect(stage,tag+" all 4 rivers and center must have a fixed cell").toHaveLength(5);
    for(const cell of stage){
      expect(cell.withinBoard,tag+" "+cell.selector+" stays inside tabletop").toBe(true);
      expect(cell.width,tag+" "+cell.selector+" has width").toBeGreaterThan(15);
      expect(cell.height,tag+" "+cell.selector+" has height").toBeGreaterThan(10);
      if(cell.selector.includes("discard"))expect(cell.hiddenScroll,tag+" no nested river scrolling").toBe(true);
    }
    for(let i=0;i<stage.length;i++)for(let j=i+1;j<stage.length;j++){
      const a=stage[i],b=stage[j];
      const overlapX=Math.min(a.right,b.right)-Math.max(a.left,b.left);
      const overlapY=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
      expect(overlapX<=2||overlapY<=2,tag+" distinct river/center cells must not overlap").toBe(true);
    }
    await page.screenshot({path:"test-results/v2-screenshots/"+tag+".png",fullPage:false});
  }
  // Keep the actual one-tile select & confirmation path after viewport reflow.
  await page.setViewportSize({width:844,height:390});
  await page.getByRole("button",{name:/查看 .* 全部弃牌/}).first().click();
  await expect(page.getByRole("dialog",{name:/完整弃牌记录/})).toBeVisible();
  await page.getByRole("button",{name:"关闭"}).click();
  await expect(page.locator(".mj-history-dialog")).toHaveCount(0);
  await page.locator(".mj-hand button").first().click();
  await expect(page.locator(".mj-hand button[aria-pressed='true']")).toHaveCount(1);
  await page.getByRole("button",{name:/打出所选牌/}).click();
  await expect.poll(async()=>page.locator(".mj-river .mj-tile").count()).toBeGreaterThan(0);
});
