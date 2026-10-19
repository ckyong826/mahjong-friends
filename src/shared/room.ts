import type { Wind } from "./tiles";
import type { RoundOutcome } from "../game/engine";

export type GameVariant =
  | "malaysia-three-player"
  | "singapore-four-player"
  | "hong-kong-four-player";

export interface RoomRules {
  variant: GameVariant;
  seats: 3 | 4;
  includeAnimals: boolean;
  feiCount: number;
  minimumFan: number;
}

export interface PlayerPublicInfo {
  id: string;
  nickname: string;
  seat: Wind;
  ready: boolean;
  connected: boolean;
  /** Server-controlled practice opponent, not a real connected client. */
  isBot?: boolean;
}

/** Non-official Mahjong test-points profile; never real-money scores. */
export interface ScoreLine {
  name:string;
  fan:number;
  detail:string;
}
export interface RoundSettlement {
  roundNumber:number;
  outcome:RoundOutcome;
  mode:"practice-v1";
  winnerId?:string;
  payerId?:string;
  fan:number;
  lines:ScoreLine[];
  delta:Record<string,number>;
  totals:Record<string,number>;
}
export interface RoomPublicView {
  code: string;
  ownerId: string;
  players: PlayerPublicInfo[];
  rules: RoomRules;
  state: "waiting" | "playing" | "settlement";
  roundNumber?:number;
  scores?:Record<string,number>;
  lastSettlement?:RoundSettlement|null;
  /** Server timestamp of last successful turn action, for wait reminders. */
  turnStartedAt?:number;
  /** Last room-wide reminder; clients can disable the reminder button. */
  lastNudgeAt?:number;
}

/** Distinguish public room codes from private reconnect secrets. */
export interface PrivateMembership {
  playerId: string;
  reconnectToken: string;
}
