# Mahjong Friends v2 — Ten DISTINCT tabletop spatial layouts

**Preview:** `/mahjong-design-lab.html`. **Design only — NOT playable Mahjong, not a room/UI engine replacement.** Originally this page showed ten mostly cosmetic themes sharing the same table geometry. Owner feedback (2026-10-16): **"different 排版 ... 弃牌之类的会被吃位子，overflow"**. This revision changes **the actual distribution of each opponent's discard region**, central round info, score and own hand.

## Ten alternative placement diagrams

Each letter is a distinct allotted grid region. T=top opponent, L=left opponent, R=right opponent, B=bottom opponent, C=central turn info; ·=unused tabletop breathing space. Discard history, meld summary and view-all link are internal to the respective opponent region.

```text
01 Classic Cross        02 Tall Side Rails      03 Diagonal Quadrants
· T ·                   L T R                   T T R
L C R                   L C R                   L C R
· B ·                   L B R                   L B B

04 Full-width Bands     05 Opponent Rail        06 Diagonal Focus
T T T                   T C C                   L T T
L C R                   L C C                   L C R
B B B                   R B B                   B B R

07 Broadcast            08 Asymmetric L         09 Mosaic
T L R                   T T L                   T R R
C C C                   R C L                   T C L
B B B                   R B B                   B B L

10 Mobile Pro (4 rows)
T L R
T L R
C C C
B B B
```

**Important:** All ten use the same Emerald/Gold color palette in this experiment so the choices are about **layout, hierarchy and discarded-tile real estate**, rather than style/skin.

## What is now materially different

- The table region uses a different explicit CSS **grid-template-areas** per prototype, not a shared fixed `.seat.top/left/right/bottom` arrangement with ten colors.
- Every region gets an allotted non-overlapping area with fixed height/width tracks in CSS `fr` units (the gap and padding are included in space budgeting).
- Full discard rivers never scroll inside seats. Latest discards remain visible; if the region cannot fit even the abbreviated preview, reduce **older** tiles first and update `查看全部 +N`. The complete sequence remains available using a separate **paged, non-scrolling view**.
- Melds/flowers and the `查看全部` link remain visible and tested, rather than being "eaten" by the river.
- Fixed hand+confirm dock remains independent of table growth. Three device simulations: Desktop 1100×620, Landscape 844×390, Portrait 390×844.
- Portrait isn't necessarily the intended serious play mode; evaluate #07 and #10 on narrow landscape devices first.
- All demo tiles/history are static examples, never another player's actual concealed hand or server decision. Existing Practice v1 and authoritative gameplay are untouched.

## Stronger Playwright acceptance

The Design Lab test now requires **10 unique computed CSS grid templates for each of three devices**, five mutually non-overlapping tabletop regions, all inside the table boundary; every player has at least six latest tiles plus a complete-history entry and a visible meld summary. It also checks no document, screen, seat or dock scroll overflows; tile selection, confirmation toast, and paginated river dialog remain functional.

## Choosing the final layout

Evaluate visual hierarchy rather than just theme: whether the most recent discard is findable in one glance; public meld/flower indicators are still distinguishable; each of the other three players can be identified immediately; a winning/claim modal doesn't cover your chosen tile; the fixed dock is comfortably tappable in landscape; no clipping at 844×390, 915×412 and portrait. Once one or two directions are selected, implement the production `MahjongTable` layout in a separate PR, reuse the current tile art and preserve all server-authenticated action behavior. Do not present the static Design Lab as actual gameplay.

Official four-player Fei rules continue in [Issue #27](https://github.com/ckyong826/mahjong-friends/issues/27). Implementing them in the server is separate from visual UX.
