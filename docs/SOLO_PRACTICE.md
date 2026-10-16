# Solo practice bots (beginner mode)

A host can start a test Mahjong hand even when fewer than four real people are available.

## Quick test

1. Create a private room (or open your existing **waiting** room).
2. Tap **🤖 补满练习机器人**. The host must be the room owner.
3. Bots occupy exactly the empty East/South/West/North seats and are automatically ready.
4. Tap **我准备好了**, then **四人准备后开局**.
5. Select a tile and confirm discard. Bot players use actual server logic to draw, discard, claim Chow/Pong/Kong, and win a valid hand.
6. The bot turns are scheduled at roughly 550 ms intervals through a **Cloudflare Durable Object alarm**, so an idle room still proceeds even if a browser disconnects.
7. Refresh your browser: the server reconstructs the hand, melds, discards and the bot game.

Before the hand starts, any invited real player automatically replaces the last bot seat. The host may also remove bots manually to invite friends. Once started, seats are locked until the hand settles.

These are **basic deterministic training opponents**, not advanced Mahjong strategy. Bot player identities cannot authenticate using room Bearer tokens and never receive player-private socket projections. Their decisions are calculated exclusively on the server. Winning, Fei, and fan calculation remain under the existing Practice v1 rules, not finalized regional house rules.

Automated tests cover full single-human rounds, legal actions, tile accounting, reconnect reconstruction, host authority, replacement, and zero-sum settlement. Browser tests verify alarm-driven turns against the local Cloudflare Durable Object runtime.
