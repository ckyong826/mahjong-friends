import type { Tile } from "../shared/tiles";
import { createDeck, shuffleDeck, type DeckOptions, type RandomIndex } from "./deck";
import { availableChows, isLegalChow, isStandardWinningHand, sameNaturalFace } from "./hand";
import { drawWithBonusReplacement, reserveReplacementWall, type TileWall, type DrawSource } from "./wall";

export type MeldKind = "chi" | "pong" | "kong";
export interface Meld {
  kind: MeldKind;
  tiles: Tile[];
  fromPlayerId: string | null;
  concealed: boolean;
}
export interface GamePlayer {
  id: string;
  hand: Tile[];
  bonuses: Tile[];
  discards: Tile[];
  melds: Meld[];
}
export type ClaimKind = MeldKind | "win" | "pass";
export interface ClaimResponse {
  playerId: string;
  kind: ClaimKind;
  tileIds: string[];
}
export interface PendingDiscard {
  fromPlayerId: string;
  tile: Tile;
  eligiblePlayerIds: string[];
  responses: ClaimResponse[];
}
export interface RoundOutcome {
  type: "win" | "draw";
  winnerId?: string;
  fromPlayerId?: string;
  selfDraw?: boolean;
}
export interface GameState {
  version: number;
  phase: "discard" | "claims" | "ended";
  players: GamePlayer[];
  currentPlayerIndex: number;
  dealerIndex: number;
  wall: TileWall;
  pendingDiscard: PendingDiscard | null;
  lastDiscard: { fromPlayerId: string; tile: Tile } | null;
  outcome: RoundOutcome | null;
  processedActionIds: string[];
  /** Server-only data, never projected to a client. */
  allTileIds: string[];
}
export type GameAction = {
  playerId: string;
  actionId: string;
  expectedVersion: number;
} & (
  | { type: "discard"; tileId: string }
  | { type: "claim"; kind: ClaimKind; tileIds?: string[] }
  | { type: "kong"; kind: "concealed"; tileIds: string[] }
  | { type: "kong"; kind: "added"; tileId: string; meldIndex: number }
  | { type: "win" }
);

export class IllegalGameAction extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalGameAction";
  }
}
function requireAction(ok: boolean, message: string): asserts ok {
  if (!ok) throw new IllegalGameAction(message);
}
function playerIndex(state: GameState, id: string): number {
  const index = state.players.findIndex((p) => p.id === id);
  requireAction(index >= 0, "Unknown player");
  return index;
}
function copyState(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map((p) => ({
      ...p,
      hand: [...p.hand],
      bonuses: [...p.bonuses],
      discards: [...p.discards],
      melds: p.melds.map((m) => ({...m, tiles: [...m.tiles]}))
    })),
    wall: { live: [...s.wall.live], replacement: [...s.wall.replacement] },
    pendingDiscard: s.pendingDiscard && {
      ...s.pendingDiscard,
      eligiblePlayerIds: [...s.pendingDiscard.eligiblePlayerIds],
      responses: s.pendingDiscard.responses.map((r) => ({...r,tileIds:[...r.tileIds]}))
    },
    processedActionIds: [...s.processedActionIds],
    allTileIds: [...s.allTileIds]
  };
}

export interface StartRoundOptions {
  playerIds: string[];
  dealerIndex?: number;
  deckOptions?: DeckOptions;
  replacementCount?: number;
  /** Trusted server/testing injection only. Never expose a chosen wall to browser clients. */
  shuffledTiles?: readonly Tile[];
  randomIndex?: RandomIndex;
}

