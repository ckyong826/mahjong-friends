import { describe, expect, it } from "vitest";
import { scoreRound } from "../src/game/scoring";
import { startRound } from "../src/game/engine";
import type { GameState } from "../src/game/engine";
import type { Tile } from "../src/shared/tiles";
import {
  joinRoom, newRoom, readyRoom, settleRoom, startRoom
} from "../worker/roomCore";

const ids=["a","b","c","d"];
let serial=0;
const tile=(face:Tile["face"]):Tile=>({id:"test-"+serial++,face});
const m=(n:1|2|3|4|5|6|7|8|9)=>tile({family:"suit",suit:"characters",rank:n});
const p=(n:1|2|3|4|5|6|7|8|9)=>tile({family:"suit",suit:"dots",rank:n});
const s=(n:1|2|3|4|5|6|7|8|9)=>tile({family:"suit",suit:"bamboo",rank:n});
const white=()=>tile({family:"dragon",dragon:"white"});
const fei=()=>tile({family:"fei"});
const flower=()=>tile({family:"flower",flower:"spring"});
const animal=()=>tile({family:"animal",animal:"cat"});
const winHand=()=>[m(1),m(2),m(3),m(4),m(5),m(6),p(1),p(2),p(3),s(7),s(8),s(9),white(),white()];
const fixture=():GameState=>{
  const round=startRound({playerIds:ids,deckOptions:{includeFlowers:false},randomIndex:()=>0});
  round.players[0].hand=winHand();round.players[0].bonuses=[];
  return round;
};

describe("transparent test-points scoring",()=>{
  it("draw round changes no one's cumulative points",()=>{
    const game=fixture();
    game.phase="ended";game.outcome={type:"draw"};
    const s=scoreRound(game,3,{a:8,b:-3,c:-3,d:-2});
    expect(s.mode).toBe("practice-v1");
    expect(s.fan).toBe(0);
    expect(s.delta).toEqual({a:0,b:0,c:0,d:0});
    expect(s.totals).toEqual({a:8,b:-3,c:-3,d:-2});
  });
  it("self draw charges all three opponents equally with flower and animal breakdown",()=>{
    const game=fixture();
    game.players[0].bonuses=[flower(),animal()];
    game.phase="ended";game.outcome={type:"win",winnerId:"a",selfDraw:true};
    const scored=scoreRound(game,1);
    expect(scored.fan).toBe(4); // base 1 + self draw 1 + 2 bonuses
    expect(scored.lines.map(x=>x.name)).toContain("花牌及动物牌");
    expect(scored.delta).toEqual({a:12,b:-4,c:-4,d:-4});
    expect(Object.values(scored.delta).reduce((x,y)=>x+y,0)).toBe(0);
  });
  it("discard win charges discarder only while preserving zero-sum scores",()=>{
    const game=fixture();
    const last=game.players[0].hand.pop()!;
    game.players[1].discards.push(last);
    game.phase="ended";game.outcome={type:"win",winnerId:"a",fromPlayerId:"b",selfDraw:false};
    const scored=scoreRound(game,2);
    expect(scored.fan).toBe(1);
    expect(scored.delta).toEqual({a:3,b:-3,c:0,d:0});
    expect(scored.payerId).toBe("b");
  });
  it("does not award made-up extra fans for a blank Fei Joker",()=>{
    const game=fixture();
    game.players[0].hand[0]=fei();
    game.phase="ended";game.outcome={type:"win",winnerId:"a",selfDraw:true};
    const scored=scoreRound(game,1);
    expect(scored.lines.find(x=>x.name==="飞牌")?.fan).toBe(0);
    expect(scored.lines.find(x=>x.name==="飞牌")?.detail).toContain("不自动增加番数");
  });
  it("rejects scoring an unfinished game or invalid winner",()=>{
    const game=fixture();
    expect(()=>scoreRound(game,1)).toThrow();
    game.phase="ended";game.outcome={type:"win",winnerId:"intruder",selfDraw:true};
    expect(()=>scoreRound(game,1)).toThrow();
  });
});
const room=()=>{
  let r=newRoom("ABCDEF","a","hash-a","A",1000);
  for(const [i,id] of ids.slice(1).entries()) {
    r=joinRoom(r,id,"hash-"+id,id,1001+i);
  }
  return r;
};
const allReady=<T extends ReturnType<typeof room>>(r:T)=>{
  let ready=r;
  for(const id of ids)ready=readyRoom(ready,id,true) as T;
  return ready;
};
describe("multi-round scoreboard lifecycle",()=>{
  it("starts round one and rotates the dealer clockwise on the next hand",()=>{
    const started=startRoom(allReady(room()),"a");
    expect(started.roundNumber).toBe(1);
    expect(started.game?.dealerIndex).toBe(0);
    expect(started.scores).toEqual({a:0,b:0,c:0,d:0});
    const ended={...started,game:{...started.game!,phase:"ended" as const,outcome:{type:"draw" as const}}};
    const settled=settleRoom(ended);
    expect(settled.state).toBe("settlement");
    expect(settled.members.every(p=>!p.ready)).toBe(true);
    expect(settleRoom(settled)).toBe(settled); // cannot double count
    expect(()=>startRoom(settled,"a")).toThrow();
    const next=startRoom(allReady(settled),"a");
    expect(next.roundNumber).toBe(2);
    expect(next.game?.dealerIndex).toBe(1);
    expect(next.lastSettlement).toBeNull();
    expect(next.scores).toEqual(settled.scores);
  });
  it("preserves zero-sum cumulative points between rounds",()=>{
    const started=startRoom(allReady(room()),"a");
    const winner=started.game!.players[0];
    const complete={...started.game!,phase:"ended" as const,outcome:{
      type:"win" as const,winnerId:winner.id,selfDraw:true as const
    }};
    const settled=settleRoom({...started,game:complete});
    expect(settled.lastSettlement?.mode).toBe("practice-v1");
    expect(Object.values(settled.scores).reduce((a,b)=>a+b,0)).toBe(0);
    const next=startRoom(allReady(settled),"a");
    expect(next.scores).toEqual(settled.scores);
  });
});
