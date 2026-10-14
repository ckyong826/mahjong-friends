import { describe, expect, it } from "vitest";
import { isBonusTile, isFei, type TileFace } from "../src/shared/tiles";

describe("tile distinctions", () => {
  it("represents the blank Fei separately from white dragon", () => {
    const fei: TileFace = { family: "fei" };
    const whiteDragon: TileFace = { family: "dragon", dragon: "white" };
    expect(isFei(fei)).toBe(true);
    expect(isFei(whiteDragon)).toBe(false);
    expect(fei).not.toEqual(whiteDragon);
  });

  it("only marks flowers and animals as bonus tiles", () => {
    expect(isBonusTile({ family: "flower", flower: "spring" })).toBe(true);
    expect(isBonusTile({ family: "animal", animal: "cat" })).toBe(true);
    expect(isBonusTile({ family: "fei" })).toBe(false);
    expect(isBonusTile({ family: "suit", suit: "dots", rank: 1 })).toBe(false);
  });
});
