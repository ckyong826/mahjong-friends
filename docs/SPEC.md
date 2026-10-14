# Mahjong Friends — MVP Product & Engineering Specification

## Product promise
Browser Mahjong for private friend groups. No login required, no real-money gaming.

## Required gameplay
- Invite with 6-character private room code and shareable link.
- Support flowers, seasons, optional animals, and **blank Fei jokers**; white dragon has a distinct face.
- Automatically expose bonus tiles and replace them from reserved wall.
- Four distinct face-up discard rivers tied to each seat; tile order retained. Claimed discards move to melds.
- Server-authoritative draw, discard, chi/pong/kong, win checks, scoring, reconnect.
- Desktop and mobile layout; do not reveal other players' concealed tiles.

## Rules profiles, not one-size-fits-all
- Four-player Hong Kong flower baseline (136 standard + 8 flower).
- Four-player Singapore/Malaysian-style variant (optional animals and Fei).
- Three-player Malaysian variant **requires dedicated tile-set and scoring configuration**. Do not assume four-player deck minus a seat.
- Fei handling, fly-discard, swap/reclaim, flowers, animal bonuses, win threshold, multi-win and scoring are rules-profile decisions. Document and test them before enabling a profile.
- Scoring uses virtual points. No payments, betting, or cash settlement.

## System boundaries
- React/Vite UI and Cloudflare Worker REST API.
- One Durable Object per room (later ticket); serialized commands, persistence, hibernatable WebSockets.
- Every tile physically unique. Private snapshots generated per authenticated player.
- Room code must never act as authentication for a seat; use secret reconnect identity.
- Server owns RNG, wall, hands, legal action validation, turn arbitration and ledger.

## Definition of done
Four real browsers can independently join the same private room and finish a full round, including flower replacement, legal meld handling, readable discard rivers, settlement and reconnect. Until then the homepage is a **scaffold preview**, not a playable game.

## Delivery plan
See [Issues](https://github.com/ckyong826/mahjong-friends/issues/1) through #8, implemented as one reviewed PR per ticket.
