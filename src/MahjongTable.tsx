import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import type { Tile } from "./shared/tiles";
import TileFaceArt from "./game/TileFaceArt";
import {tableTurnFeedback} from "./game/turnFeedback";
import type { PlayerGameView, PublicPlayerView } from "./game/engine";
import type { PlayerPublicInfo, RoomPublicView } from "./shared/room";
import {
  addedKongOptions, concealedKongOptions, matchingHandIds, seatPlayers,
  riverRows, claimedMeldTileIndex, sortedConcealedHand, tileAppearance, windText, type SeatPosition
} from "./game/presentation";
import type { SocketStatus } from "./useRoomSocket";

export type GameActionDraft =
  | {type:"discard";tileId:string}
  | {type:"claim";kind:"chi"|"pong"|"kong"|"win"|"pass";tileIds?:string[]}
  | {type:"kong";kind:"concealed";tileIds:string[]}
  | {type:"kong";kind:"added";tileId:string;meldIndex:number}
  | {type:"win"};

export interface MahjongTableProps {
  room:RoomPublicView;
  game:PlayerGameView;
  viewerId:string;
  connection:SocketStatus;
  pending:boolean;
  onAction:(action:GameActionDraft)=>void;
  onCopyInvite:()=>void;
  onTurnNudge?:()=>void;
  attentionEvent?:{fromPlayerId:string;at:number}|null;
  nudgeNotice?:string;
  isOwner?:boolean;
  lobbyBusy?:boolean;
  onReady?:()=>void;
  onNextRound?:()=>void;
}

function TileCard({tile,mini=false,selected=false,latest=false,arriving=false,onSelect,disabled=false,buttonRef}:{
  tile:Tile;mini?:boolean;selected?:boolean;latest?:boolean;arriving?:boolean;
  onSelect?:()=>void;disabled?:boolean;buttonRef?:(node:HTMLButtonElement|null)=>void;
}) {
  const style=tileAppearance(tile);
  const className=[
    "mj-tile","mj-"+style.variant,mini?"mj-tile-mini":"",
    selected?"mj-tile-selected":"",latest?"mj-tile-latest":"",arriving?"mj-tile-arriving":""
  ].filter(Boolean).join(" ");
  const inner=<TileFaceArt face={tile.face}/>;
  if(onSelect) {
    return <button type="button" ref={buttonRef} className={className} disabled={disabled}
      aria-label={"选择 "+style.accessibleName} aria-pressed={selected}
      onClick={onSelect}>{inner}</button>;
  }
  return <span role="img" aria-label={style.accessibleName+(latest?"，最新弃牌":"")} className={className}>{inner}</span>;
}
function TileBack({count,side}: {count:number;side:SeatPosition}) {
  return <div className={"mj-concealed mj-concealed-"+side} aria-label={"未公开手牌 "+count+" 张"}>
    {Array.from({length:count},(_,i)=><span className="mj-back" key={i} aria-hidden="true"/>)}
  </div>;
}
function DisplayMelds({player,windByPlayer}:{player:PublicPlayerView;windByPlayer:Record<string,string>}) {
  return <div className="mj-showcases" aria-label="明花、动物及公开组合">
    {player.bonuses.length>0&&<div className="mj-bonus-group" aria-label="明花及动物牌">
      <span className="mj-showcase-label">花牌 {player.bonuses.length}</span>
      <div className="mj-showcase-tiles">
        {player.bonuses.map(tile=><TileCard key={tile.id} tile={tile} mini/>)}
      </div>
    </div>}
    {player.melds.length>0&&<div className="mj-meld-group" aria-label="公开的吃碰杠组合">
      <span className="mj-showcase-label">明牌 {player.melds.length}</span>
      <div className="mj-showcase-melds">
        {player.melds.map((meld,i)=>{
          const claimedIndex=claimedMeldTileIndex(meld);
          const source=meld.fromPlayerId?windByPlayer[meld.fromPlayerId]??"他家":null;
          return <div key={i} className="mj-meld" data-kind={meld.kind}
            data-concealed={meld.concealed?"true":"false"}
            data-claimed-from={meld.fromPlayerId??undefined}
            aria-label={(meld.concealed?"暗杠":meld.kind==="chi"?"吃":meld.kind==="pong"?"碰":"明杠")+
              (source?"，来自"+source+"位的弃牌":"")}>
            <span className="mj-meld-name">{meld.kind==="chi"?"吃":meld.kind==="pong"?"碰":"杠"}</span>
            <div className="mj-meld-tiles">
              {meld.tiles?.map((tile,index)=>claimedIndex===index?
                <span className="mj-meld-claimed-tile" key={tile.id}
                  aria-label={"来自"+source+"位的牌"}>
                  <TileCard tile={tile} mini/>
                </span>:
                <TileCard tile={tile} key={tile.id} mini/>) ??
                Array.from({length:meld.tileCount},(_,j)=>
                  <span key={j} className="mj-back mj-back-small" aria-label="暗杠背面"/>)}
            </div>
            {source&&<span className="mj-meld-source">{source}位</span>}
          </div>;
        })}
      </div>
    </div>}
  </div>;
}
/**
 * Draw the ORIGINAL public tiles directly in the seat, never a summary.
 * A compact 5-column Mahjong layout has very different tray aspect ratios on
 * desktop, mobile landscape and portrait. Measure the actual cell and try
 * multiple wrap widths, choosing the largest legible scale that fits BOTH
 * dimensions. No data is sliced, paginated or hidden in the primary table.
 */
