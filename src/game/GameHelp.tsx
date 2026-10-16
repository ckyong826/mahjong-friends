import {useEffect,useRef,useState} from "react";

/** Exact current server Practice v1, NOT the unapproved MY/SG house rules. */
export default function GameHelp({onClose}:{onClose:()=>void}) {
  const ref=useRef<HTMLDivElement>(null);
  const [tab,setTab]=useState<"play"|"score">("play");
  useEffect(()=>{ref.current?.focus();},[]);
  return <>
    <div className="mj-help-backdrop" aria-hidden="true" onClick={onClose}/>
    <section className="mj-help-dialog" role="dialog" aria-modal="true"
      aria-label="麻将玩法与练习番数说明" ref={ref} tabIndex={-1}
      onKeyDown={event=>{
        if(event.key==="Escape"){event.stopPropagation();onClose();return;}
        if(event.key!=="Tab")return;
        const nodes=[...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
        if(!nodes.length){event.preventDefault();return;}
        const first=nodes[0],last=nodes[nodes.length-1];
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===event.currentTarget)){
          event.preventDefault();last.focus();
        } else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===event.currentTarget)){
          event.preventDefault();first.focus();
        }
      }}>
      <header className="mj-help-heading">
        <strong>怎么玩？怎么算番？</strong>
        <button type="button" onClick={onClose} aria-label="关闭玩法说明">✕</button>
      </header>
      <div className="mj-help-tabs" aria-label="帮助主题">
        <button type="button" aria-pressed={tab==="play"} onClick={()=>setTab("play")}>怎么玩</button>
        <button type="button" aria-pressed={tab==="score"} onClick={()=>setTab("score")}>练习算番</button>
      </div>
      {tab==="play"?<div className="mj-help-body" key="play">
        <h3>四人好友麻将 · 基本操作</h3>
        <p>四人按东、南、西、北座位轮流摸牌、打牌。轮到自己时，点选手牌，再按「打出所选牌」确认。</p>
        <dl>
          <div><dt>吃</dt><dd>只能接上家刚打的牌，与手中两张凑成同花色连续三张。</dd></div>
          <div><dt>碰</dt><dd>其他玩家刚打的牌，和自己两张相同牌凑成三张。</dd></div>
          <div><dt>杠</dt><dd>四张同样的牌组成一杠；按可用操作补牌。</dd></div>
          <div><dt>胡</dt><dd>组成合法胡牌牌型时，按提示「胡牌」或「自摸胡牌」。</dd></div>
          <div><dt>花牌 / 动物</dt><dd>游戏会公开摸到的花牌、动物牌并补牌。公开的实体牌显示在玩家旁边。</dd></div>
          <div><dt>飞牌</dt><dd>当前 Practice v1 仅保留独立牌身份，不承诺已实现地区家规里的万能替代。</dd></div>
        </dl>
        <p className="mj-help-note">所有出牌／抢牌均由房间服务器确认，点按钮不代表操作已生效。</p>
      </div>:<div className="mj-help-body" key="score">
        <h3>当前正式可玩：Practice v1 练习番数</h3>
        <p className="mj-help-warning">以下是现行测试积分，不是正式马来西亚／新加坡家规，也不涉及现金。</p>
        <table><thead><tr><th>计分项目</th><th>练习番</th></tr></thead><tbody>
          <tr><td>合法胡牌基础</td><td>+1</td></tr>
          <tr><td>自摸</td><td>+1</td></tr>
          <tr><td>每张公开花牌或动物牌</td><td>+1</td></tr>
          <tr><td>清一色／混一色</td><td>+2／+1</td></tr>
          <tr><td>门风刻子</td><td>+1</td></tr>
          <tr><td>每组三元刻子</td><td>+1</td></tr>
          <tr><td>飞牌（当前练习模式）</td><td>+0</td></tr>
        </tbody></table>
        <h3>练习积分怎样分配？</h3>
        <p>每单位积分 = max(1, 总番数)。自摸：其他三家各扣 1 单位，赢家共得 3 单位。放炮：放炮者扣 3 单位，赢家得 3 单位，另外两家不扣分。</p>
        <p>例：合计 3 番 → 单位积分 3；自摸赢 9 分（三家各 -3）；放炮赢 9 分（放炮者 -9）。</p>
        <p className="mj-help-note">正在讨论的地区家规可能采用「每增加一番翻倍」、放炮三家 2:1:1、0 番鸡胡等，但基础分、封顶、自摸和正花仍未最终确认，**目前没有启用这些规则**。</p>
      </div>}
    </section>
  </>;
}
