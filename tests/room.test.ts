import { describe, expect, it } from "vitest";
import { assertTileConservation, projectPlayerView } from "../src/game/engine";
import {
  DEFAULT_RULES, findMember, joinRoom, makeRoomCode, newRoom,
  publicRoom, readyRoom, configureRoom, removeRoomMember, startRoom,
  validateNickname, validateRules
} from "../worker/roomCore";

const create=()=>newRoom("ABCDEFG".slice(0,6),"host","hash-a","房主",1000);
function full() {
  let room=create();
  room=joinRoom(room,"p2","hash-b","乙",1001);
  room=joinRoom(room,"p3","hash-c","丙",1002);
  room=joinRoom(room,"p4","hash-d","丁",1003);
  return room;
}
describe("private lobby domain model",()=>{
  it("creates a six-character unambiguous code and assigns east to owner",()=>{
    const code=makeRoomCode(()=>0);
    expect(code).toBe("AAAAAA");
    expect(create().members[0].seat).toBe("east");
    expect(create().rules.feiCount).toBe(4);
    expect(create().rules.includeAnimals).toBe(true);
    expect(create().state).toBe("waiting");
  });
  it("joins 4 unique players and rejects the fifth",()=>{
    const room=full();
    expect(room.members.map(m=>m.seat)).toEqual(["east","south","west","north"]);
    expect(()=>joinRoom(room,"p5","hash-e","戊",1004)).toThrow("房间已满");
    expect(room.members).toHaveLength(4);
    expect(new Set(room.members.map(m=>m.id)).size).toBe(4);
  });
  it("enforces both player ID and private membership credential uniqueness",()=>{
    const room=create();
    expect(()=>joinRoom(room,"host","hash-b","乙",1002)).toThrow("重复加入");
    expect(()=>joinRoom(room,"p2","hash-a","乙",1002)).toThrow("重复加入");
    expect(findMember(room,"hash-a").id).toBe("host");
    expect(()=>findMember(room,"invalid")).toThrow();
    expect(JSON.stringify(publicRoom(room,1003))).not.toContain("hash-a");
  });
  it("rejects empty, control-character and long nicknames",()=>{
    expect(validateNickname("  阿明  ")).toBe("阿明");
    for(const name of [" ","bad\nname","x".repeat(21)])expect(()=>validateNickname(name)).toThrow();
  });
  it("does not allow a 3-player variant before its rule engine exists",()=>{
    expect(()=>validateRules({...DEFAULT_RULES,seats:3,variant:"malaysia-three-player"})).toThrow();
  });
  it("only the owner may change rules; updates invalidate prior ready status",()=>{
    const ready=readyRoom(create(),"host",true);
    expect(()=>configureRoom(ready,"intruder",{...DEFAULT_RULES})).toThrow();
    const hongKong=configureRoom(ready,"host",{
      variant:"hong-kong-four-player",seats:4,feiCount:0,includeAnimals:false,minimumFan:1
    });
    expect(hongKong.members[0].ready).toBe(false);
    expect(hongKong.rules.feiCount).toBe(0);
    expect(()=>validateRules({...DEFAULT_RULES,variant:"hong-kong-four-player"})).toThrow();
  });
  it("requires exactly 4 ready players before server deals the round",()=>{
    let room=full();
    expect(()=>startRoom(room,"host")).toThrow("四人全部准备");
    for(const member of room.members)room=readyRoom(room,member.id,true);
    expect(()=>startRoom(room,"p2")).toThrow("只有房主");
    const started=startRoom(room,"host");
    expect(started.state).toBe("playing");
    expect(started.game).not.toBeNull();
    expect(started.game!.players.map(p=>p.hand.length)).toEqual([14,13,13,13]);
    assertTileConservation(started.game!);
    expect(projectPlayerView(started.game!,"host").players[1].hand).toBeUndefined();
    expect(()=>joinRoom(started,"p5","hash-e","戊",1010)).toThrow("牌局已经开始");
    expect(()=>readyRoom(started,"host",true)).toThrow("牌局已经开始");
  });
  it("only allows house owner to kick; member may leave and owner transfers seat",()=>{
    let room=full();
    expect(()=>removeRoomMember(room,"p2","p3")).toThrow("只有房主");
    room=removeRoomMember(room,"host","p3");
    expect(room.members).toHaveLength(3);
    room=joinRoom(room,"p5","hash-e","戊",1005);
    expect(room.members.at(-1)?.seat).toBe("west");
    room=removeRoomMember(room,"host","host");
    expect(room.ownerId).toBe("p2");
    expect(()=>findMember(room,"hash-a")).toThrow();
  });
  it("signals presence only for clients polling recently",()=>{
    const room=create();
    expect(publicRoom(room,15_000).players[0].connected).toBe(true);
    expect(publicRoom(room,30_000).players[0].connected).toBe(false);
  });
});
