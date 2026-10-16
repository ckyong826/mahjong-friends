import {useCallback,useEffect,useRef,useState} from "react";
import type {PlayerGameView} from "./engine";

export type GameSoundCue={type:"discard"|"chi"|"pong"|"kong";key:string};
/** Only a new SERVER-ACCEPTED public tile event makes a sound. Changes in
 * pending/selected controls and reconnect initial snapshots remain silent. */
export function gameSoundCues(previous:PlayerGameView,current:PlayerGameView):GameSoundCue[] {
  if(current.version<=previous.version)return [];
  const result:GameSoundCue[]=[];
  const newest=current.lastDiscard?.tile;
  if(newest&&newest.id!==previous.lastDiscard?.tile.id){
    result.push({type:"discard",key:"discard:"+newest.id});
  }
  for(const player of current.players){
    const past=previous.players.find(p=>p.id===player.id)?.melds??[];
    const fingerprint=(meld:typeof player.melds[number],index:number)=>
      [index,meld.kind,meld.tileCount,meld.tiles?.map(t=>t.id).join(",")??"hidden"].join(":");
    const before=new Set(past.map(fingerprint));
    for(const [i,meld] of player.melds.entries()){
      const key=fingerprint(meld,i);
      if(!before.has(key)){
        result.push({type:meld.kind,key:"meld:"+player.id+":"+key});
      }
    }
  }
  return result;
}
const femaleZh=/(female|tingting|meijia|xiaoxiao|huihui|yaoyao|yating|yuna|samantha|sinji|xiaoyi)/i;
function preferredChineseVoice():SpeechSynthesisVoice|undefined {
  if(!("speechSynthesis" in window))return;
  const voices=window.speechSynthesis.getVoices();
  return voices.find(v=>/^zh[-_]/i.test(v.lang)&&femaleZh.test(v.name))??
    voices.find(v=>/^zh[-_]/i.test(v.lang));
}
function clickTile(ctx:AudioContext) {
  if(ctx.state==="suspended")void ctx.resume();
  const length=Math.max(1,Math.round(ctx.sampleRate*.070));
  const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
  const channel=buffer.getChannelData(0);
  for(let i=0;i<length;i++){
    const envelope=Math.pow(1-i/length,5);
    // A short woody clack generated locally, without media downloads.
    channel[i]=(Math.random()*2-1)*envelope*.24+
      Math.sin(i/ctx.sampleRate*2*Math.PI*235)*envelope*.12;
  }
  const source=ctx.createBufferSource();
  source.buffer=buffer;
  const low=ctx.createBiquadFilter();
  low.type="lowpass";low.frequency.value=1150;
  source.connect(low);low.connect(ctx.destination);
  source.start();
}
function speakCall(type:"chi"|"pong"|"kong") {
  if(!("speechSynthesis" in window))return;
  const synth=window.speechSynthesis;
  // Announce only the accepted call; prevent multiple voices piling up.
  synth.cancel();
  const speech=new SpeechSynthesisUtterance(
    type==="chi"?"吃！":type==="pong"?"碰！":"杠！");
  speech.lang="zh-CN";speech.rate=.93;speech.pitch=1.2;speech.volume=.9;
  const voice=preferredChineseVoice();
  if(voice)speech.voice=voice;
  synth.speak(speech);
}
export function useGameAudio(game:PlayerGameView) {
  // Audio is OFF by default: browsers require an explicit user gesture.
  const [enabled,setEnabled]=useState(false);
  const ctx=useRef<AudioContext|null>(null);
  const last=useRef<PlayerGameView|null>(null);
  const enabledRef=useRef(false);
  const handled=useRef(new Set<string>());
  const toggle=useCallback(()=>{
    if(enabledRef.current){
      enabledRef.current=false;setEnabled(false);
      if("speechSynthesis" in window)window.speechSynthesis.cancel();
      return;
    }
    try{
      const context=ctx.current??new AudioContext();
      ctx.current=context;void context.resume();
      // Unlock WebAudio inside the button click, not in a background effect.
      clickTile(context);
    }catch{/* Some devices offer SpeechSynthesis without WebAudio. */}
    enabledRef.current=true;setEnabled(true);
  },[]);
  useEffect(()=>{
    const before=last.current;
    last.current=game;
    if(!before)return;
    const cues=gameSoundCues(before,game);
    if(!enabledRef.current||document.visibilityState==="hidden")return;
    for(const cue of cues){
      if(handled.current.has(cue.key))continue;
      handled.current.add(cue.key);
      if(handled.current.size>300)handled.current.clear();
      if(cue.type==="discard"){
        if(ctx.current)clickTile(ctx.current);
      }else speakCall(cue.type);
    }
  },[game]);
  useEffect(()=>()=>{if(ctx.current)void ctx.current.close();},[]);
  return {enabled,toggle};
}
