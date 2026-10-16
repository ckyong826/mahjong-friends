# Mahjong Friends v2 — River & meld display (Issue #23)

## Physical table mapping

- The authenticated viewer is always Bottom. Clockwise next = Right; opposite = Top; previous = Left. Public winds and score badges remain anchored to each server seat.
- Each seat's `PublicPlayerView.discards` is rendered **in chronological order**, with up to six tiles per visible line. There is no face sorting, duplicate insertion or client-simulated discard.
- Left and right river lines align inward toward the center; top/bottom lines are centered. Tile faces remain upright for practical phone legibility rather than exact perspective rotations.
- Last discard receives a gold ring and tiny amber marker **only while that tile is still physically present in the river**.
- A long river scrolls *inside that seat's pane* to reveal the newest rows without scrolling the whole game page. Old rows remain accessible.

## Exposed and hidden groups

- `bonuses` is separate from `melds`; 8 flowers/seasons and 4 Singapore animals are always bonus tiles and not claimed from discards.
- Every public Chow/Pong/Kong is grouped, with a colored group edge, tiles and a subtle source-seat label.
- The server's meld order is two matching tiles from the hand, then the third tile from the discarder. Therefore index 2 is highlighted as the **claimed tile**. Added Kong appends the fourth tile at index 3, and must NOT move the claimed marker.
- A concealed Kong viewed by another player exposes only `tileCount=4`: all four tile backs are rendered with no tile-face or source marker, preserving privacy.
- Claimed tiles are physically removed from the discarder river by the server and present exactly once in the claimant meld. Their original `tile.id` remains unchanged.

## Acceptance tests

- `tests/riverDisplay.test.ts`: 25 discards split into 6/6/6/6/1, original order unchanged; source marker remains index 2 for added Kong; concealed Kong has no face/source.
- `e2e/mahjong.e2e.ts`: four authenticated browsers see one correct seat-specific row for the first real discard and its highlighted latest tile.
- `e2e/v2-viewport.e2e.ts`: 1366×768, 1440×900, 844×390, 915×412 and 390×844 render all four seat rivers plus hand and controls without whole-document scroll.

**Known tradeoff:** long river history can scroll inside a seat, and complex meld/bonus collections may also locally scroll in very short screens. We prioritize access to the current action and newest discard over squeezing 25+ tiles into illegible tiny sprites. Full animated rotation/perspective is scoped to v2 polish Issue #29.
