import { secureRandomIndex } from "../src/game/deck";
import { makeRoomCode, ROOM_CODE_REGEX, RoomError, validateNickname } from "./roomCore";
import { digestToken, json, MahjongRoom, readBody, secureToken, type Env } from "./room";

export { MahjongRoom };
const actions = new Set(["ready","rules","start","leave","kick","fill-bots","socket-ticket"]);
function codeFrom(path:string):{code:string;action:string}|null {
  const found=path.match(/^\/api\/rooms\/([^/]+)(?:\/([^/]+))?$/);
  if(!found) return null;
  return {code:found[1].toUpperCase(),action:found[2]??"state"};
}
function stubFor(env:Env,code:string) {
  return env.ROOMS.get(env.ROOMS.idFromName("room:"+code));
}
async function toRoom(stub:ReturnType<typeof stubFor>,route:string,method:string,body?:unknown,auth?:string):Promise<Response> {
  const headers:Record<string,string>={"content-type":"application/json"};
  if(auth) headers.authorization=auth;
  return stub.fetch(new Request("https://rooms.internal/internal/"+route,{
    method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})
  }));
}
async function gateway(request:Request,env:Env):Promise<Response> {
  const url=new URL(request.url);
  if(url.pathname==="/api/health" && request.method==="GET") {
    return json({status:"ok",app:"mahjong-friends",stage:"realtime-websocket"});
  }
  if(url.pathname==="/api/rooms" && request.method==="POST") {
    const body=await readBody(request);
    const nickname=validateNickname(body.nickname);
    for(let attempt=0;attempt<6;attempt++) {
      const code=makeRoomCode(secureRandomIndex);
      const token=secureToken();
      const playerId=crypto.randomUUID();
      const stub=stubFor(env,code);
      const created=await toRoom(stub,"create","POST",{code,playerId,tokenHash:await digestToken(token),nickname});
      if(created.status===409) continue; // Extremely rare room-code collision.
      if(!created.ok) return created;
      const room=(await created.json()) as Record<string,unknown>;
      return json({...room,membership:{playerId,reconnectToken:token}},201);
    }
    throw new RoomError(503,"暂时无法分配房间码，请重试");
  }
  const match=codeFrom(url.pathname);
  if(!match || !ROOM_CODE_REGEX.test(match.code)) throw new RoomError(404,"找不到此房间");
  const stub=stubFor(env,match.code);
  if(match.action==="ws" && request.method==="GET") {
    if(request.headers.get("upgrade")?.toLowerCase()!=="websocket") {
      throw new RoomError(426,"需要 WebSocket 升级请求");
    }
    // A short-lived, single-use ticket is minted using Bearer auth via the
    // REST endpoint; the browser never puts its reusable membership token in a URL.
    const origin=request.headers.get("origin");
    if(origin && origin!==url.origin) throw new RoomError(403,"WebSocket 来源不合法");
    const ticket=url.searchParams.get("ticket")??"";
    if(!/^[a-f0-9]{64}$/.test(ticket)) throw new RoomError(401,"无效临时凭证");
    return stub.fetch(new Request("https://rooms.internal/internal/ws?ticket="+ticket,{
      method:"GET",headers:{"upgrade":"websocket"}
    }));
  }
  if(match.action==="join" && request.method==="POST") {
    const body=await readBody(request);
    const nickname=validateNickname(body.nickname);
    const token=secureToken();
    const playerId=crypto.randomUUID();
    const joined=await toRoom(stub,"join","POST",{nickname,playerId,tokenHash:await digestToken(token)});
    if(!joined.ok) return joined;
    const room=(await joined.json()) as Record<string,unknown>;
    return json({...room,membership:{playerId,reconnectToken:token}},201);
  }
  if(match.action==="state" && request.method==="GET") {
    return toRoom(stub,"state","GET",undefined,request.headers.get("authorization")??"");
  }
  if(actions.has(match.action) && request.method==="POST") {
    const body=await readBody(request);
    return toRoom(stub,match.action,"POST",body,request.headers.get("authorization")??"");
  }
  throw new RoomError(405,"不支持此操作");
}
export default {
  async fetch(request:Request,env:Env):Promise<Response> {
    try {
      const url=new URL(request.url);
      if(!url.pathname.startsWith("/api/")) return json({error:"Not found"},404);
      return await gateway(request,env);
    } catch(error) {
      if(error instanceof RoomError) return json({error:error.message},error.status);
      console.error("gateway error",error);
      return json({error:"服务器出现问题"},500);
    }
  }
};
