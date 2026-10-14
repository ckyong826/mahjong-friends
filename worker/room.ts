import { DurableObject } from "cloudflare:workers";
import { projectPlayerView } from "../src/game/engine";
import type { RoomPublicView } from "../src/shared/room";
import {
  configureRoom, findMember, joinRoom, newRoom, publicRoom, readyRoom,
  removeRoomMember, RoomError, startRoom, type RoomRecord
} from "./roomCore";

export interface Env {
  ROOMS: DurableObjectNamespace<MahjongRoom>;
}
const jsonHeaders = {
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer"
};
export function json(data:unknown,status=200):Response {
  return new Response(JSON.stringify(data),{status,headers:jsonHeaders});
}
export async function readBody(request:Request):Promise<Record<string,unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RoomError(415,"仅支持 JSON 请求");
  }
  const body=await request.text();
  if(body.length>4096) throw new RoomError(413,"请求内容太长");
  try {
    const parsed:unknown=JSON.parse(body);
    if(!parsed || typeof parsed!=="object" || Array.isArray(parsed)) throw new Error("not object");
    return parsed as Record<string,unknown>;
  } catch {
    throw new RoomError(400,"无效 JSON");
  }
}
export function secureToken():string {
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,(n)=>n.toString(16).padStart(2,"0")).join("");
}
export async function digestToken(token:string):Promise<string> {
  const encoded=new TextEncoder().encode(token);
  const bytes=await crypto.subtle.digest("SHA-256",encoded);
  return Array.from(new Uint8Array(bytes),(n)=>n.toString(16).padStart(2,"0")).join("");
}
function bearer(request:Request):string {
  const auth=request.headers.get("authorization")??"";
  const token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!/^[a-f0-9]{64}$/.test(token)) throw new RoomError(401,"需要有效房间身份凭证");
  return token;
}
function roomSnapshot(room:RoomRecord,viewerId:string,now:number):{
  room:RoomPublicView; game?:ReturnType<typeof projectPlayerView>
}{
  return {
    room:publicRoom(room,now),
    ...(room.game ? {game:projectPlayerView(room.game,viewerId)}:{})
  };
}

/** Each Durable Object is addressed by the 6-character room code.
 * State and hashed seat credentials are persisted in SQLite-backed DO storage.
 * No game state or auth data is sent via the lobby's public projection.
 */
export class MahjongRoom extends DurableObject<Env> {
  async fetch(request:Request):Promise<Response> {
    try {
      const path=new URL(request.url).pathname;
      const now=Date.now();
      let room=await this.ctx.storage.get<RoomRecord>("room");
      if(path==="/internal/create" && request.method==="POST") {
        if(room) throw new RoomError(409,"房间码已被使用");
        const body=await readBody(request);
        room=newRoom(
          String(body.code??""),String(body.playerId??""),
          String(body.tokenHash??""),body.nickname as string,now
        );
        await this.ctx.storage.put("room",room);
        return json(roomSnapshot(room,room.ownerId,now),201);
      }
      if(!room) throw new RoomError(404,"找不到此房间");
      if(path==="/internal/join" && request.method==="POST") {
        const body=await readBody(request);
        const id=String(body.playerId??"");
        room=joinRoom(room,id,String(body.tokenHash??""),body.nickname as string,now);
        await this.ctx.storage.put("room",room);
        return json(roomSnapshot(room,id,now),201);
      }
      const actor=findMember(room,await digestToken(bearer(request)));
      // Refresh last seen on authorized fetches. WebSocket presence will replace polling in #5.
      room={...room,members:room.members.map(m=>m.id===actor.id?{...m,lastSeenAt:now}:m)};
      if(path==="/internal/state" && request.method==="GET") {
        await this.ctx.storage.put("room",room);
        return json(roomSnapshot(room,actor.id,now));
      }
      if(request.method!=="POST") throw new RoomError(405,"不支持此操作");
      const body=await readBody(request);
      if(path==="/internal/ready") room=readyRoom(room,actor.id,body.ready as boolean);
      else if(path==="/internal/rules") room=configureRoom(room,actor.id,body.rules as RoomRecord["rules"]);
      else if(path==="/internal/start") room=startRoom(room,actor.id);
      else if(path==="/internal/leave") room=removeRoomMember(room,actor.id,actor.id);
      else if(path==="/internal/kick") room=removeRoomMember(room,actor.id,String(body.playerId??""));
      else throw new RoomError(404,"找不到此操作");
      // Empty rooms are left as unavailable tombstones so an old invitation code
      // can never be reused to hijack an earlier link.
      await this.ctx.storage.put("room",room);
      return json(roomSnapshot(room,actor.id,now));
    } catch(error) {
      if(error instanceof RoomError) return json({error:error.message},error.status);
      console.error("room operation failed",error);
      return json({error:"房间服务器出现问题"},500);
    }
  }
}
