# Mahjong Friends v2 — Rules Baseline (2026-10-16)

**Status: audited against repository code, NOT approved as a regional Malaysian / Singaporean / Hong Kong house ruleset.**

## 1. Objective external baseline vs our custom game

| Topic | Widely documented 4-player Singapore pattern | What Mahjong Friends actually does |
|---|---|---|
| Base deck | 108 suited (3 × 9 × 4), 16 winds, 12 dragons = **136 standard tiles** | `src/game/deck.ts`: 136 standard |
| Flower / season | Eight distinct bonus tiles; four season and four flower, commonly numbered for each seat | Eight distinct bonus faces generated; shown face-up and replaced from reserved replacement wall |
| Animal tiles | Cat, mouse/rat, rooster/cockerel, centipede/worm = **4**; commonly 148 tiles altogether | The correct four face identities are present in `ANIMALS`; replacement occurs as a bonus |
| Blank Fei | **Not part of the ordinary Singapore 148-tile deck** | Extra 0–4 blank Fei as **custom practice profile**, default 4: default deck = **152 tiles** |
| White dragon | Separate from any joker | White dragon `{family:"dragon", dragon:"white"}`; Fei `{family:"fei"}` |
| Objective standard win shape | Four 3-tile melds plus a pair (with Kong counting as one meld); alternate special patterns exist | `isStandardWinningHand` checks four groups + pair only; exposed meld count subtracted |
| Chow / Chi | Suited consecutive three; generally next player on a discard | Server `possibleClaims` checks eligibility and next-seat Chi; no bonus/wind/dragon Chow |
| Pong / Kong | Three/four matching *natural* tiles | Server handles natural matching tiles; wildcard is not used in exposed melds |
| Bonus replacement | Flowers/seasons/animals exposed and replaced | From server-side replacement wall, including consecutive bonuses; 14 reserved by default |
| Fan / side payouts | House-specific; seat flowers, animal pairs, Kong payments vary | **Practice v1 only** (virtual, non-regional points) |
| Dealer continuation | Household/variant dependent | Practice next round rotates dealer unconditionally |
| Player count | Singapore baseline is four players | Four humans, or 1–3 bots filling empty seats. Malaysian 3p **not implemented** |

**Independent reference reading (not official governing authority):**
- https://www.singaporemahjong.com/rules/ — 148-tile inventory, basic meld/win structure, flowers and animals.
- https://sgmahjong.com/rules.html — names of common animal pairs and 13/14 initial hand convention.
- https://singaporemahjongrules.com/ — explicitly notes that household scoring/rules differ.
- https://mahjong.geraldajam.com/setting-up — identifies the four animals, numbered seat flower/season convention.

Sources may disagree about scoring. None should be treated as the **user's** house rules without approval.

## 2. Exact executable profile currently deployed

### Deck and dealing
- `src/game/deck.ts`: each natural suited/wind/dragon face has four physical copies, all IDs distinct. 8 unique bonus flowers/seasons are enabled at round start; optional animal module contains 4 unique correct species; `feiCount` accepts integers 0..4.
- `worker/roomCore.ts` default is `singapore-four-player`, `includeAnimals:true`, `feiCount:4`, `seats:4`, `minimumFan:1`. **Display name implies Singapore, but this is a _Singapore-inspired custom testing deck_, NOT standard Singapore scoring.**
- Dealer starts with 14 tiles, others 13; bonus tiles enter face-up bonuses and require replacement from 14 reserved tiles.
- The four-player Hong-Kong-style *inventory choice* switches off animals and Fei, but remains **Practice v1 scoring**.

### Playable legal action set
- `src/game/engine.ts`: server-owned RNG/wall and action version. Discard; claim window; pass, Chow, Pong, claimed Kong, claim-Hu; concealed and added Kong; self-draw Hu. The first valid claim wins by Hu > Pong/Kong > Chow with closest-seat tie-break.
- Only the next player may Chow. Fei can substitute any natural face for the ordinary concealed 4-groups-plus-pair Hu test; it may not be used in an open Chow/Pong/Kong. These are **developer practice assumptions**, not proven regional rules.
- Special winning hands (seven pairs, thirteen orphans/wonders, etc.) are **not implemented**.
- Robbing added Kong, multiple simultaneous winners, Fei reclaim/exchange, Fei discard penalties and other regional exceptions **not implemented**.
- The engine preserves physical tile accounting after every accepted turn.
- Each private WebSocket snapshot contains only the viewer's concealed hand; opponent hands and concealed Kong identities are hidden.

