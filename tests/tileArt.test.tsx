import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TileFaceArt, { tilePipLayout } from "../src/game/TileFaceArt";
import type { Rank, TileFace } from "../src/shared/tiles";
import { ANIMALS, FLOWERS, RANKS, SUITS, WINDS, DRAGONS } from "../src/game/deck";

const html=(face:TileFace)=>renderToStaticMarkup(<TileFaceArt face={face}/>);
describe("semantically correct original v2 tile visual assets",()=>{
  it("has exactly N dots or N bamboo stalks for ranks one to nine",()=>{
    for(const rank of RANKS) {
      expect(tilePipLayout(rank)).toHaveLength(rank);
      const circles=html({family:"suit",suit:"dots",rank});
      const bamboo=html({family:"suit",suit:"bamboo",rank});
      expect((circles.match(/<g>/g)??[])).toHaveLength(rank);
      expect((bamboo.match(/<g>/g)??[])).toHaveLength(rank);
      expect(circles).toContain('data-rank="'+rank+'"');
      expect(bamboo).toContain('data-rank="'+rank+'"');
    }
  });
  it("renders all 34 natural faces from typed keys",()=>{
    const faces:TileFace[]=[
      ...SUITS.flatMap(suit=>RANKS.map(rank=>({family:"suit" as const,suit,rank}))),
      ...WINDS.map(wind=>({family:"wind" as const,wind})),
      ...DRAGONS.map(dragon=>({family:"dragon" as const,dragon}))
    ];
    expect(faces).toHaveLength(34);
    for(const face of faces){
      const output=html(face);
      expect(output.length).toBeGreaterThan(35);
      expect(output).not.toContain("undefined");
    }
    expect(html({family:"suit",suit:"characters",rank:9})).toContain("九");
    expect(html({family:"suit",suit:"characters",rank:9})).toContain("萬");
  });
  it("keeps the blank Fei entirely blank, while white dragon is explicitly marked",()=>{
    const fei=html({family:"fei"});
    const white=html({family:"dragon",dragon:"white"});
    expect(fei).toContain('data-face="fei"');
    expect(fei).not.toMatch(/白|飛|飞|中|發/);
    expect(white).toContain('data-face="dragon-white"');
    expect(white).toContain("白");
    expect(white).not.toContain('data-face="fei"');
  });
  it("uses exactly the typed flowers/seasons and Singapore animal species",()=>{
    const expected=["貓","鼠","雞","蜈"];
    expect(ANIMALS).toHaveLength(4);
    ANIMALS.forEach((animal,index)=>{
      expect(html({family:"animal",animal})).toContain(expected[index]);
    });
    expect(FLOWERS).toHaveLength(8);
    for(const flower of FLOWERS){
      const art=html({family:"flower",flower});
      expect(art).toContain('data-face="flower"');
      expect(art).not.toContain("undefined");
    }
    for(const wrong of ["熊","鶴","魚","虎"]) {
      expect(ANIMALS.map(animal=>html({family:"animal",animal})).join("")).not.toContain(wrong);
    }
  });
  it("character suit renders Chinese numeral and 萬 for each rank",()=>{
    for(const rank of RANKS){
      const art=html({family:"suit",suit:"characters",rank:rank as Rank});
      expect(art).toContain('data-rank="'+rank+'"');
      expect(art).toContain("萬");
    }
  });
});