/** This ticket implements four-seat structural rules only; 3-player is not silently treated as 4-player. */
export function startRound(options: StartRoundOptions): GameState {
  const ids = options.playerIds;
  if (ids.length !== 4 || new Set(ids).size !== 4 || ids.some((id) => !id.trim())) {
    throw new RangeError("Exactly four distinct players required");
  }
  const dealerIndex = options.dealerIndex ?? 0;
  if (!Number.isInteger(dealerIndex) || dealerIndex < 0 || dealerIndex > 3) {
    throw new RangeError("Invalid dealer");
  }
  const tiles = options.shuffledTiles ? [...options.shuffledTiles] :
    shuffleDeck(createDeck(options.deckOptions), options.randomIndex);
  if (new Set(tiles.map((t) => t.id)).size !== tiles.length) {
    throw new RangeError("Duplicate physical tile IDs");
  }
  const wall = reserveReplacementWall(tiles, options.replacementCount ?? 14);
  const state: GameState = {
    version: 0, phase: "discard",
    players: ids.map((id) => ({id,hand:[],bonuses:[],discards:[],melds:[]})),
    currentPlayerIndex: dealerIndex,
    dealerIndex,
    wall,
    pendingDiscard: null,
    lastDiscard: null,
    outcome: null,
    processedActionIds: [],
    allTileIds: tiles.map((t) => t.id)
  };
  // Real dealing advances around table; each exposure consumes a replacement tile.
  for (let round = 0; round < 13; round++) {
    for (let step = 0; step < 4; step++) {
      drawIntoHand(state,(dealerIndex + step) % 4,"live");
      if (state.phase === "ended") return state;
    }
  }
  drawIntoHand(state,dealerIndex,"live"); // Dealer starts with the 14th tile.
  return state;
}
function drawIntoHand(state: GameState, index: number, source: DrawSource): void {
  const drawn = drawWithBonusReplacement(state.wall,source);
  state.wall = drawn.wall;
  state.players[index].bonuses.push(...drawn.revealedBonuses);
  if (drawn.exhausted || !drawn.tile) {
    state.phase = "ended";
    state.outcome = {type:"draw"};
  } else {
    state.players[index].hand.push(drawn.tile);
  }
}

function matchingTiles(hand: readonly Tile[], target: Tile): Tile[] {
  return hand.filter((t) => sameNaturalFace(t,target));
}
export type ClaimOptions = {
  canWin: boolean;
  canPong: boolean;
  canKong: boolean;
  chiTileIds: string[][];
};
/** Compute only from SERVER state; no client assertions can grant a meld. */
export function possibleClaims(state: GameState, claimantIndex: number, target: Tile, fromIndex: number): ClaimOptions {
  const p = state.players[claimantIndex];
  const matches = matchingTiles(p.hand,target).length;
  return {
    canWin: isStandardWinningHand([...p.hand,target],p.melds.length),
    canPong: matches >= 2,
    canKong: matches >= 3,
    chiTileIds: claimantIndex === (fromIndex + 1) % 4 ? availableChows(p.hand,target) : []
  };
}
function finishUnclaimedDiscard(state: GameState, fromIndex: number): void {
  state.pendingDiscard = null;
  const next = (fromIndex + 1) % state.players.length;
  state.currentPlayerIndex = next;
  drawIntoHand(state,next,"live");
  if (state.phase !== "ended") state.phase = "discard";
}
function handTilesByIds(player: GamePlayer, ids: readonly string[]): Tile[] {
  requireAction(new Set(ids).size === ids.length, "Duplicate selected tile ID");
  return ids.map((id) => {
    const tile = player.hand.find((t) => t.id === id);
    requireAction(!!tile, "Selected tile is not in your hand");
    return tile;
  });
}
function removeFromHand(player: GamePlayer, tiles: readonly Tile[]): void {
  const ids = new Set(tiles.map((t) => t.id));
  player.hand = player.hand.filter((t) => !ids.has(t.id));
}
function resolveClaims(state: GameState): void {
  const pending = state.pendingDiscard;
  if (!pending) throw new Error("Expected pending discard");
  const fromIndex = playerIndex(state,pending.fromPlayerId);
  const replies = pending.responses.filter((r) => r.kind !== "pass");
  if (!replies.length) return finishUnclaimedDiscard(state,fromIndex);
  const priority: Record<Exclude<ClaimKind,"pass">,number> = {win:3,kong:2,pong:2,chi:1};
  replies.sort((a,b) => {
    const diff = priority[b.kind as Exclude<ClaimKind,"pass">] - priority[a.kind as Exclude<ClaimKind,"pass">];
    if (diff !== 0) return diff;
    const distA = (playerIndex(state,a.playerId) - fromIndex + 4) % 4;
    const distB = (playerIndex(state,b.playerId) - fromIndex + 4) % 4;
    return distA - distB;
  });
  const chosen = replies[0];
  if (chosen.kind === "pass") throw new Error("Pass cannot win claim arbitration");
  if (chosen.kind === "win") {
    state.phase = "ended";
    state.outcome = {type:"win",winnerId:chosen.playerId,fromPlayerId:pending.fromPlayerId,selfDraw:false};
    state.pendingDiscard = null;
    return; // Winning discard stays in its source river until settlement (#7).
  }
  const actorIndex = playerIndex(state,chosen.playerId);
  const actor = state.players[actorIndex];
  const source = state.players[fromIndex];
  requireAction(source.discards.at(-1)?.id === pending.tile.id,"Claimed discard no longer exists");
  source.discards.pop();
  const used = handTilesByIds(actor,chosen.tileIds);
  removeFromHand(actor,used);
  actor.melds.push({kind:chosen.kind,tiles:[...used,pending.tile],fromPlayerId:source.id,concealed:false});
  state.pendingDiscard = null;
  state.currentPlayerIndex = actorIndex;
  state.phase = "discard";
  if (chosen.kind === "kong") drawIntoHand(state,actorIndex,"replacement");
}

