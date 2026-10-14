# Issue #4 — Private room REST API and friend lobby

This ticket introduces **real server-persisted room membership**. It does not claim that the Mahjong tabletop is playable yet.

## Routes (all JSON)

| Method | Endpoint | Auth | Request |
|---|---|---|---|
| POST | /api/rooms | No | {"nickname":"阿明"} |
| POST | /api/rooms/:code/join | No | {"nickname":"小美"} |
| GET | /api/rooms/:code | Bearer token | — |
| POST | /api/rooms/:code/ready | Bearer token | {"ready":true} |
| POST | /api/rooms/:code/rules | Owner token | {"rules":{...}} |
| POST | /api/rooms/:code/kick | Owner token | {"playerId":"..."} |
| POST | /api/rooms/:code/leave | Bearer token | {} |
| POST | /api/rooms/:code/start | Owner token | {} |

Successful create/join responds with a public room view, the authenticated viewer ID, and a **one-time membership credential**. Client stores the token in localStorage per room, never in the invite link. GET/POST operations require Authorization: Bearer token. Credentials are hashed SHA-256 in the Durable Object. An invite code alone cannot access a private seat.

Room codes are 6 characters from a reduced alphabet without I, O, 0 or 1. Collision detection occurs via the Durable Object before returning a new room. Empty rooms are reserved as tombstones rather than allowing stale invite URLs to be reused.

## Platform architecture

One SQLite-backed Cloudflare Durable Object is assigned to each room code. It stores memberships, seats, host, readiness, rules, and the server-only GameState after starting. Authorized GET returns the requesting player's projection rather than full game state. Worker gateway dispatches private HTTP operations to that DO.

The four-player room is currently the only enabled option. Default: Singapore-style 4p prototype (8 flowers, 4 animals, 4 blank Fei). Hong Kong 4p (8 flowers, no animals/Fei) can be selected by the host; changing rules resets all ready states. **Exact regional Fei and scoring rules are still provisional** (#7).

A room starts the server's initial shuffled hand only when all four members are ready and the owner requests start. Game actions, real-time broadcasts and client gameplay are **not exposed yet**. The front end explicitly labels this limitation.

## Frontend

Home screen provides create/join and nickname fields. Invite URL: /room/ABCDEF. Lobby shows four seats, owner, readiness, room mode and a copy-to-clipboard invitation. Polling every five seconds supplies a temporary synchronization mechanism. After refresh the bearer token restores the player's seat. Issue #5 will replace polling with hibernatable WebSockets and robust reconnection.

## Security/remaining work

- Keep the private GitHub repo private and use Cloudflare env bindings, not embedded secret keys.
- No server-sent wall or opponent concealed hand. Player projection is the only response.
- Public deployment must add Cloudflare WAF/Rate Limiting/Turnstile protection for anonymous create/join to reduce room spam. An ephemeral gateway counter is not strong enough.
- WebSocket authenticated identity, presence, game persistence events and rematch flow belong to Issue #5.
- Display tabletop and actual move actions belong to Issue #6.

No deployment has occurred yet: Cloudflare account authorization is a separate prerequisite.
