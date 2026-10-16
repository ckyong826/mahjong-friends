import {describe,expect,it} from "vitest";
import {tableTurnFeedback} from "../src/game/turnFeedback";
import type {PlayerGameView} from "../src/game/engine";
import type {PlayerPublicInfo} from "../src/shared/room";

const players:PlayerPublicInfo[]=[
 {id:"a",nickname:"Alice",seat:"east",ready:true,connected:true},
 {id:"bot-1",nickname:"🤖 南位练习机器人",seat:"south",ready:true,connected:true,isBot:true},
 {id:"c",nickname:"Chris",seat:"west",ready:true,connected:true},
 {id:"bot-2",nickname:"🤖 北位练习机器人",seat:"north",ready:true,connected:true,isBot:true}
];
const state=(phase:PlayerGameView["phase"],currentPlayerId:string,alreadyResponded=false)=>{
 return {
   phase,currentPlayerId,alreadyResponded,pendingDiscard:null,outcome:null
 } satisfies Pick<PlayerGameView,"phase"|"currentPlayerId"|"alreadyResponded"|"pendingDiscard"|"outcome">;
};
describe("server-authoritative activity captions",()=>{
 it("announces human's own discard turn only while discard phase",()=>{
   const f=tableTurnFeedback(state("discard","a"),players,"a");
   expect(f).toMatchObject({kind:"self",activePlayerId:"a",headline:"轮到你出牌"});
 });
 it("announces a Bot turn without claiming to have already moved",()=>{
   const f=tableTurnFeedback(state("discard","bot-1"),players,"a");
   expect(f.kind).toBe("bot");
   expect(f.activePlayerId).toBe("bot-1");
   expect(f.detail).toContain("等待服务器");
 });
 it("identifies an actual human rather than a Bot when friend replaces a seat",()=>{
   const f=tableTurnFeedback(state("discard","c"),players,"a");
   expect(f.kind).toBe("human");
   expect(f.headline).toContain("Chris");
   const replacements=players.map(p=>p.id==="bot-1"?{...p,isBot:false,nickname:"Bob"}:p);
   expect(tableTurnFeedback(state("discard","bot-1"),replacements,"a").kind).toBe("human");
 });
 it("never marks original discarder as still acting during claims",()=>{
   const f=tableTurnFeedback(state("claims","bot-1"),players,"a");
   expect(f).toMatchObject({kind:"claims",activePlayerId:null});
   expect(f.headline).toContain("回应");
   const responded=tableTurnFeedback(state("claims","bot-1",true),players,"a");
   expect(responded.activePlayerId).toBeNull();
   expect(responded.detail).toContain("你已回应");
 });
 it("never announces anyone as acting in a settled round",()=>{
   const f=tableTurnFeedback(state("ended","bot-1"),players,"a");
   expect(f).toMatchObject({kind:"ended",activePlayerId:null});
 });
});
