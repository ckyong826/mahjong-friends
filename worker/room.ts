import { DurableObject } from "cloudflare:workers";
import { applyGameAction, assertTileConservation, projectPlayerView } from "../src/game/engine";
import type { RoomPublicView } from "../src/shared/room";
import { parseClientMessage } from "./protocol";
import { consumeTicket, pruneTickets, type TicketStore } from "./socketTicket";
import {
  configureRoom, findMember, joinRoom, newRoom, publicRoom, readyRoom,
  removeRoomMember, RoomError, settleRoom, startRoom, type RoomRecord
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
interface SocketAttachment {
  playerId: string;
}
function authenticatedSnapshot(room:RoomRecord,viewerId:string,now:number,connectedIds:ReadonlySet<string>) {
  const published:RoomPublicView=publicRoom(room,now);
  for(const player of published.players) {
    if(connectedIds.has(player.id)) player.connected=true;
  }
  return {
    type:"snapshot" as const,
    revision:room.revision,
    room:published,
    viewerId,
    ...(room.game ? {game:projectPlayerView(room.game,viewerId)}:{})
  };
}

/** One DO per invitation code; persistent game and membership in DO SQLite,
 * hibernatable WebSockets with only viewer IDs in socket attachments.
 */
export class MahjongRoom extends DurableObject<Env> {
  private queue:Promise<void>=Promise.resolve();

  private async serial<T>(job:()=>Promise<T>):Promise<T> {
    const before=this.queue;
    let release!:()=>void;
    this.queue=new Promise<void>(resolve=>{release=resolve;});
    await before;
    try{return await job();}finally{release();}
  }

  private socketPlayer(ws:WebSocket):string|null {
    const meta=ws.deserializeAttachment() as SocketAttachment|null;
    return typeof meta?.playerId==="string"?meta.playerId:null;
  }
  private online():Set<string> {
    return new Set(this.ctx.getWebSockets()
      .filter(ws=>ws.readyState===WebSocket.OPEN)
      .map(ws=>this.socketPlayer(ws)).filter((id):id is string=>id!==null));
  }
  private sendSnapshot(ws:WebSocket,room:RoomRecord):void {
    if(ws.readyState!==WebSocket.OPEN)return;
    const playerId=this.socketPlayer(ws);
    if(!playerId || !room.members.some(m=>m.id===playerId)) {
      ws.close(1008,"房间身份失效");
      return;
    }
    const data=authenticatedSnapshot(room,playerId,Date.now(),this.online());
    try{ws.send(JSON.stringify(data));}catch{/* socket has disconnected */}
  }
  private broadcast(room:RoomRecord):void {
    for(const ws of this.ctx.getWebSockets()) this.sendSnapshot(ws,room);
  }
  async fetch(request:Request):Promise<Response> {
    return this.serial(()=>this.handle(request));
  }
  private async upgrade(request:Request,room:RoomRecord,now:number):Promise<Response> {
    if(request.method!=="GET" || request.headers.get("upgrade")?.toLowerCase()!=="websocket") {
      throw new RoomError(426,"需要 WebSocket Upgrade");
    }
    const raw=new URL(request.url).searchParams.get("ticket")??"";
    if(!/^[a-f0-9]{64}$/.test(raw)) throw new RoomError(401,"无效 WebSocket 临时凭证");
    const digest=await digestToken(raw);
    const consumed=consumeTicket(await this.ctx.storage.get<TicketStore>("socketTickets")??{},digest,now);
    if(!consumed) throw new RoomError(401,"临时凭证已经使用或过期");
    await this.ctx.storage.put("socketTickets",consumed.remaining);
    if(!room.members.some(m=>m.id===consumed.playerId))throw new RoomError(403,"玩家已离开房间");
    const pair=new WebSocketPair();
    const [client,server]=Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({playerId:consumed.playerId} satisfies SocketAttachment);
    room={...room,members:room.members.map(m=>m.id===consumed.playerId?{...m,lastSeenAt:now}:m)};
    await this.ctx.storage.put("room",room);
    this.broadcast(room);
    return new Response(null,{status:101,webSocket:client});
  }
  private async handle(request:Request):Promise<Response> {
    try {
      const path=new URL(request.url).pathname;
      const now=Date.now();
      let room=await this.ctx.storage.get<RoomRecord>("room");
      if(path==="/internal/create" && request.method==="POST") {
        if(room) throw new RoomError(409,"房间码已被使用");
        const body=await readBody(request);
        room=newRoom(String(body.code??""),String(body.playerId??""),
          String(body.tokenHash??""),body.nickname as string,now);
        await this.ctx.storage.put("room",room);
        return json(authenticatedSnapshot(room,room.ownerId,now,this.online()),201);
      }
      if(!room) throw new RoomError(404,"找不到此房间");
      if(path==="/internal/ws") return this.upgrade(request,room,now);
      if(path==="/internal/join" && request.method==="POST") {
        const body=await readBody(request);
        const id=String(body.playerId??"");
        room=joinRoom(room,id,String(body.tokenHash??""),body.nickname as string,now);
        room.revision++;
        await this.ctx.storage.put("room",room);
        this.broadcast(room);
        return json(authenticatedSnapshot(room,id,now,this.online()),201);
      }
      const actor=findMember(room,await digestToken(bearer(request)));
      room={...room,members:room.members.map(m=>m.id===actor.id?{...m,lastSeenAt:now}:m)};
      if(path==="/internal/state" && request.method==="GET") {
        await this.ctx.storage.put("room",room);
        return json(authenticatedSnapshot(room,actor.id,now,this.online()));
      }
      if(request.method!=="POST") throw new RoomError(405,"不支持此操作");
      const body=await readBody(request);
      if(path==="/internal/socket-ticket") {
        const ticket=secureToken();
        const hashed=await digestToken(ticket);
        const existing=pruneTickets(await this.ctx.storage.get<TicketStore>("socketTickets")??{},now);
        existing[hashed]={playerId:actor.id,expiresAt:now+30_000};
        await this.ctx.storage.put("room",room);
        await this.ctx.storage.put("socketTickets",existing);
        return json({ticket,expiresInSeconds:30},201);
      }
      if(path==="/internal/ready") room=readyRoom(room,actor.id,body.ready as boolean);
      else if(path==="/internal/rules") room=configureRoom(room,actor.id,body.rules as RoomRecord["rules"]);
      else if(path==="/internal/start") room=startRoom(room,actor.id);
      else if(path==="/internal/leave") room=removeRoomMember(room,actor.id,actor.id);
      else if(path==="/internal/kick") room=removeRoomMember(room,actor.id,String(body.playerId??""));
      else throw new RoomError(404,"找不到此操作");
      room.revision++;
      await this.ctx.storage.put("room",room);
      this.broadcast(room);
      return json(authenticatedSnapshot(room,actor.id,now,this.online()));
    } catch(error) {
      if(error instanceof RoomError) return json({error:error.message},error.status);
      console.error("room operation failed",error);
      return json({error:"房间服务器出现问题"},500);
    }
  }

  async webSocketMessage(ws:WebSocket,message:string|ArrayBuffer):Promise<void> {
    await this.serial(async()=>{
      try {
        const playerId=this.socketPlayer(ws);
        if(!playerId)throw new RoomError(401,"未验证身份的连接");
        const room=await this.ctx.storage.get<RoomRecord>("room");
        if(!room || !room.members.some(m=>m.id===playerId)) {
          ws.close(1008,"玩家已不在房间");return;
        }
        const parsed=parseClientMessage(message);
        if(parsed.type==="ping") {
          ws.send(JSON.stringify({type:"pong"}));
          return;
        }
        if(parsed.type==="sync") {
          this.sendSnapshot(ws,room);return;
        }
        if(!room.game || room.state!=="playing")throw new RoomError(409,"房间尚未开始游戏");
        // Actor identity comes exclusively from the authenticated socket attachment.
        const action={...parsed.action,playerId};
        const next=applyGameAction(room.game,action);
        if(next===room.game) {
          this.sendSnapshot(ws,room); // duplicate action id: do not reapply.
          return;
        }
        assertTileConservation(next);
        // Round settlement is deterministic and persisted once, atomically
        // with the final accepted game action; never apply score twice.
        const settled=next.phase==="ended"?
          settleRoom({...room,game:next}):{...room,game:next};
        settled.revision++;
        await this.ctx.storage.put("room",settled); // commit before broadcasting
        this.broadcast(settled);
      }catch(error) {
        const message=error instanceof Error ? error.message : "出牌请求失败";
        if(ws.readyState===WebSocket.OPEN) {
          ws.send(JSON.stringify({type:"error",message,code:error instanceof RoomError?error.status:409}));
          const room=await this.ctx.storage.get<RoomRecord>("room");
          if(room) this.sendSnapshot(ws,room);
        }
      }
    });
  }
  async webSocketClose(ws:WebSocket,code:number,reason:string,_clean:boolean):Promise<void> {
    await this.serial(async()=>{
      const playerId=this.socketPlayer(ws);
      const room=await this.ctx.storage.get<RoomRecord>("room");
      if(playerId&&room&&!this.online().has(playerId)) {
        room.members=room.members.map(m=>m.id===playerId?{...m,lastSeenAt:0}:m);
        await this.ctx.storage.put("room",room);
        this.broadcast(room);
      }
      try {ws.close(code,reason);}catch{/* already closed */}
    });
  }
  async webSocketError(ws:WebSocket,_error:unknown):Promise<void> {
    await this.webSocketClose(ws,1011,"Connection failed",false);
  }
}
