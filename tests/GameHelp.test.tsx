import {describe,it,expect} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import GameHelp from "../src/game/GameHelp";
import {gameSoundCues} from "../src/game/useGameAudio";
import type {PlayerGameView} from "../src/game/engine";

const tile=(id:string)=>({id,face:{family:"suit" as const,suit:"dots" as const,rank:2 as const}});
const sample=(version:number,last:string|null,kind?:"chi"|"pong"|"kong"):PlayerGameView=>({
  version,lastDiscard:last?{fromPlayerId:"a",tile:tile(last)}:null,
  players:[{
    id:"a",
    melds:kind?[{kind,tileCount:kind==="kong"?4:3,concealed:false,fromPlayerId:"b",
      tiles:[tile("c1"),tile("c2"),tile("c3"),...(kind==="kong"?[tile("c4")]:[])]}]:[],
    bonuses:[],discards:[],concealedCount:10
  }]
} as unknown as PlayerGameView);

describe("sound cues only for server-confirmed public changes",()=>{
  it("emits no click/voice on unrelated versions or identical public history",()=>{
    expect(gameSoundCues(sample(0,null),sample(1,null))).toEqual([]);
    expect(gameSoundCues(sample(1,"x"),sample(1,"y"))).toEqual([]);
    expect(gameSoundCues(sample(1,"x"),sample(2,"x"))).toEqual([]);
  });
  it("only a NEW accepted discard produces a tile sound cue",()=>{
    expect(gameSoundCues(sample(1,"old"),sample(2,"new")))
      .toEqual([{type:"discard",key:"discard:new"}]);
  });
  it("announces Chi/Pong/Kong from new public melds (not clicks)",()=>{
    for(const kind of ["chi","pong","kong"] as const){
      const cues=gameSoundCues(sample(2,null),sample(3,null,kind));
      expect(cues).toHaveLength(1);
      expect(cues[0].type).toBe(kind);
    }
  });
  it("does not replay unchanged meld and recognizes a confirmed added-Kong",()=>{
    expect(gameSoundCues(sample(2,null,"pong"),sample(3,null,"pong"))).toEqual([]);
    const cues=gameSoundCues(sample(3,null,"pong"),sample(4,null,"kong"));
    expect(cues).toHaveLength(1);
    expect(cues[0].type).toBe("kong");
  });
});
describe("help wording",()=>{
  it("shows real gameplay instructions, Practice v1 fan table, no unofficial scoring claim",()=>{
    const html=renderToStaticMarkup(<GameHelp onClose={()=>{}}/>);
    expect(html).toContain("麻将玩法与练习番数说明");
    expect(html).toContain("怎么玩");
    expect(html).toContain("练习算番");
    expect(html).toContain("花牌 / 动物");
    expect(html).toContain('role="dialog"');
    expect(html).not.toContain("官方结算");
  });
});
