import { useEffect, useRef, useState } from "react";
import type { PlayerGameView } from "./game/engine";
import type { RoomPublicView } from "./shared/room";

export interface RoomSnapshot {
  type:"snapshot";
  revision:number;
  viewerId:string;
  room:RoomPublicView;
  game?:PlayerGameView;
  membership?:{playerId:string;reconnectToken:string};
}
export type SocketStatus="disconnected"|"connecting"|"connected";
type Handlers={
  onSnapshot:(snapshot:RoomSnapshot)=>void;
  onError:(message:string)=>void;
  onTurnNudge?:(event:{fromPlayerId:string;at:number})=>void;
  onNudgeSent?:(event:{toPlayerId:string;at:number})=>void;
};

function isSnapshot(value:unknown):value is RoomSnapshot {
  if(!value||typeof value!=="object")return false;
  const data=value as Partial<RoomSnapshot>;
  return data.type==="snapshot" && typeof data.revision==="number" &&
    !!data.room && typeof data.room.code==="string" && typeof data.viewerId==="string";
}

/** The membership token goes ONLY in a same-origin Authorization header to
 * fetch a 30s one-use ticket. Only that ephemeral ticket is placed in the WSS URL.
 */
async function requestTicket(code:string,token:string,signal:AbortSignal):Promise<string> {
  const response=await fetch("/api/rooms/"+code+"/socket-ticket",{
    method:"POST",headers:{"authorization":"Bearer "+token,"content-type":"application/json"},
    body:"{}",cache:"no-store",signal
  });
  const payload:unknown=await response.json();
  if(!response.ok) {
    const error=payload as {error?:string};
    throw new Error(error.error??"无法连接实时房间");
  }
  const ticket=(payload as {ticket?:string}).ticket??"";
  if(!/^[a-f0-9]{64}$/.test(ticket))throw new Error("实时房间返回了无效票据");
  return ticket;
}
export interface SocketAction {
  actionId:string;
  expectedVersion:number;
  type:"discard"|"claim"|"kong"|"win";
  tileId?:string;
  tileIds?:string[];
  kind?:"chi"|"pong"|"kong"|"pass"|"win"|"concealed"|"added";
  meldIndex?:number;
}

export function useRoomSocket(code:string|null,token:string,handlers:Handlers) {
  const [status,setStatus]=useState<SocketStatus>("disconnected");
  const socketRef=useRef<WebSocket|null>(null);
  const handlersRef=useRef(handlers);
  handlersRef.current=handlers;

  useEffect(()=>{
    if(!code||!token) {setStatus("disconnected");return;}
    let active=true;
    let attempts=0;
    let retry:number|undefined;
    let ws:WebSocket|null=null;
    const controller=new AbortController();
    const connect=async()=>{
      if(!active)return;
      setStatus("connecting");
      try {
        const ticket=await requestTicket(code,token,controller.signal);
        if(!active)return;
        const scheme=window.location.protocol==="https:"?"wss:":"ws:";
        const url=scheme+"//"+window.location.host+"/api/rooms/"+code+"/ws?ticket="+ticket;
        ws=new WebSocket(url);
        socketRef.current=ws;
        ws.onopen=()=>{
          attempts=0;
          if(active)setStatus("connected");
        };
        ws.onmessage=(event)=>{
          if(!active||typeof event.data!=="string")return;
          try {
            const body:unknown=JSON.parse(event.data);
            if(isSnapshot(body)) handlersRef.current.onSnapshot(body);
            else if(body&&typeof body==="object"&&"type" in body&&
              body.type==="turn_nudge"&&"fromPlayerId" in body&&
              typeof body.fromPlayerId==="string"&&"at" in body&&typeof body.at==="number") {
              handlersRef.current.onTurnNudge?.({fromPlayerId:body.fromPlayerId,at:body.at});
            } else if(body&&typeof body==="object"&&"type" in body&&
              body.type==="turn_nudge_sent"&&"toPlayerId" in body&&
              typeof body.toPlayerId==="string"&&"at" in body&&typeof body.at==="number") {
              handlersRef.current.onNudgeSent?.({toPlayerId:body.toPlayerId,at:body.at});
            } else if(body && typeof body==="object" && "type" in body &&
              body.type==="error" && "message" in body && typeof body.message==="string") {
              handlersRef.current.onError(body.message);
            }
          }catch{/* Ignore malformed frame, never trust unsolicited input */}
        };
        ws.onerror=()=>{if(active)setStatus("disconnected");};
        ws.onclose=()=>{
          if(socketRef.current===ws)socketRef.current=null;
          if(!active)return;
          setStatus("disconnected");
          attempts++;
          retry=window.setTimeout(()=>void connect(),Math.min(15000,1000*Math.pow(2,Math.min(attempts,4))));
        };
      }catch(err) {
        if(!active)return;
        setStatus("disconnected");
        handlersRef.current.onError(err instanceof Error?err.message:"实时网络连接失败");
        attempts++;
        retry=window.setTimeout(()=>void connect(),Math.min(15000,1000*Math.pow(2,Math.min(attempts,4))));
      }
    };
    void connect();
    return ()=>{
      active=false;
      controller.abort();
      if(retry!==undefined)window.clearTimeout(retry);
      if(ws) {ws.onclose=null;ws.close();}
      if(socketRef.current===ws)socketRef.current=null;
    };
  },[code,token]);

  const sendAction=(action:SocketAction):void=>{
    const ws=socketRef.current;
    if(!ws||ws.readyState!==WebSocket.OPEN)throw new Error("尚未连接到牌局服务器");
    ws.send(JSON.stringify({type:"game_action",action}));
  };
  const sendTurnNudge=():void=>{
    const ws=socketRef.current;
    if(!ws||ws.readyState!==WebSocket.OPEN)throw new Error("尚未连接到牌局服务器");
    ws.send(JSON.stringify({type:"turn_nudge"}));
  };
  return {status,sendAction,sendTurnNudge};
}
