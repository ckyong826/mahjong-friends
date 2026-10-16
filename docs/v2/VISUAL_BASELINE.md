# Mahjong Friends v2 — Visual & UX Acceptance Baseline

**Status: design specification for development.** Based on the two *original generated concept images* discussed with the owner, plus public Mahjong Soul screenshots analyzed **for gameplay layout conventions only**, not for licensed characters, art, logo, sprites or exact reproduction.

## 1. Design intent

“真正麻将桌，整屏玩完，不用上下滑；有真实牌、固定四方弃牌区和可随时点击的自己手牌。”

- Stage: custom premium jade felt + dark wooden border + restrained warm gold highlights; optional lantern / blossom decoration must be low contrast and outside critical hit areas.
- Four permanent seats; viewer at bottom, clockwise next at right, opposite at top, prior at left. Seat/avatar/wind/score badges must not occlude the center rivers.
- Three other concealed hands use tile **backs** only. Bonus tiles are revealed separately from melds and discarded tiles.
- Tile face is more important than anime character: avoid decorative artwork covering tile pips/characters.
- Retain current data + server actions. Scene overhaul must not generate a pretend local hand or fake discard results.

## 2. Objective screen contracts

### Automated target sizes

| Viewport | UX contract | Priority |
|---|---|---|
| 1366×768 desktop landscape | **All core HUD, table, 4 rivers, selectable hand and actions visible without document scroll** | P0 |
| 1440×900 desktop landscape | Same; table expands in available height | P0 |
| 844×390 phone landscape | Same; compact HUD, smaller tile sizes, reduced ornament | P0 |
| 915×412 phone landscape | Same; leave tappable tile & action space | P0 |
| 390×844 phone portrait | Hand/actions and all players accessible; compact portrait fallback. Prefer one viewport if feasible; do not crop game controls | P1 |
| 320×568 phone portrait | No broken interaction; landscape suggestion may appear. Never hide actionable tile/claim buttons | P2 |
| Browser zoom 125% and 200% | Text/controls not completely clipped; allow *localized* panel overflow for dense settlement details | P1 |

P0 assertion: `document.documentElement.scrollHeight <= window.innerHeight + 2` and `document.body.scrollHeight <= window.innerHeight + 2` while `.mj-game` is open, with all required rectangles inside viewport bounds. It is acceptable to scroll **within a noncritical detailed settlement sheet** if needed, but never to scroll the whole document to reach the hand or action bar.

### Layout anatomy and priorities

- Global marketing site header/footer/feature cards are **not part of active gameplay scene**. Hide them or switch to immersive `.app:has(.mj-game)` mode.
- HUD ~5–8% of height: room code, round number, current wind, wall remaining, connection/setting buttons and compact scores. Secondary debug version info moves to a tooltip or modal.
- Table field ~62–70% of height: perspective wood frame + jade-green felt. Opponents placed north/west/east around centered wind / wall meter. Six-column-per-row discard rivers in each seat's own area; side lanes may rotate/compact consistently.
- Bottom hand ~16–23%: **one continuous row** (not wrapping to second row when 14 tiles), with selected tile lifting into reserve space and actions available beside/just above it. Use touch-safe scaling rather than forcing horizontal page scroll.
- Contextual action bar ~10–14%: `吃 碰 杠 胡 过` when legal plus `确认打出`. Common desktop should show within scene. Action choices may use a popover directly above action bar.
- Settlement: in-scene modal overlay, not a long list below the board; show point delta and total first, fan details secondary.

### Visual component contract

| Component | Data source | Required behavior |
|---|---|---|
| Own hand | `projectPlayerView(viewerId).players[].hand` | Real face, one-row sorted tiles; selected tile rise + aria-pressed |
| Opponent tiles | `concealedCount` | Backs only, never render opponent face |
| River 1–4 | each player's `discards` | Stable seat mapping, visible faces, latest tile halo |
| Open melds | each player's `melds` | Chow, Pong, Kong, concealed Kong remains hidden |
| Bonuses | `bonuses` | Separate face-up area for flowers/seasons and Singapore animals |
| Empty Fei | tile family `fei` | **Blank ivory face + gold/green bevel**; accessible label “飞牌（空白）” |
| White dragon | `dragon:white` | Distinct printed blue border/白 marker; not visually same as Fei |
| Active player | `currentPlayerId` | High contrast focused seat/wind, not blink-dependent |
| Action bar | server `myAvailableClaims`, `canSelfWin`, current seat | Only render eligible actions, prevent duplicate sends on pending |
| Bot | public `isBot` | Clear small “BOT” mark; no deceptive “human online” indicator |

## 3. Runtime layout approach

- Scene root height `100dvh` (fallback `100vh`), overflow hidden **only when playing**. Avoid `min-height` constraints or marketing page footer expanding document.
- Use named CSS grid areas / fractional tracks for the four seats and table center, with `minmax(0, ...)` to prevent unbounded internal content height. `min-height:0` on nested flex/grid children.
- Tile size derives from viewport width/height via `clamp()` and/or CSS variables; in 844×390 keep hand tile count in one row.
- River grids have known 6-column normal layout. At landscape compact widths, use smaller tiles without discarding or covering real tiles. If a full wall generates > typical rows, localized visual scaling/overflow management must preserve older discards.
- `prefers-reduced-motion` respected for tile select/turn pulse; keyboard focus style mandatory.
- On touch, keep separate select-then-confirm action to avoid accidental discard.

## 4. Visual verification protocol

For **each** relevant PR:
1. Take Playwright screenshots at 1366×768, 1440×900, 844×390, 915×412 (in both waiting/playing/claims if UI changed).
2. Programmatically assert **no page vertical scroll** in active landscape gameplay and action/hand/center/4 rivers' bounding rectangles visible.
3. Inspect actual screenshots: winding river directions, portrait/bonus overlap, pips legibility, action buttons and blank Fei vs white dragon.
4. Run 4-browser and 1-player+3-bot E2E; inspect any regressions.
5. Get owner review on artistic direction before final decorative polish; **functional and structural milestones can proceed meanwhile**.

## 5. Reference boundary

- Public game screenshot from Mahjong Soul demonstrates **general composition only**: center score/wind plate, discards orbiting the center, own full hand at bottom, opponents' concealed backs and avatars around edges. No copying exact screenshots into the product.
- The two AI-generated original concept images are aesthetic direction only. They contain fictitious characters, demo room data and inaccurate tile imagery; **do not treat as functional screenshot or ship as playable sprites without semantic QA**.
- Specific mockup errors: animal set is drawn as crane/koi/panda/tiger, but current code's correct four Singapore bonus animals are **cat/mouse/rooster/centipede**. First v2 asset pack must fix.

### External composition references

- https://steamcommunity.com/app/2739990 (Mahjong Soul user gameplay captures)
- https://mahjongsoul.com/ (official game reference, not a license grant)
- https://www.singaporemahjong.com/rules/ (face inventory reference)

All implementation icons/art must be original or explicitly licensed for reuse.

## 6. Staged completion

- #20 design spec sign-off → #21 asset pack → #22 viewport layout → #23 river/meld → #24 actions → #25 solo bot feedback → #26 result overlay → #29 motion polish.
- Regional rules #27–#28 are **separate** from visual upgrades and blocked until the owner confirms the house profile.
