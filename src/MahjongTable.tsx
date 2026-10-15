import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Tile } from "./shared/tiles";
import type { PlayerGameView, PublicPlayerView } from "./game/engine";
import type { PlayerPublicInfo, RoomPublicView } from "./shared/room";
import {
  addedKongOptions, concealedKongOptions, matchingHandIds, seatPlayers,
  sortedConcealedHand, tileAppearance, windText, type SeatPosition
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
}

function TileCard({tile,mini=false,selected=false,latest=false,onSelect,disabled=false}:{
  tile:Tile;mini?:boolean;selected?:boolean;latest?:boolean;
  onSelect?:()=>void;disabled?:boolean;
}) {
  const style=tileAppearance(tile);
  const className=[
    "mj-tile","mj-"+style.variant,mini?"mj-tile-mini":"",
    selected?"mj-tile-selected":"",latest?"mj-tile-latest":""
  ].filter(Boolean).join(" ");
  const inner=<>
    <span aria-hidden="true" className="mj-glyph">{style.glyph}</span>
    {style.suit&&<span aria-hidden="true" className="mj-suit">{style.suit}</span>}
  </>;
  if(onSelect) {
    return <button type="button" className={className} disabled={disabled}
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
function DisplayMelds({player}: {player:PublicPlayerView}) {
  return <div className="mj-showcases">
    {player.bonuses.length>0&&<div className="mj-bonus-group" aria-label="明花及动物牌">
      <span className="mj-showcase-label">花 / 动物</span>
      {player.bonuses.map(tile=><TileCard key={tile.id} tile={tile} mini/>)}
    </div>}
    {player.melds.length>0&&<div className="mj-meld-group" aria-label="公开的吃碰杠组合">
      <span className="mj-showcase-label">吃碰杠</span>
      {player.melds.map((meld,i)=><div key={i} className="mj-meld">
        <span className="mj-meld-name">{meld.kind==="chi"?"吃":meld.kind==="pong"?"碰":"杠"}</span>
        {meld.tiles?.map(tile=><TileCard tile={tile} key={tile.id} mini/>) ??
          Array.from({length:meld.tileCount},(_,j)=><span key={j} className="mj-back mj-back-small" aria-label="暗杠背面"/>)}
      </div>)}
    </div>}
  </div>;
}

function Seat({position,player,view,active,latest}:{
  position:SeatPosition;
  player:PlayerPublicInfo;
  view:PublicPlayerView;
  active:boolean;
  latest:{fromPlayerId:string;tile:Tile}|null;
}) {
  const newest=latest?.fromPlayerId===player.id?latest.tile.id:null;
  return <section className={"mj-seat mj-seat-"+position+(active?" mj-seat-turn":"")}
      aria-label={player.nickname+" 的弃牌区"}>
    <div className="mj-seat-header">
      <span className="mj-wind">{windText(player.seat)}</span>
      <strong>{player.nickname}</strong>
      {active&&<span className="mj-turn-pill">行动中</span>}
    </div>
    {position!=="bottom"&&<TileBack count={view.concealedCount} side={position}/>}
    <div className="mj-discard-panel">
      <div className="mj-discard-title">弃牌 <span>{view.discards.length}</span></div>
      <div className="mj-river" aria-label={player.nickname+" 依时间顺序打出的牌"}>
        {view.discards.length===0?
          <span className="mj-empty-river">暂无弃牌</span>:
          view.discards.map(tile=><TileCard mini key={tile.id} tile={tile} latest={tile.id===newest}/>)}
      </div>
    </div>
    <DisplayMelds player={view}/>
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
  room,game,viewerId,connection,pending,onAction,onCopyInvite
}:MahjongTableProps) {
  const [selectedId,setSelectedId]=useState<string|null>(null);
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
  const claim=game.myAvailableClaims;
  const claimTile=game.pendingDiscard?.tile;
  const ownKongs=useMemo(()=>concealedKongOptions(myHand),[myHand]);
  const upgrades=useMemo(()=>addedKongOptions(myHand,myPrivate?.melds??[]),[myHand,myPrivate?.melds]);
  const outcome=game.outcome;
  const winner=outcome?.winnerId?room.players.find(p=>p.id===outcome.winnerId):null;
  if(!myPublic||!myPrivate) {
    return <div className="mj-error" role="alert">你目前不在这个牌局中。</div>;
  }
  const byPosition=(position:SeatPosition)=>{
    const seat=seats.find(p=>p.position===position);
    if(!seat||!seat.game)return null;
    const user=room.players.find(p=>p.id===seat.id);
    if(!user)return null;
    return <Seat position={position} player={user} view={seat.game}
      active={game.phase!=="ended"&&game.currentPlayerId===seat.id}
      latest={game.lastDiscard}/>;
  };

  return <div className="mj-game" aria-label="四人实时麻将桌">
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
      <span>庄家 <strong>{room.players.find(p=>p.id===game.dealerId)?.nickname??"—"}</strong></span>
      <span>牌墙剩余 <strong>{game.liveWallCount}</strong></span>
      <span>补牌 <strong>{game.replacementWallCount}</strong></span>
      <span>第 <strong>{game.version+1}</strong> 次操作</span>
    </div>

    <div className="mj-board" aria-label="四家独立弃牌区，每家各自显示打过的牌">
      {byPosition("top")}
      {byPosition("left")}
      <div className="mj-center">
        <span className="mj-center-logo">友</span>
        <p className="mj-center-winds">東 · 南 · 西 · 北</p>
        {game.phase==="ended" ?
          <strong className="mj-center-state">{outcome?.type==="draw"?"本局流局":(winner?.nickname??"玩家")+" 胡牌"}</strong>:
          game.phase==="claims"?
            <strong className="mj-center-state">等待吃碰杠胡</strong>:
            <strong className="mj-center-state">{game.currentPlayerId===viewerId?"轮到你出牌":"等待 "+(room.players.find(p=>p.id===game.currentPlayerId)?.nickname??"其他玩家")}</strong>}
        {claimTile&&<div className="mj-center-claim">当前出牌 <TileCard mini tile={claimTile}/></div>}
      </div>
      {byPosition("right")}
      {byPosition("bottom")}
    </div>

    <section className="mj-controls" aria-label="你的手牌和操作">
      <div className="mj-controls-heading">
        <div><strong>我的手牌</strong> <span>· {myPublic.nickname} · {windText(myPublic.seat)}位</span></div>
        <span className="mj-controls-help">{canDiscard?"先选一张牌，再确认打出":game.phase==="claims"?"等待其他玩家回应，或选择抢牌":"等待轮到你"}</span>
      </div>
      <div className="mj-hand" aria-label="你的暗牌">
        {myHand.map(tile=><TileCard key={tile.id} tile={tile}
          selected={selected?.id===tile.id}
          onSelect={()=>setSelectedId(old=>old===tile.id?null:tile.id)}
          disabled={!enabled||!canDiscard}/>)}
      </div>
      {game.phase==="ended"?<div className="mj-results" role="status">
        <strong>{outcome?.type==="draw"?"本局流局":winner?.nickname+" 胡牌！"}</strong>
        <p>实际计分、结算及下一局会在 Issue #7 完成。</p>
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
