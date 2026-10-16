import { describe,expect,it } from "vitest";
import { claimedMeldTileIndex,riverRows,seatPosition } from "../src/game/presentation";
import type { PublicMeldView } from "../src/game/engine";
import type { Tile } from "../src/shared/tiles";
const tile=(id:string):Tile=>({id,face:{family:"suit",suit:"dots",rank:1}});

describe("v2 six-tile chronological discard rivers",()=>{
  it("groups a 25-discard wall in 6/6/6/6/1 chronological order without sorting",()=>{
    const discards=Array.from({length:25},(_,i)=>tile("tile-"+String(i).padStart(2,"0")));
    const original=discards.map(t=>t.id);
    const rows=riverRows(discards);
    expect(rows.map(r=>r.length)).toEqual([6,6,6,6,1]);
    expect(rows.flat().map(t=>t.id)).toEqual(original);
    expect(discards.map(t=>t.id)).toEqual(original);
    expect(rows[0]).not.toBe(discards);
    expect(riverRows([])).toEqual([]);
    expect(()=>riverRows(discards,0)).toThrow(RangeError);
    expect(()=>riverRows(discards,1.2)).toThrow(RangeError);
  });
  it("leaves the server's claimed physical discard absent from its old river",()=>{
    const before=["a","b","c","claim"].map(tile);
    const after=before.filter(t=>t.id!=="claim");
    const claimantMeld:[Tile,Tile,Tile]=[tile("from-hand-1"),tile("from-hand-2"),before[3]];
    expect(riverRows(after).flat().map(t=>t.id)).toEqual(["a","b","c"]);
    expect(claimantMeld[2].id).toBe("claim");
    expect(after.every(t=>t.id!=="claim")).toBe(true);
  });
  it("rotates relative player seats with no face/river identities exchanged",()=>{
    expect(["east","south","west","north"].map(w=>
      seatPosition("east",w as "east"|"south"|"west"|"north")))
      .toEqual(["bottom","right","top","left"]);
    expect(seatPosition("north","east")).toBe("right");
    expect(seatPosition("north","south")).toBe("top");
  });
});

describe("real claimed-meld tile marker",()=>{
  const pong:PublicMeldView={
    kind:"pong",concealed:false,fromPlayerId:"south",tileCount:3,
    tiles:[tile("a"),tile("b"),tile("claimed")]
  };
  it("identifies original discarded tile as third after public Chi/Pong/Kong",()=>{
    expect(claimedMeldTileIndex(pong)).toBe(2);
    expect(claimedMeldTileIndex({...pong,kind:"chi"})).toBe(2);
    expect(claimedMeldTileIndex({...pong,kind:"kong",tileCount:4,
      tiles:[...pong.tiles!,tile("added-fourth")]})).toBe(2);
  });
  it("never guesses a source tile on concealed Kong, missing provenance or hidden tiles",()=>{
    expect(claimedMeldTileIndex({...pong,concealed:true,tiles:undefined,tileCount:4})).toBeNull();
    expect(claimedMeldTileIndex({...pong,fromPlayerId:null})).toBeNull();
    expect(claimedMeldTileIndex({...pong,tiles:undefined})).toBeNull();
    expect(claimedMeldTileIndex({...pong,tiles:[tile("a"),tile("b")]})).toBeNull();
  });
});
