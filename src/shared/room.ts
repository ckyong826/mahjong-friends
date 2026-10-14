import type { Wind } from "./tiles";

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
}

export interface RoomPublicView {
  code: string;
  ownerId: string;
  players: PlayerPublicInfo[];
  rules: RoomRules;
  state: "waiting" | "playing" | "settlement";
}

/** Distinguish public room codes from private reconnect secrets. */
export interface PrivateMembership {
  playerId: string;
  reconnectToken: string;
}
