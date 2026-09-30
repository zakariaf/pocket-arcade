# Game logos, the logo tile and the Shell pictures

## Contents

- Where logos appear
- GAME_ART: how the Shell gets the logo and the credits
- The logo grid and the six roles
- The three painted games' logos
- Designing a logo for a new game
- The logo tile (frame) per place
- The rating star (two colours)
- The S10 empty-statistics picture
- The S15 hazard strip
- How-to-play pictures (game art)
- Canvas budget

## Where logos appear

Each game has one logo, drawn in code and never mirrored. It sits in an accent **logo tile**: S4 Home brand lock (46 pt), S10 game panel (36), S11b About (92, "cut"), S7 lose picture (104), S1 splash (152), and in the app icon and native splash (`app-icon-and-splash.md`). `assets/reference/logos-design.png` shows the three painted games' S1 tiles in light and dark exactly as the design draws them.

## GAME_ART: how the Shell gets the logo and the credits

This skill owns the art part of the game module contract: `packages/shell/src/art/game-art.ts` (`GameArt`), `credit-entry.ts` (`CreditEntry`, one S11d row) and `credit-rows.ts` (`creditRowsOf`). Each game exports `GAME_ART` from `apps/<game>/src/art/game-art.ts` (template: `templates/apps/__GAME_ID__/src/art/game-art.ts`), and the game-host-integration skill assembles it as `presentation.art`:

```ts
export const GAME_ART: GameArt<BoardToken> = {
  palettes: BOARD_PALETTES, // the board's four palettes (board-rendering-skia)
  logo: LOGO_ART,           // ./logo-art.ts: the one logo of the game
  credits: CREDITS,         // the game's own S11d rows; [] for most games
};
```

| Member | Read by | What for |
|---|---|---|
| `palettes` | the board host factory | `makeBoardColors(Skia, palettes, { scheme, isColorBlind })` |
| `logo` | the game host (`host.logo`), screens | `LogoTile` on S1, S4, S7 (lose picture), S10 and S11b; `render-art.ts` reads the same `LOGO_ART` for the app icon and splash |
| `credits` | the game host (`host.credits`), the licences screen | `[...shellLicenceEntries(t), ...creditRowsOf(host.credits)]` |

`creditRowsOf(credits)` turns each `CreditEntry { kind, name, version, license, copyright, source }` (`source` is host and path without a scheme, because app code holds no URL literals) into a row `{ key: 'game-<kebab name>', group, name, version, licence }`: fonts go to `fonts`, sounds to `sounds`, word lists and libraries to `software` (the licences screen has these groups). Credit a font or word list the game ships beyond the Shell's own five fonts; generated sounds need no row (the Shell's "Game sound effects" row covers them).

There is no `drawIcon`: the icon, the splash and every in-app tile draw `LOGO_ART`, so one data file is the whole brand. The win title that S7 shows above the stars is a text, not art: it is `identity.winTitleId` (`'<game-id>.win-title'`, in all four catalogs).

`check-icons-and-logos.mjs` fails `game-art` when an assembled game (`src/index.ts`) has no `game-art.ts`, or when `GAME_ART.logo` is anything but `LOGO_ART` imported from `./logo-art.ts`.

## The logo grid and the six roles

Logos use a `viewBox 0 0 48 48` and are drawn at 88 % of the tile's content box. Each layer has a role; toy ink `#1D1B3A` and white are printed colours (the same in light and dark), pop is the game's paint:

| Role | Paint |
|---|---|
| `p` | fill `pop` + toy-ink edge 2.6, round join |
| `w` | fill white + toy-ink edge 2.6, round join |
| `w0` | fill white, no edge |
| `k` | fill toy ink |
| `kl` | toy-ink line 2.6, round cap and join |
| `pl` | pop line 4, round cap |

A layer may carry `rotate: { deg, cx, cy }` (SVG `rotate(deg cx cy)`). In code: `LogoArt` in `packages/shell/src/art/logo-art.ts`; each game exports `LOGO_ART` from `apps/<game>/src/art/logo-art.ts`; `logoOps()` expands roles into paint operations (a fill before its edge) for both the in-app canvas and the Node art script.

## The three painted games' logos

- **Line Siege** (`templates/apps/line-siege/src/art/logo-art.ts`): a castle wall (`w`) with brick lines (`kl`) under a pop beam (`p`) rising from its tower.
- **Flock Tilt** (`examples/flock-tilt-logo-art.ts`): a pop meadow line (`pl`), then a white sheep (`w`) with ink legs (`kl`), ink head (`k`) and a white eye (`w0`), all rotated -10 degrees about (24, 27).
- **Scrap Shove** (`examples/scrap-shove-logo-art.ts`): a white robot head (`w`) with an ink eye (`k`), a crossed eye and mouth (`kl`), a pop antenna ball and a pop neck (`p`), side bolts (`kl`).