export function applyGameAction(previous: GameState, action: GameAction): GameState {
  requireAction(!!action.actionId && action.actionId.length <= 128,"Invalid action ID");
  // An exact duplicate gets the SAME state; safe when a WebSocket retries after reconnect.
  if (previous.processedActionIds.includes(action.actionId)) return previous;
  requireAction(action.expectedVersion === previous.version,"Stale game state version");
  requireAction(previous.phase !== "ended","Round has ended");
  const actorIndex = playerIndex(previous,action.playerId);
  const state = copyState(previous);
  const actor = state.players[actorIndex];

  if (action.type === "discard") {
    requireAction(state.phase === "discard" && actorIndex === state.currentPlayerIndex,"Not your turn to discard");
    const tile = handTilesByIds(actor,[action.tileId])[0];
    requireAction(tile.face.family !== "flower" && tile.face.family !== "animal","Bonus tiles cannot be discarded");
    removeFromHand(actor,[tile]);
    actor.discards.push(tile);
    state.lastDiscard = {fromPlayerId:actor.id,tile};
    const eligiblePlayerIds = state.players.filter((_,i) => {
      if (i === actorIndex) return false;
      const opts = possibleClaims(state,i,tile,actorIndex);
      return opts.canWin || opts.canPong || opts.canKong || opts.chiTileIds.length > 0;
    }).map((p) => p.id);
    state.pendingDiscard = {fromPlayerId:actor.id,tile,eligiblePlayerIds,responses:[]};
    if (eligiblePlayerIds.length) state.phase = "claims";
    else finishUnclaimedDiscard(state,actorIndex);
  } else if (action.type === "claim") {
    requireAction(state.phase === "claims" && state.pendingDiscard !== null,"No claim window is open");
    const pending = state.pendingDiscard;
    requireAction(["pass","win","chi","pong","kong"].includes(action.kind),"Unknown claim kind");
    requireAction(action.tileIds === undefined || Array.isArray(action.tileIds),"Invalid claimed tile IDs");
    requireAction(pending.eligiblePlayerIds.includes(actor.id),"You are not eligible to claim");
    requireAction(!pending.responses.some((r) => r.playerId === actor.id),"You already responded to this discard");
    const fromIndex = playerIndex(state,pending.fromPlayerId);
    const opts = possibleClaims(state,actorIndex,pending.tile,fromIndex);
    const ids = action.tileIds ?? [];
    if (action.kind === "pass") requireAction(ids.length === 0,"Pass cannot select tiles");
    if (action.kind === "win") requireAction(opts.canWin && ids.length === 0,"Not a winning hand");
    if (action.kind === "chi") {
      requireAction(ids.length === 2 && opts.chiTileIds.length > 0,"Chow not available");
      requireAction(isLegalChow(pending.tile,handTilesByIds(actor,ids)),"Invalid chow selection");
    }
    if (action.kind === "pong" || action.kind === "kong") {
      requireAction(action.kind === "pong" ? opts.canPong && ids.length === 2 : opts.canKong && ids.length === 3,"Claim not available");
      requireAction(handTilesByIds(actor,ids).every((t) => sameNaturalFace(t,pending.tile)),"Meld must match discarded tile");
    }
    pending.responses.push({playerId:actor.id,kind:action.kind,tileIds:[...ids]});
    if (pending.responses.length === pending.eligiblePlayerIds.length) resolveClaims(state);
  } else if (action.type === "kong") {
    requireAction(state.phase === "discard" && actorIndex === state.currentPlayerIndex,"Not your turn to kong");
    if (action.kind === "concealed") {
      requireAction(action.tileIds.length === 4,"Concealed kong requires four tiles");
      const tiles = handTilesByIds(actor,action.tileIds);
      requireAction(tiles.every((t) => sameNaturalFace(t,tiles[0])),"Four matching natural tiles required");
      removeFromHand(actor,tiles);
      actor.melds.push({kind:"kong",tiles,fromPlayerId:null,concealed:true});
    } else {
      const meld = actor.melds[action.meldIndex];
      requireAction(!!meld && meld.kind === "pong" && !meld.concealed,"Added kong requires a public pong");
      const tile = handTilesByIds(actor,[action.tileId])[0];
      requireAction(sameNaturalFace(tile,meld.tiles[0]),"Added kong tile must match the pong");
      removeFromHand(actor,[tile]);
      meld.kind = "kong";
      meld.tiles.push(tile);
    }
    drawIntoHand(state,actorIndex,"replacement");
  } else {
    requireAction(action.type === "win" && state.phase === "discard" && actorIndex === state.currentPlayerIndex,"Not your turn to win");
    requireAction(isStandardWinningHand(actor.hand,actor.melds.length),"Invalid winning hand");
    state.phase = "ended";
    state.outcome = {type:"win",winnerId:actor.id,selfDraw:true};
  }
  state.version++;
  state.processedActionIds.push(action.actionId);
  return state;
}

