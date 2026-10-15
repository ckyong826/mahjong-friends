import type { GameState, RoundOutcome } from "./engine";
import type { Tile } from "../shared/tiles";
import type { ScoreLine, RoundSettlement } from "../shared/room";

const scoreLine=(name:string,fan:number,detail:string):ScoreLine=>({name,fan,detail});

/** A transparent, NON-OFFICIAL virtual-points practice profile.
 * Not a statement of Malaysian, Singaporean or Hong Kong regional scoring.
 */
export function scoreRound(
  game:GameState,
  roundNumber:number,
  previous:Readonly<Record<string,number>>={}
):RoundSettlement {
  if(game.phase!=="ended"||!game.outcome)throw new Error("Cannot score a round in progress");
  const outcome:RoundOutcome=game.outcome;
  const ids=game.players.map(p=>p.id);
  const delta:Record<string,number>=Object.fromEntries(ids.map(id=>[id,0]));
  const before:Record<string,number>=Object.fromEntries(ids.map(id=>[id,previous[id]??0]));
  const lines:ScoreLine[]=[];
  let fan=0;
  let winnerId:string|undefined;
  let payerId:string|undefined;
  if(outcome.type==="win") {
    winnerId=outcome.winnerId;
    if(!winnerId || !ids.includes(winnerId))throw new Error("Unknown winning player");
    const winner=game.players.find(p=>p.id===winnerId)!;
    payerId=outcome.fromPlayerId;
    const winningDiscard=outcome.selfDraw?undefined:
      game.players.find(p=>p.id===payerId)?.discards.at(-1);
    if(!outcome.selfDraw && (!payerId || !ids.includes(payerId) || !winningDiscard)) {
      throw new Error("Discarded winning tile unavailable for scoring");
    }
    const allTiles=[
      ...winner.hand,...winner.melds.flatMap(m=>m.tiles),
      ...(winningDiscard?[winningDiscard]:[])
    ];
    lines.push(scoreLine("基础胡牌",1,"结构合法的普通胡牌"));
    if(outcome.selfDraw)lines.push(scoreLine("自摸",1,"从牌墙摸到胡牌"));
    if(winner.bonuses.length>0) {
      lines.push(scoreLine("花牌及动物牌",winner.bonuses.length,
        "测试积分规则：每张明花或动物牌暂计 1 番"));
    }
    const suits=allTiles.filter(t=>t.face.family==="suit").map(t=>
      t.face.family==="suit"?t.face.suit:"");
    const honors=allTiles.some(t=>t.face.family==="wind"||t.face.family==="dragon");
    if(suits.length>0 && new Set(suits).size===1) {
      lines.push(honors?
        scoreLine("混一色",1,"同一花色加字牌（测试规则）"):
        scoreLine("清一色",2,"同一花色且无字牌（测试规则）"));
    }
    // Natural triplets only. Fei's possible substitutions do not award extra fans.
    const wind=game.players.findIndex(p=>p.id===winnerId);
    const seatWind=(["east","south","west","north"] as const)[wind];
    if(allTiles.filter(t=>t.face.family==="wind"&&t.face.wind===seatWind).length>=3) {
      lines.push(scoreLine("门风刻子",1,"自己风位至少 3 张同风牌（测试规则）"));
    }
    for(const dragon of ["red","green","white"] as const) {
      if(allTiles.filter(t=>t.face.family==="dragon"&&t.face.dragon===dragon).length>=3) {
        lines.push(scoreLine("三元刻子",1,dragon+"龙三张相同牌（测试规则）"));
      }
    }
    const feis=allTiles.filter((t:Tile)=>t.face.family==="fei").length;
    if(feis>0)lines.push(scoreLine("飞牌",0,"持有 "+feis+" 张空白飞牌；不自动增加番数"));
    fan=lines.reduce((total,line)=>total+line.fan,0);
    // Virtual match points, not real currency nor an official local payout.
    const stake=Math.max(1,fan);
    if(outcome.selfDraw) {
      for(const id of ids)if(id!==winnerId){delta[id]-=stake;delta[winnerId]+=stake;}
    } else {
      if(!payerId||payerId===winnerId)throw new Error("Invalid discarder");
      delta[payerId]-=3*stake;
      delta[winnerId]+=3*stake;
    }
  }
  const after:Record<string,number>=Object.fromEntries(ids.map(id=>[id,before[id]+delta[id]]));
  if(ids.reduce((n,id)=>n+delta[id],0)!==0)throw new Error("Virtual settlement must be zero sum");
  return {
    roundNumber,outcome:{...outcome},mode:"practice-v1",
    winnerId,payerId,fan,lines,
    delta,totals:after
  };
}
