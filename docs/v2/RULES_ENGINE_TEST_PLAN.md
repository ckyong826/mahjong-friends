# Mahjong Friends — server rules implementation and automated-test plan

**Planning deliverable for [#27](https://github.com/ckyong826/mahjong-friends/issues/27), 2026-10-16. NOT implemented or production-enabled.**
Read [OFFICIAL_RULESET_DRAFT.md](./OFFICIAL_RULESET_DRAFT.md) first. This document intentionally separates **confirmed behavior that is testable now as a specification** from **blocked scenarios for which player acceptance is still missing**.

## 1. Current code and differences

| File | Existing Practice v1 behavior | Required future house-rule change |
|---|---|---|
| `src/shared/room.ts` + `worker/roomCore.ts` | `singapore-four-player`, default Fei count 4, minimumFan 1; room validation rejects minimumFan 0 | Add a *separate versioned* house-rule profile only when inventory and scoring finalized. Do not change old room defaults in place. |
| `src/game/deck.ts`, `src/shared/tiles.ts` | 136 natural + 8 ordinary flowers + 4 animals + default 4 Fei; each physical tile has unique ID | Check physical counts / identities against owner. Preserve unique physical IDs and White Dragon vs Fei distinction. |
| `src/game/engine.ts` and `src/game/hand.ts` | Natural-tile Chi/Pong/Kong and ordinary 4-meld+pair solver | Add wildcard-resolving combinator for **confirmed** Chi/Pong and 3-natural+1-Fei concealed Kong. Further Fei constraints remain blocked. |
| `src/game/wall.ts` | `{live,replacement}`; flower/animal automatically revealed, Fei never automatically exposed | Model interactive Fei exposure + replacement, forced flower replacement, **player choice** on replacement Fei. Leave animal handling profile-specific/blocked. |
| `src/game/scoring.ts` | Practice baseline +1 fan for any flower/animal, minimumFan 1, point stake = max(1,fan), only discarder pays on discard Hu | Separate score calculators and score/settle stages. New rules require seat flower +1, exposed Fei +1, 0-fan legal, each-fan doubling, 2:1:1 discard payer weights; base and cap still BLOCKED. |
| `worker/roomCore.ts` | Every next round moves dealer one seat, Bot readiness persisted, settlement idempotent | New dealer progression under a future confirmed policy; keep current Practice behavior unchanged. |
| `src/MahjongTable.tsx` | Physical tiles, original art, one-viewport table, public bonuses and melds, 4 rivers | Show `Expose Fei` as separate action (not `discard`), explicit Fei keep/expose choice after replacement draw, and wildcard meld identity without leaking hands. |

All house-rule action and scoring results must be computed by the **Cloudflare Durable Object server**. The browser submits only choices/IDs; it cannot dictate drawn tile, chosen substitute, fan or settlement points.

## 2. Recommended future rule boundary (DESIGN only)

Use versioned profiles so already-deployed Practice v1 room state remains valid:

```ts
type RulesProfileId = "practice-v1" | "my-four-player-fei-v1";
type Unknown<T> = {state:"confirmed"; value:T} | {state:"unconfirmed"};
type FeiKongPolicy = {
  concealedThreeNaturalsOneFei: true;
  exposed: Unknown<boolean>;
  addedNaturalPongPlusFei: Unknown<boolean>;
  addedFeiPongPlusNatural: Unknown<boolean>;
};
type DraftHouseRules = {
  fourPlayers: true;
  minFanToWin: 0;
  seatFlowerFan: 1;
  exposedFeiFan: 1;
  fanGrowth: "double-each-additional-fan";
  discardPayerWeights: [2,1,1];
  baseVirtualUnit: Unknown<number>;
  fanCap: Unknown<number|null>;
  seatFlowerMapping: Unknown<Record<"east"|"south"|"west"|"north",readonly string[]>>;
  dealerRetention: Unknown<string>;
  reserveDepletion: Unknown<string>;
  kong: FeiKongPolicy;
};
```

This is **design pseudocode, not an existing API or approved defaults**. Critical requirement: unresolved `Unknown<T>` fields must prevent "official mode" activation; do not silently fall back to practice values. Use a separate state-schema version and migration/recovery strategy, not mutation of running rooms.

### Event/reducer boundaries

1. `exposeFei(tileId, expectedVersion, actionId)`: validate authenticated current player, actual physical Fei in their private hand, proper action window (exact window still OPEN), no duplicate action ID; move physical tile to explicit `exposedFei` collection. Replacement draws are from reserved zone.
2. `resolveReplacement`: consumes one tile from reserved zone. Ordinary flower must reveal and continue. If replacement is Fei, pause at `fei-choice` phase; the player chooses `keep` (Fei becomes concealed hand, replacement chain ends) or `expose-and-continue` (Fei becomes publicly exposed, another replacement); do not auto-consume without choice. Define recovery for disconnect/reload/resume in the persisted DO state.
3. `claimChi/claimPong`: validate actual physical claimed discard and each concealed selected tile ID. Use wildcard resolution to record both the **real physical Fei** and which natural face it represents. Once exposed, do not offer a reclaim action. A meld must never produce an extra copy of a physical tile.
4. `concealedKong`: accept the explicitly confirmed `3 natural of same face + 1 Fei` case; record a concealed meld with four unique physical IDs and use profile-defined replacement source, without exposing opponent-only private identity.
5. `calculateFans`: return typed itemization, keyed by physical tile/group to prevent double counting: e.g. seat-matching flower +1, exposed Fei +1. Set rewards and animal bonus lines must stay **unresolved** until numeric values are approved.
6. `settleVirtualPoints`: given *approved* base and cap, compute fan-scaled per-loser unit and the confirmed discard allocation `2:1:1`. Winner delta is negative sum of three losers. Self-draw payer set is known, **not** the actual formula. Require pure, idempotent settlement, exactly 4 delta entries, and `sum(delta) === 0`.
7. `chooseNextDealer`: cannot be implemented for the official profile until dealer-win/nondealer-win/draw decisions are approved.

**Security/correctness:** no hidden hand or reserved wall content in public `PlayerGameView`; server-side legality, single-writer DO, expectedVersion/actionId idempotency, proof that every physical tile exists in exactly one zone (live, reserve, hand, discard, meld, flower/animal, exposed Fei). Claims must remove the discarded physical tile from the original river; out-of-order client events must not cause two replacement draws.

## 3. Test-fixture catalog (to implement, not yet present)

A testing fixture must contain explicit **input physical tile IDs**, owner rules profile/version, initial server state, action, resulting state, expected server rejection if invalid, and public/private projections. Test cases without numeric ground truth should check **structure/invariants only**, not invent points.

### CONFIRMED behavior fixtures — can be drafted against the spec now

| ID | Input / action | Required assertion |
|---|---|---|
| H-01 | One Fei concealed over several turns; later player exposes it on own turn | Accepted action; tile appears exactly once in exposed Fei area, absent from hand and river. |
| H-02 | Expose held Fei and pull reserved replacement | Reserve count decreases by 1; live wall unchanged; only server determines tile. |
| H-03 | H-02 replacement is spring flower | Spring publicly exposed; replacement count decreases *again*; no extra physical tile. |
| H-04 | H-02 replacement is another Fei | Pauses for explicit choice; `keep` does not auto-replace; `expose` increments exposed count and pulls next reserved tile. |
| H-05 | Own 2-dots + Fei, previous player discarded 4-dots -> Chi | Physical meld contains actual Fei, resolves as 2-3-4; incoming 4-dots removed from original river. |
| H-06 | Own 3-dots + Fei, opponent discarded 3-dots -> Pong | Server accepts Pong; physically consumes exactly those 3 tile IDs. |
| H-07 | Own three real 3-dots + Fei -> concealed Kong | Server accepts concealed Kong; four unique physical tiles conserved, replacement triggered. |
| H-08 | Try to reclaim Fei from exposed Chi/Pong using later 3-dots | Rejected; both hand and public meld remain unchanged. |
| H-09 | Exposed Fei count 0,1,2 | Itemized Fei fan contribution exactly 0,1,2; each Fei counted only once even in flower-category aggregation. |
| H-10 | Player owns one seat-matching regular flower and one nonmatching regular flower | Ordinary matching-flower base award exactly +1, nonmatching award +0; mapping selected from a *later-approved test profile*. |
| H-11 | Winner has structurally valid 0-fan hand | Win is legal at 0 fan; payout test explicitly **blocked** until zero-fan base approved. |
| H-12 | Discard Hu, loser base `u` supplied as a test-only parameter | For player order [winner, discarder, other1, other2], deltas = [+4u, -2u, -u, -u]; sum 0, regardless of what future rule defines `u`. |
| H-13 | `f` vs `f+1` with same approved hypothetical `B>0` and no cap crossing | Per-unit progression doubles; test must not assert a real-world approved B or cap. |
| H-14 | Re-submit expose Fei / claim / score action with same `actionId` after reload | No extra tile drawn, no duplicated fan, no double settlement. |
| H-15 | Four authenticated browsers with 1 human + 3 server Bots | Same public Fei exposures/melds and settlement; opponents' hands still redacted, Bot moves server-side. |

### BLOCKED numeric/edge fixtures — await written confirmations

| ID | Missing owner decision | Test required after confirmation |
|---|---|---|
| P-01 | Exact four seat ↔ eight flowers map | East/South/West/North fixture with +1 for matching only, including both groups. |
| P-02 | Exact flower-set fan, stacking with matching flower, double-set behavior | Four seasons/four gentlemen/both sets and combined detailed fan breakdown. |
| P-03 | Animal exposure/replacement/individual bonus/pairs | Cat+mouse, rooster+centipede and chained replacement. |
| P-04 | Number of physical Fei, multiple Fei in a meld, wild card substitution into pair/honors | Authoritative legal/illegal action boundary table. |
| P-05 | Direct claimed Kong and added Kong with Fei | Two added-Kong shapes tested separately; concealed Kong may remain supported. |
| P-06 | Actual 0-fan baseline `B`, max fan/cap, self-draw payment, rounding | Golden payout table for f=0,1,2,3 and cap boundary, separately for self-draw and discard. |
| P-07 | Dealer retention after winner/draw and dealer adjustment | Win-by-dealer / win-by-nondealer / drawn-round lifecycle. |
| P-08 | Reserve-size and depletion policy, exceptional flowers/Fei/animal loops | Exhaustion never crashes or creates tiles; behavior matches owner's final decision. |
| P-09 | Fei exposure per own turn limit and Fei normal discardability | No accidental illegal extra Fei exposures, correct UI choices. |

### Integration/quality gates

- `vitest`: wildcard resolver, action state machine, physical-tile conservation property tests, player view privacy, pure fan breakdown, 2:1:1 zero-sum payout; verify old `tests/scoring.test.ts` still passes unchanged in Practice v1.
- Worker integration: room schema migration, WebSocket broadcasts, concurrent claim race, Durable Object restart, cross-round persistence, reconnect during replacement-Fei choice, repeat actionId, nonowner permission denial.
- Playwright: 4 browser multiplayer claim/expose/settlement; 1 human + 3 server Bots; 844×390 and 390×844 no document scroll; touch and keyboard action confirmations; screenshot review.
- Release: explicit owner acceptance fixtures + profile locked and versioned -> CI gate -> staging/manual smoke -> production deploy; **no activation** of incomplete rules profile.

## 4. Small, independently reviewable implementation PRs (after rule confirmations)

- **PR A — profile/schema and independent result projections:** add versioned profile types, reject incomplete official profile, preserve old room. Requires inventory and unknown-field choices.
- **PR B — server wildcard meld reducer:** Chi/Pong + confirmed one-Fei concealed Kong, physical IDs and redaction, exhaustive tests. May progress in isolation, gated off in production.
- **PR C — expose-Fei and reserved replacement state machine:** forced flower chain, optional keep/expose Fei decision, authenticated idempotent continuation. Requires exhaustion behavior for production.
- **PR D — scored fan categories:** seat mapping, set and animal bonuses after confirmation; no double counting; 0-fan eligibility.
- **PR E — actual virtual payout and dealer lifecycle:** doubling formula, 2:1:1 discarder weighting, self-draw formula, base/cap, dealer continuation; **BLOCKED** pending owner answers.
- **PR F — full-stack E2E and gated deployment:** golden examples approved by owner, multi-browser/solo Bots and rejoin, accessibility, desktop and mobile screenshots.

**No runtime code changed by this planning document.** Until these gates pass, the live project is still a **Practice v1** scoring prototype; #28 remains blocked on #27.
