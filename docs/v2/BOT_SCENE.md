# Mahjong Friends v2 — Bot scene, banker and turn feedback (#25)

## Server truth is the only source of visual activity

The table derives all active-seat and center-caption states exclusively from the authenticated `PlayerGameView`, not from local "Bot AI" decisions or a simulated turn timer.

| Authoritative state | Center text | Active seat |
| --- | --- | --- |
| `discard` with viewer's `currentPlayerId` | 轮到你出牌 | Viewer |
| `discard` with bot current player | Bot 回合 · 等待服务器自动出牌 | That Bot |
| `discard` with a human opponent | 等待 [player] 出牌 | That opponent |
| `claims` | 等待吃碰杠胡回应 | **None** — discarder is no longer acting |
| `ended` | Win/draw outcome | None |

The banker badge is shown **only** when `game.dealerId === player.id`, independent of who is acting or which seat the viewer occupies. Each seat has its own original tiny illustrated robot or generic human avatar. The same authenticated `isBot` flag that controls the lobby displays BOT style badges, ensuring real friends replacing a Bot are not misrepresented.

## Turn micro-motion

A discard tile receives a short 670ms placement animation only when `game.lastDiscard.tile.id` changes between server snapshots. It cannot animate a guessed tile before the server has applied an action. Refreshing a page with the same visible discard does not replay a bogus action animation. Any claimed discard that disappears from a river is still handled by the server and remains governed by the River/Meld UI in #23.

The animation is ornamental: the last discard remains visually highlighted; the player's hand and claim buttons stay usable. `prefers-reduced-motion: reduce` disables the keyframe entirely; there is no looping spinner suggesting the server performed an action it did not.

## Safe visual constraints

- Do not expose Bot or human concealed tiles. All three opposing hands remain `concealedCount`-only.
- Match the existing one-viewport layout at 1366×768, 1440×900, 844×390, 915×412 and 390×844.
- Preserve 1-human/3-Bot room fill and replacement, which remain strictly server-controlled.
- No change to game rules, token authentication, actions, scoring profile, server alarm cadence, or storage schema.

## Evidence

- `tests/turnFeedback.test.ts`: pure reducer projection distinguishing Bot, human, viewer, claims and terminal round.
- `e2e/solo-bot.e2e.ts`: 3 robot avatars and 1 human, exactly one banker, correct viewer cue, server-triggered Bot turn progression, reload consistency and no opponent hand leakage.
- Existing 4-browser, viewport, action UX and tile art tests remain mandatory.
