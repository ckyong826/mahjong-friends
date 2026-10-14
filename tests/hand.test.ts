import { describe, expect, it } from "vitest";
import { availableChows, isLegalChow, isStandardWinningHand } from "../src/game/hand";
import type { Tile, TileFace } from "../src/shared/tiles";

let nextId=0;
const t=(face:TileFace):Tile=>({id:String(nextId++),face});
const c=(rank:1|2|3|4|5|6|7|8|9)=>t({family:"suit",suit:"characters",rank});
const d=(rank:1|2|3|4|5|6|7|8|9)=>t({family:"suit",suit:"dots",rank});
const b=(rank:1|2|3|4|5|6|7|8|9)=>t({family:"suit",suit:"bamboo",rank});
const white=()=>t({family:"dragon",dragon:"white"});
const east=()=>t({family:"wind",wind:"east"});
const fei=()=>t({family:"fei"});
const flower=()=>t({family:"flower",flower:"spring"});
const complete=()=>[c(1),c(2),c(3),c(4),c(5),c(6),d(1),d(2),d(3),b(7),b(8),b(9),white(),white()];

describe("standard hand validator",()=>{
  it("validates ordinary four-melds and a pair",()=>{
    expect(isStandardWinningHand(complete())).toBe(true);
  });
  it("uses Fei for a missing sequence middle",()=>{
    const hand=complete();
    const index=hand.findIndex(x=>x.face.family==="suit"&&x.face.suit==="characters"&&x.face.rank===5);
    hand[index]=fei();
    expect(isStandardWinningHand(hand)).toBe(true);
    expect(isStandardWinningHand(hand,0,false)).toBe(false);
  });
  it("uses Fei to complete the pair",()=>{
    const hand=complete();hand[13]=fei();
    expect(isStandardWinningHand(hand)).toBe(true);
  });
  it("handles meld count for openly claimed groups",()=>{
    const concealed=[c(1),c(2),c(3),d(1),d(2),d(3),b(1),b(1)];
    expect(isStandardWinningHand(concealed,2)).toBe(true);
    expect(isStandardWinningHand(concealed,0)).toBe(false);
  });
  it("rejects invalid counts and exposed bonus tiles",()=>{
    expect(isStandardWinningHand(complete().slice(1))).toBe(false);
    const hand=complete();hand[0]=flower();
    expect(isStandardWinningHand(hand)).toBe(false);
    expect(isStandardWinningHand(complete(),5)).toBe(false);
  });
  it("rejects a non-winning shape with no wildcards",()=>{
    const hand=[c(1),c(1),c(1),d(1),d(1),d(1),b(1),b(1),b(1),east(),east(),white(),white(),c(9)];
    expect(isStandardWinningHand(hand)).toBe(false);
  });
  it("validates all-Fei pair when needed",()=>{
    const hand=complete();
    hand[12]=fei();hand[13]=fei();
    expect(isStandardWinningHand(hand)).toBe(true);
  });
});

describe("Chow claim validation",()=>{
  it("accepts the next player's consecutive tiles",()=>{
    const discard=c(2);
    const hand=[c(1),c(3),c(4),d(1)];
    expect(isLegalChow(discard,[hand[0],hand[1]])).toBe(true);
    expect(availableChows(hand,discard)).toEqual([[hand[0].id,hand[1].id],[hand[1].id,hand[2].id]]);
  });
  it("rejects different suits, Fei and non-consecutive ranks",()=>{
    expect(isLegalChow(c(2),[d(1),c(3)])).toBe(false);
    expect(isLegalChow(c(2),[fei(),c(3)])).toBe(false);
    expect(isLegalChow(c(2),[c(2),c(3)])).toBe(false);
    expect(isLegalChow(c(2),[c(1),c(1)])).toBe(false);
  });
});
