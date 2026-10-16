# Mahjong Friends v2 — Asset Manifest and Quality Gates

**No copyrighted Mahjong Soul sprites, characters, screenshots or audio may be bundled.** Our generated mockups establish a **mood / art direction**, not machine-usable semantically correct assets.

## Required machine-addressable tile identities

Use the typed tile face model (`src/shared/tiles.ts`) as the source of truth:

- Characters: 1–9 萬; four physical copies each.
- Bamboo: 1–9 索 / bamboo pips; suit identity independent from decorative drawing.
- Dots: 1–9 筒 / circles; pip number must exactly match rank.
- Winds: 東 南 西 北 (4 each).
- Dragons: 中 發 白 / white dragon blue-bordered design (4 each).
- Flowers: 梅 蘭 菊 竹 (4 singletons); seasons 春 夏 秋 冬 (4 singletons).
- Animals: **cat, mouse, rooster, centipede** (4 singletons), not crane/fish/panda/tiger.
- Fei: a truly **blank** face with separate gold bevel / subtle motif only on frame, never print `白` or `飛` on face.
- Tile back: jade tile-back + white/green thick side surface. Distinguish face-up and upside-down/hidden states.

**Design QA rule**: reject assets with incorrect pips, semantically swapped characters, wrong species or nonblank Fei. Decorative AI images may be used as concept reference, not truth source.

## Scalable game UI asset groups

1. Table: emerald felt texture, dark carved wood square/diamond frame, gold center wind & wall meter plate, safe tile-row backgrounds.
2. Player badge: four wind positions, clear name/score/bot tag and one active-turn outline. Avoid requiring character art.
3. Tile symbols: exact 34 natural faces + flowers/seasons 8 + animals 4 + Fei blank (47 semantic keys) rendered from verified original SVG/component source; a single visual tile component may reuse vector/canvas instructions.
4. Action buttons: Chi, Pong, Kong, Hu, Pass; select/confirm/cancel, active/disabled/hover/focus variants.
5. Status icons: copy room link, reconnect signal, sound on/off (future), settings, dealer crown; vector icon library is preferable to generated raster for legibility.
6. Motion: selection lift, latest discard glow, wind active indicator, no disruptive animations or unbounded extra DOM.

## Pipeline / implementation guidance

- Asset creation must be reproducible. Prefer code-driven SVG/CSS for tile bodies + semantic symbol art or curated original raster/vector faces checked by tests. Avoid brittle CSS positioning inside one giant AI sprite sheet.
- If a generated image is approved only as a **concept**, store in design documentation or deliver via preview; do not slice it into live game tiles blindly.
- Keep 1x and 2x physical pixel sizes sharp. Ensure text contrast on every tile style, keyboard labels, and no reliance on hue alone.
- Snapshot tests should enumerate every `TileFace`, checking the exact expected visual label and correct suit/rank mapping.
- Provide fallback tile drawing if any requested asset cannot load. Do not hide face, side walls or actionable buttons because an image fails.

## License policy

- Assets created from scratch, public domain or explicit commercial reuse license only.
- “Inspired by” cannot mean pixel-tracing or extracting copyrighted Mahjong Soul UI pieces.
- Preserve attribution and license metadata for any acquired font/icon.
- User-provided/generated concept artwork must be reviewed for semantic correctness and originality before production deployment.
