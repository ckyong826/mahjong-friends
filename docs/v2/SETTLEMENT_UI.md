# Mahjong Friends v2 — Practice settlement scene (#26)

## Visual semantics and accessibility

At end-of-hand, `MahjongTable` renders a fixed, viewport-bounded settlement **dialog**, not a long page appended beneath the table. It has `role="dialog"`, `aria-modal="true"`, and a labelled heading (Hu or exhaustive draw). The dialog gains keyboard focus when the round enters `ended`, and Tab/Shift+Tab remain inside its actual enabled controls until the next round starts. There is no fake close button: players must complete readiness or exit through another session flow.

1. Winner/draw headline and round number.
2. **练习积分 · 非正式家规／非官方新马麻将番数** always visible.
3. Four score cards, one for each seated player: positive/negative/zero delta and cumulative total.
4. Named Practice v1 category fan breakdown, not a claim of official regional scoring.
5. Next-round ready count, local ready/cancel button, and owner-only next round button. In solo testing, Bots remain automatically ready after settlement.

The entire table's document does not scroll. Dense fan lines may scroll **inside the result sheet** on 844×390 or portrait, while the bottom ready controls remain sticky and in view. Blank/negative points are visually distinct without relying on color alone because signs and numeric values remain printed.

## Source of truth

- Scores come only from authenticated `room.lastSettlement` and `room.scores`, calculated by the existing server-side Practice v1 settlement engine.
- The UI does NOT calculate fans, transfer money or alter regional Mahjong rules.
- The same room state persists through reload and four-client WebSocket updates.

## Automated acceptance

- `tests/scoring.test.ts`: zero-sum payouts, no double settlement, rematch and rotating dealer already covered.
- `e2e/mahjong.e2e.ts`: four real browsers play a whole hand. At terminal outcome, a labelled keyboard-focused results dialog appears, cards show all four players, the Practice-only label remains visible, and server `delta` sums to zero. Checks 844×390 viewport fit without document scroll; four players then ready and start next round.
- Existing solo Bot and main responsive suite must remain green.

The production game is still an explicitly non-official practice scoring prototype until the owner confirms the exact region/house rules in #27.
