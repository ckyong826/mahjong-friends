import type { PlayerGameView } from "./engine";
import type { PlayerPublicInfo } from "../shared/room";

export interface TableTurnFeedback {
  kind:"self"|"bot"|"human"|"claims"|"ended";
  activePlayerId:string|null;
  headline:string;
  detail:string;
}

/** Render only server-acknowledged state. During claims, currentPlayerId is
 * still the discarder, NOT necessarily a player who is currently acting.
 */
export function tableTurnFeedback(
  game:Pick<PlayerGameView,"phase"|"currentPlayerId"|"pendingDiscard"|"outcome"|"alreadyResponded">,
  players:readonly PlayerPublicInfo[],
  viewerId:string
):TableTurnFeedback {
  if(game.phase==="ended")return {
    kind:"ended",activePlayerId:null,headline:"本局结束",detail:"等待结算及下一局准备"
  };
  if(game.phase==="claims")return {
    kind:"claims",activePlayerId:null,headline:"等待吃碰杠胡回应",
    detail:game.alreadyResponded?"你已回应 · 等待其他玩家":
      "所有合资格玩家回应后，服务器决定下一步"
  };
  if(game.currentPlayerId===viewerId)return {
    kind:"self",activePlayerId:viewerId,headline:"轮到你出牌",detail:"请选择手牌，再点击确认打出"
  };
  const current=players.find(p=>p.id===game.currentPlayerId);
  if(current?.isBot)return {
    kind:"bot",activePlayerId:current.id,headline:"Bot 回合",
    detail:current.nickname+" · 等待服务器自动出牌"
  };
  return {
    kind:"human",activePlayerId:game.currentPlayerId,
    headline:"等待 "+(current?.nickname??"其他玩家")+" 出牌",
    detail:"牌局由服务器同步，其他玩家暗牌不会公开"
  };
}
