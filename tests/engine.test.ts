import { describe, expect, it } from "vitest";
import {
  applyGameAction, assertTileConservation, projectPlayerView, startRound,
  type GameState, type GamePlayer, type GameAction
} from "../src/game/engine";
import { createDeck } from "../src/game/deck";
import type { Tile, TileFace } from "../src/shared/tiles";

let seq=0;
const t=(face:TileFace):Tile=>({id:"fixture-"+seq++,face});
const c=(rank:1|2|3|4|5|6|7|8|9)=>t({family:"suit",suit:"characters",rank});
const d=(rank:1|2|3|4|5|6|7|8|9)=>t({family:"suit",suit:"dots",rank});
const b=(rank:1|2|3|4|5|6|7|8|9)=>t({family:"suit",suit:"bamboo",rank});
const white=()=>t({family:"dragon",dragon:"white"});
const east=()=>t({family:"wind",wind:"east"});
const fei=()=>t({family:"fei"});
const ids=["a","b","c","d"];
const winnerWaitingForWhite=()=>[c(1),c(2),c(3),d(1),d(2),d(3),b(1),b(2),b(3),east(),east(),east(),white()];
const winnerWithWhitePair=()=>[...winnerWaitingForWhite(),white()];

function fixture(
  hands: Tile[][],
  replacement: Tile[] = [],
  live: Tile[] = []
):GameState {
  const players:GamePlayer[]=ids.map((id,i)=>({id,hand:hands[i]??[],bonuses:[],discards:[],melds:[]}));
  const allTileIds=[...live,...replacement,...players.flatMap(p=>p.hand)].map(tile=>tile.id);
  return {
    version:0,phase:"discard",players,currentPlayerIndex:0,dealerIndex:0,
    wall:{live,replacement},pendingDiscard:null,lastDiscard:null,
    outcome:null,processedActionIds:[],allTileIds
  };
}
const act=(s:GameState, playerId:string, value:Omit<GameAction,"playerId"|"actionId"|"expectedVersion">,label="action"):GameState=>
  applyGameAction(s,{...value,playerId,actionId:label+"-"+s.version,expectedVersion:s.version} as GameAction);