`check-icons-and-logos` fails if these three differ from the Toybox data.

## Designing a logo for a new game

The other games have no logo yet. Draw one with the same recipe, then show it to the owner (a new logo is a design decision):

1. One object that says what the toy is (a wall, a sheep, a robot), seen from the front or slightly tilted, filling about 80 % of the 48 grid; keep 2 units clear at the edges.
2. White bodies with toy-ink edges (`w`), ink details as 2.6 lines (`kl`) or solid ink (`k`), one or two pop accents (`p` or `pl`). No text, no gradients, no more than about eight layers.
3. It sits on the game's accent, so avoid large accent-coloured areas; the pop accent must read against the accent tile.
4. Write it as `apps/<game>/src/art/logo-art.ts` (`export const LOGO_ART: LogoArt = { layers: [...] }`), render the S1 tile and the icons with `render-art.ts`, and look at them at 1024 and 256 px.

## The logo tile per place

A square of size *s*, radius 0.24 *s*, `accent` fill, outline, tilt, the logo at 88 % of the content box (inside the edge). `LogoTile` (`packages/shell/src/ui/logo-tile.tsx`) holds the variants:

| Variant | Size | Edge | Die-cut ring | Tilt | Other |
|---|---|---|---|---|---|
| `home` | 46 | 3, `border` | none | -4 | brand lock |
| `statsHeader` | 36 | 3, `border` | none | -4 | S10 game panel header |
| `about` | 92 | 3, toy ink ("cut") | 5 white | -4 | S11b |
| `lose` | 104 | 3, `border` | 6 white | +17 | 6 pt lower (S7 lose) |
| `splash` | 152 | 4, `border` | 7 white | -6 | S1 |

The tile is a View (ring = `boxShadow` spread, via `dieCutRing`), the art is one Skia `<Canvas>` inside it. It is decorative (`accessibilityElementsHidden`); the screen names the game in text. `drawLogoTile()` in `packages/shell/src/art/draw-logo.ts` draws the same tile imperatively (ring, face, inner edge, art) for scripts and goldens.

Verified: the S1 tiles drawn by `drawLogoTile` at 2x differ from the design's Chrome render in 0.01 % of pixels for Line Siege and Scrap Shove and 0.3 to 0.5 % for Flock Tilt (anti-aliasing on the rotated sheep).

## The rating star

Filled: the star path filled `starOn` plus its 1.8 edge in `border` (2.2 on 13 pt mini stars), round join. Hollow: only the 1.8 edge in `starOff` (`onPrimary` on the current level tile). In code, stack two `Icon`s: `rating-fill` and `rating-edge` (or `rating-edge-mini`). Sizes: 13 on level tiles, 18 in stickers, 22 in the S8 progress line and stat headers, 34 in rating rows (gap 6), 86 / 102 / 86 on the result screen.

## The S10 empty-statistics picture

`viewBox 0 0 190 150`, drawn 190 pt wide, in draw order: the lid `M34 66 48 24 150 36 142 74z` rotated -6 degrees about (90, 50), fill `pop`, `border` edge 2.5; a dashed star (`M95 33l5.5 11.2 ...`), no fill, `text` stroke 3, dash 5 5, round join; the box (rect x 30 y 68 w 130 h 72 r 10) fill `primary`, `border` edge 2.5; the rim line `M30 88h130`, `text` stroke 3.5, round cap and join; the label (rect x 80 y 98 w 30 h 20 r 4) fill white, toy-ink edge 2.5, round join. In code: `emptyStatsOps()` in `picture-ops.ts` and `EmptyStatsPicture` (one canvas, decorative).

## The S15 hazard strip

A 20 pt band under the status bar (test builds only): gold and toy-ink stripes at -45 degrees, 12 pt each, with 3 pt toy-ink rules top and bottom. Drawn once by Skia as parallelograms (`hazardStripeOps()`, `HazardStrip`), never as a gradient. It is the only repeating fill in Toybox.

## How-to-play pictures

S13 pictures are game art, drawn by each game in its own board style inside the Shell's how-to stage (a `surface` frame, 3 pt edge, radius 16, padding 12). Style roles a game may reuse: board `sunken` fill + `border` 3; cell grid `textMuted` at 35 % opacity, stroke 1.5, radius 5; blocks `primary` + `border` 2.5; beams and bursts `pop`; ghost moves `textMuted` stroke 2.5 dashed 4 5; direction arrows `text` stroke 3.5, round. The design's placeholder monster `#7B5CFF` and rock `#9AA3B5` are mock only.

## Canvas budget

Use a Skia `<Canvas>` only for multi-colour art (logos, the empty picture, the hazard strip, how-to pictures) and boards: at most 8 canvases per screen outside the board, never one per list item. Each canvas costs about 0.18 MB and 2.8 ms to mount.
