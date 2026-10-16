import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MahjongTable from "../src/MahjongTable";
import type { PlayerGameView } from "../src/game/engine";
import type { RoomPublicView } from "../src/shared/room";
import type { Tile } from "../src/shared/tiles";

const f=(id:string,face:Tile["face"]):Tile=>({id,face});
const fei=f("fei-visible",{family:"fei"});
const white=f("white-visible",{family:"dragon",dragon:"white"});
const discard=f("discard-p0",{family:"suit",suit:"characters",rank:2});
const room:RoomPublicView={
  code:"ABCDEF",ownerId:"p0",rules:{
    variant:"singapore-four-player",seats:4,includeAnimals:true,feiCount:4,minimumFan:1
  },
  state:"playing",
  players:["east","south","west","north"].map((seat,i)=>({
    id:"p"+i,nickname:["阿明","小美","阿豪","阿文"][i],
    seat:seat as "east"|"south"|"west"|"north",connected:true,ready:true
  }))
};
const game:PlayerGameView={
  version:3,phase:"discard",currentPlayerId:"p0",dealerId:"p0",
  players:[
    {id:"p0",concealedCount:2,hand:[fei,white],bonuses:[],discards:[discard],melds:[]},
    {id:"p1",concealedCount:13,bonuses:[],discards:[f("b1",{family:"wind",wind:"east"})],melds:[]},
    {id:"p2",concealedCount:13,bonuses:[],discards:[f("c1",{family:"dragon",dragon:"red"})],melds:[]},
    {id:"p3",concealedCount:13,bonuses:[],discards:[f("d1",{family:"suit",suit:"dots",rank:3})],melds:[]}
  ],
  liveWallCount:78,replacementWallCount:12,pendingDiscard:null,lastDiscard:{fromPlayerId:"p0",tile:discard},
  myAvailableClaims:null,alreadyResponded:false,canSelfWin:false,outcome:null
};
const draw=(g:PlayerGameView=game,id="p0")=>renderToStaticMarkup(
  <MahjongTable game={g} room={room} viewerId={id} connection="connected"
    pending={false} onAction={()=>{}} onCopyInvite={()=>{}}/>
);
describe("rendered Mahjong tabletop",()=>{
  it("renders exactly four seat-tied rivers, not a mixed common pile",()=>{
    const html=draw();
    for(const name of ["阿明","小美","阿豪","阿文"]) {
      expect(html).toContain(name+" 的弃牌区");
    }
    expect((html.match(/class="mj-river"/g)??[])).toHaveLength(4);
    expect(html).toContain('mj-tile-latest');
    expect(html).toContain("打出所选牌");
  });
  it("prints white dragon but leaves Fei glyph blank and accessible",()=>{
    const html=draw();
    expect(html).toContain("mj-fei");
    expect(html).toContain("飞牌，空白万能牌");
    expect(html).toContain("mj-dragon-white");
    expect(html).toContain("白板");
  });
  it("renders only current player's concealed hand; opponents are face down",()=>{
    const html=draw();
    expect(html).toContain("未公开手牌 13 张");
    expect((html.match(/class="mj-concealed /g)??[])).toHaveLength(3);
    expect(html).not.toContain("secret-other-player-tile");
    expect((html.match(/class="mj-hand"/g)??[])).toHaveLength(1);
  });
  it("relocates claimed discard to claimant's meld when projection changes",()=>{
    const claimed:PlayerGameView={
      ...game,
      lastDiscard:null,
      players:game.players.map((p,i)=>i===0?{...p,discards:[]}:i===1?{
        ...p,melds:[{kind:"pong",tileCount:3,concealed:false,fromPlayerId:"p0",
          tiles:[discard,f("pong-1",{family:"suit",suit:"characters",rank:2}),
            f("pong-2",{family:"suit",suit:"characters",rank:2})]}]
      }:p)
    };
    const html=draw(claimed);
    expect(html).not.toContain("mj-tile-latest");
    expect(html).toContain("吃碰杠");
    expect(html).toContain("碰");
    expect(html).toContain("暂无弃牌");
  });
  it("renders a guarded claim prompt only when server offers it",()=>{
    const fake:PlayerGameView={
      ...game,phase:"claims",pendingDiscard:{fromPlayerId:"p1",tile:discard},
      myAvailableClaims:{canWin:false,canPong:true,canKong:false,chiTileIds:[]}
    };
    const html=draw(fake);
    expect(html).toContain("你可以");
    expect(html).toContain(">碰</button>");
    expect(html).toContain(">过</button>");
    expect(html).not.toContain("自摸胡牌");
  });
  it("shows recent chronological rivers while preserving full history access",()=>{
    const expanded:PlayerGameView={
      ...game,
      players:game.players.map((player,i)=>({
        ...player,
        discards:Array.from({length:25},(_,n)=>f("history-"+i+"-"+n,{
          family:"suit",suit:"dots",rank:(n%9+1) as 1|2|3|4|5|6|7|8|9
        }))
      })),
      lastDiscard:null
    };
    const html=draw(expanded);
    expect(html).toContain("mj-central-discard-stage");
    expect((html.match(/class="mj-river-line"/g)??[])).toHaveLength(8);
    expect(html).toContain("较早 +18");
    expect((html.match(/全部弃牌/g)??[])).toHaveLength(4);
    expect((html.match(/mj-public-open/g)??[])).toHaveLength(4);
    expect(html).not.toContain("mj-history-dialog");
  });

});
