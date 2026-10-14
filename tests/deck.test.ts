import { describe, expect, it } from "vitest";
import { createDeck, shuffleDeck, secureRandomIndex } from "../src/game/deck";

describe("physical Mahjong deck", () => {
  it("has 136 base tiles, or 144/148/152 with bonuses and Fei", () => {
    expect(createDeck({ includeFlowers: false })).toHaveLength(136);
    expect(createDeck()).toHaveLength(144);
    expect(createDeck({ includeAnimals: true })).toHaveLength(148);
    expect(createDeck({ includeAnimals: true, feiCount: 4 })).toHaveLength(152);
  });
  it("assigns unique ids and exact face multiplicities", () => {
    const deck = createDeck({ includeAnimals: true, feiCount: 4 });
    expect(new Set(deck.map(tile => tile.id)).size).toBe(deck.length);
    expect(deck.filter(tile => tile.face.family === "fei")).toHaveLength(4);
    expect(deck.filter(tile => tile.face.family === "flower")).toHaveLength(8);
    expect(deck.filter(tile => tile.face.family === "animal")).toHaveLength(4);
    expect(deck.filter(tile => tile.face.family === "dragon" && tile.face.dragon === "white")).toHaveLength(4);
    expect(deck.filter(tile => tile.face.family === "suit" && tile.face.suit === "bamboo" && tile.face.rank === 9)).toHaveLength(4);
  });
  it("rejects invalid Fei counts", () => {
    for (const count of [-1,4.5,5,NaN]) expect(() => createDeck({feiCount:count})).toThrow(RangeError);
  });
  it("shuffles a copy while preserving every physical tile exactly once", () => {
    const deck = createDeck({feiCount:4});
    const shuffled = shuffleDeck(deck,()=>0);
    expect(shuffled).not.toBe(deck);
    expect(shuffled.map(t=>t.id).sort()).toEqual(deck.map(t=>t.id).sort());
    expect(deck[0].id).toBe("000");
    expect(shuffled.map(t=>t.id)).not.toEqual(deck.map(t=>t.id));
  });
  it("rejects a buggy index generator", () => {
    expect(() => shuffleDeck([1,2,3],()=>999)).toThrow(RangeError);
    expect(() => secureRandomIndex(0)).toThrow(RangeError);
  });
});
