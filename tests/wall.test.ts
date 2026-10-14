import { describe, expect, it } from "vitest";
import { drawWithBonusReplacement, reserveReplacementWall } from "../src/game/wall";
import type { Tile } from "../src/shared/tiles";

const tile = (id:string,face:Tile["face"]):Tile => ({id,face});
const c = tile("c",{family:"suit",suit:"characters",rank:5});
const spring = tile("spring",{family:"flower",flower:"spring"});
const cat = tile("cat",{family:"animal",animal:"cat"});
const white = tile("white",{family:"dragon",dragon:"white"});
const fei = tile("fei",{family:"fei"});

describe("live and replacement wall",()=>{
  it("reserves only the requested number of tiles",()=>{
    const wall=reserveReplacementWall([c,spring,cat,white,fei],2);
    expect(wall.live.map(t=>t.id)).toEqual(["c","spring","cat"]);
    expect(wall.replacement.map(t=>t.id)).toEqual(["white","fei"]);
    expect(()=>reserveReplacementWall([c],2)).toThrow(RangeError);
  });
  it("reveals bonuses consecutively until a playable tile appears",()=>{
    const wall={live:[c,spring],replacement:[white,cat]};
    const result=drawWithBonusReplacement(wall);
    expect(result.tile?.id).toBe("white");
    expect(result.revealedBonuses.map(t=>t.id)).toEqual(["spring","cat"]);
    expect(result.wall.live.map(t=>t.id)).toEqual(["c"]);
    expect(result.wall.replacement).toHaveLength(0);
    expect(result.exhausted).toBe(false);
    expect(wall.live).toHaveLength(2);
  });
  it("does not expose Fei or white dragon as a bonus",()=>{
    const first=drawWithBonusReplacement({live:[fei],replacement:[]});
    expect(first.tile?.id).toBe("fei");
    expect(first.revealedBonuses).toEqual([]);
    const second=drawWithBonusReplacement({live:[white],replacement:[]});
    expect(second.tile?.id).toBe("white");
    expect(second.revealedBonuses).toEqual([]);
  });
  it("retains consumed bonus tiles when replacement is exhausted",()=>{
    const wall={live:[c,spring],replacement:[cat]};
    const result=drawWithBonusReplacement(wall);
    expect(result.tile).toBeNull();
    expect(result.exhausted).toBe(true);
    expect(result.revealedBonuses.map(t=>t.id)).toEqual(["spring","cat"]);
    const accounting=[...result.wall.live,...result.wall.replacement,...result.revealedBonuses];
    expect(accounting.map(t=>t.id).sort()).toEqual([c,spring,cat].map(t=>t.id).sort());
  });
  it("allows explicit replacement draw for a kong",()=>{
    const result=drawWithBonusReplacement({live:[c],replacement:[fei]},"replacement");
    expect(result.tile?.id).toBe("fei");
    expect(result.wall.live).toHaveLength(1);
  });
});