describe("server-authoritative game engine",()=>{
  it("deals 13 per seat and 14 to dealer, from a crypto-shufflable full deck",()=>{
    const state=startRound({playerIds:ids,deckOptions:{includeFlowers:false},randomIndex:()=>0});
    expect(state.players.map(p=>p.hand.length)).toEqual([14,13,13,13]);
    expect(state.players.every(p=>p.bonuses.length===0)).toBe(true);
    expect(state.phase).toBe("discard");
    assertTileConservation(state);
  });
  it("replaces consecutive flower/animal during initial dealing",()=>{
    const all=createDeck({includeAnimals:true});
    const spring=all.find(x=>x.face.family==="flower"&&x.face.flower==="spring")!;
    const cat=all.find(x=>x.face.family==="animal"&&x.face.animal==="cat")!;
    const whiteDragon=all.find(x=>x.face.family==="dragon"&&x.face.dragon==="white")!;
    const others=all.filter(t=>![spring.id,cat.id,whiteDragon.id].includes(t.id));
    const reserve=[...others.splice(-12),whiteDragon,cat];
    const state=startRound({playerIds:ids,replacementCount:14,shuffledTiles:[...others,spring,...reserve]});
    expect(state.players[0].bonuses.map(t=>t.id)).toEqual([spring.id,cat.id]);
    expect(state.players.map(p=>p.hand.length)).toEqual([14,13,13,13]);
    assertTileConservation(state);
  });
  it("rejects 3-seat setup rather than silently using 4-player rules",()=>{
    expect(()=>startRound({playerIds:["a","b","c"]})).toThrow(RangeError);
  });
  it("prevents out-of-turn actions, stale versions and duplicate action replays",()=>{
    const state=startRound({playerIds:ids,deckOptions:{includeFlowers:false},randomIndex:()=>0});
    const tileId=state.players[0].hand[0].id;
    expect(()=>applyGameAction(state,{type:"discard",tileId,playerId:"b",actionId:"wrong-seat",expectedVersion:0})).toThrow();
    expect(()=>applyGameAction(state,{type:"discard",tileId,playerId:"a",actionId:"stale",expectedVersion:1})).toThrow();
    const after=applyGameAction(state,{type:"discard",tileId,playerId:"a",actionId:"first",expectedVersion:0});
    expect(after.version).toBe(1);
    expect(applyGameAction(after,{type:"discard",tileId,playerId:"a",actionId:"first",expectedVersion:0})).toBe(after);
    expect(state.players[0].hand.some(t=>t.id===tileId)).toBe(true); // original immutable
    assertTileConservation(after);
  });
  it("lets only a valid Pong claimant seize and relocate the discarded tile",()=>{
    const discard=c(5);
    let state=fixture([[discard],[c(5),c(5)],[],[]]);
    state=act(state,"a",{type:"discard",tileId:discard.id},"discard");
    expect(state.phase).toBe("claims");
    expect(state.players[0].discards.map(x=>x.id)).toEqual([discard.id]);
    state=act(state,"b",{type:"claim",kind:"pong",tileIds:state.players[1].hand.map(x=>x.id)},"pong");
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.phase).toBe("discard");
    expect(state.players[0].discards).toHaveLength(0);
    expect(state.players[1].melds[0].kind).toBe("pong");
    expect(state.players[1].melds[0].tiles.map(x=>x.id)).toContain(discard.id);
    assertTileConservation(state);
  });
  it("resolves Pong before Chow, even if Chow was declared first",()=>{
    const discard=c(2);
    let state=fixture([[discard],[c(1),c(3)],[c(2),c(2)],[]]);
    state=act(state,"a",{type:"discard",tileId:discard.id},"discard");
    const chiIds=state.players[1].hand.map(t=>t.id);
    state=act(state,"b",{type:"claim",kind:"chi",tileIds:chiIds},"chi");
    expect(state.phase).toBe("claims"); // wait for other eligible claimant
    state=act(state,"c",{type:"claim",kind:"pong",tileIds:state.players[2].hand.map(t=>t.id)},"pong");
    expect(state.currentPlayerIndex).toBe(2);
    expect(state.players[2].melds[0].kind).toBe("pong");
    expect(state.players[1].melds).toHaveLength(0);
    assertTileConservation(state);
  });
  it("resolves a discarded Hu ahead of an earlier Pong claim",()=>{
    const discarded=white();
    let state=fixture([[discarded],winnerWaitingForWhite(),[white(),white()],[]]);
    state=act(state,"a",{type:"discard",tileId:discarded.id},"discard");
    state=act(state,"c",{type:"claim",kind:"pong",tileIds:state.players[2].hand.map(t=>t.id)},"pong");
    state=act(state,"b",{type:"claim",kind:"win"},"win");
    expect(state.phase).toBe("ended");
    expect(state.outcome).toEqual({type:"win",winnerId:"b",fromPlayerId:"a",selfDraw:false});
    expect(state.players[0].discards.map(t=>t.id)).toEqual([discarded.id]);
    assertTileConservation(state);
  });
  it("rejects forged tile IDs or an invalid meld without state mutation",()=>{
    const discard=c(5);
    const state=act(fixture([[discard],[c(5),c(5)],[],[]]),"a",{type:"discard",tileId:discard.id},"discard");
    const before=JSON.stringify(state);
    expect(()=>act(state,"b",{type:"claim",kind:"pong",tileIds:["forged","other"]},"invalid")).toThrow();
    expect(JSON.stringify(state)).toBe(before);
  });
  it("allows passes, then auto-draws for the next seat",()=>{
    const discard=c(5),drawn=d(4);
    let state=fixture([[discard],[c(5),c(5)],[],[],],[],[drawn]);
    state=act(state,"a",{type:"discard",tileId:discard.id},"discard");
    state=act(state,"b",{type:"claim",kind:"pass"},"pass");
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.players[1].hand.some(t=>t.id===drawn.id)).toBe(true);
    expect(state.pendingDiscard).toBeNull();
    assertTileConservation(state);
  });
  it("draws a replacement tile after a concealed Kong",()=>{
    const tiles=[c(9),c(9),c(9),c(9)],replacement=[d(7)];
    const initial=fixture([tiles,[],[],[]],replacement);
    const next=act(initial,"a",{type:"kong",kind:"concealed",tileIds:tiles.map(t=>t.id)},"kong");
    expect(next.players[0].melds[0].tiles).toHaveLength(4);
    expect(next.players[0].hand.map(t=>t.id)).toEqual([replacement[0].id]);
    expect(next.players[0].melds[0].concealed).toBe(true);
    assertTileConservation(next);
  });
  it("adds a fourth matching tile to an already public Pong",()=>{
    const added=c(4),pong=[c(4),c(4),c(4)],replacement=[d(8)];
    const state=fixture([[added],[],[],[]],replacement);
    state.players[0].melds=[{kind:"pong",tiles:pong,fromPlayerId:"b",concealed:false}];
    state.allTileIds.push(...pong.map(t=>t.id));
    const after=act(state,"a",{type:"kong",kind:"added",tileId:added.id,meldIndex:0},"added");
    expect(after.players[0].melds[0].kind).toBe("kong");
    expect(after.players[0].melds[0].tiles).toHaveLength(4);
    expect(after.players[0].hand[0].id).toBe(replacement[0].id);
    assertTileConservation(after);
  });
  it("accepts self-draw Hu only on a structurally winning hand",()=>{
    const state=fixture([winnerWithWhitePair(),[],[],[]]);
    const ended=act(state,"a",{type:"win"},"self-win");
    expect(ended.outcome).toEqual({type:"win",winnerId:"a",selfDraw:true});
    expect(()=>act(fixture([[fei()],[],[],[]]),"a",{type:"win"},"bad-win")).toThrow();
    assertTileConservation(ended);
  });
  it("never includes opponents' concealed tiles or any wall identities in player projections",()=>{
    const state=startRound({playerIds:ids,deckOptions:{includeFlowers:false},randomIndex:()=>0});
    const view=projectPlayerView(state,"b");
    expect(view.players[1].hand).toHaveLength(13);
    expect(view.players[0].hand).toBeUndefined();
    expect(view.players[2].hand).toBeUndefined();
    expect(view.players[3].hand).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain('"allTileIds"');
    expect(JSON.stringify(view)).not.toContain('"replacement"');
    expect(()=>projectPlayerView(state,"stranger")).toThrow();
  });
  it("passes over non-claimable Fei without treating it as a natural Pong",()=>{
    const flying=fei();
    const state=act(fixture([[flying],[fei(),fei()],[],[]],[d(1)]),"a",{type:"discard",tileId:flying.id},"fly");
    expect(state.phase).toBe("discard");
    expect(state.players[0].discards.map(t=>t.id)).toEqual([flying.id]);
    assertTileConservation(state);
  });
});
