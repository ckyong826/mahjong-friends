import type { RoomPublicView, RoomRules, RoundSettlement } from "../src/shared/room";
import { scoreRound } from "../src/game/scoring";
import type { Wind } from "../src/shared/tiles";
import { startRound, type GameState } from "../src/game/engine";

export interface RoomMember {
  id: string;
  tokenHash: string;
  nickname: string;
  seat: Wind;
  ready: boolean;
  lastSeenAt: number;
}
export interface RoomRecord {
  code: string;
  ownerId: string;
  members: RoomMember[];
  rules: RoomRules;
  state: "waiting" | "playing" | "settlement";
  roundNumber:number;
  scores:Record<string,number>;
  lastSettlement:RoundSettlement|null;
  createdAt: number;
  revision: number;
  game: GameState | null;
}
export class RoomError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "RoomError";
  }
}
const winds: Wind[] = ["east", "south", "west", "north"];
export const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;
export const DEFAULT_RULES: RoomRules = {
  variant: "singapore-four-player", seats: 4, includeAnimals: true,
  feiCount: 4, minimumFan: 1
};
export function validateNickname(input: unknown): string {
  if (typeof input !== "string") throw new RoomError(400, "请输入昵称");
  const name = input.trim();
  if (!name || [...name].length > 20 || /[\x00-\x1F\x7F]/.test(name)) {
    throw new RoomError(400, "昵称长度须为 1–20 字，不能包含控制字符");
  }
  return name;
}
export function validateRules(input: unknown): RoomRules {
  if (!input || typeof input !== "object") throw new RoomError(400,"无效的房间规则");
  const r=input as Partial<RoomRules>;
  if (r.seats !== 4 || !["singapore-four-player","hong-kong-four-player"].includes(r.variant ?? "")) {
    throw new RoomError(400,"目前仅支持四人房");
  }
  if (typeof r.includeAnimals !== "boolean" || !Number.isInteger(r.feiCount) ||
      (r.feiCount ?? -1) < 0 || (r.feiCount ?? 5) > 4 || !Number.isInteger(r.minimumFan) ||
      (r.minimumFan ?? -1) < 0 || (r.minimumFan ?? 99) > 8) {
    throw new RoomError(400,"无效的动物牌、飞牌或番数设置");
  }
  if (r.minimumFan!==1)throw new RoomError(400,"测试计分模式仅允许最低 1 番");
  if (r.variant === "hong-kong-four-player" && (r.includeAnimals || r.feiCount !== 0)) {
    throw new RoomError(400,"港式四人模式暂不支持动物牌或飞牌");
  }
  return {
    variant:r.variant as "singapore-four-player" | "hong-kong-four-player", seats:4, includeAnimals:r.includeAnimals,
    feiCount:r.feiCount!, minimumFan:r.minimumFan!
  };
}
export function makeRoomCode(randomIndex: (upper:number)=>number): string {
  return Array.from({length:6},()=>ROOM_ALPHABET[randomIndex(ROOM_ALPHABET.length)]).join("");
}
export function newRoom(code:string,ownerId:string,tokenHash:string,nickname:string,now:number, rules:RoomRules=DEFAULT_RULES):RoomRecord {
  if (!ROOM_CODE_REGEX.test(code)) throw new RoomError(400,"无效房间码");
  return {code,ownerId,createdAt:now,revision:0,rules:validateRules(rules),state:"waiting",game:null,
    roundNumber:0,scores:{[ownerId]:0},lastSettlement:null,
    members:[{id:ownerId,tokenHash,nickname:validateNickname(nickname),seat:"east",ready:false,lastSeenAt:now}]};
}
export function findMember(room:RoomRecord,tokenHash:string): RoomMember {
  const member=room.members.find(m=>m.tokenHash===tokenHash);
  if (!member) throw new RoomError(401,"身份凭证失效，请重新加入房间");
  return member;
}
export function publicRoom(room:RoomRecord,now:number):RoomPublicView {
  return {
    code:room.code,ownerId:room.ownerId,rules:{...room.rules},state:room.state,
    roundNumber:room.roundNumber??0,scores:{...room.scores},lastSettlement:room.lastSettlement??null,
    players:room.members.map(m=>({
      id:m.id,nickname:m.nickname,seat:m.seat,ready:m.ready,
      connected:now-m.lastSeenAt < 20_000
    }))
  };
}
export function joinRoom(room:RoomRecord,playerId:string,tokenHash:string,nickname:string,now:number):RoomRecord {
  if (room.state !== "waiting") throw new RoomError(409,"牌局已经开始");
  if (room.members.length >= 4) throw new RoomError(409,"房间已满");
  if (room.members.some(m=>m.id===playerId || m.tokenHash===tokenHash)) throw new RoomError(409,"重复加入");
  const seat=winds.find(w=>!room.members.some(m=>m.seat===w));
  if (!seat) throw new RoomError(409,"没有空座");
  return {...room,scores:{...room.scores,[playerId]:0},
    members:[...room.members,{id:playerId,tokenHash,nickname:validateNickname(nickname),seat,ready:false,lastSeenAt:now}]};
}
export function readyRoom(room:RoomRecord,playerId:string,ready:boolean):RoomRecord {
  if(room.state !== "waiting" && room.state !== "settlement") throw new RoomError(409,"牌局已经开始");
  if(typeof ready!=="boolean") throw new RoomError(400,"无效准备状态");
  return {...room,members:room.members.map(m=>m.id===playerId?{...m,ready}:m)};
}
export function configureRoom(room:RoomRecord,actorId:string,rules:RoomRules):RoomRecord {
  if(room.state!=="waiting") throw new RoomError(409,"开局后不能修改规则");
  if(room.ownerId!==actorId) throw new RoomError(403,"只有房主可以更改规则");
  return {...room,rules:validateRules(rules),members:room.members.map(m=>({...m,ready:false}))};
}
export function removeRoomMember(room:RoomRecord,actorId:string,targetId:string):RoomRecord {
  if(room.state!=="waiting") throw new RoomError(409,"开局后不能退出或移除玩家");
  const target=room.members.find(m=>m.id===targetId);
  if(!target) throw new RoomError(404,"玩家不存在");
  if (actorId!==targetId && actorId!==room.ownerId) throw new RoomError(403,"只有房主可以移除其他玩家");
  const members=room.members.filter(m=>m.id!==targetId);
  const scores={...room.scores};delete scores[targetId];
  return {...room,members,scores,ownerId:room.ownerId===targetId?(members[0]?.id ?? ""):room.ownerId};
}
/** Idempotent settlement: once marked settled, do not apply deltas twice. */
export function settleRoom(room:RoomRecord):RoomRecord {
  if(room.state==="settlement")return room;
  if(room.state!=="playing"||!room.game||room.game.phase!=="ended") {
    throw new RoomError(409,"只有结束的牌局可以结算");
  }
  const result=scoreRound(room.game,room.roundNumber??1,room.scores??{});
  return {
    ...room,state:"settlement",scores:{...result.totals},lastSettlement:result,
    members:room.members.map(m=>({...m,ready:false}))
  };
}

export function startRoom(room:RoomRecord,actorId:string):RoomRecord {
  if(room.state!=="waiting" && room.state!=="settlement") throw new RoomError(409,"牌局已经开始");
  if(room.ownerId!==actorId) throw new RoomError(403,"只有房主可以开局");
  if(room.members.length!==4 || room.members.some(m=>!m.ready)) throw new RoomError(409,"必须四人全部准备才能开局");
  const ordered=[...room.members].sort((a,b)=>winds.indexOf(a.seat)-winds.indexOf(b.seat));
  const nextRound=(room.roundNumber??0)+1;
  // Practice profile rotates dealer every round; real regional continuation
  // after a win/draw needs a separate confirmed ruleset.
  const game=startRound({
    playerIds:ordered.map(m=>m.id),dealerIndex:(nextRound-1)%4,
    deckOptions:{includeFlowers:true,includeAnimals:room.rules.includeAnimals,feiCount:room.rules.feiCount}
  });
  const opened:RoomRecord={
    ...room,state:"playing",game,roundNumber:nextRound,lastSettlement:null,
    scores:{...room.scores}
  };
  return game.phase==="ended"?settleRoom(opened):opened;
}
