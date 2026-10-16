import { useCallback, useEffect, useRef, useState } from "react";
import MahjongTable, { type GameActionDraft } from "./MahjongTable";
import type { RoomRules } from "./shared/room";
import { useRoomSocket, type RoomSnapshot } from "./useRoomSocket";

type Snapshot=RoomSnapshot;
const ROOM_CODE=/^[A-HJ-NP-Z2-9]{6}$/;
const SESSION_PREFIX="mahjong-friends:room:";
function currentCode():string|null {
  const match=window.location.pathname.match(/^\/room\/([^/]+)\/?$/);
  const code=match?.[1].toUpperCase()??"";
  return ROOM_CODE.test(code)?code:null;
}
function savedToken(code:string):string {
  try {return window.localStorage.getItem(SESSION_PREFIX+code)??"";} catch{return "";}
}
function remember(code:string,token:string):void {
  try{window.localStorage.setItem(SESSION_PREFIX+code,token);}catch{/* private mode */ }
}
function forget(code:string):void {
  try{window.localStorage.removeItem(SESSION_PREFIX+code);}catch{/* private mode */ }
}
async function api(path:string,options:RequestInit={}):Promise<Snapshot> {
  const response=await fetch(path,{
    ...options,headers:{"content-type":"application/json",...(options.headers??{})},
    cache:"no-store"
  });
  const result:unknown=await response.json();
  if(!response.ok) {
    const error=result as {error?:string};
    throw new Error(error.error??"无法连接房间服务器");
  }
  return result as Snapshot;
}
const winds=["东","南","西","北"] as const;
function seatName(seat:string):string {
  return winds[["east","south","west","north"].indexOf(seat)]??seat;
}
export default function RoomLobby({onPathChanged}:{onPathChanged?:(inRoom:boolean)=>void}) {
  const [code,setCode]=useState<string|null>(currentCode);
  const [nickname,setNickname]=useState("");
  const [enterCode,setEnterCode]=useState("");
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const inFlightVersion=useRef<number|null>(null);
  const [submittedVersion,setSubmittedVersion]=useState<number|null>(null);
  const applySnapshot=useCallback((next:Snapshot)=>{
    setSnapshot(previous=>previous?.room.code===next.room.code &&
      (previous.revision??-1)>next.revision?previous:next);
  },[]);
  const {status:socketStatus,sendAction}=useRoomSocket(code,code?savedToken(code):"",{
    onSnapshot:(next)=>{applySnapshot(next);setError("");},
    onError:(message)=>{inFlightVersion.current=null;setSubmittedVersion(null);setError(message);}
  });
  useEffect(()=>{
    // A newer server version confirms the prior action; reconnect permits retry
    // only after a fresh private state arrives.
    if(submittedVersion!==null && snapshot?.game?.version!==submittedVersion) {
      inFlightVersion.current=null;
      setSubmittedVersion(null);
    }
  },[submittedVersion,snapshot?.game?.version]);
  useEffect(()=>{
    if(socketStatus==="disconnected") {
      inFlightVersion.current=null;
      setSubmittedVersion(null);
    }
  },[socketStatus]);
  const play=(draft:GameActionDraft):void=>{
    const game=snapshot?.game;
    if(!game||socketStatus!=="connected"||inFlightVersion.current!==null)return;
    const version=game.version;
    inFlightVersion.current=version;
    setSubmittedVersion(version);
    setError("");
    try {
      sendAction({...draft,actionId:crypto.randomUUID(),expectedVersion:version});
    } catch(err) {
      inFlightVersion.current=null;
      setSubmittedVersion(null);
      setError(err instanceof Error?err.message:"无法发送游戏指令");
    }
  };
  const navigate=useCallback((next:string|null)=>{
    window.history.pushState({}, "",next?"/room/"+next:"/");
    setCode(next);setSnapshot(null);setError("");setNotice("");
    onPathChanged?.(Boolean(next));
  },[onPathChanged]);
  useEffect(()=>{
    const handle=()=>{const next=currentCode();setCode(next);setSnapshot(null);setError("");onPathChanged?.(Boolean(next));};
    window.addEventListener("popstate",handle);
    return ()=>window.removeEventListener("popstate",handle);
  },[onPathChanged]);
  const refresh=useCallback(async (roomCode:string)=>{
    const token=savedToken(roomCode);
    if(!token) {setSnapshot(null);return;}
    const result=await api("/api/rooms/"+roomCode,{headers:{authorization:"Bearer "+token}});
    applySnapshot(result);
  },[applySnapshot]);
  useEffect(()=>{
    if(!code || !savedToken(code))return;
    let active=true;
    const poll=async()=>{
      try {
        const token=savedToken(code);
        if(!token)return;
        const result=await api("/api/rooms/"+code,{headers:{authorization:"Bearer "+token}});
        if(active)applySnapshot(result);
      }catch(err) {
        if(active&&socketStatus!=="connected")setError(err instanceof Error?err.message:"网络连接失败");
      }
    };
    // HTTP snapshot remains a fallback when the WebSocket has not connected.
    if(socketStatus!=="connected")void poll();
    const interval=socketStatus==="connected"?undefined:
      window.setInterval(()=>{if(document.visibilityState!=="hidden")void poll();},15000);
    return ()=>{active=false;if(interval!==undefined)window.clearInterval(interval);};
  },[code,socketStatus,applySnapshot]);
  const run=async(task:()=>Promise<void>)=>{
    if(busy)return;
    setBusy(true);setError("");setNotice("");
    try{await task();}catch(err){setError(err instanceof Error?err.message:"发生未知错误");}
    finally{setBusy(false);}
  };
  const create=()=>run(async()=>{
    const result=await api("/api/rooms",{method:"POST",body:JSON.stringify({nickname})});
    if(!result.membership)throw new Error("缺少身份凭证");
    remember(result.room.code,result.membership.reconnectToken);
    navigate(result.room.code);applySnapshot(result);
  });
  const join=()=>run(async()=>{
    if(!code)throw new Error("请选择房间");
    const result=await api("/api/rooms/"+code+"/join",{method:"POST",body:JSON.stringify({nickname})});
    if(!result.membership)throw new Error("缺少身份凭证");
    remember(code,result.membership.reconnectToken);
    applySnapshot(result);
  });
  const action=(verb:string,body:Record<string,unknown>={})=>run(async()=>{
    if(!code)throw new Error("无效的房间");
    const result=await api("/api/rooms/"+code+"/"+verb,{
      method:"POST",headers:{authorization:"Bearer "+savedToken(code)},
      body:JSON.stringify(body)
    });
    if(verb==="leave"){forget(code);navigate(null);}
    else applySnapshot(result);
  });
  const enter=()=>{
    const proposed=enterCode.trim().toUpperCase();
    if(!ROOM_CODE.test(proposed)){setError("请输入正确的 6 位房间码");return;}
    navigate(proposed);
  };
  const share=()=>run(async()=>{
    if(!code)return;
    const link=window.location.origin+"/room/"+code;
    await navigator.clipboard.writeText(link);
    setNotice("邀请链接已复制，可以发给朋友");
  });
  const room=snapshot?.room;
  const self=room?.players.find(p=>p.id===snapshot?.viewerId);
  const isOwner=!!room&&self?.id===room.ownerId;
  return (
    <section className="room-lobby" aria-label="私人房间">
      {!code ? (
        <div className="lobby-entry">
          <label htmlFor="nickname">你的昵称</label>
          <input id="nickname" maxLength={20} value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="例如：阿明" autoComplete="nickname"/>
          <div className="room-button-row">
            <button className="button-primary" type="button" disabled={busy||!nickname.trim()} onClick={create}>创建私人房间 ↗</button>
          </div>
          <div className="join-by-code">
            <input aria-label="6位房间码" maxLength={6} value={enterCode} onChange={e=>setEnterCode(e.target.value.toUpperCase())} placeholder="输入 6 位房间码"/>
            <button type="button" className="button-secondary" disabled={busy} onClick={enter}>加入房间</button>
          </div>
        </div>
      ) : !room ? (
        <div className="lobby-entry">
          <p className="room-number">房间 {code}</p>
          <p>收到邀请啦！输入昵称加入朋友的麻将桌。</p>
          <label htmlFor="join-name">你的昵称</label>
          <input id="join-name" maxLength={20} value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="输入昵称"/>
          <div className="room-button-row">
            {savedToken(code)
              ? <button type="button" className="button-primary" disabled={busy} onClick={()=>void run(()=>refresh(code))}>恢复房间</button>
              : <button type="button" className="button-primary" disabled={busy||!nickname.trim()} onClick={join}>加入这桌</button>}
            <button type="button" className="button-secondary" onClick={()=>navigate(null)}>返回首页</button>
          </div>
        </div>
      ) : (room.state==="playing" || room.state==="settlement") && snapshot?.game ? (
        <MahjongTable room={room} game={snapshot.game} viewerId={snapshot.viewerId}
          connection={socketStatus} pending={submittedVersion!==null}
          onAction={play} onCopyInvite={()=>{void share();}}
          isOwner={isOwner} lobbyBusy={busy}
          onReady={()=>{void action("ready",{ready:!self?.ready});}}
          onNextRound={()=>{void action("start");}}/>
      ) : (
        <div className="lobby-room">
          <p className="eyebrow">PRIVATE ROOM · 好友等待室</p>
          <h2>房间 <span className="room-number">{room.code}</span></h2>
          <button type="button" className="button-secondary" onClick={share}>复制邀请链接 <span aria-hidden="true">↗</span></button>
          <p className="room-hint">通过 WhatsApp 分享房间链接，邀请另外 {Math.max(0,4-room.players.filter(p=>!p.isBot).length)} 位真人朋友。人数不足也可以用练习机器人补位。</p>
          {isOwner&&room.state==="waiting"&&room.players.length<4&&
            <div className="bot-fill-panel">
              <p>想先试玩？剩余 {4-room.players.length} 个空位可以交给 Bot。</p>
              <button type="button" className="button-primary" disabled={busy}
                onClick={()=>{void action("fill-bots");}}>
                🤖 补满练习机器人（{4-room.players.length} 位）
              </button>
              <small>机器人自动准备、出牌、吃碰杠胡；真人在开局前加入会替换一位机器人。</small>
            </div>}
          {room.state==="waiting"&&room.players.some(p=>p.isBot)&&
            <p className="room-hint">🤖 已加入 {room.players.filter(p=>p.isBot).length} 位初级练习机器人。真人可在开局前替换 Bot。</p>}
          <div className="lobby-seats">
            {(["east","south","west","north"] as const).map((seat)=>{
              const player=room.players.find(p=>p.seat===seat);
              return <div key={seat} className={"lobby-seat"+(player?.isBot?" lobby-bot-seat":"")}>
                <span className="lobby-wind">{seatName(seat)}</span>
                <strong>{player?.nickname??"空位"}</strong>
                <small>{player?.isBot?"机器人自动操作":player ? (player.ready?"已准备 ✓":"尚未准备"):"等待好友加入"}</small>
                {player?.id===room.ownerId&&<span className="owner-tag">房主</span>}
                {isOwner&&player&&player.id!==self?.id&&room.state==="waiting"&&
                  <button className="kick-button" disabled={busy} onClick={()=>action("kick",{playerId:player.id})}>{player.isBot?"移除 Bot":"移除"}</button>}
              </div>;
            })}
          </div>
          <p className="room-hint">规则：{room.rules.variant==="hong-kong-four-player"?"港式四人":"新马花牌四人"} · {room.rules.includeAnimals?"含动物牌":"无动物牌"} · {room.rules.feiCount} 张飞牌</p>
          {isOwner&&room.state==="waiting"&&
            <div className="lobby-settings">
              <label htmlFor="variant-select">房间玩法</label>
              <select id="variant-select" disabled={busy} value={room.rules.variant} onChange={e=>{
                const variant=e.target.value;
                const next:RoomRules=variant==="hong-kong-four-player"
                  ?{variant:"hong-kong-four-player",seats:4,includeAnimals:false,feiCount:0,minimumFan:1}
                  :{variant:"singapore-four-player",seats:4,includeAnimals:true,feiCount:4,minimumFan:1};
                action("rules",{rules:next});
              }}>
                <option value="singapore-four-player">新马四人 · 花牌 + 动物 + 4飞</option>
                <option value="hong-kong-four-player">港式四人 · 8花</option>
              </select>
            </div>}
          {room.state==="waiting" ? (
            <div className="room-button-row">
              <button className="button-primary" disabled={busy||!self} onClick={()=>action("ready",{ready:!self?.ready})}>{self?.ready?"取消准备":"我准备好了"}</button>
              {isOwner&&<button className="button-primary" disabled={busy||room.players.length!==4||room.players.some(p=>!p.ready)} onClick={()=>action("start")}>四人准备后开局</button>}
              <button className="button-secondary" disabled={busy} onClick={()=>action("leave")}>退出房间</button>
            </div>
          ) : (
            <div className="game-unavailable">
              <strong>房间已经开局</strong>
              <p>目前尚未收到这局的完整游戏快照。请检查网络连接或重新进入房间；不会在未取得服务器状态时允许出牌。</p>
            </div>
          )}
          <p className="preview-note" role="status">实时连接：{socketStatus==="connected"?"已连接 ✓":socketStatus==="connecting"?"正在连接…":"断线重连中（HTTP 备用同步）"} · 所有出牌操作以服务器确认为准。</p>
        </div>
      )}
      {error&&<p role="alert" className="room-error">{error}</p>}
      {notice&&<p role="status" className="room-success">{notice}</p>}
    </section>
  );
}
