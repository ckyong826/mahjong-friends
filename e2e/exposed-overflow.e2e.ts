import {test,expect} from "@playwright/test";

/** Full four-seat, 4-meld + 8-flower visual stress across real viewports.
 * The actual physical tiles are asserted via the JSX render unit tests.
 * Here we stress the browser's ResizeObserver-based auto-fit engine with the
 * same nested markup and ensure no in-board tile is clipped.
 */
test("physical Chi/Pong/Kong and flowers fit directly on all four seats",async({page})=>{
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("textbox",{name:"你的昵称"}).fill("Tile Fit Tester");
  await page.getByRole("button",{name:/创建私人房间/}).click();
  await expect(page).toHaveURL(new RegExp("/room/[A-HJ-NP-Z2-9]{6}$"));
  await page.getByRole("button",{name:/补满练习机器人/}).click();
  await page.getByRole("button",{name:"我准备好了"}).click();
  await page.getByRole("button",{name:"四人准备后开局"}).click();
  await expect(page.locator(".mj-game")).toBeVisible();
  await expect(page.locator(".mj-public-stage")).toHaveCount(4);

  // Exercise fit at multiple real panel aspect ratios with a representative
  // maximum exposed tile load. This modifies browser-local markup only,
  // NEVER the server's authoritative game or any player's hidden hand.
  await page.evaluate(()=>{
    for(const stage of document.querySelectorAll<HTMLElement>(".mj-public-stage")){
      const body=stage.querySelector<HTMLElement>(".mj-public-fit")!;
      const tile=(label:string)=>'<span class="mj-tile mj-dots mj-tile-mini" role="img" aria-label="'+label+
        '"><span class="mj-semantic-face">'+label+'</span></span>';
      const bonuses=Array.from({length:8},(_,i)=>tile("花"+(i+1))).join("");
      const kinds=["chi","pong","kong","chi"];
      const melds=kinds.map((kind,i)=>'<div class="mj-meld" data-kind="'+kind+'">'+
        '<span class="mj-meld-name">'+({chi:"吃",pong:"碰",kong:"杠"} as Record<string,string>)[kind]+'</span>'+
        '<div class="mj-meld-tiles">'+Array.from({length:kind==="kong"?4:3},(_,n)=>
          tile("第"+(i+1)+"组"+(n+1)+"牌")).join("")+'</div></div>').join("");
      body.innerHTML='<div class="mj-showcases">'+
        '<div class="mj-bonus-group"><span class="mj-showcase-label">花牌 8</span>'+
        '<div class="mj-showcase-tiles">'+bonuses+'</div></div>'+
        '<div class="mj-meld-group"><span class="mj-showcase-label">明牌 4</span>'+
        '<div class="mj-showcase-melds">'+melds+'</div></div></div>';
    }
  });
  // Each viewport resize notifies the fit engine via ResizeObserver.
  for(const [width,height] of [[1366,768],[1440,900],[844,390],[915,412],[390,844]]){
    await page.setViewportSize({width,height});
    await page.waitForTimeout(125);
    const seats=await page.evaluate(()=>{
      const board=document.querySelector(".mj-board")!.getBoundingClientRect();
      return [...document.querySelectorAll<HTMLElement>(".mj-public-stage")].map(stage=>{
        const r=stage.getBoundingClientRect();
        const fit=stage.querySelector<HTMLElement>(".mj-public-fit")!;
        const scaled=parseFloat(stage.dataset.fitScale??"0");
        const tiles=[...stage.querySelectorAll<HTMLElement>(".mj-tile")].map(tile=>{
          const rect=tile.getBoundingClientRect();
          return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
            width:rect.width,height:rect.height};
        });
        const kinds=[...stage.querySelectorAll<HTMLElement>(".mj-meld")].map(x=>x.dataset.kind);
        return {scale:scaled,
          stage:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},
          tiles,kinds,flowers:stage.querySelectorAll(".mj-bonus-group .mj-tile").length,
          fitting:fit.getBoundingClientRect().width<=r.width+2,
          board:{left:board.left,right:board.right,top:board.top,bottom:board.bottom}};
      });
    });
    const tag=width+"x"+height;
    expect(seats,tag+" four fitted public areas").toHaveLength(4);
    for(const seat of seats){
      expect(seat.scale,tag+" a positive auto-fit scale").toBeGreaterThan(0);
      expect(seat.scale,tag+" fit scale never enlarges physical tiles").toBeLessThanOrEqual(1);
      expect(seat.fitting,tag+" stage fits within own cell").toBe(true);
      expect(seat.flowers,tag+" eight visible flowers").toBe(8);
      expect(seat.kinds,tag+" all physical exposed groups").toEqual(["chi","pong","kong","chi"]);
      expect(seat.tiles,tag+" all physical tiles present without opening details").toHaveLength(21);
      for(const tile of seat.tiles){
        expect(tile.left,tag+" exposed tile not clipped horizontally").toBeGreaterThanOrEqual(seat.stage.left-2);
        expect(tile.right,tag+" exposed tile not clipped horizontally").toBeLessThanOrEqual(seat.stage.right+2);
        expect(tile.top,tag+" exposed tile not clipped vertically").toBeGreaterThanOrEqual(seat.stage.top-2);
        expect(tile.bottom,tag+" exposed tile not clipped vertically").toBeLessThanOrEqual(seat.stage.bottom+2);
      }
      expect(seat.stage.left).toBeGreaterThanOrEqual(seat.board.left-2);
      expect(seat.stage.right).toBeLessThanOrEqual(seat.board.right+2);
    }
    await page.screenshot({path:"test-results/v2-screenshots/autofit-"+tag+".png",fullPage:false});
  }
});
