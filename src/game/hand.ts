import type { Tile, TileFace } from "../shared/tiles";

const faceIndex = (face: TileFace): number => {
  if (face.family === "suit") {
    const offset = face.suit === "characters" ? 0 : face.suit === "dots" ? 9 : 18;
    return offset + face.rank - 1;
  }
  if (face.family === "wind") return 27 + ["east", "south", "west", "north"].indexOf(face.wind);
  if (face.family === "dragon") return 31 + ["red", "green", "white"].indexOf(face.dragon);
  throw new Error("Flower, animal or Fei has no natural face index");
};

export function sameNaturalFace(a: Tile, b: Tile): boolean {
  if (a.face.family === "fei" || b.face.family === "fei") return false;
  if (a.face.family === "flower" || a.face.family === "animal") return false;
  if (b.face.family === "flower" || b.face.family === "animal") return false;
  return faceIndex(a.face) === faceIndex(b.face);
}

/** Fei substitutes any standard tile in a concealed hand.
 * This is structural validation only: fan calculation, seven pairs and
 * regional Fei restrictions are separate rules-profile work (Issue #7).
 */
export function isStandardWinningHand(
  tiles: readonly Tile[],
  openMeldCount = 0,
  allowFei = true
): boolean {
  if (!Number.isInteger(openMeldCount) || openMeldCount < 0 || openMeldCount > 4) return false;
  const meldCount = 4 - openMeldCount;
  if (tiles.length !== meldCount * 3 + 2) return false;
  const counts = Array<number>(34).fill(0);
  let jokers = 0;
  for (const tile of tiles) {
    if (tile.face.family === "fei") {
      if (!allowFei) return false;
      jokers++;
    } else if (tile.face.family === "flower" || tile.face.family === "animal") {
      return false;
    } else {
      counts[faceIndex(tile.face)]++;
    }
  }
  const memo = new Map<string, boolean>();
  const canMakeMelds = (remaining: number, wilds: number): boolean => {
    if (remaining === 0) return counts.every((c) => c === 0) && wilds === 0;
    const key = remaining + ":" + wilds + ":" + counts.join(",");
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const first = counts.findIndex((n) => n > 0);
    if (first < 0) return wilds === remaining * 3;
    // Triplets must contain the earliest natural tile, plus possible Fei.
    for (let take = 1; take <= Math.min(3, counts[first]); take++) {
      const needed = 3 - take;
      if (needed > wilds) continue;
      counts[first] -= take;
      if (canMakeMelds(remaining - 1, wilds - needed)) {
        counts[first] += take;
        memo.set(key, true);
        return true;
      }
      counts[first] += take;
    }
    // A wildcard can complete a sequence whose start precedes the earliest tile.
    if (first < 27) {
      const suitOffset = Math.floor(first / 9) * 9;
      const rank = first - suitOffset;
      for (let start = Math.max(0, rank - 2); start <= Math.min(6, rank); start++) {
        const indices = [suitOffset + start, suitOffset + start + 1, suitOffset + start + 2];
        // First natural tile must be consumed. Other positions can be natural or Fei.
        const search = (at: number, left: number): boolean => {
          if (at === 3) return canMakeMelds(remaining - 1, left);
          const index = indices[at];
          if (counts[index] > 0) {
            counts[index]--;
            const result = search(at + 1, left);
            counts[index]++;
            if (result) return true;
          }
          if (index !== first && left > 0) return search(at + 1, left - 1);
          return false;
        };
        if (search(0, wilds)) {
          memo.set(key, true);
          return true;
        }
      }
    }
    memo.set(key, false);
    return false;
  };
  // Try a natural pair, a mixed natural/Fei pair or an all-Fei pair.
  for (let i = 0; i < counts.length; i++) {
    for (const take of [2, 1]) {
      const spend = 2 - take;
      if (counts[i] < take || spend > jokers) continue;
      counts[i] -= take;
      const valid = canMakeMelds(meldCount, jokers - spend);
      counts[i] += take;
      if (valid) return true;
    }
  }
  return jokers >= 2 && canMakeMelds(meldCount, jokers - 2);
}

/** Only next player can chow; Fei is disallowed in an open meld until rules are finalized. */
export function isLegalChow(discarded: Tile, chosen: readonly Tile[]): boolean {
  if (chosen.length !== 2 || chosen[0].id === chosen[1].id) return false;
  const all = [discarded, ...chosen];
  if (!all.every((t) => t.face.family === "suit")) return false;
  const suits = all.map((t) => t.face.family === "suit" ? t.face.suit : "");
  if (new Set(suits).size !== 1) return false;
  const ranks = all.map((t) => t.face.family === "suit" ? t.face.rank : 0).sort((a, b) => a - b);
  return ranks[0] + 1 === ranks[1] && ranks[1] + 1 === ranks[2];
}

/** Returns concrete tile IDs, never client-supplied arbitrary tile substitutions. */
export function availableChows(hand: readonly Tile[], discarded: Tile): string[][] {
  const choices: string[][] = [];
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      if (isLegalChow(discarded, [hand[i], hand[j]])) choices.push([hand[i].id, hand[j].id]);
    }
  }
  return choices;
}
