# Mahjong Friends v2 — Action UX (Issue #24)

## The interaction invariant

A touch, mouse click, keyboard Arrow/Home/End, or focus event on a hand tile must **only** select it. The game must NOT send a discard to the server until the independent `打出所选牌` button is activated. `取消选牌` and Escape clear the selection without any server action.

- The current viewer's concealed hand is still sourced from the server; other players' hidden hands remain tile backs.
- The hand sorts naturally as before. Keyboard focus follows ArrowLeft/ArrowRight/Home/End and wraps at the ends.
- Confirmation button shows the selected tile's accessible name; it is disabled if no tile is selected, when offline, or when waiting for server acknowledgment.
- After each accepted server `game.version` advancement, selected tile resets; private stale state and duplicate sends are guarded by existing RoomLobby socket code.
- Claim actions (Chi/Pong/Kong/Hu/Pass) stay derived from the authenticated `myAvailableClaims` projection and continue to be server-validated.
- A clear keyboard focus ring, chosen-tile lift, and live SR announcements make selection visible without color-only cues.
- Error/success notifications in an active game use a fixed toast above the table: they must not appear beneath the clipped full-screen scene.
- Compact phone landscape offers >=40px wide own-hand hit targets and >=40px tall primary actions where there is room; cramped portrait may require landscape for larger physical hit areas.

## Automation gate

`e2e/v2-action.e2e.ts` creates a real 1+3 bot room and checks:
- Landscape 844×390 hit targets.
- Arrow-right selection, moving focus, Escape, cancel, disabled confirm state.
- Selecting/reselecting does not mutate the room's server `game.version`.
- Explicit confirmation advances the real server version.
- The page still does not vertically scroll after a real action.

The existing four-browser, solo Bot, and responsive viewports suite must remain green.
