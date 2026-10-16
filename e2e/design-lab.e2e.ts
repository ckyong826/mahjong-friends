import {expect,test} from "@playwright/test";

test("v2 concept gallery has 10 selectable layouts and no clipped primary controls",async({page})=>{
  test.setTimeout(120_000);
  await page.goto("/mahjong-design-lab.html");
  await expect(page.locator(".concept")).toHaveCount(10);
  await expect(page.locator(".screen .seat")).toHaveCount(4);
  await expect(page.locator(".screen .my-tile")).toHaveCount(14);
  await expect(page.getByText(/static simulation/)).toBeVisible();

  for(const [device,width,height] of [
    ["desktop",1100,620],["landscape",844,390],["portrait",390,844]
  ] as const){
    await page.locator('.device-row [data-device="'+device+'"]').click();
    await expect(page.locator(".screen")).toHaveAttribute("data-device",device);
    const seenGrids=new Set<string>();
    for(let id=1;id<=10;id++){
      await page.locator('.concept[data-concept="'+(id-1)+'"]').click();
      await expect(page.locator(".screen")).toHaveAttribute("data-id",String(id).padStart(2,"0"));
      const geometry=await page.evaluate(()=>{
        const screen=document.querySelector(".screen")!;
        const stage=document.querySelector(".stage")!;
        const gameTable=screen.querySelector(".game-table")!;
        const tabletop=gameTable.getBoundingClientRect();
        const grid=getComputedStyle(gameTable);
        const seatRects=Array.from(gameTable.querySelectorAll(".seat,.center")).map(el=>{
          const r=el.getBoundingClientRect();return {name:el.className,left:r.left,right:r.right,top:r.top,bottom:r.bottom};
        });
        const innerPanels=Array.from(gameTable.querySelectorAll(".seat")).map(seat=>{
          const items=Array.from(seat.querySelectorAll(".mini-tile"));
          const meld=seat.querySelector(".meld")!;
          const link=seat.querySelector("[data-river]")!;
          const seatRect=seat.getBoundingClientRect(),meldRect=meld.getBoundingClientRect(),linkRect=link.getBoundingClientRect();
          return {name:seat.className,items:items.length,linkLabel:link.textContent,
            meldVisible:getComputedStyle(meld).display!=="none",
            meldContained:meldRect.left>=seatRect.left-2&&meldRect.right<=seatRect.right+2&&meldRect.bottom<=seatRect.bottom+2,
            linkContained:linkRect.bottom<=seatRect.bottom+2
          };
        });
        const outer=screen.getBoundingClientRect();
        const container=stage.getBoundingClientRect();
        const rects=Array.from(screen.querySelectorAll(".seat,.center,.hand-dock,.my-tile,.dock-actions,.action")).map(el=>{
          const r=el.getBoundingClientRect();
          return {cls:el.className,left:r.left,right:r.right,top:r.top,bottom:r.bottom};
        });
        const overflow=Array.from(screen.querySelectorAll(".seat,.hand-dock")).map(el=>({
          name:el.className,height:el.clientHeight,contentHeight:el.scrollHeight,
          width:el.clientWidth,contentWidth:el.scrollWidth
        }));
        return {layout:grid.gridTemplateAreas,tabletop:{left:tabletop.left,right:tabletop.right,top:tabletop.top,bottom:tabletop.bottom},seatRects,innerPanels,
          outer:{left:outer.left,right:outer.right,top:outer.top,bottom:outer.bottom},
          container:{left:container.left,right:container.right,top:container.top,bottom:container.bottom},
          rects,overflow,screenScrollHeight:screen.scrollHeight,screenClientHeight:screen.clientHeight,
          screenScrollWidth:screen.scrollWidth,screenClientWidth:screen.clientWidth};
      });
      const key=device+" / concept "+id;
      seenGrids.add(geometry.layout);
      expect(geometry.innerPanels,key+" four seats").toHaveLength(4);
      expect(geometry.seatRects,key+" five independent regions").toHaveLength(5);
      for(const panel of geometry.innerPanels){
        expect(panel.items,key+" "+panel.name+" recent discards").toBeGreaterThanOrEqual(6);
        expect(panel.linkLabel,key+" full-history entry").toContain("查看全部");
        expect(panel.meldVisible,key+" claimed meld summary not hidden").toBe(true);
        expect(panel.meldContained,key+" meld not eaten by river").toBe(true);
        expect(panel.linkContained,key+" full-history link not clipped").toBe(true);
      }
      for(let a=0;a<geometry.seatRects.length;a++){
        const r=geometry.seatRects[a];
        expect(r.left,key+" "+r.name+" inside tabletop").toBeGreaterThanOrEqual(geometry.tabletop.left-2);
        expect(r.right,key+" "+r.name+" inside tabletop").toBeLessThanOrEqual(geometry.tabletop.right+2);
        expect(r.top,key+" "+r.name+" inside tabletop").toBeGreaterThanOrEqual(geometry.tabletop.top-2);
        expect(r.bottom,key+" "+r.name+" inside tabletop").toBeLessThanOrEqual(geometry.tabletop.bottom+2);
        for(let b=a+1;b<geometry.seatRects.length;b++){
          const q=geometry.seatRects[b];
          const overlapW=Math.min(r.right,q.right)-Math.max(r.left,q.left);
          const overlapH=Math.min(r.bottom,q.bottom)-Math.max(r.top,q.top);
          expect(overlapW*overlapH>0&&overlapW>1&&overlapH>1,key+" seat overlaps "+r.name+" / "+q.name).toBe(false);
        }
      }
      expect(geometry.outer.left,key+" left screen edge").toBeGreaterThanOrEqual(geometry.container.left-2);
      expect(geometry.outer.right,key+" right screen edge").toBeLessThanOrEqual(geometry.container.right+2);
      expect(geometry.outer.bottom,key+" bottom screen edge").toBeLessThanOrEqual(geometry.container.bottom+2);
      expect(geometry.screenScrollWidth,key+" no horizontal scroll inside scene")
        .toBeLessThanOrEqual(geometry.screenClientWidth+1);
      expect(geometry.screenScrollHeight,key+" no vertical scroll inside scene")
        .toBeLessThanOrEqual(geometry.screenClientHeight+1);
      for(const r of geometry.rects){
        expect(r.left,key+" "+r.cls+" left").toBeGreaterThanOrEqual(geometry.outer.left-2);
        expect(r.right,key+" "+r.cls+" right").toBeLessThanOrEqual(geometry.outer.right+2);
        expect(r.top,key+" "+r.cls+" top").toBeGreaterThanOrEqual(geometry.outer.top-2);
        expect(r.bottom,key+" "+r.cls+" bottom").toBeLessThanOrEqual(geometry.outer.bottom+2);
      }
      for(const el of geometry.overflow){
        expect(el.contentWidth,key+" "+el.name+" inner horizontal clipping")
          .toBeLessThanOrEqual(el.width+2);
        expect(el.contentHeight,key+" "+el.name+" inner vertical clipping")
          .toBeLessThanOrEqual(el.height+2);
      }
      if(id===1||id===3||id===7||id===10)
        await page.locator(".stage").screenshot({path:
          "test-results/v2-screenshots/concept-"+String(id).padStart(2,"0")+"-"+device+".png"});
    }
    expect(seenGrids.size,device+" must have ten DISTINCT spatial layouts, not ten color skins").toBe(10);
  }
  await page.locator('.device-row [data-device="landscape"]').click();
  await page.locator('.concept[data-concept="9"]').click();
  await page.locator('.screen [data-tile="0"]').click();
  await expect(page.locator('.screen [data-tile="0"]')).toHaveAttribute("aria-pressed","true");
  await page.locator(".screen [data-confirm]").click();
  await expect(page.locator(".screen .demo-toast")).toContainText("未连接服务器");
  await page.locator('.screen [data-river="0"]').click();
  await expect(page.getByRole("dialog",{name:/完整牌河/})).toBeVisible();
  await expect(page.getByRole("dialog").locator(".mini-tile")).toHaveCount(12);
  await page.getByRole("button",{name:"下一页"}).click();
  await expect(page.getByRole("dialog")).toContainText("2 / 2");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
