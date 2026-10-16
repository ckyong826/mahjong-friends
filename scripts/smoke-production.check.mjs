import { test } from "node:test";
import assert from "node:assert/strict";
import { smokeReadOnly, smokeRoomProbe } from "./smoke-production.mjs";

const base="https://mahjong-friends.example.workers.dev";
const json=(object,status=200)=>new Response(JSON.stringify(object),{
  status,headers:{"content-type":"application/json; charset=utf-8"}
});
const html=(body)=>new Response(body,{status:200,headers:{"content-type":"text/html"}});
function readOnlyFixture(overrides={}) {
  const paths=[];
  const fetchImpl=async(url,options)=>{
    const path=new URL(url).pathname;
    paths.push({path,options});
    if(path in overrides)return overrides[path];
    if(path==="/api/health")return json({status:"ok",app:"mahjong-friends"});
    if(path==="/")return html("<title>Mahjong Friends</title>");
    if(path==="/mahjong-design-lab.html")return html("<title>Mahjong Design Lab</title>");
    if(path==="/api/rooms/not-a-valid-code")return json({error:"Not Found"},404);
    throw new Error("Unexpected path "+path);
  };
  return {paths,fetchImpl};
}
test("production read-only smoke performs only GETs and verifies all four endpoints",async()=>{
  const fixture=readOnlyFixture(),logs=[];
  const result=await smokeReadOnly(base,{fetchImpl:fixture.fetchImpl,log:x=>logs.push(x)});
  assert.equal(result.mode,"read-only");
  assert.deepEqual(fixture.paths.map(x=>x.path),[
    "/api/health","/","/mahjong-design-lab.html","/api/rooms/not-a-valid-code"
  ]);
  assert.ok(fixture.paths.every(x=>x.options.redirect==="manual" &&
    x.options.cache==="no-store" && x.options.method===undefined));
  assert.equal(logs.length,4);
});
test("rejects untrusted production URLs or paths",async()=>{
  const {fetchImpl}=readOnlyFixture();
  for(const bad of ["http://example.com","https://user:secret@example.com",
    "https://example.com/other","https://example.com/?token=secret",
    "https://example.com/#fragment",undefined]){
    await assert.rejects(smokeReadOnly(bad,{fetchImpl}));
  }
});
test("rejects HTML error fallbacks, false health and redirects",async()=>{
  for(const override of [
    {"/api/health":json({status:"ok",app:"other-product"})},
    {"/api/rooms/not-a-valid-code":html("<title>Mahjong Friends</title>")},
    {"/mahjong-design-lab.html":new Response(null,{status:302,headers:{location:"/"}})}
  ]){
    await assert.rejects(smokeReadOnly(base,{fetchImpl:readOnlyFixture(override).fetchImpl}));
  }
});
test("explicit room probe checks owner-only state and authenticated socket handshake",async()=>{
  const code="ABCDEFG".slice(0,6), token="a".repeat(64),ticket="b".repeat(64);
  const calls=[],socketUrls=[],logs=[];
  const fetchImpl=async(url,options)=>{
    const path=new URL(url).pathname;
    calls.push({path,method:options.method??"GET",
      isAuthorized:!!options.headers?.authorization});
    if(path==="/api/rooms"&&options.method==="POST") {
      return json({room:{code},membership:{playerId:"player-a",reconnectToken:token}},201);
    }
    if(path==="/api/rooms/"+code&&options.headers?.authorization) {
      return json({viewerId:"player-a",room:{code}});
    }
    if(path==="/api/rooms/"+code)return json({error:"Need token"},401);
    if(path==="/api/rooms/"+code+"/socket-ticket"&&options.method==="POST"){
      return json({ticket},201);
    }
    throw new Error("Unexpected call "+path);
  };
  const result=await smokeRoomProbe(base,{
    fetchImpl,log:x=>logs.push(x),openSocket:async url=>socketUrls.push(url)
  });
  assert.equal(result.mode,"room-probe");
  assert.equal(socketUrls.length,1);
  assert.ok(socketUrls[0].startsWith("wss://"));
  assert.ok(socketUrls[0].endsWith("ticket="+ticket));
  assert.deepEqual(calls.map(x=>[x.path,x.method,x.isAuthorized]),[
    ["/api/rooms","POST",false],
    ["/api/rooms/"+code,"GET",false],
    ["/api/rooms/"+code,"GET",true],
    ["/api/rooms/"+code+"/socket-ticket","POST",true]
  ]);
  assert.equal(logs.length,2);
  assert.ok(!logs.join(" ").includes(token) && !logs.join(" ").includes(ticket));
});
test("room probe rejects credentials exposure from unauthorized endpoint",async()=>{
  const token="a".repeat(64),code="ABCDEF";
  const fetchImpl=async(url,options)=>{
    const path=new URL(url).pathname;
    if(path==="/api/rooms")return json({room:{code},membership:{playerId:"x",reconnectToken:token}},201);
    return json({viewerId:"x",room:{code}},200);
  };
  await assert.rejects(smokeRoomProbe(base,{fetchImpl,log:()=>{},openSocket:async()=>{}}),
    /unauthenticated room state must be denied/);
});
