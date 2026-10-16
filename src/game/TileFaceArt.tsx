import type { TileFace, Rank } from "../shared/tiles";

/** Semantic, original vector tile faces — never crop an AI mockup sprite.
 * Count of dots/bamboo stems always equals the corresponding tile rank.
 * TileCard owns the accessible label, so everything inside here is aria-hidden.
 */
const placements: Record<Rank, readonly (readonly [number,number])[]> = {
  1: [[34,44]],
  2: [[23,24],[45,64]],
  3: [[22,20],[34,44],[46,68]],
  4: [[22,23],[46,23],[22,65],[46,65]],
  5: [[22,20],[46,20],[34,44],[22,68],[46,68]],
  6: [[22,18],[46,18],[22,44],[46,44],[22,70],[46,70]],
  7: [[34,13],[22,31],[46,31],[22,49],[46,49],[22,69],[46,69]],
  8: [[22,15],[46,15],[22,34],[46,34],[22,54],[46,54],[22,73],[46,73]],
  9: [[17,19],[34,19],[51,19],[17,44],[34,44],[51,44],[17,69],[34,69],[51,69]]
};
export function tilePipLayout(rank:Rank): ReadonlyArray<readonly [number,number]> {
  return placements[rank];
}

const seasons:Record<string,string>={spring:"春",summer:"夏",autumn:"秋",winter:"冬"};
const flowers:Record<string,string>={plum:"梅",orchid:"蘭",chrysanthemum:"菊","bamboo-flower":"竹"};
const animals:Record<string,string>={cat:"貓",mouse:"鼠",rooster:"雞",centipede:"蜈"};
const digits=["","一","二","三","四","五","六","七","八","九"];

function CirclePips({rank}:{rank:Rank}){
  const centers=tilePipLayout(rank);
  return <svg className="mj-face-svg" viewBox="0 0 68 88" aria-hidden="true" focusable="false">
    {centers.map(([x,y],i)=>{
      const fill=(rank===1||i%3===0)?"#267654":i%3===1?"#c64a41":"#245a98";
      const radius=rank===1?16:rank<=4?9.5:7.7;
      return <g key={i}>
        <circle cx={x} cy={y} r={radius+1.5} fill="#f4f0e3" stroke={fill} strokeWidth="1.8"/>
        <circle cx={x} cy={y} r={radius-1.3} fill={fill}/>
        <circle cx={x} cy={y} r={Math.max(2,radius*.44)} fill="#fff9eb"/>
        <circle cx={x} cy={y} r={Math.max(1.25,radius*.19)} fill={fill}/>
      </g>;
    })}
  </svg>;
}
function BambooPips({rank}:{rank:Rank}){
  return <svg className="mj-face-svg" viewBox="0 0 68 88" aria-hidden="true" focusable="false">
    {tilePipLayout(rank).map(([x,y],i)=>{
      const stem=rank===1?22:rank<=4?15:12;
      const col=i%3===2?"#bc5349":"#247b56";
      return <g key={i}>
        <rect x={x-3.7} y={y-stem*.57} width="7.4" height={stem*1.14} rx="2.7" fill={col} stroke="#105e48" strokeWidth=".65"/>
        <path d={`M ${x-4.3} ${y-2.7} h 8.6 M ${x-4.3} ${y+3.5} h 8.6`}
          stroke="#fff0d0" strokeWidth="1.4"/>
        <path d={`M ${x-1} ${y-stem*.41} Q ${x+7} ${y-stem*.77} ${x+8} ${y-stem*.5}`}
          stroke="#277c55" fill="none" strokeWidth="2"/>
      </g>;
    })}
  </svg>;
}
export default function TileFaceArt({face}:{face:TileFace}){
  if(face.family==="suit") {
    if(face.suit==="dots")return <span className="mj-semantic-face" data-face="dots" data-rank={face.rank}>
      <CirclePips rank={face.rank}/></span>;
    if(face.suit==="bamboo")return <span className="mj-semantic-face" data-face="bamboo" data-rank={face.rank}>
      <BambooPips rank={face.rank}/></span>;
    return <span className="mj-semantic-face mj-face-characters" data-face="characters" data-rank={face.rank}>
      <span className="mj-character-number">{digits[face.rank]}</span>
      <span className="mj-character-suit">萬</span>
    </span>;
  }
  if(face.family==="wind"){
    const names={east:"東",south:"南",west:"西",north:"北"};
    return <span className="mj-semantic-face mj-face-wind" data-face="wind"><span>{names[face.wind]}</span></span>;
  }
  if(face.family==="dragon") {
    if(face.dragon==="white")return <span className="mj-semantic-face mj-face-white" data-face="dragon-white">
      <span className="mj-white-dragon-frame" aria-hidden="true"><span>白</span></span>
    </span>;
    return <span className={"mj-semantic-face mj-face-dragon-"+face.dragon} data-face={"dragon-"+face.dragon}>
      {face.dragon==="red"?"中":"發"}
    </span>;
  }
  if(face.family==="fei")return <span className="mj-semantic-face mj-face-fei" data-face="fei"/>;
  if(face.family==="flower") {
    const value=seasons[face.flower]??flowers[face.flower];
    return <span className="mj-semantic-face mj-face-bonus" data-face="flower">
      <span className="mj-bonus-sigil" aria-hidden="true">✿</span>
      <span className="mj-bonus-character">{value}</span>
    </span>;
  }
  return <span className="mj-semantic-face mj-face-animal" data-face="animal">
    <span className="mj-bonus-sigil" aria-hidden="true">◆</span>
    <span className="mj-bonus-character">{animals[face.animal]}</span>
  </span>;
}
