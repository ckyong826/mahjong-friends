import {test,expect} from "@playwright/test";

/** Layout-only late-game stress. Authoritative rules are exercised elsewhere.
 * Inject physical-tile-shaped markup into the exposed-history dialog after
 * creating a real bot game; don't mutate live/server state to manufacture hands.
 */
test("Chi/Pong/Kong and flower trays never overflow the shared stage or details",async({page})=>{
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("textbox",{name:"你的昵称"}).fill("Meld Overflow QA");
  await page.getByRole("button",{name:/创建私人房间/}).click();
  await expect(page).toHaveURL(new RegExp("/room/[A-HJ-NP-Z2-9]{6}$"));
  await page.getByRole("button",{name:/补满练习机器人/}).click();
  await page.getByRole("button",{name:"我准备好了"}).click();
  await page.getByRole("button",{name:"四人准备后开局"}).click();
  await expect(page.locator(".mj-game")).toBeVisible();

  for(const [width,height] of [[1366,768],[844,390],[915,412],[390,844]]){
    await page.setViewportSize({width,height});
    const box=await page.evaluate(()=>{
      const board=document.querySelector(".mj-board")!.getBoundingClientRect();
      return [...document.querySelectorAll<HTMLElement>(".mj-public-tray")].map(tray=>{
        const tr=tray.getBoundingClientRect();
        const button=tray.querySelector<HTMLButtonElement>(".mj-public-open")!;
        const br=button.getBoundingClientRect();
        const parts=[...button.querySelectorAll<HTMLElement>(
          ".mj-public-summary-meld,.mj-public-summary-bonus,.mj-public-arrow"
        )].map(el=>{
          const r=el.getBoundingClientRect();
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};
        });
        return {rect:tr,button:br,parts,
          nestedScroll:tray.scrollWidth>tray.clientWidth+1||tray.scrollHeight>tray.clientHeight+1};
      }).map(({rect,button,parts,nestedScroll})=>({
        tray:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},
        button:{left:button.left,right:button.right,top:button.top,bottom:button.bottom},
        parts,nestedScroll,
        withinBoard:rect.left>=board.left-2&&rect.right<=board.right+2&&
          rect.top>=board.top-2&&rect.bottom<=board.bottom+2
      }));
    });
    const tag=width+"x"+height;
    expect(box,tag+" exactly four public meld/flower counters").toHaveLength(4);
    for(const seat of box){
      expect(seat.withinBoard,tag+" public tray inside board").toBe(true);
      expect(seat.nestedScroll,tag+" no nested scroll in public tray").toBe(false);
      expect(seat.button.left,tag+" open button begins inside tray").toBeGreaterThanOrEqual(seat.tray.left-2);
      expect(seat.button.right,tag+" open button ends inside tray").toBeLessThanOrEqual(seat.tray.right+2);
      expect(seat.button.top,tag+" open button top inside tray").toBeGreaterThanOrEqual(seat.tray.top-2);
      expect(seat.button.bottom,tag+" open button bottom inside tray").toBeLessThanOrEqual(seat.tray.bottom+2);
      expect(seat.parts,tag+" latest meld type, flowers and detail affordance").toHaveLength(3);
      for(const label of seat.parts){
        expect(label.left).toBeGreaterThanOrEqual(seat.button.left-2);
        expect(label.right).toBeLessThanOrEqual(seat.button.right+2);
        expect(label.top).toBeGreaterThanOrEqual(seat.button.top-2);
        expect(label.bottom).toBeLessThanOrEqual(seat.button.bottom+2);
      }
    }
  }

  await page.getByRole("button",{name:/查看 .* 全部公开组合与花牌/}).first().click();
  await expect(page.getByRole("dialog",{name:/全部公开组合/})).toBeVisible();
  // Geometry fixture: a whole Kong and several physical flowers in the same
  // paged detail view are the worst-case content under the 1-meld/3-bonus rule.
  await page.evaluate(()=>{
    const root=document.querySelector<HTMLElement>(".mj-history-public")!;
    const tile=(name:string)=>'<span role="img" aria-label="'+name+
      '" class="mj-tile mj-dots mj-tile-mini">'+name+'</span>';
    root.innerHTML='<div class="mj-showcases">'+
      '<div class="mj-bonus-group"><span class="mj-showcase-label">花牌 3</span>'+
      '<div class="mj-showcase-tiles">'+["春","夏","秋"].map(tile).join("")+'</div></div>'+
      '<div class="mj-meld-group"><span class="mj-showcase-label">明牌 1</span>'+
      '<div class="mj-showcase-melds"><div class="mj-meld" data-kind="kong">'+
      '<span class="mj-meld-name">杠</span><div class="mj-meld-tiles">'+
      ["一","一","一","一"].map(tile).join("")+'</div>'+
      '<span class="mj-meld-source">东位</span></div></div></div></div>';
  });
  for(const [width,height] of [[1366,768],[844,390],[915,412],[390,844]]){
    await page.setViewportSize({width,height});
    const measured=await page.evaluate(()=>{
      const dialog=document.querySelector(".mj-history-dialog")!.getBoundingClientRect();
      const content=document.querySelector(".mj-history-public")!.getBoundingClientRect();
      const parts=[...document.querySelectorAll<HTMLElement>(
        ".mj-history-public .mj-showcase-label,.mj-history-public .mj-tile,.mj-history-public .mj-meld"
      )].map(el=>{
        const r=el.getBoundingClientRect();
        return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};
      });
      const el=document.querySelector<HTMLElement>(".mj-history-public")!;
      return {dialog:{top:dialog.top,bottom:dialog.bottom,left:dialog.left,right:dialog.right},
        content:{top:content.top,bottom:content.bottom,left:content.left,right:content.right},
        parts,scrollX:el.scrollWidth>el.clientWidth+1,scrollY:el.scrollHeight>el.clientHeight+1};
    });
    const tag=width+"x"+height;
    expect(measured.dialog.top).toBeGreaterThanOrEqual(-2);
    expect(measured.dialog.bottom).toBeLessThanOrEqual(height+2);
    expect(measured.dialog.left).toBeGreaterThanOrEqual(-2);
    expect(measured.dialog.right).toBeLessThanOrEqual(width+2);
    expect(measured.scrollX,tag+" no public detail horizontal overflow").toBe(false);
    expect(measured.scrollY,tag+" no public detail vertical overflow").toBe(false);
    expect(measured.parts).toHaveLength(10);
    for(const p of measured.parts){
      expect(p.left,tag+" tile inside detail").toBeGreaterThanOrEqual(measured.content.left-2);
      expect(p.right,tag+" tile inside detail").toBeLessThanOrEqual(measured.content.right+2);
      expect(p.top,tag+" tile top inside detail").toBeGreaterThanOrEqual(measured.content.top-2);
      expect(p.bottom,tag+" tile bottom inside detail").toBeLessThanOrEqual(measured.content.bottom+2);
    }
    await page.screenshot({path:"test-results/v2-screenshots/exposed-"+tag+".png",fullPage:false});
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".mj-history-dialog")).toHaveCount(0);
  await expect(page.locator(".mj-public-open").first()).toBeFocused();
});
