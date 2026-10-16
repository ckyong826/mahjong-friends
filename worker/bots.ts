import { applyGameAction, possibleClaims, type GameAction, type GameState } from "../src/game/engine";
import { isStandardWinningHand, sameNaturalFace } from "../src/game/hand";
import type { Tile } from "../src/shared/tiles";
import type { RoomRecord } from "./roomCore";

/** Training bot policy: use only actual server state, never a client-supplied hand
 * or selectable wall order. Bots are simple opponents, not strong Mahjong AI.
 */
function pickDiscard(hand:readonly Tile[]):Tile {
  const candidates=hand.filter(t=>t.face.family!=="flower"&&t.face.family!=="animal");
  if(candidates.length===0)throw new Error("Bot cannot discard an empty hand");
  const value=(tile:Tile):number=>{
    if(tile.face.family==="fei")return 1_000; // keep jokers
    const pairs=hand.filter(other=>other.id!==tile.id&&sameNaturalFace(other,tile)).length;
    let neighbours=0;
    if(tile.face.family==="suit"){
      neighbours=hand.filter(other=>other.face.family==="suit"&&
        other.face.suit===tile.face.suit&&
        Math.abs(other.face.rank-tile.face.rank)>0&&
        Math.abs(other.face.rank-tile.face.rank)<=2).length;
    }
    // Low-valued isolated honors and numerals are discarded before useful sets.
    return pairs*10+neighbours*3;
  };
  return [...candidates].sort((a,b)=>value(a)-value(b)||a.id.localeCompare(b.id))[0];
}

export function nextBotAction(room:RoomRecord,makeId:()=>string):GameAction|null {
  const state=room.game;
  if(!state||room.state!=="playing"||state.phase==="ended")return null;
  const bots=new Set(room.members.filter(m=>m.isBot===true).map(m=>m.id));
  let playerId:string;
  let payload:
    | {type:"discard";tileId:string}
    | {type:"claim";kind:"pass"|"win"|"chi"|"pong"|"kong";tileIds?:string[]}
    | {type:"win"};

  if(state.phase==="claims"&&state.pendingDiscard){
    const pending=state.pendingDiscard;
    const botId=pending.eligiblePlayerIds.find(id=>
      bots.has(id) && !pending.responses.some(reply=>reply.playerId===id));
    if(!botId)return null; // Wait for human claim/pass.
    playerId=botId;
    const index=state.players.findIndex(p=>p.id===playerId);
    const source=state.players.findIndex(p=>p.id===pending.fromPlayerId);
    const opts=possibleClaims(state,index,pending.tile,source);
    const match=state.players[index].hand.filter(t=>sameNaturalFace(t,pending.tile));
    if(opts.canWin)payload={type:"claim",kind:"win"};
    else if(opts.canKong)payload={type:"claim",kind:"kong",tileIds:match.slice(0,3).map(t=>t.id)};
    else if(opts.canPong)payload={type:"claim",kind:"pong",tileIds:match.slice(0,2).map(t=>t.id)};
    else if(opts.chiTileIds.length)payload={type:"claim",kind:"chi",tileIds:opts.chiTileIds[0]};
    else payload={type:"claim",kind:"pass"};
  } else if(state.phase==="discard"){
    playerId=state.players[state.currentPlayerIndex].id;
    if(!bots.has(playerId))return null; // Human controls their own hand.
    const actor=state.players[state.currentPlayerIndex];
    if(isStandardWinningHand(actor.hand,actor.melds.length))payload={type:"win"};
    else payload={type:"discard",tileId:pickDiscard(actor.hand).id};
  } else return null;
  return {playerId,expectedVersion:state.version,actionId:"bot-"+makeId(),...payload};
}

/** At most one bot action per alarm, creating visible turn-by-turn updates. */
export function advanceOneBot(room:RoomRecord,makeId:()=>string):RoomRecord {
  const action=nextBotAction(room,makeId);
  if(!action)return room;
  const game=applyGameAction(room.game as GameState,action);
  return {...room,game,revision:room.revision+1};
}
