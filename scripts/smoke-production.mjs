#!/usr/bin/env node
/**
 * Production-only, credential-free smoke test.
 * Default mode is READ ONLY: no rooms are created and no private tokens logged.
 * --room-probe is an explicit opt-in; it creates one disposable private QA room
 * and validates Durable Object state auth plus a one-use WebSocket ticket.
 */
import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS=12_000;
function requireHttps(raw) {
  if(!raw)throw new Error("Provide the deployed https://... base URL (or MAHJONG_PRODUCTION_URL)");
  const url=new URL(raw);
  if(url.protocol!=="https:" || url.username || url.password || url.search || url.hash ||
    (url.pathname!=="/" && url.pathname!=="")) {
    throw new Error("Expected a bare HTTPS origin without credentials, path, query or hash");
  }
  return url.origin;
}
async function request(fetchImpl,base,path,options={}) {
  const response=await fetchImpl(base+path,{
    redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(DEFAULT_TIMEOUT_MS),...options
  });
  if(response.status>=300&&response.status<400){
    throw new Error(path+": redirect "+response.status+" is not accepted");
  }
  return response;
}
async function requireStatus(response,status,description) {
  if(response.status!==status)throw new Error(description+": HTTP "+response.status+" (expected "+status+")");
}
export async function smokeReadOnly(raw,{fetchImpl=fetch,log=console.log}={}) {
  const base=requireHttps(raw);
  const health=await request(fetchImpl,base,"/api/health");
  await requireStatus(health,200,"health");
  if(!(health.headers.get("content-type")??"").includes("application/json")){
    throw new Error("health did not return JSON");
  }
  const state=await health.json();
  if(state.status!=="ok"||state.app!=="mahjong-friends"){
    throw new Error("health response is not Mahjong Friends");
  }
  log("PASS: /api/health identifies Mahjong Friends");

  const home=await request(fetchImpl,base,"/");
  await requireStatus(home,200,"home page");
  if(!(home.headers.get("content-type")??"").includes("text/html")){
    throw new Error("home page did not return HTML");
  }
  const html=await home.text();
  if(!/mahjong|麻将/i.test(html))throw new Error("home page is not Mahjong Friends");
  log("PASS: SPA home HTML is served");

  const lab=await request(fetchImpl,base,"/mahjong-design-lab.html");
  await requireStatus(lab,200,"design lab");
  if(!(lab.headers.get("content-type")??"").includes("text/html")){
    throw new Error("design lab did not return HTML");
  }
  const labHtml=await lab.text();
  if(!/design.lab|布局|mahjong/i.test(labHtml)){
    throw new Error("design lab content missing");
  }
  log("PASS: /mahjong-design-lab.html is served");

  // Invalid codes must return a typed API error, not the React SPA fallback.
  const invalid=await request(fetchImpl,base,"/api/rooms/not-a-valid-code");
  await requireStatus(invalid,404,"invalid room code");
  if(!(invalid.headers.get("content-type")??"").includes("application/json")){
    throw new Error("invalid room code response is not JSON");
  }
  log("PASS: invalid room code is rejected by API");
  return {base,mode:"read-only"};
}
async function sendJson(fetchImpl,base,path,body,token) {
  return request(fetchImpl,base,path,{
    method:"POST",
    headers:{"content-type":"application/json",...(token?{authorization:"Bearer "+token}:{})},
    body:JSON.stringify(body)
  });
}
async function websocketOpen(wssUrl,WebSocketCtor=globalThis.WebSocket) {
  if(typeof WebSocketCtor!=="function"){
    throw new Error("Node 22+ with native WebSocket is required for --room-probe");
  }
  return new Promise((resolve,reject)=>{
    let finished=false;
    const socket=new WebSocketCtor(wssUrl);
    const timeout=setTimeout(()=>fail(new Error("WebSocket connect timeout")),DEFAULT_TIMEOUT_MS);
    const cleanup=()=>{clearTimeout(timeout);};
    const fail=(error)=>{
      if(finished)return;
      finished=true;cleanup();
      try{socket.close();}catch{}
      reject(error);
    };
    socket.addEventListener("open",()=>{
      if(finished)return;
      finished=true;cleanup();socket.close();resolve();
    },{once:true});
    socket.addEventListener("error",()=>fail(new Error("WebSocket handshake failed")),{once:true});
    socket.addEventListener("close",()=>fail(new Error("WebSocket closed before opening")),{once:true});
  });
}
export async function smokeRoomProbe(raw,{fetchImpl=fetch,log=console.log,openSocket=websocketOpen}={}) {
  const base=requireHttps(raw);
  const created=await sendJson(fetchImpl,base,"/api/rooms",{nickname:"Production QA"});
  await requireStatus(created,201,"private test-room create");
  const createdData=await created.json();
  const code=createdData.room?.code;
  const token=createdData.membership?.reconnectToken;
  if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code??"")||!token){
    throw new Error("room creation returned an invalid code or no private credential");
  }
  // Never print, snapshot, or persist reconnect tokens/tickets.
  const anonymous=await request(fetchImpl,base,"/api/rooms/"+code);
  if(anonymous.status!==401&&anonymous.status!==403){
    throw new Error("unauthenticated room state must be denied");
  }
  const auth=await request(fetchImpl,base,"/api/rooms/"+code,{
    headers:{authorization:"Bearer "+token}
  });
  await requireStatus(auth,200,"authenticated room state");
  const state=await auth.json();
  if(state.viewerId!==createdData.membership.playerId||state.room?.code!==code){
    throw new Error("authenticated room returned incorrect player identity or room");
  }
  log("PASS: disposable private room created and read only by its authenticated owner");
  const minted=await sendJson(fetchImpl,base,"/api/rooms/"+code+"/socket-ticket",{},token);
  await requireStatus(minted,201,"one-use WebSocket ticket");
  const ticket=(await minted.json()).ticket;
  if(!/^[a-f0-9]{64}$/.test(ticket??""))throw new Error("invalid ephemeral socket ticket");
  const wss=base.replace(/^https:/,"wss:")+"/api/rooms/"+code+"/ws?ticket="+ticket;
  await openSocket(wss);
  log("PASS: authenticated Durable Object WebSocket handshake");
  // Existing practice rooms have no deletion endpoint. Leave no extra
  // persistent user account or secret on disk; run only on explicit opt-in.
  return {base,mode:"room-probe"};
}
const isCli=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(isCli){
  const mode=process.argv.includes("--room-probe")?"room":"read";
  const args=process.argv.slice(2).filter(x=>x!=="--room-probe");
  const target=args[0]??process.env.MAHJONG_PRODUCTION_URL;
  try{
    await smokeReadOnly(target);
    if(mode==="room")await smokeRoomProbe(target);
    console.log("PASS: "+(mode==="room"?"live room + WebSocket":"read-only")+" production smoke complete");
  }catch(error){
    console.error("FAIL: "+(error instanceof Error?error.message:String(error)));
    process.exitCode=1;
  }
}
