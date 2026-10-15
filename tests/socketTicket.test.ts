import { describe, expect, it } from "vitest";
import { consumeTicket, pruneTickets } from "../worker/socketTicket";

describe("ephemeral websocket admission tickets",()=>{
  it("prunes expired tickets and never changes an old store in place",()=>{
    const existing={a:{playerId:"a",expiresAt:100},b:{playerId:"b",expiresAt:200}};
    expect(pruneTickets(existing,100)).toEqual({b:{playerId:"b",expiresAt:200}});
    expect(Object.keys(existing)).toEqual(["a","b"]);
  });
  it("allows only the first consumption of a 30s ticket",()=>{
    const existing={hash:{playerId:"player-1",expiresAt:30000}};
    const admitted=consumeTicket(existing,"hash",500)!;
    expect(admitted.playerId).toBe("player-1");
    expect(admitted.remaining).toEqual({});
    expect(consumeTicket(admitted.remaining,"hash",501)).toBeNull();
  });
  it("denies expired or unknown tickets",()=>{
    const existing={hash:{playerId:"player-1",expiresAt:30000}};
    expect(consumeTicket(existing,"hash",30000)).toBeNull();
    expect(consumeTicket(existing,"wrong",0)).toBeNull();
  });
});
