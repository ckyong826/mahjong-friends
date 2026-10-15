# Issue #5 — Real-time private Mahjong protocol

## Hibernating room WebSockets

Mahjong Friends uses one SQLite-backed Cloudflare Durable Object per private room (one DO instance owns all mutations), upgraded with Cloudflare's hibernatable WebSockets:

- GET **/api/rooms/:code** returns an authenticated player-specific snapshot, with opponents' concealed tiles removed.
- POST **/api/rooms/:code/socket-ticket** with Authorization: Bearer <membershipToken> and JSON {} creates a **30-second single-use ticket**; only its SHA-256 digest is stored server-side.
- Browser opens wss://<same-origin>/api/rooms/:code/ws?ticket=<one-use-ticket>. Reusable membership token is **never in the WebSocket URL**. The upgrade validates same-origin Origin when provided.
- The DO consumes the ticket before accepting the WebSocket. The hibernation-safe socket attachment stores **only authenticated player ID**. After hibernation, the player ID is recovered from deserializeAttachment; room membership and game state are read from durable storage.
- The owner, seat and game history live in DO storage, not in memory-only socket handlers. WebSocket actions and HTTP room commands run through the same per-room serialization queue.
- Each broadcast is generated independently for each authenticated player's seat using projectPlayerView. Nobody receives another player's hand, a concealed Kong's actual tiles or wall identities.
- On disconnection, browser reacquires a new one-use ticket using its stored membership token. Exponential backoff: 1, 2, 4, 8, 15 seconds maximum. HTTP polling at 15-second intervals is a temporary fallback when socket is unavailable.

## Messages

Server to browser:

- snapshot: { type: "snapshot", revision, room, viewerId, game? }
- error: { type: "error", message, code }
- pong: { type: "pong" }

Browser to server:

- { type: "sync" } — request latest private snapshot
- { type: "ping" } — optional application health frame
- { type: "game_action", action: { type:"discard", tileId, actionId, expectedVersion } }
- { type: "game_action", action: { type:"claim", kind:"pass|chi|pong|kong|win", tileIds?, actionId, expectedVersion } }
- { type: "game_action", action: { type:"kong", kind:"concealed|added", tileIds? / tileId & meldIndex?, actionId, expectedVersion } }
- { type: "game_action", action: { type:"win", actionId, expectedVersion } }

The server assigns playerId from WebSocket attachment, **never from the message**. It rejects arbitrary wall draws, forged IDs, illegal melds, invalid actor turns and stale state versions.

Game commands are idempotent by action ID. On a duplicate, send a fresh snapshot without reapplying the action. On a stale action, send an error followed by an up-to-date snapshot. Persist each accepted change in Durable Object storage **before** broadcasting it.

## Why SQLite-backed DO + hibernation

Cloudflare DO hibernation keeps sockets alive while unloading idle JS objects. The per-connection attachment survives wake-up. SQLite-backed DO storage retains memberships and game state. The existing Wrangler declarative exports config provisions the DO class without the older migrations array.

## Incomplete / rollout checklist

- The 4-player tabletop and actionable controls are #6. At present, the UI shows a real-time lobby only; manual game_action WebSocket requests are supported in the server protocol.
- Full browser E2E / real Cloudflare deployment and latency/reconnection validation remain #8.
- Private games have no spectator endpoint; no cash betting.
- Before inviting the public, add WAF/Turnstile and per-IP room creation and join rate limits.
- Rules scoring, house-specific Fei behaviours, special hands, settlement and repeat rounds remain #7.
- This code is not yet deployed to the user's Cloudflare account.
