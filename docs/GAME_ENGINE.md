# Issue #3 — Four-player server-authoritative gameplay engine

## Implemented this ticket

- Dealer starts with 14 concealed playable tiles; other seats receive 13 each, with bonus replacement during dealing.
- Deterministic state reducer: validated playerId, actionId and expectedVersion; exact replays are idempotent; out-of-turn and forged tile IDs rejected.
- Discard rivers are tied to their source player. Unclaimed discards remain in the source river; claimed ones move to exactly one exposed meld.
- Claim window collects all *eligible* players' responses, then resolves **Hu > Kong/Pong > Chi**, with nearest following seat winning ties. Only next seat can Chi. No eager claim resolution that bypasses a higher-priority response.
- Exposed/ concealed/ added Kong, each followed by a replacement-wall draw; replacement exhaustion causes a drawn round.
- Standard Hu validator: four groups and a pair (adjusted for publicly exposed melds). Blank Fei counts as concealed wildcard in structural validation; it is not a replacement flower and it is not interchangeable with white dragon.
- A client-safe per-player view shows only that player's concealed tiles. Other concealed hands and physical wall order remain server-only.
- No browser-controlled draw action. Only the reducer moves tiles.
- Tile conservation invariant checked across wall, hands, bonuses, discards and melds.

## Deliberately out of scope

- Three-player Malaysian tile-availability differences; the current round constructor requires exactly four players. Separate variant profiles must be introduced before enabling three-player rooms.
- Local house-rule differences for Fei: discarding Fei, exchange/reclaim of Joker, robbing an added Kong, Fei in open melds and Fei bonuses require a rules profile first. The current engine forbids Fei in open melds, but allows Fei in concealed Hu validation. **This is provisional.**
- Seven pairs, thirteen orphans, flower-based fan and minimum-fan thresholds are not part of the initial structural validator and will be in scoring/rules Issue #7.
- Durable Object persistence, reconnect, real player socket IDs and automatic timeouts are Issues #4–#5.
- Settlement, round rotation and screen integration are Issues #6–#7.

## Integration contract

Use startRound only on the trusted server, after the room has authenticated all four players. Production uses cryptographic shuffling. Do not provide shuffledTiles or randomIndex as values received from users; those are trusted test/simulation injection points.

Apply GameAction serially from the room Durable Object. Keep GameState server-only. Send projectPlayerView(state, authenticatedPlayerId) through the socket. Do **not** JSON-serialize GameState.

Before starting the next ticket, the PR must pass typecheck, Vitest and Cloudflare build on GitHub Actions.
