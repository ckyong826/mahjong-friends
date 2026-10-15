# Mahjong Friends — Scoring practice profile (v1)

> **IMPORTANT — This is not official Malaysian/Singaporean/Hong Kong scoring.** The precise 3-player/4-player regional rules, Fei bonuses, special hands and flower payments must be agreed with the friend group before a regional scoring profile can be declared accurate.

The purpose of Practice v1 is to let 4 friends complete and restart rounds, keep transparent **virtual** scores, and test a deterministic zero-sum scoreboard. It is not gambling, money, or an indication of official fan/points rules.

## Currently enabled profiles

- Singapore-style four-player **tile inventory prototype**: 136 base + 8 flowers/seasons + 4 animals + 4 blank Fei. Scoring profile always Practice v1.
- Hong Kong four-player tile inventory: 136 base + 8 flowers/seasons, no animals/Fei. Scoring profile still Practice v1.
- Malaysian 3-player is **not enabled**. Do not confuse its removed suits/Fei behaviour with four-player tile counts.

## Practice v1 scoring table

| Category | Test fans | Logic |
|---|---:|---|
| Standard valid Hu | +1 | Engine has verified 4 melds and a pair |
| Self-draw | +1 | Winner draws own tile |
| Flower/season/animal bonus | +1 each | Practice only; official bonuses often depend on matching seat |
| Half flush (mixed one suit + honors) | +1 | Natural suit tiles all in one suit and there are honors |
| Full flush (one suit, no honors) | +2 | Natural suit tiles all in one suit |
| Seat wind triplet | +1 | Three natural matching wind tiles |
| Dragon triplet | +1 per group | Three natural matching dragon tiles |
| Blank Fei | +0 | Wild for ordinary concealed hand validation; no automatically invented bonus |
| Draw game | 0 | No transfer |

All values are training constants, not assertions about regional Mahjong.

## Virtual points settlement

Define **stake = max(1, total test fans)**.

- Self-draw: each of 3 opponents loses 1× stake; winner gains 3× stake.
- Win on a discard: the discarder loses 3× stake; winner gains 3× stake; other players transfer 0.
- Draw game: all deltas 0.

The sum of all four deltas is exactly zero. Results include each category label, fan count and written explanation. The room stores cumulative totals, the most recent breakdown and round number.

## Round transition

A room enters `settlement` when an engine action ends the hand. In the same serialized DO operation, it persists the outcome and **exactly one** score transfer, then broadcasts each player's redacted snapshot. All readiness flags reset. Every player clicks **准备下一局**; when all four are ready the owner can start. Total virtual points persist.

Practice mode rotates dealer each round (East -> South -> West -> North -> East) independent of who won. This rule is **provisional**; true regional rules may keep the banker depending on self-draw/draw/win.

## Remaining before regional-accurate scoring

- Confirm exact Malaysian/Singaporean ruleset and whether using 3-player or 4-player mode.
- Confirm Fei joker restrictions, discarded Fei, Fei claim/exchange, bonuses and payouts.
- Confirm minimum fan and alternative legal winning hands (seven pairs, thirteen orphans, special hands).
- Confirm whether seat flowers/animals, dealer, self-draw and exposed/concealed Kong create side payments.
- Confirm draw/retain dealer, multi-win and robbing a Kong.

These must be built as independently tested **regional profiles** — never change Practice v1 silently.

For now, the UI explicitly labels every total as **练习积分，非正式家规**.
