import { describe, expect, it } from "vitest";
import { parseClientMessage } from "../worker/protocol";

const base={actionId:"action-1",expectedVersion:2};
const parse=(action:Record<string,unknown>)=>
  parseClientMessage(JSON.stringify({type:"game_action",action}));

describe("realtime command security",()=>{
  it("supports snapshot sync and ping only as known control commands",()=>{
    expect(parseClientMessage('{"type":"sync"}')).toEqual({type:"sync"});
    expect(parseClientMessage('{"type":"ping"}')).toEqual({type:"ping"});
    expect(()=>parseClientMessage('{"type":"draw"}')).toThrow();
    expect(()=>parseClientMessage('not-json')).toThrow();
    expect(()=>parseClientMessage("x".repeat(2049))).toThrow();
    expect(()=>parseClientMessage(new ArrayBuffer(3))).toThrow();
  });
  it("accepts legitimate discard and strips spoofed actor and wall values",()=>{
    const parsed=parse({...base,type:"discard",tileId:"050",playerId:"somebody-else",
      wall:["cheated-tile"],selectedDraw:"050"});
    expect(parsed).toEqual({type:"game_action",action:{...base,type:"discard",tileId:"050"}});
    expect(JSON.stringify(parsed)).not.toContain("somebody-else");
  });
  it("validates Pong/Chow/Kong claims and disallows duplicate or forged tile IDs",()=>{
    expect(parse({...base,type:"claim",kind:"chi",tileIds:["001","002"]}))
      .toEqual({type:"game_action",action:{...base,type:"claim",kind:"chi",tileIds:["001","002"]}});
    expect(parse({...base,type:"claim",kind:"pass"}).type).toBe("game_action");
    for(const action of [
      {...base,type:"claim",kind:"chi",tileIds:["001"]},
      {...base,type:"claim",kind:"pong",tileIds:["001","001"]},
      {...base,type:"claim",kind:"kong",tileIds:["001","002"]},
      {...base,type:"claim",kind:"pass",tileIds:["001"]},
      {...base,type:"claim",kind:"cheat"},
      {...base,type:"claim",kind:"kong",tileIds:["001","002","../../../etc"]}
    ])expect(()=>parse(action)).toThrow();
  });
  it("accepts both Kong modes but never arbitrary meld indexes",()=>{
    expect(parse({...base,type:"kong",kind:"concealed",tileIds:["1","2","3","4"]}).type).toBe("game_action");
    expect(parse({...base,type:"kong",kind:"added",tileId:"1",meldIndex:0}).type).toBe("game_action");
    expect(()=>parse({...base,type:"kong",kind:"added",tileId:"1",meldIndex:100})).toThrow();
  });
  it("rejects forged state versions and unsupported game actions",()=>{
    for(const action of [
      {...base,type:"discard",tileId:"abc",expectedVersion:-1},
      {...base,type:"discard",tileId:"abc",expectedVersion:"0"},
      {...base,type:"discard",tileId:"abc",actionId:""},
      {...base,type:"discard",tileId:"abc",actionId:"x".repeat(129)},
      {...base,type:"draw",tileId:"unfair"},
      {...base,type:"discard",tileId:{value:"abc"}}
    ])expect(()=>parse(action)).toThrow();
  });
  it("supports self-win without a client-supplied winner ID",()=>{
    expect(parse({...base,type:"win",winnerId:"spoof"}))
      .toEqual({type:"game_action",action:{...base,type:"win"}});
  });
});
