# Mahjong Friends — Owner house-rule contract (DRAFT)

> Owner interview snapshot: **2026-10-16**. Source of truth: [Issue #27](https://github.com/ckyong826/mahjong-friends/issues/27).
>
> **NOT approved for a production rules profile.** `Practice v1` is the only implemented scoring profile. "Confirmed" below means **owner explicitly said this**, **not** that code supports it. No real-money settlement, payments or gambling ledger.

Use these four status codes on every rule: **CONFIRMED** (owner stated); **OPEN** (unconfirmed); **CONFLICT** (two incompatible decisions; must reconcile); **DESIGN** (implementation concept, not yet approved).

## Confirmed — gameplay and deck

| ID | Rule | Status | Acceptance example |
|---|---|---|---|
| C-01 | Four seated players. Includes flowers, Fei jokers, and four animals: cat, mouse, rooster, centipede. | CONFIRMED | Player list has 4 seats; named animals represented by distinct physical tiles. Exact Fei count and full inventory remain open. |
| C-02 | A concealed Fei can be kept as a wildcard across turns. | CONFIRMED | Fei drawn in round turn 1 remains in hand through later turns without compulsory exposure. |
| C-03 | During one's own turn, a previously held Fei can be exposed for a replacement draw. | CONFIRMED | Moving an old Fei from own concealed hand to exposed Fei area removes one physical tile from the hand and initiates replacement. |
| C-04 | Fei may substitute a missing suited tile in an exposed Chi. | CONFIRMED | Own 2-dots + Fei, previous player's 4-dots -> Chi representing 2-3-4 dots. The exposed physical meld still contains Fei, not a fabricated 3-dots. |
| C-05 | Fei may substitute a missing identical tile in Pong. | CONFIRMED | Own 3-dots + Fei, another player discards 3-dots -> legal Pong; the actual Fei stays in exposed meld. |
| C-06 | Three real identical tiles plus one Fei can form a concealed Kong and trigger replacement. | CONFIRMED | Own [3-dots,3-dots,3-dots,Fei] -> concealed Kong and one replacement draw; cannot infer rules for other Kong kinds. |
| C-07 | Fei already used in exposed Chi/Pong cannot be reclaimed by swapping in a real tile. | CONFIRMED | Later drawing 3-dots does not let a player take Fei out of exposed 2-dots/Fei/4-dots Chi. |
| C-08 | Expose Fei -> draw from a **reserved replacement zone**. | CONFIRMED | The live wall does not shrink when exposed Fei is replaced; replacement-zone inventory does. |
| C-09 | Replacement draw of a flower -> reveal flower and draw again from the replacement zone. | CONFIRMED | Expose Fei -> replacement yields spring flower -> expose spring -> consume another replacement tile. |
| C-10 | Replacement draw of another Fei -> choose: keep as a wildcard OR expose it and keep replacing. | CONFIRMED | Do not automatically expose a replacement Fei; server awaits an authenticated choice. |
| C-11 | Each **exposed Fei** contributes +1 fan under the flower/bonus scoring category, without counting the same Fei twice. | CONFIRMED | Two exposed Fei = 2 fan from Fei exposure, not 4 by adding separate "flower" and "Fei" credits. |
| C-12 | Only own seat's matching "正花" awards the ordinary flower bonus: **each matching flower +1 fan**. | CONFIRMED | A nonmatching ordinary flower gets no **seat-flower base fan** (independent full-set rewards still require confirmation). |
| C-13 | A complete spring/summer/autumn/winter set OR a complete plum/orchid/bamboo/chrysanthemum set has an extra set reward. | CONFIRMED (reward exists; value OPEN) | Each four-tile set qualifies for a bonus line; its numeric fan and stacking remain blocked. |
| C-14 | A legal hand can win at **0 fan** ("鸡胡"). | CONFIRMED | Minimum-fan eligibility = 0; this does not tell us whether zero-fan hand pays 0 or has a base stake. |
| C-15 | A discard win is paid by **all three other players**. Discarder:other loser:other loser = **2:1:1**. | CONFIRMED | If the regular other-loser unit is `u`, deltas are winner +4u, discarder -2u, remaining losers -u and -u; `u` itself is OPEN. |
| C-16 | A self-drawn win is paid by all three opponents, though amounts are not known. | CONFIRMED (payers only) | All three opponents are in the settlement; do not assert a per-player amount. |
| C-17 | For increasing fan, the **base payable amount doubles for each +1 fan**. | CONFIRMED (scaling only) | If valid applicable base is `B`, unbounded provisional scale `B × 2^f`; B, cap, applicability to different payers/modes and any rounding are still OPEN. |

## Unconfirmed — do not silently choose defaults

| ID | Exact unresolved question | Safe engineering treatment |
|---|---|---|
| U-01 | Full physical inventory: all 3 suited families? exactly how many Fei? other special tiles? | Existing 152-tile practice deck is NOT owner-approved. |
| U-02 | Which seat pairs with spring/plum, summer/orchid, autumn/bamboo, winter/chrysanthemum? | No formal `seatFlowerMap` until specified. |
| U-03 | Are exposed Fei ever discarded normally? Can a Fei be used as an eye, honor, or in special hands? How many Fei per meld? | No blanket wildcard permission beyond C-04/C-05/C-06. |
| U-04 | Fei in directly claimed open Kong, and in upgrading Pong to Kong (either natural Pong + Fei or Fei Pong + natural tile). | Keep separate pending rules; do not inherit from concealed Kong. |
| U-05 | Maximum number of old Fei a player may intentionally expose in one own turn, and precise allowed action timing. | Do not build a user-facing unlimited-expose shortcut. C-10's choice after replacement is separately confirmed. |
| U-06 | Reserved replacement size, depletion policy, and whether all Kong replacement draws use the same reserved zone. | Cannot choose automatic draw/end/live-wall fallback. |
| U-07 | Do animal tiles have to be revealed and replaced? Is there a replacement chain for animals? | Current Practice v1 auto-reveals/replaces animals; not an owner-approved animal rule. |
| U-08 | Animal single-tile fan; cat+mouse, rooster+centipede pair rewards; any all-animal bonus. | Physical four animals are confirmed; scoring is not. |
| U-09 | Complete flower-set extra fan for each group; whether a set overrides or adds to the +1 matching seat flower; bonus for both sets. | Separate `seatFlower`, `seasonSet`, `flowerSet` scoring lines; no numeric set contribution yet. |
| U-10 | 0-fan winning **base virtual points**, cap, fan-to-point conversion baseline, rounding, mode differences and non-fan win modifiers. | "Doubles per +1 fan" alone is insufficient to produce payouts. Do NOT assume `B=1` or `cap=none`. |
| U-11 | Self-draw payable formula, same/different rates, dealer adjustment, double payment and special cases. | Payer set known, amounts OPEN; do not reuse discard 2:1:1. |
| U-12 | Dealer retention after dealer wins / other player wins / draw, plus dealer-payment effects. | Current unconditional Practice v1 rotation is not owner-approved. |
| U-13 | Special wins, robbing Kong, claim priority exceptions, self-draw fan rules, Kong side-payment and maximum fan. | Do not automatically apply Singapore reference rules. |
| U-14 | Ordinary flower exposure timing; seat-number identity of four flowers/seasons; bonus count on replacement exhaustion. | Keep specific behaviors under test before approval. |

## Contradictions to avoid

- **Confirmed:** 0 fan can win. **Not confirmed:** 0 fan pays zero points.
- **Confirmed:** score amount scales by doubling each additional fan. **Not confirmed:** a complete numeric payout table.
- **Confirmed:** exposed Fei +1 fan in flower category. **Not confirmed:** every ordinary nonmatching flower +1 fan.
- **Confirmed:** exposed Fei cannot be reclaimed from Chi/Pong. **Not confirmed:** another form of "起飞" not described in owner answers.
- **Confirmed:** replacement Fei may be exposed immediately again. **Not confirmed:** unlimited voluntary exposure of previously held Fei in one turn.
- **Confirmed:** Fei can form one specified concealed Kong. **Not confirmed:** Fei can form every type of Kong.
- **Confirmed:** players get their own true concealed tiles. **Not confirmed:** clients ever get to inspect opponents' hands. Opponent hands must remain private.

## Owner decision checkpoints to unblock official mode

Prioritize: **(1) complete tile inventory + seat flower mapping, (2) precise joker and animal replacement/remaining-wall behavior, (3) fan table + 0-fan base + cap + self-draw payouts, (4) dealer/settlement continuation rules**. A confirmation must include at least one acceptance hand and example for each special case, not just agreement to the profile name.

> Last updated 2026-10-16; every "CONFIRMED" claim traces back to written owner replies in [Ticket #27](https://github.com/ckyong826/mahjong-friends/issues/27). Keep Issue #27 OPEN and #28 BLOCKED until an approved, deterministic profile and its fixtures exist.
