# Mahjong Friends v2 — Ten UX visual directions

Standalone preview: **`/mahjong-design-lab.html`**. No live authentication or gameplay actions; does not mutate or override the shipped game UI. This is a nonproduction exploration artifact based on `src/MahjongTable.tsx`, `src/game/presentation.ts` and `src/styles.css`.

## Confirmed UX symptoms in current source

- `.mj-discard-panel {overflow-y:auto}`: four independent river scrollbars inside a page that forbids document scrolling.
- `.mj-showcases {overflow:auto}`: flower and open-meld collections can acquire nested scrollbars.
- `.mj-hand` and mobile landscape overrides compete for fixed height with controls, labels and long rivers; screen-size-specific mini-tile shrinking addresses geometry but degrades recognition.
- Empty/long rivers and wrapped nickname badges need stronger compact/expanded presentation boundaries.
- Existing E2E tests check overall page scroll and broad bounding boxes, but **do not assert that each inner panel has no scrollable overflow**.

## Ten concepts (layout exploration, not ten finished UIs)

| ID | Name | Direction | When to choose |
|---|---|---|---|
| 01 | Emerald Heritage | Simplified traditional deep-green / gold cross-shaped table | Default continuity with current visual brand |
| 02 | Arcade Neon | Wide horizontal rivers and narrow flanking rails, high-contrast current turn | Faster action scanning |
| 03 | Porcelain Blue | Bright high-contrast tile presentation, narrower circular focus | Long play with lower eye fatigue |
| 04 | Minimal Focus | Borderless quiet action scene, low-decor UI | Maximum readability for experienced players |
| 05 | Social Lounge | Larger avatars and warm seating cards | Friends/solo Bot identity and social presence |
| 06 | Tactical HUD | Dense information ribbons, square cards, high contrast | Advanced players monitoring scores and walls |
| 07 | Classic Teak | Felt center and wood-framed seating | Real-world Mahjong atmosphere |
| 08 | Botanical Calm | Soft green spacious surface and rounded interactions | Beginner/family-friendly play |
| 09 | Social Pop | Colorful casual skins, pill status and wide top/bottom rivers | Customization and collectible cosmetic skins |
| 10 | Compact Pro | Screen-budgeted mobile-first rails and fixed primary action dock | **Recommended engineering baseline for 844×390** |

## Deliberate UX constraints shared by each proposal

1. No nested scrolling inside the playing scene. On desktop, top and bottom rivers show 12 latest discards, left and right up to 18. The view-only complete river paginates in a separate overlay; no row vanishes beneath a scroll pane.
2. Four player positions are always visible; each has a label and scores. Opponent tiles are UI-only example data and do not represent server secret hands.
3. Hand and Confirm button are fixed independently of growing discard history.
4. The portrait and landscape previews use separate 390×844 and 844×390 scene budgets rather than shrinking a desktop page without rearrangement.
5. Smaller regions use recent-tile summaries and explicit **“查看全部”**; no silent extra discard loss.
6. Demo tile selection and action button show a **mock toast only**. Not a live action. No gameplay state or scoring code touched.
7. Full public meld/flower collections need a deliberate detail sheet in the chosen final build; the prototype shows their persistent labels and summaries rather than faking unlimited visible tiles.
8. Release-gating future implementation: run measurements for nickname length, expanded meld count, multi-row claimed river, many Bonus tiles, selection confirmation and settle/claim modal at five real viewport sizes, including touch target size and physical screen containment.

## Suggested next work after visual selection

- Owner chooses at most two directions to compare side by side on real phones.
- Implement a **content budget** for each seat panel; keep a latest-discard marker and direct physical tile count.
- Replace nested river and meld scrolling with intentional full-history overlay/pagination; render the entire server-public sequence there.
- Keep claimed Chi/Pong/Kong visually grouped with source position, persistent flower/animal/Fei summary.
- Preserve server-authoritative action boundaries and Practice v1 during UI refactor.
- Build Playwright assertions for 1366×768, 1440×900, 844×390, 915×412, 390×844, including **scrollWidth/scrollHeight of every internal seat panel**, not just full document.
- Visual QA real screenshots + reduced-motion and accessible label/focus; deploy behind a feature flag/preview route before promoting to main table.

## Automated preview QA

`e2e/design-lab.e2e.ts` visits the static 10-concept gallery, switches each concept in desktop, phone-landscape and phone-portrait, checks stage/seat/control geometry and absence of inner scrollable overflow; verifies tile-selection toast and paginated full river; saves selected screenshots.

**Not a rule decision:** All labels, scores, wall counts and sample 24-discard rivers are intentionally static fake examples for exploring hierarchy. Existing server-backed game is unchanged. Official four-player Fei house-rule confirmation remains in Issue #27, and full scoring engine #28 remains blocked.
