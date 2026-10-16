import { sameNaturalFace } from "./hand";
import type { PublicMeldView, PlayerGameView } from "./engine";

/** Keep the actual chronological server discard sequence intact.
 * A river displays one 6-tile line at a time, like a physical Mahjong table.
 * NEVER sort by face: claimed tiles are removed from their owner's river
 * by the server and only the remaining chronological sequence is rendered.
 */
export function riverRows<T>(tiles:readonly T[],perLine=6):T[][] {
  if(!Number.isInteger(perLine)||perLine<1)throw new RangeError("perLine must be positive");
  const rows:T[][]=[];
  for(let i=0;i<tiles.length;i+=perLine)rows.push(tiles.slice(i,i+perLine));
  return rows;
}

/** Engine appends a claimed discard at meld.tiles[2] for Chi/Pong/Kong.
 * Added Kong appends its fourth tile at [3]; the original claimed tile stays
 * at [2]. Concealed Kong has NO publicly identifiable source/face.
 */
export function claimedMeldTileIndex(meld:PublicMeldView):number|null {
  return !meld.concealed&&!!meld.fromPlayerId&&!!meld.tiles&&meld.tiles.length>=3?2:null;
}
import type { Tile, TileFace, Wind } from "../shared/tiles";

export type SeatPosition = "bottom" | "right" | "top" | "left";
const winds: readonly Wind[] = ["east","south","west","north"];

export function seatPosition(viewerWind: Wind, otherWind: Wind): SeatPosition {
  const steps=(winds.indexOf(otherWind)-winds.indexOf(viewerWind)+4)%4;
  return (["bottom","right","top","left"] as const)[steps];
}
export function windText(wind:Wind):string {
  return ({east:"東",south:"南",west:"西",north:"北"})[wind];
}
const digits=["","一","二","三","四","五","六","七","八","九"];
export interface TileAppearance {
  glyph:string;
  suit:string;
  variant:string;
  accessibleName:string;
}
export function tileAppearance(tile:Tile):TileAppearance {
  const f:TileFace=tile.face;
  switch(f.family) {
    case "suit": {
      const type=f.suit==="characters"?"萬":f.suit==="dots"?"筒":"索";
      return {glyph:digits[f.rank],suit:type,variant:f.suit,accessibleName:digits[f.rank]+type};
    }
    case "wind": {
      const name=windText(f.wind);
      return {glyph:name,suit:"風",variant:"wind",accessibleName:name+"風"};
    }
    case "dragon": {
      const names={red:"中",green:"發",white:"白"};
      return {glyph:names[f.dragon],suit:"",variant:"dragon-"+f.dragon,accessibleName:f.dragon==="white"?"白板":names[f.dragon]};
    }
    case "flower": {
      const names={
        plum:"梅",orchid:"蘭",chrysanthemum:"菊","bamboo-flower":"竹",
        spring:"春",summer:"夏",autumn:"秋",winter:"冬"
      };
      return {glyph:names[f.flower],suit:"花",variant:"flower",accessibleName:names[f.flower]+"花"};
    }
    case "animal": {
      const names={cat:"貓",mouse:"鼠",rooster:"雞",centipede:"蜈"};
      return {glyph:names[f.animal],suit:"獸",variant:"animal",accessibleName:names[f.animal]+"牌"};
    }
    case "fei":
      // Deliberately blank face; no printed 飞 character. Gold border is for
      // identifying a blank joker visually versus the printed 白板.
      return {glyph:"",suit:"",variant:"fei",accessibleName:"飞牌，空白万能牌"};
  }
}
const faceRank=(tile:Tile):number=>{
  const f=tile.face;
  if(f.family==="suit")return ({characters:0,dots:9,bamboo:18})[f.suit]+f.rank-1;
  if(f.family==="wind")return 27+winds.indexOf(f.wind);
  if(f.family==="dragon")return 31+({red:0,green:1,white:2})[f.dragon];
  if(f.family==="fei")return 34;
  return 35;
};
export function sortedConcealedHand(tiles:readonly Tile[]):Tile[] {
  return [...tiles].sort((a,b)=>faceRank(a)-faceRank(b)||a.id.localeCompare(b.id));
}
export function matchingHandIds(hand:readonly Tile[],discard:Tile,count:2|3):string[] {
  return hand.filter(t=>sameNaturalFace(t,discard)).slice(0,count).map(t=>t.id);
}
export function concealedKongOptions(hand:readonly Tile[]):string[][] {
  const choices:string[][]=[];
  const used=new Set<string>();
  for(const tile of hand) {
    if(tile.face.family==="fei"||tile.face.family==="flower"||tile.face.family==="animal")continue;
    const same=hand.filter(t=>sameNaturalFace(t,tile));
    if(same.length!==4)continue;
    const face=same.map(t=>t.id).sort().join("|");
    if(!used.has(face)){used.add(face);choices.push(same.map(t=>t.id));}
  }
  return choices;
}
export interface AddedKong {
  meldIndex:number;
  tileId:string;
}
export function addedKongOptions(hand:readonly Tile[],melds:readonly PublicMeldView[]):AddedKong[] {
  const options:AddedKong[]=[];
  melds.forEach((meld,meldIndex)=>{
    if(meld.kind!=="pong"||meld.concealed||!meld.tiles?.length)return;
    const match=hand.find(tile=>sameNaturalFace(tile,meld.tiles![0]));
    if(match)options.push({meldIndex,tileId:match.id});
  });
  return options;
}
export function seatPlayers(game:PlayerGameView,viewerWind:Wind,players:readonly {id:string;seat:Wind}[]) {
  return players.map(p=>({
    ...p,
    position:seatPosition(viewerWind,p.seat),
    game:game.players.find(g=>g.id===p.id)
  }));
}