function FittedPublicMelds({player,windByPlayer}:{
  player:PublicPlayerView;windByPlayer:Record<string,string>;
}) {
  const stageRef=useRef<HTMLDivElement>(null);
  const fitRef=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const stage=stageRef.current,fit=fitRef.current;
    if(!stage||!fit)return;
    const layout=()=>{
      const availableW=stage.clientWidth,availableH=stage.clientHeight;
      if(availableW<=0||availableH<=0)return;
      let bestScale=0,bestWidth=availableW,bestW=availableW,bestH=availableH;
      // Wrapping at the available width is not always optimal for extremely
      // shallow top/bottom rows. Try wider intrinsic rows and scale down.
      for(const multiple of [1,1.25,1.5,2,2.5,3,4,5]){
        const width=Math.max(40,Math.round(availableW*multiple));
        fit.style.width=width+"px";
        const naturalW=Math.max(width,fit.scrollWidth);
        const naturalH=Math.max(1,fit.scrollHeight);
        const scale=Math.min(1,availableW/naturalW,availableH/naturalH);
        if(scale>bestScale+0.001){
          bestScale=scale;bestWidth=width;bestW=naturalW;bestH=naturalH;
        }
      }
      fit.style.width=bestWidth+"px";
      const x=Math.max(0,(availableW-bestW*bestScale)/2);
      const y=Math.max(0,(availableH-bestH*bestScale)/2);
      fit.style.transform="translate("+x+"px,"+y+"px) scale("+bestScale+")";
      stage.dataset.fitScale=bestScale.toFixed(3);
    };
    layout();
    const observer=new ResizeObserver(layout);
    observer.observe(stage);
    return ()=>observer.disconnect();
  },[player.melds,player.bonuses,windByPlayer]);
  return <div className="mj-public-stage" ref={stageRef}
    data-melds={player.melds.length} data-bonuses={player.bonuses.length}
    aria-label={"桌上公开 "+player.melds.length+" 组明牌及 "+player.bonuses.length+" 张花牌或动物牌"}>
    <div className="mj-public-fit" ref={fitRef}>
      <DisplayMelds player={player} windByPlayer={windByPlayer}/>
      {player.melds.length===0&&player.bonuses.length===0&&
        <span className="mj-public-empty">尚未公开牌</span>}
    </div>
  </div>;
}
function Seat({position,player,view,active,latest,score,windByPlayer,dealer,arrivingId,canNudge,onNudge}:{
  position:SeatPosition;
  player:PlayerPublicInfo;
  view:PublicPlayerView;
  active:boolean;
  latest:{fromPlayerId:string;tile:Tile}|null;
  score:number;
  windByPlayer:Record<string,string>;
  dealer:boolean;
  arrivingId:string|null;
  canNudge?:boolean;
  onNudge?:()=>void;
}) {
  const newest=latest?.fromPlayerId===player.id?latest.tile.id:null;
  // Keep the visual table finite. The server's complete chronological river
  // remains intact and can be inspected page-by-page without nested scrolling.
  const [openPanel,setOpenPanel]=useState<"river"|"public"|null>(null);
  const [historyPage,setHistoryPage]=useState(0);
  const dialogRef=useRef<HTMLDivElement>(null);
  const dialogTrigger=useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{
    if(openPanel)dialogRef.current?.focus();
    else dialogTrigger.current?.focus();
  },[openPanel]);
  const allRows=riverRows(view.discards);
  const visibleRows=allRows.slice(-2);
  const earlierTiles=view.discards.length-visibleRows.reduce((total,line)=>total+line.length,0);
  const historyPageCount=Math.max(1,Math.ceil(view.discards.length/18));
  // One entire physical meld + up to three flowers per page fits even a short
  // landscape modal. Never crop a single claimed Chi/Pong/Kong or a flower.
  const publicPageCount=Math.max(1,view.melds.length,Math.ceil(view.bonuses.length/3));
  const currentPageCount=openPanel==="river"?historyPageCount:publicPageCount;
  const page=Math.min(historyPage,currentPageCount-1);
  const showPanel=(kind:"river"|"public",trigger:HTMLButtonElement)=>{
    dialogTrigger.current=trigger;
    setHistoryPage(0);
    setOpenPanel(kind);
  };
  return <section className={"mj-seat mj-seat-"+position+(active?" mj-seat-turn":"")}
      aria-label={player.nickname+" 的弃牌区"}>
    <div className="mj-seat-header">
      <span className={"mj-avatar"+(player.isBot?" mj-avatar-bot":" mj-avatar-human")}
        title={player.isBot?"练习机器人":"真人玩家"} aria-hidden="true">
        {player.isBot?
          <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <rect x="6" y="10" width="20" height="16" rx="5" fill="currentColor"/>
            <rect x="14" y="5" width="4" height="6" rx="2" fill="currentColor"/>
            <circle cx="12" cy="17" r="2.2" fill="#103d31"/>
            <circle cx="20" cy="17" r="2.2" fill="#103d31"/>
            <rect x="11" y="22" width="10" height="2" rx="1" fill="#103d31"/>
          </svg>:
          <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <circle cx="16" cy="12" r="6" fill="currentColor"/>
            <path d="M5 29c1-8 6-11 11-11s10 3 11 11" fill="currentColor"/>
          </svg>}
      </span>
      <span className="mj-wind">{windText(player.seat)}</span>
      <strong>{player.nickname}</strong>
      {dealer&&<span className="mj-dealer-pill" title="本局庄家">庄</span>}
      {player.isBot&&<span className="mj-bot-label" title="练习机器人">BOT</span>}
      <span className="mj-seat-score">{score}分</span>
      {position!=="bottom"&&<span className="mj-seat-count">{view.concealedCount}张</span>}
      {active&&<span className="mj-turn-pill">{player.isBot?"Bot 回合":"行动中"}</span>}
      {canNudge&&onNudge&&<button type="button" className="mj-turn-nudge"
        aria-label={"提醒 "+player.nickname+" 轮到出牌"} onClick={onNudge}>
        ✨ 提醒
      </button>}
    </div>
    {position!=="bottom"&&<TileBack count={view.concealedCount} side={position}/>}
    <div className="mj-discard-panel">
      <div className="mj-discard-title">
        <span>弃牌 {view.discards.length}</span>
        <button type="button" className="mj-river-open" onClick={event=>showPanel("river",event.currentTarget)}
          aria-label={"查看 "+player.nickname+" 全部弃牌"}>
          {earlierTiles>0?"较早 +"+earlierTiles:"全部"} ↗
        </button>
      </div>
      <div className="mj-river" data-seat={position}
        aria-label={player.nickname+" 依时间顺序打出的牌"}>
        {view.discards.length===0?
          <span className="mj-empty-river">暂无弃牌</span>:
          visibleRows.map((line,index)=>{
            const lineNumber=allRows.length-visibleRows.length+index+1;
            return <div className="mj-river-line"
              key={lineNumber} data-line={lineNumber} aria-label={"第"+lineNumber+"排，"+line.length+"张"}>
            {line.map(tile=><TileCard mini key={tile.id} tile={tile} latest={tile.id===newest} arriving={tile.id===arrivingId}/>)}
          </div>;
          })}
      </div>
    </div>
    <div className="mj-public-tray" aria-label={player.nickname+" 的公开明牌与花牌"}>
      <FittedPublicMelds player={view} windByPlayer={windByPlayer}/>
      {/* Magnification is optional: physical exposed tiles are ALREADY
          present on the live table without clicking this control. */}
      {(view.melds.length>0||view.bonuses.length>0)&&
        <button type="button" className="mj-public-open" onClick={event=>showPanel("public",event.currentTarget)}
          aria-label={"放大查看 "+player.nickname+" 全部公开组合与花牌"}
          title="放大查看公开牌">⤢</button>}
    </div>
    {openPanel&&<div className="mj-history-backdrop" aria-hidden="true"
      onClick={()=>setOpenPanel(null)}/>}
    {openPanel&&<div className="mj-history-dialog" role="dialog" aria-modal="true"
      ref={dialogRef} tabIndex={-1} aria-label={player.nickname+(openPanel==="river"?" 的完整弃牌记录":" 的全部公开组合")}
      onKeyDown={event=>{
        if(event.key==="Escape"){
          event.stopPropagation();
          setOpenPanel(null);
          return;
        }
        if(event.key!=="Tab")return;
        const items=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        if(!items.length){event.preventDefault();return;}
        const first=items[0],last=items[items.length-1];
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===event.currentTarget)){
          event.preventDefault();last.focus();
        }else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===event.currentTarget)){
          event.preventDefault();first.focus();
        }
      }}>
      <div className="mj-history-heading">
        <strong>{player.nickname} · {openPanel==="river"?"按出牌时间排列":"公开明牌与花牌"}</strong>
        <button type="button" onClick={()=>setOpenPanel(null)}>关闭</button>
      </div>
      {openPanel==="river"?
        <div className="mj-history-river" aria-label="分页显示完整弃牌记录">
          {riverRows(view.discards.slice(page*18,(page+1)*18)).map((line,i)=>
            <div className="mj-history-line" key={i}>
              {line.map(tile=><TileCard key={tile.id} tile={tile} mini
                latest={tile.id===newest}/>)}
            </div>)}
          {view.discards.length===0&&<span>暂无弃牌</span>}
        </div>:
        <div className="mj-history-public">
          <DisplayMelds player={{...view,bonuses:view.bonuses.slice(page*3,page*3+3),
            melds:view.melds.slice(page,page+1)}} windByPlayer={windByPlayer}/>
          {view.bonuses.length===0&&view.melds.length===0&&<span>暂无公开明牌或花牌</span>}
        </div>}
      <div className="mj-history-pagination">
        <button type="button" disabled={page===0} onClick={()=>setHistoryPage(p=>p-1)}>上一页</button>
        <span>{page+1} / {currentPageCount}</span>
        <button type="button" disabled={page>=currentPageCount-1} onClick={()=>setHistoryPage(p=>p+1)}>下一页</button>
      </div>
    </div>}
  </section>;
}

