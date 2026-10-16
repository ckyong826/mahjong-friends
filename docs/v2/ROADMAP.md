# Mahjong Friends — v2 Execution Roadmap

## Delivery contracts

GitHub issues [#19](https://github.com/ckyong826/mahjong-friends/issues/19) through [#29](https://github.com/ckyong826/mahjong-friends/issues/29), one independently testable PR per ticket wherever practical.

1. **#19 Rule audit** (not an official house-rule approval). Source vs runtime and issues.
2. **#20 Visual / interaction baseline**. Scene metrics and original art source contract.
3. **#21 Tile art / scene primitives**. Semantically correct assets only.
4. **#22 Single viewport table**. Landscape desktop/phone no document scroll and full controls.
5. **#23 Four readable rivers, melds, bonus tiles**. Claim transfer correct.
6. **#24 Action interaction**. No misclick, keyboard and touch-safe behavior.
7. **#25 Bot visual integration**. Solo test in new UI.
8. **#26 Settlement overlay**. Preserve virtual Practice v1 and rematch.
9. **#27 Owner-approved rule decisions**. BLOCKED until written confirmation.
10. **#28 Confirmed regional scoring engine**. BLOCKED on #27.
11. **#29 Animation, visual QA, production release**.

## Never conflate

- UI screenshot approval ≠ rule approval.
- Unit tests pass ≠ regional scoring official.
- GitHub build succeeds ≠ Cloudflare deployment proves real-world performance.
- “Fills viewport” ≠ readable; human screenshot QA needed before declaring v2 polished.

## Live operations

`main` successful CI automatically triggers production Cloudflare deployment if repository secrets exist. To avoid interrupting active rooms, game reducer and durable storage schema are unchanged during early visual-only milestones. Each ticket requires a smoke test in the local Worker environment; production rollback is via previous version deployment if severe issues arise.