### Practice-only scoring, no betting
- `src/game/scoring.ts`: virtual categories: base Hu 1, self-draw 1, each bonus tile 1, mixed one-suit 1, pure one-suit 2, natural seat wind triplet 1, each dragon triplet 1, Fei 0. These **are not authoritative fan/tai values**.
- Self-draw: each opponent loses `max(1, fan)`; winner earns three such stakes. Discard win: discarder pays `3 × max(1, fan)`, others zero. Draw: no transfer. Zero-sum. This is **not a claim about actual Singapore payouts**.
- `minimumFan=1` is room configuration but the practice win validator does **not** enforce an official 1-fan regional threshold or cap.
- Settlement is performed once, cumulative practice points persist, all players (bots are auto-ready) ready for next round, dealer index rotates 0→1→2→3 irrespective of outcome.

## 3. Bug/ambiguity risk register — do NOT silently declare correct

1. **Practice hand wins may be offered independent of regional minimum fan.** Region-specific minimums require explicit profile checks and golden test fixtures.
2. **No official Fei definition.** Default 4 blank jokers is not Singapore standard 148; whether Fei can form pair/sequence/triplet, be discarded or reclaimed remains user's choice.
3. **Scoring special cases are approximations.** `scoreRound` counts natural triplet tile totals rather than evaluating exact meld/pair decomposition; it may award an illustrative fan for a configuration whose shape is different. Future confirmed rule profile must score actual decomposed melds.
4. **Flower seat matching and animal pairs are not implemented.** Existing blanket per-bonus practice fan is not authoritative.
5. **Dealer rotates on all outcomes** and does not model house-specific dealer retention on wins/draws.
6. **Winning discard remains in source river at settlement** (intentional data conservation); user UI must make winning ownership obvious without misplacing a physical tile.
7. **Existing generated illustration asset sheet has invalid animal species** (crane, koi, panda, tiger). Do not ship those as gameplay tiles: correct species are cat, mouse, rooster, centipede.
8. **Mobile layout currently requires visual regression verification**; preserving a seat river is not the same as fitting all content in one viewport.

## 4. Tests and evidence links

| Claim | Executable evidence |
|---|---|
| Deck counts and unique tiles | `tests/deck.test.ts`, `tests/tiles.test.ts` |
| Bonus replacement | `tests/wall.test.ts` |
| Hu/chow and wildcard structural logic | `tests/hand.test.ts` |
| Turn arbitration, privacy & conservation | `tests/engine.test.ts` |
| Socket admission, retry/idempotence | `tests/protocol.test.ts`, `tests/socketTicket.test.ts` |
| Practice payout, repeat round | `tests/scoring.test.ts` |
| Bots and single-human completion | `tests/bots.test.ts`, `e2e/solo-bot.e2e.ts` |
| Full four-human browser flow | `e2e/mahjong.e2e.ts` |

Passing automated tests means the code complies with its *implemented* assumptions, not that a regional Mahjong judge validated the house rules.

## 5. Decisions blocked on owner's explicit approval (Issue #27)

- Is target Singapore four-player, Malaysian four-player house style or Malaysian three-player? **Three-player needs independent deck and turn logic.**
- Exact tile inventory: how many Fei? Are Fei printed blank? Is white dragon wild in any variation?
- Whether Fei substitutes for a pair, may be discarded/reclaimed/claimed, or gets bonuses/penalties.
- Flower/season ownership seat mapping and all/paired animal payouts.
- Minimum fan/tai, cap, seven pairs/thirteen wonders, pure-suit, dragon, Kong side settlements.
- Point transfers for self-draw vs discard; multiple winners/rob-a-Kong and dealer retain/draw rules.

**Rule change gate:** record owner-approved examples first, write table-driven tests, then implement a named new rules profile. Keep Practice v1 behavior unchanged until that profile is selected.

**Non-goal:** real money, stakes, betting.
