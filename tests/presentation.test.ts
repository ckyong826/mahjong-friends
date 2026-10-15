import { describe, expect, it } from "vitest";
import { addedKongOptions, concealedKongOptions, matchingHandIds, seatPosition, sortedConcealedHand, tileAppearance } from "../src/game/presentation";
import type { Tile } from "../src/shared/tiles";

const tile=(id:string,face:Tile["face"]):Tile=>({id,face});
const man=(id:string,rank:1|2|3|4|5|6|7|8|9)=>tile(id,{family:"suit",suit:"characters",rank});
const dots=(id:string,rank:1|2|3|4|5|6|7|8|9)=>tile(id,{family:"suit",suit:"dots",rank});
const fei=tile("fei",{family:"fei"});
const white=tile("white",{family:"dragon",dragon:"white"});

describe("Mahjong table presentation",()=>{
  it("rotates table orientation so viewer is always at the bottom",()=>{
    expect(seatPosition("east","east")).toBe("bottom");
    expect(seatPosition("east","south")).toBe("right");
    expect(seatPosition("east","west")).toBe("top");
    expect(seatPosition("east","north")).toBe("left");
    expect(seatPosition("west","west")).toBe("bottom");
    expect(seatPosition("west","north")).toBe("right");
    expect(seatPosition("west","east")).toBe("top");
  });
  it("uses a visually blank Fei while white dragon prints 白",()=>{
    const blank=tileAppearance(fei),dragon=tileAppearance(white);
    expect(blank.glyph).toBe("");
    expect(blank.suit).toBe("");
    expect(blank.variant).toBe("fei");
    expect(blank.accessibleName).toContain("飞牌");
    expect(dragon.glyph).toBe("白");
    expect(dragon.variant).toBe("dragon-white");
  });
  it("shows all three normal suits and distinct dragon names",()=>{
    expect(tileAppearance(man("a",2))).toMatchObject({glyph:"二",suit:"萬"});
    expect(tileAppearance(dots("b",8))).toMatchObject({glyph:"八",suit:"筒"});
    expect(tileAppearance(tile("c",{family:"suit",suit:"bamboo",rank:3}))).toMatchObject({glyph:"三",suit:"索"});
  });
  it("sorts concealed tiles but leaves the source array unchanged",()=>{
    const initial=[fei,dots("8",2),man("2",9),white,man("1",1)];
    const sorted=sortedConcealedHand(initial);
    expect(sorted.map(t=>t.id)).toEqual(["1","2","8","white","fei"]);
    expect(initial[0].id).toBe("fei");
  });
  it("never offers wildcards as natural Pong or Kong tiles",()=>{
    const discarded=man("target",4);
    const hand=[man("a",4),man("b",4),man("c",4),fei];
    expect(matchingHandIds(hand,discarded,2)).toEqual(["a","b"]);
    expect(matchingHandIds(hand,discarded,3)).toEqual(["a","b","c"]);
    expect(concealedKongOptions(hand)).toEqual([]);
    expect(concealedKongOptions([fei,fei,fei,fei])).toEqual([]);
  });
  it("finds natural concealed Kong and valid added Kong upgrades",()=>{
    const four=[man("a",9),man("b",9),man("c",9),man("d",9)];
    expect(concealedKongOptions(four)).toEqual([["a","b","c","d"]]);
    const pong={kind:"pong" as const,concealed:false,fromPlayerId:"north",tileCount:3,
      tiles:[man("x",9),man("y",9),man("z",9)]};
    expect(addedKongOptions([man("added",9)], [pong])).toEqual([{meldIndex:0,tileId:"added"}]);
    expect(addedKongOptions([fei],[pong])).toEqual([]);
  });
});
