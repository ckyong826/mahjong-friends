import type { GameAction } from "../src/game/engine";
import { RoomError } from "./roomCore";

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 128;
const tileId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
const idList = (value: unknown, size: number): value is string[] =>
  Array.isArray(value) && value.length === size && value.every(tileId) &&
  new Set(value).size === value.length;
export type ClientGameAction = Omit<GameAction, "playerId">;
export type ClientMessage =
  | { type: "sync" }
  | { type: "ping" }
  | { type: "game_action"; action: ClientGameAction };

/** Only explicit action shapes can reach the reducer. User-supplied playerId
 * and wall/tile draw instructions are never accepted. */
export function parseClientMessage(data: unknown): ClientMessage {
  if (typeof data !== "string" || data.length > 2048) {
    throw new RoomError(400,"只接受 2KB 以内的文字消息");
  }
  let parsed: unknown;
  try { parsed=JSON.parse(data); }
  catch { throw new RoomError(400,"无效的 WebSocket JSON"); }
  if (!isObject(parsed)) throw new RoomError(400,"无效 WebSocket 消息");
  if (parsed.type === "ping") return {type:"ping"};
  if (parsed.type === "sync") return {type:"sync"};
  if (parsed.type !== "game_action" || !isObject(parsed.action)) {
    throw new RoomError(400,"不支持此消息");
  }
  const raw=parsed.action;
  if (!isId(raw.actionId) || !Number.isSafeInteger(raw.expectedVersion) ||
    (raw.expectedVersion as number) < 0) {
    throw new RoomError(400,"缺少有效的操作编号或状态版本");
  }
  const base={actionId:raw.actionId,expectedVersion:raw.expectedVersion as number};
  let action: ClientGameAction;
  if (raw.type === "discard" && tileId(raw.tileId)) {
    action={...base,type:"discard",tileId:raw.tileId};
  } else if (raw.type === "claim" &&
    ["pass","chi","pong","kong","win"].includes(raw.kind as string)) {
    const kind=raw.kind as "pass"|"chi"|"pong"|"kong"|"win";
    const expected=kind==="chi"||kind==="pong"?2:kind==="kong"?3:0;
    if (raw.tileIds !== undefined && !idList(raw.tileIds,expected)) {
      throw new RoomError(400,"抢牌所选牌张不合法");
    }
    if (expected>0 && !idList(raw.tileIds,expected)) {
      throw new RoomError(400,"抢牌缺少牌张");
    }
    action={...base,type:"claim",kind,tileIds:raw.tileIds as string[] | undefined};
  } else if (raw.type === "kong" && raw.kind === "concealed" && idList(raw.tileIds,4)) {
    action={...base,type:"kong",kind:"concealed",tileIds:raw.tileIds};
  } else if (raw.type === "kong" && raw.kind === "added" &&
    tileId(raw.tileId) && Number.isInteger(raw.meldIndex) &&
    (raw.meldIndex as number)>=0 && (raw.meldIndex as number)<4) {
    action={...base,type:"kong",kind:"added",tileId:raw.tileId,meldIndex:raw.meldIndex as number};
  } else if (raw.type === "win") {
    action={...base,type:"win"};
  } else throw new RoomError(400,"非法出牌指令");
  return {type:"game_action",action};
}