function ActionButton({children,onClick,disabled=false,kind="secondary"}:{
  children:ReactNode;onClick:()=>void;disabled?:boolean;kind?:"primary"|"secondary"|"win"
}) {
  return <button type="button" className={"mj-action mj-action-"+kind} onClick={onClick} disabled={disabled}>{children}</button>;
}
const lookup=(hand:readonly Tile[],ids:readonly string[])=>ids.map(id=>{
  const tile=hand.find(x=>x.id===id);
  return tile?tileAppearance(tile).accessibleName:"未知";
}).join(" ");

export default function MahjongTable({
  room,game,viewerId,connection,pending,onAction,onCopyInvite,
  onTurnNudge,attentionEvent,nudgeNotice,
  isOwner=false,lobbyBusy=false,onReady,onNextRound
}:MahjongTableProps) {
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [nudgeNow,setNudgeNow]=useState(Date.now());
  const [showAttention,setShowAttention]=useState(false);
  const [flashEnabled,setFlashEnabled]=useState(()=>{
    try{return window.localStorage.getItem("mahjong-friends:disable-attention-flash")!=="1";}
    catch{return true;}
  });
  useEffect(()=>{
    const timer=window.setInterval(()=>setNudgeNow(Date.now()),1000);
    return ()=>window.clearInterval(timer);
  },[]);
  useEffect(()=>{
    if(!attentionEvent)return;
    setShowAttention(true);
    const timer=window.setTimeout(()=>setShowAttention(false),1600);
    return ()=>window.clearTimeout(timer);
  },[attentionEvent?.at]);
  const handButtons=useRef(new Map<string,HTMLButtonElement>());
  const resultsRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(game.phase==="ended")resultsRef.current?.focus();
  },[game.phase,room.roundNumber]);
  const [arrivingId,setArrivingId]=useState<string|null>(null);
  const seenLastDiscard=useRef(game.lastDiscard?.tile.id??null);
  useEffect(()=>{
    const id=game.lastDiscard?.tile.id??null;
    const changed=id!==null&&id!==seenLastDiscard.current;
    seenLastDiscard.current=id;
    if(!changed)return;
    setArrivingId(id);
    const timer=setTimeout(()=>setArrivingId(null),670);
    return ()=>clearTimeout(timer);
  },[game.lastDiscard?.tile.id]);
  useEffect(()=>setSelectedId(null),[game.version]);

  const myPublic=room.players.find(p=>p.id===viewerId);
  const myPrivate=game.players.find(p=>p.id===viewerId);
  const myHand=useMemo(()=>sortedConcealedHand(myPrivate?.hand??[]),[myPrivate?.hand]);
  const canDiscard=game.phase==="discard"&&game.currentPlayerId===viewerId;
  const enabled=connection==="connected"&&!pending;
  const selected=selectedId?myHand.find(t=>t.id===selectedId):null;
  const seats=useMemo(()=>myPublic?
    seatPlayers(game,myPublic.seat,room.players):[],
    [myPublic,room.players,game]);
  const handleHandKeyboard=(event:ReactKeyboardEvent<HTMLDivElement>)=>{
    // No automatic discard on keyboard navigation. Arrow/Home/End only select;
    // pressing Enter on the separate confirm button is still required.
    if(!enabled||!canDiscard||!myHand.length)return;
    if(event.key==="Escape") {
      if(selectedId){event.preventDefault();setSelectedId(null);}
      return;
    }
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    event.preventDefault();
    const current=myHand.findIndex(tile=>tile.id===selectedId);
    let index:number;
    if(event.key==="Home")index=0;
    else if(event.key==="End")index=myHand.length-1;
    else if(current<0)index=event.key==="ArrowRight"?0:myHand.length-1;
    else index=(current+(event.key==="ArrowRight"?1:-1)+myHand.length)%myHand.length;
    const next=myHand[index];
    setSelectedId(next.id);
    handButtons.current.get(next.id)?.focus();
  };
  const claim=game.myAvailableClaims;
  const claimTile=game.pendingDiscard?.tile;
  const ownKongs=useMemo(()=>concealedKongOptions(myHand),[myHand]);
  const upgrades=useMemo(()=>addedKongOptions(myHand,myPrivate?.melds??[]),[myHand,myPrivate?.melds]);
  const feedback=tableTurnFeedback(game,room.players,viewerId);
  const currentHuman=room.players.find(p=>p.id===game.currentPlayerId&&!p.isBot);
  const canNudge=!!onTurnNudge&&connection==="connected"&&game.phase==="discard"&&
    currentHuman!==undefined&&currentHuman.id!==viewerId&&
    typeof room.turnStartedAt==="number"&&nudgeNow-room.turnStartedAt>=30_000&&
    (room.lastNudgeAt===undefined||nudgeNow-room.lastNudgeAt>=60_000);
  const outcome=game.outcome;
  const winner=outcome?.winnerId?room.players.find(p=>p.id===outcome.winnerId):null;
  if(!myPublic||!myPrivate) {
    return <div className="mj-error" role="alert">你目前不在这个牌局中。</div>;
  }
  const windByPlayer=Object.fromEntries(room.players.map(player=>[player.id,windText(player.seat)]));
  const byPosition=(position:SeatPosition)=>{
    const seat=seats.find(p=>p.position===position);
    if(!seat||!seat.game)return null;
    const user=room.players.find(p=>p.id===seat.id);
    if(!user)return null;
    return <Seat position={position} player={user} view={seat.game}
      active={feedback.activePlayerId===seat.id}
      latest={game.lastDiscard} score={room.scores?.[user.id]??0}
      dealer={game.dealerId===seat.id} arrivingId={arrivingId} windByPlayer={windByPlayer}
      canNudge={canNudge&&seat.id===game.currentPlayerId}
      onNudge={onTurnNudge}/>;
  };

  return <div className="mj-game" aria-label="四人实时麻将桌">
    {showAttention&&<div className={
      "mj-attention-overlay"+(!flashEnabled?" mj-attention-no-flash":"")}
      role="alert" aria-label="轮到你出牌了">
      <div className="mj-attention-message">
        <strong>轮到你出牌了！</strong>
        <p>其他玩家正在等你</p>
        {flashEnabled&&<button type="button" onClick={()=>{
          setFlashEnabled(false);
          try{window.localStorage.setItem("mahjong-friends:disable-attention-flash","1");}
          catch{/* local storage may be unavailable */}
          setShowAttention(false);
        }}>以后只显示文字，不闪白屏</button>}
      </div>
    </div>}
    {nudgeNotice&&<div className="mj-nudge-toast" role="status">{nudgeNotice}</div>}
    <div className="mj-topbar">
      <div>
        <p className="mj-eyebrow">MAHJONG FRIENDS · 私人牌局</p>
        <h2>好友麻将 <span className="mj-room-code">{room.code}</span></h2>
      </div>
      <div className="mj-top-actions">
        <span className={"mj-connection mj-connection-"+connection} role="status">
          <span className="mj-connection-dot"/>
          {connection==="connected"?"实时联机":connection==="connecting"?"连接中":"断线重连"}
        </span>
        <button type="button" className="mj-invite" onClick={onCopyInvite}>复制邀请链接</button>
      </div>
    </div>

    <div className="mj-meta">
      <span>第 <strong>{room.roundNumber??1}</strong> 局</span>
      <span>庄家 <strong>{room.players.find(p=>p.id===game.dealerId)?.nickname??"—"}</strong></span>
      <span>牌墙剩余 <strong>{game.liveWallCount}</strong></span>
      <span>补牌 <strong>{game.replacementWallCount}</strong></span>
      <span>第 <strong>{game.version+1}</strong> 次操作</span>
    </div>

    <div className="mj-score-strip" aria-label="玩家累计虚拟积分">
      {room.players.map(player=><div key={player.id}>
        <span>{player.nickname}</span>
        <strong className={(room.scores?.[player.id]??0)<0?"mj-negative":""}>
          {room.scores?.[player.id]??0} 分
        </strong>
      </div>)}
      <small>练习计分，非正式家规</small>
    </div>
    <div className="mj-board mj-central-discard-stage" aria-label="中央共享布局，四家独立弃牌区，每家各自显示打过的牌">
      {byPosition("top")}
      {byPosition("left")}
      <div className="mj-center">
        <span className="mj-center-logo">友</span>
        <span className="mj-center-wall">剩余 {game.liveWallCount} 张</span>
        <p className="mj-center-winds">東 · 南 · 西 · 北</p>
        <strong className={"mj-center-state mj-turn-feedback mj-feedback-"+feedback.kind} role="status"
          data-turn-kind={feedback.kind}>
          {game.phase==="ended"?
            outcome?.type==="draw"?"本局流局":(winner?.nickname??"玩家")+" 胡牌":
            feedback.headline}
        </strong>
        <span className="mj-center-detail" aria-hidden="true">{feedback.detail}</span>
        {claimTile&&<div className="mj-center-claim">当前出牌 <TileCard mini tile={claimTile}/></div>}
      </div>
      {byPosition("right")}
      {byPosition("bottom")}
    </div>

    <section className="mj-controls" aria-label="你的手牌和操作">
      <div className="mj-controls-heading">
        <div><strong>我的手牌</strong> <span>· {myPublic.nickname} · {windText(myPublic.seat)}位</span></div>
        <span className="mj-controls-help">{canDiscard?
          selected?"已选 "+tileAppearance(selected).accessibleName+" · 请按确认打出":"选牌后点击确认打出；方向键可换牌":
          game.phase==="claims"?"等待其他玩家回应，或选择抢牌":"等待轮到你"}</span>
      </div>
      <div className="mj-hand" aria-label="你的暗牌；方向键选牌、Escape 取消，再点击确认打出"
        onKeyDown={handleHandKeyboard}>
        {myHand.map(tile=><TileCard key={tile.id} tile={tile}
          selected={selected?.id===tile.id}
          buttonRef={node=>{
            if(node)handButtons.current.set(tile.id,node);
            else handButtons.current.delete(tile.id);
          }}
          onSelect={()=>setSelectedId(old=>old===tile.id?null:tile.id)}
          disabled={!enabled||!canDiscard}/>)}
      </div>
      <span className="mj-screenreader-status" role="status" aria-live="polite" aria-atomic="true">
        {canDiscard?(selected?"已选择 "+tileAppearance(selected).accessibleName+"，需点击确认打出":"轮到你出牌，请选择一张牌"):"等待行动"}
      </span>
      {game.phase==="ended"?<div className="mj-results" role="dialog" aria-modal="true"
        aria-labelledby="mj-result-heading" tabIndex={-1} ref={resultsRef}
        onKeyDown={event=>{
          // Keep keyboard navigation within the result sheet until the next
          // round; Escape cannot silently dismiss an unresolved settlement.
          if(event.key!=="Tab")return;
          const items=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
          if(!items.length){event.preventDefault();return;}
          const first=items[0],last=items[items.length-1];
          if(event.shiftKey&&(document.activeElement===first||document.activeElement===event.currentTarget)){
            event.preventDefault();last.focus();
          }else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===event.currentTarget)){
            event.preventDefault();first.focus();
          }
        }}>
        <div className="mj-results-heading">
          <span className="mj-results-kicker">第 {room.roundNumber??1} 局 · 牌局结算</span>
          <h3 id="mj-result-heading">{outcome?.type==="draw"?"本局流局":(winner?.nickname??"玩家")+" 胡牌！"}</h3>
          <p className="mj-practice-disclaimer">练习积分 · 非正式家规／非官方新马麻将番数</p>
        </div>
        {room.lastSettlement&&<>
          <section className="mj-results-score-section" aria-label="本局和累计虚拟积分">
            <h4>本局得分与累计积分</h4>
            <div className="mj-settlement-totals">
              {room.players.map(player=>{
                const delta=room.lastSettlement!.delta[player.id]??0;
                return <div key={player.id} className={delta>0?"mj-score-gain":delta<0?"mj-score-loss":"mj-score-neutral"}>
                  <span>{player.nickname}</span>
                  <strong>{delta>0?"+":""}{delta} 分</strong>
                  <small>累计 {room.lastSettlement!.totals[player.id]??0} 分</small>
                </div>;
              })}
            </div>
          </section>
          <section className="mj-results-fan-section" aria-label="练习番数计算明细">
            <h4>练习计分明细</h4>
            <div className="mj-settlement-lines">
              {room.lastSettlement.lines.map((line,i)=><div key={i}>
                <span>{line.name}</span><span>+{line.fan} 番</span>
                <small>{line.detail}</small>
              </div>)}
            </div>
          </section>
        </>}
        {room.state==="settlement"&&<div className="mj-next-round">
          <p>下一局准备：{room.players.filter(p=>p.ready).length}/4 人</p>
          {onReady&&<ActionButton kind="primary" disabled={lobbyBusy} onClick={onReady}>
            {myPublic.ready?"取消准备":"准备下一局"}</ActionButton>}
          {isOwner&&onNextRound&&<ActionButton disabled={lobbyBusy||room.players.some(p=>!p.ready)}
            onClick={onNextRound}>所有人准备好后开下一局</ActionButton>}
        </div>}
      </div>:<>
        {claim&&claimTile&&<div className="mj-claim-actions" aria-label="吃碰杠胡选择">
          <strong>有人打出了 {tileAppearance(claimTile).accessibleName}，你可以：</strong>
          <div className="mj-action-row">
            {claim.canWin&&<ActionButton kind="win" disabled={!enabled} onClick={()=>onAction({type:"claim",kind:"win"})}>胡牌</ActionButton>}
            {claim.canPong&&<ActionButton disabled={!enabled} onClick={()=>onAction({
              type:"claim",kind:"pong",tileIds:matchingHandIds(myHand,claimTile,2)
            })}>碰</ActionButton>}
            {claim.canKong&&<ActionButton disabled={!enabled} onClick={()=>onAction({
              type:"claim",kind:"kong",tileIds:matchingHandIds(myHand,claimTile,3)
            })}>明杠</ActionButton>}
            {claim.chiTileIds.map((ids,i)=><ActionButton key={ids.join("-")} disabled={!enabled} onClick={()=>onAction({
              type:"claim",kind:"chi",tileIds:ids
            })}>吃 {claim.chiTileIds.length>1?i+1+": ":""}{lookup(myHand,ids)}</ActionButton>)}
            <ActionButton disabled={!enabled} onClick={()=>onAction({type:"claim",kind:"pass"})}>过</ActionButton>
          </div>
        </div>}
        {game.phase==="claims"&&!claim&&<p className="mj-wait-note" role="status">{game.alreadyResponded?"已选择，正在等待其他人回应":"其他玩家正在考虑是否吃碰杠胡"}</p>}
        {canDiscard&&<div className="mj-action-row">
          <ActionButton kind="primary" disabled={!enabled||!selected} onClick={()=>{
            if(selected)onAction({type:"discard",tileId:selected.id});
          }}>打出所选牌 {selected?"· "+tileAppearance(selected).accessibleName:""}</ActionButton>
          {selected&&<ActionButton disabled={!enabled} onClick={()=>setSelectedId(null)}>取消选牌</ActionButton>}
          {game.canSelfWin&&<ActionButton kind="win" disabled={!enabled} onClick={()=>onAction({type:"win"})}>自摸胡牌</ActionButton>}
          {ownKongs.map(ids=><ActionButton key={ids.join("-")} disabled={!enabled}
            onClick={()=>onAction({type:"kong",kind:"concealed",tileIds:ids})}>暗杠 {lookup(myHand,ids.slice(0,1))}</ActionButton>)}
          {upgrades.map(option=><ActionButton key={option.meldIndex} disabled={!enabled}
            onClick={()=>onAction({type:"kong",kind:"added",tileId:option.tileId,meldIndex:option.meldIndex})}>
            加杠 {lookup(myHand,[option.tileId])}</ActionButton>)}
        </div>}
        {pending&&<p className="mj-wait-note" role="status">指令已提交，正在等待服务器确认…</p>}
      </>}
      <p className="mj-rule-note">牌面来自服务器实时状态；空白金框牌是「飞」，印有「白」的是白板。各家弃牌按出牌顺序排列，被吃碰杠的牌会移至对应玩家的明牌区。</p>
    </section>
  </div>;
}