export interface PublicMeldView {
  kind: MeldKind;
  concealed: boolean;
  fromPlayerId: string | null;
  tileCount: number;
  /** Hidden for concealed Kongs belonging to other players. */
  tiles?: Tile[];
}
export interface PublicPlayerView {
  id: string;
  concealedCount: number;
  /** Absent for every player except the authenticated viewer. */
  hand?: Tile[];
  bonuses: Tile[];
  discards: Tile[];
  melds: PublicMeldView[];
}
export interface PlayerGameView {
  version: number;
  phase: GameState["phase"];
  currentPlayerId: string;
  dealerId: string;
  players: PublicPlayerView[];
  liveWallCount: number;
  replacementWallCount: number;
  pendingDiscard: {fromPlayerId: string;tile: Tile} | null;
  lastDiscard: GameState["lastDiscard"];
  myAvailableClaims: ClaimOptions | null;
  alreadyResponded: boolean;
  canSelfWin: boolean;
  outcome: RoundOutcome | null;
}
/** Explicit redaction boundary. Never JSON-serialize full GameState to a socket. */
export function projectPlayerView(state: GameState, viewerId: string): PlayerGameView {
  const viewer = playerIndex(state,viewerId);
  const pending = state.pendingDiscard;
  const eligible = !!pending?.eligiblePlayerIds.includes(viewerId);
  const alreadyResponded = !!pending?.responses.some((r) => r.playerId === viewerId);
  return {
    version: state.version, phase: state.phase,
    currentPlayerId: state.players[state.currentPlayerIndex].id,
    dealerId: state.players[state.dealerIndex].id,
    players: state.players.map((p,i) => ({
      id:p.id,
      concealedCount:p.hand.length,
      ...(i === viewer ? {hand:[...p.hand]} : {}),
      bonuses:[...p.bonuses],
      discards:[...p.discards],
      melds:p.melds.map((m) => ({
        kind:m.kind,concealed:m.concealed,fromPlayerId:m.fromPlayerId,
        tileCount:m.tiles.length,
        ...(!m.concealed || i === viewer ? {tiles:[...m.tiles]} : {})
      }))
    })),
    liveWallCount:state.wall.live.length,
    replacementWallCount:state.wall.replacement.length,
    pendingDiscard:pending ? {fromPlayerId:pending.fromPlayerId,tile:pending.tile} : null,
    lastDiscard:state.lastDiscard,
    myAvailableClaims:pending && eligible && !alreadyResponded ?
      possibleClaims(state,viewer,pending.tile,playerIndex(state,pending.fromPlayerId)) : null,
    alreadyResponded,
    canSelfWin:state.phase === "discard" && viewer === state.currentPlayerIndex &&
      isStandardWinningHand(state.players[viewer].hand,state.players[viewer].melds.length),
    outcome:state.outcome ? {...state.outcome} : null
  };
}

/** Every physical tile is in exactly one wall, concealed hand, bonus area, meld or discard river. */
export function assertTileConservation(state: GameState): void {
  const tiles = [
    ...state.wall.live,...state.wall.replacement,
    ...state.players.flatMap((p) => [...p.hand,...p.bonuses,...p.discards,...p.melds.flatMap((m) => m.tiles)])
  ];
  const original = new Set(state.allTileIds);
  if (tiles.length !== original.size || new Set(tiles.map((t) => t.id)).size !== tiles.length ||
    tiles.some((t) => !original.has(t.id))) {
    throw new Error("Game invariant violated: physical tile accounting");
  }
}
