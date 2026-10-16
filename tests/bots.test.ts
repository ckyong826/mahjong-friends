import { describe, expect, it } from "vitest";
import { applyGameAction, assertTileConservation } from "../src/game/engine";
import { advanceOneBot, nextBotAction } from "../worker/bots";
import {
  configureRoom, DEFAULT_RULES, fillRoomWithBots, joinRoom,
  newRoom, publicRoom, readyRoom, removeRoomMember, settleRoom, startRoom,
  type RoomRecord
} from "../worker/roomCore";

let serial=0;
const ids=()=>String(++serial);
const create=()=>newRoom("ABCDEF","human","real-hash","Test player",1000);
const fill=(room:RoomRecord)=>fillRoomWithBots(room,"human",1001,ids);

describe("opt-in beginner practice bots",()=>{
  it("fills exactly three missing seats and readies bots automatically",()=>{
    const room=fill(create());
    expect(room.members).toHaveLength(4);
    expect(room.members.filter(m=>m.isBot)).toHaveLength(3);
    expect(room.members.map(m=>m.seat)).toEqual(["east","south","west","north"]);
    expect(room.members.filter(m=>m.isBot).every(m=>m.ready)).toBe(true);
    expect(room.members[0].ready).toBe(false);
    expect(room.members.filter(m=>m.isBot).every(m=>!m.tokenHash.match(/^[a-f0-9]{64}$/))).toBe(true);
    const snapshot=publicRoom(room,50_000);
    expect(snapshot.players.filter(m=>m.isBot).every(m=>m.connected)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain("real-hash");
    expect(JSON.stringify(snapshot)).not.toContain("bot:no-login");
  });
  it("accepts only a host request, only before play and idempotently fills open seats",()=>{
    expect(()=>fillRoomWithBots(create(),"outsider",1001,ids)).toThrow("房主");
    const full=fill(create());
    expect(fill(full).members).toHaveLength(4);
    const started=startRoom(readyRoom(full,"human",true),"human");
    expect(()=>fill(started)).toThrow("开局前");
    expect(started.game).not.toBeNull();
  });
  it("real joiners replace a bot before starting, keeping same occupied seat",()=>{
    const room=fill(create());
    const lastBot=room.members.at(-1)!;
    const entered=joinRoom(room,"friend","friend-hash","Friend",1002);
    expect(entered.members).toHaveLength(4);
    expect(entered.members.find(m=>m.id==="friend")?.seat).toBe(lastBot.seat);
    expect(entered.members.find(m=>m.id===lastBot.id)).toBeUndefined();
    expect(entered.scores[lastBot.id]).toBeUndefined();
    expect(entered.scores.friend).toBe(0);
    expect(entered.members.filter(m=>m.isBot)).toHaveLength(2);
    expect(entered.members.find(m=>m.id==="friend")?.ready).toBe(false);
    expect(()=>joinRoom(readyRoom(entered,"human",true),"friend","duplicate","Friend",1010)).toThrow();
  });
  it("owner can kick a bot or reset rules without making bots unready",()=>{
    const room=fill(create());
    const bot=room.members.find(m=>m.isBot)!;
    const withoutBot=removeRoomMember(room,"human",bot.id);
    expect(withoutBot.members).toHaveLength(3);
    const restored=fill(withoutBot);
    const changed=configureRoom(restored,"human",{...DEFAULT_RULES,feiCount:0});
    expect(changed.members.filter(m=>m.isBot).every(m=>m.ready)).toBe(true);
  });
  it("bots never act on a human turn, even after opening a round",()=>{
    const room=startRoom(readyRoom(fill(create()),"human",true),"human");
    expect(room.game?.currentPlayerIndex).toBe(0);
    expect(nextBotAction(room,ids)).toBeNull();
    expect(advanceOneBot(room,ids)).toBe(room);
  });
  it("plays a complete 1-human 3-bot round and zero-sum settles without fake wall access",()=>{
    let room=startRoom(readyRoom(fill(create()),"human",true),"human");
    let actions=0;
    while(room.state==="playing"&&actions<500){
      const game=room.game!;
      if(game.phase==="ended") {
        room=settleRoom(room);break;
      }
      const bot=nextBotAction(room,ids);
      if(bot) {
        const next=applyGameAction(game,bot);
        assertTileConservation(next);
        room={...room,game:next};actions++;continue;
      }
      const human=game.players[0];
      const action=game.phase==="claims"
        ? game.pendingDiscard?.eligiblePlayerIds.includes("human") &&
          !game.pendingDiscard.responses.some(r=>r.playerId==="human")
          ? {type:"claim" as const,kind:"pass" as const}
          : null
        : game.currentPlayerIndex===0
          ? {type:"discard" as const,tileId:human.hand[0]?.id}
          : null;
      if(!action)throw new Error("Stalled when no bot or human could act");
      const next=applyGameAction(game,{
        ...action,playerId:"human",actionId:"human-"+ids(),expectedVersion:game.version
      });
      assertTileConservation(next);
      room={...room,game:next};actions++;
    }
    if(room.state==="playing"&&room.game?.phase==="ended")room=settleRoom(room);
    expect(room.state,"Entire game should finish, not stall").toBe("settlement");
    expect(actions).toBeGreaterThan(20);
    expect(room.game?.phase).toBe("ended");
    expect(Object.values(room.scores).reduce((a,b)=>a+b,0)).toBe(0);
    expect(room.members.filter(m=>m.isBot).every(m=>m.ready)).toBe(true);
    expect(room.members.find(m=>m.id==="human")?.ready).toBe(false);
    const next=startRoom(readyRoom(room,"human",true),"human");
    expect(next.roundNumber).toBe(2);
    expect(next.game?.dealerIndex).toBe(1);
  });
});
