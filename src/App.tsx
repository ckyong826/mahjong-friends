import { useCallback, useEffect, useState } from "react";
import RoomLobby from "./RoomLobby";

type Health = "checking" | "online" | "offline";

const checkpoints = [
  { index: "01", title: "花牌・动物牌・飞", description: "春夏秋冬、梅兰菊竹、动物牌和空白飞牌", issue: 2 },
  { index: "02", title: "创建私人房间", description: "房间码及邀请链接，和朋友实时联机", issue: 4 },
  { index: "03", title: "服务器核验每一步", description: "摸打、吃碰杠胡由服务器处理，正式地区家规仍在确认", issue: 3 },
  { index: "04", title: "四家独立弃牌区", description: "实时分清每位玩家的弃牌与公开组合", issue: 6 },
  { index: "05", title: "Bot 单人练习", description: "没人在线也能补满三位服务器练习机器人", issue: 25 },
  { index: "06", title: "积分结算与下一局", description: "完整回合、虚拟积分和准备下一局已可体验", issue: 26 }
];

export default function App() {
  const [health, setHealth] = useState<Health>("checking");
  const [inRoom,setInRoom] = useState(window.location.pathname.startsWith("/room/"));

  const checkHealth = useCallback(async () => {
    setHealth("checking");
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error("Health check failed");
      const body: unknown = await response.json();
      if (
        typeof body !== "object" ||
        body === null ||
        !("status" in body) ||
        body.status !== "ok"
      ) {
        throw new Error("Unexpected health response");
      }
      setHealth("online");
    } catch {
      setHealth("offline");
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  return (
    <div className="app">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Mahjong Friends 首页">
          <span className="brand-tile" aria-hidden="true">發</span>
          <span>Mahjong <strong>Friends</strong></span>
        </a>
        <span className="edition">好友麻将 · 四人联机练习版</span>
      </header>

      <main>{inRoom ? <RoomLobby onPathChanged={setInRoom} /> : <>
        <section className="hero" aria-labelledby="hero-title">
          <div className="eyebrow"><span className="shine" /> PRIVATE MAHJONG NIGHTS</div>
          <h1 id="hero-title">老友凑一桌，<br /><em>随时开台。</em></h1>
          <p className="hero-copy">花牌、飞牌、清楚分开的四家弃牌区。<br />不用下载，不用注册，分享房间链接给朋友。</p>
          <RoomLobby onPathChanged={setInRoom} />
          <p className="preview-note">※ 已支持四人联机、Bot 练习和虚拟积分结算；正式新马地区家规仍待确认。</p>
        </section>

        <section className="table-illustration" aria-label="麻将桌布局预览">
          <div className="corner-mark">MAHJONG FRIENDS</div>
          <div className="table-player top"><span className="player-label">对家 · 东</span><span className="backs">▮ ▮ ▮ ▮ ▮ ▮ ▮ ▮ ▮ ▮ ▮ ▮ ▮</span></div>
          <div className="river river-top"><span>🀇 🀙 🀀 🀄 🀚 🀅</span></div>
          <div className="river river-left"><span>🀈 🀝 🀃</span><span>🀉 🀅 🀄</span></div>
          <div className="center-emblem"><span>友</span><small>东 · 南 · 西 · 北</small></div>
          <div className="river river-right"><span>🀠 🀙 🀆</span><span>🀇 🀄 🀈</span></div>
          <div className="river river-bottom"><span>🀀 🀁 🀂 🀙 🀚 🀛</span></div>
          <div className="table-player bottom"><span className="player-label">我的手牌 · 南</span><div className="hand">{["一","二","三","四","五","六","七","八","九","中","發","白","飞"].map((t, i) => <span key={i} className={i === 12 ? "tile fei" : "tile"}>{i === 12 ? "" : t}</span>)}</div></div>
          <p className="table-caption">牌桌布局示意 · 实际开房后可联机出牌</p>
        </section>

        <section className="roadmap" aria-labelledby="roadmap-title">
          <div className="section-heading"><p className="eyebrow">WHAT WE'RE BUILDING</p><h2 id="roadmap-title">一桌好麻将，该有的都有。</h2></div>
          <div className="features">
            {checkpoints.map((step) => (
              <a key={step.index} className="feature" href={"https://github.com/ckyong826/mahjong-friends/issues/" + step.issue} target="_blank" rel="noopener noreferrer">
                <span className="feature-num">{step.index}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <span className="feature-link">查看开发 Ticket ↗</span>
              </a>
            ))}
          </div>
        </section>
        </>}
      </main>

      <footer className="footer">
        <span>© Mahjong Friends · 仅虚拟积分，不涉及真实金钱</span>
        <div className="health-status">
          <span className={"indicator " + health} aria-hidden="true" />
          <span aria-live="polite">{health === "online" ? "Cloudflare API 已连接" : health === "offline" ? "API 暂时无法连接" : "正在检测 API…"}</span>
          <button type="button" onClick={() => void checkHealth()}>重试</button>
        </div>
      </footer>
    </div>
  );
}
