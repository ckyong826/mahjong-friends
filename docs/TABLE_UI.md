# Issue #6 — Playable Mahjong Table UI

## What is real

The game view renders **the player's actual server-side projection**, not a demo wall or locally generated hands. It is shown only after the owner starts a four-player room and the room snapshot contains the game state.

- Every viewer sees their own seat at the bottom, next clockwise seat at right, opposite seat at top, and remaining seat at left.
- Each player's chronological face-up discarded tiles are displayed in their **own labelled river**, separate from melds and bonus tiles. A just-discarded tile is highlighted until it is claimed or the next discard replaces it.
- Six tiles per row on desktop. On narrow phones, left/right seat rivers use three tiles per row to keep tiles readable; top and bottom still use six where space permits.
- Other players' hands are tile-backs only. Concealed Kong tiles have hidden faces for opponents. Flower, season and animal tiles appear above their owner's meld groups.
- **Fei is genuinely blank**, with a gold frame and an accessible name. **White dragon is printed 白**, so these are never visually confused.
- On your turn: select a tile by click/tap (also keyboard-accessible) and press the separate confirm-discard button. Legal concealed/added Kong and self-win controls appear only when the server projection permits them.
- On a claim: click a concrete Chow combination, Pong, Kong, Win, or Pass. Controls derive from the personalized server-validated possible claims. These are still validated again by the server before acting.
- After every accepted action, the room Durable Object broadcasts a fresh **per-player redacted** state. Reload/reconnect reconstructs all four rivers and melds from persisted server state, not client memory.
- Controls disable while awaiting an action confirmation, or when offline. A stale-state / server error releases the pending guard so the player can inspect the refreshed game.

## Known limitations

This is a **playable-table UI beta**, not a fully completed regional Mahjong implementation. Exact Malaysian/3-player and blank Fei house rules still need agreement. The scoring and next-round flows remain in Issue #7. Four-browser real Cloudflare end-to-end verification and accessibility/regression review remain Issue #8.

There is no AI seat filler. Four distinct people/browsers must join and ready before opening a game. If you leave midway, the table continues to wait for your authenticated seat to reconnect.

## Validation

Run `npm test`, `npm run typecheck`, `npm run build`. Tests cover seat rotations, blank Fei/printed white dragon distinction, four separate seat rivers, unique concealed Kong choices, and server-gated claim controls. CI alone does **not** prove real remote browser operation; actual four-device smoke testing requires a Cloudflare deployment.
