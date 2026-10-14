import { isBonusTile, type Tile } from "../shared/tiles";

/** The next draw is at the END of each immutable array. */
export interface TileWall {
  readonly live: readonly Tile[];
  readonly replacement: readonly Tile[];
}
export type DrawSource = "live" | "replacement";
export interface DrawResult {
  tile: Tile | null;
  revealedBonuses: readonly Tile[];
  wall: TileWall;
  exhausted: boolean;
}

/** Shuffle first, then reserve a variant-configurable dead wall. */
export function reserveReplacementWall(tiles: readonly Tile[], replacementCount: number): TileWall {
  if (!Number.isInteger(replacementCount) || replacementCount < 0 || replacementCount > tiles.length) {
    throw new RangeError("Invalid replacement wall size");
  }
  const boundary = tiles.length - replacementCount;
  return { live: tiles.slice(0,boundary), replacement: tiles.slice(boundary) };
}

function popTile(wall: TileWall, source: DrawSource): {tile: Tile | null; wall: TileWall} {
  if (source === "live") {
    if (wall.live.length === 0) return {tile:null,wall};
    return {tile:wall.live[wall.live.length-1],wall:{live:wall.live.slice(0,-1),replacement:wall.replacement}};
  }
  if (wall.replacement.length === 0) return {tile:null,wall};
  return {tile:wall.replacement[wall.replacement.length-1],wall:{live:wall.live,replacement:wall.replacement.slice(0,-1)}};
}

/** Flowers/animals are revealed and replaced until a playable tile is drawn. Fei is NEVER exposed automatically. */
export function drawWithBonusReplacement(wall: TileWall, initialSource: DrawSource = "live"): DrawResult {
  let current = wall;
  let source = initialSource;
  const revealedBonuses: Tile[] = [];
  while (true) {
    const taken = popTile(current,source);
    current = taken.wall;
    if (!taken.tile) return {tile:null,revealedBonuses,wall:current,exhausted:true};
    if (!isBonusTile(taken.tile.face)) return {tile:taken.tile,revealedBonuses,wall:current,exhausted:false};
    revealedBonuses.push(taken.tile);
    source = "replacement";
  }
}
