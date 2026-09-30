# Contrast and colour

The contrast maths, the pair set every Toybox palette must meet, the measured Toybox table, the board palettes and their declared pairs, the colour-blind check, and the hold-to-confirm label.

## Contents

- The rules
- The maths
- The Toybox pair set (what the checks enforce)
- Measured Toybox contrast
- Danger colours: icon tiles, text and the hold-to-confirm label
- Board palettes: board-palettes.json and board-contrast.json
- Colour blindness: never colour alone
- The colour-blind check and its calibration
- Focus and Increase Contrast

## The rules

- WCAG 2.2 AA in every palette mode (standard, colour-blind) and scheme (light, dark): **4.5:1 for text** (1.4.3), **3:1 for icons, outlines and control shapes** (1.4.11). Apple uses the same values.
- Never convey meaning by colour alone: every state and every game category also has a shape or symbol.
- Palettes are data (`apps/<game>/src/theme/palette.ts`, from the Toybox tokens); colours in code come only from `theme.colors` and the Shell constants.

## The maths

WCAG 2.2 relative luminance with the sRGB threshold 0.04045: `L = 0.2126 R + 0.7152 G + 0.0722 B` on linearised channels (`c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ^ 2.4`); contrast = `(Lmax + 0.05) / (Lmin + 0.05)`, from 1 to 21. Sanity checks: `#767676` on white = 4.54:1, black on white = 21:1, `#9A9A9A` on white = 2.81:1. Palettes use opaque `#RRGGBB` only (contrast needs opaque colours). The code is `templates/shell-theme/contrast.ts`.

## The Toybox pair set (what the checks enforce)

`palette-checks.ts` (template) and `check-contrast.mjs` check these pairs in all four mode × scheme combinations:

| Pair | Minimum | Why |
|---|---|---|
| `text` on `background`, `surface`, `sunken` | 4.5 | body text wherever it sits |
| `textMuted` on `background`, `surface`, `sunken` | 4.5 | muted and disabled text |
| `onPrimary` on `primary` | 4.5 | text on accent keys |
| `onPop` on `pop` | 4.5 | text on pop keys and tabs |
| `danger` on `surface` | 4.5 | destructive text (only ever on a surface) |
| `icon` on `background`, `surface` | 3 | icons |
| `border` on `background`, `surface` | 3 | the ink outline: the boundary of every control, tile and star |
| `starOff` on `surface` | 3 | hollow stars |
| `focus` on `background`, `sunken` | 3 | the focus ring, including on a locked tile |
| Shell `toastText` on `toastBackground`, `adText` on `adBackground`, `toyInk` on `gold`, `text` on `dangerFill` | 4.5 | Shell text (the S12 error note's body text sits on `dangerFill`) |
| `danger` on Shell `dangerFill` | 3 | the danger icon and its edge on the danger icon tile: an icon pair |
| each fill (`primary` and `pop` on `background`, `starOn` on `surface`) against `border` **or** its ground, whichever is higher | 3 | the filled shape itself must be identifiable: light paints get it from the ink edge (5.9–11.5:1), dark paints from the ground (6.6–12:1) because the chalk edge is close to the fill there |

Shell constants (`shell-colors.ts`), per scheme: toast text on toast (4.5), ad text on the ad band (4.5), sticker ink on gold (4.5), body text on `dangerFill` (4.5), and the danger icon on `dangerFill` (3, an icon pair).

**Why not `primary` on `background` or `starOn` on `surface`:** Toybox fills (accent, pop, star) are deliberately close to the light ground (1.0–1.9:1), but every such fill carries the 3 pt ink outline (10.9–16.4:1 against ground and surface), which is the visual boundary WCAG 1.4.11 asks for, and filled vs hollow stars differ in shape. An older pair set (`primary`/`background` ≥ 3, `starOn`/`surface` ≥ 3, `danger`/`background` ≥ 4.5) fails every light Toybox palette by design; this set replaces it. `danger` text never sits on the ground (3.8–4.3:1 in light), only on a surface (4.8–5.7:1).

## Measured Toybox contrast

WCAG 2.2 ratios of the design's own colours (L = light, D = dark; bold = below the need). Line = Line Siege, Flock = Flock Tilt, Scrap = Scrap Shove.

| Pair (need) | Line L | Line D | Flock L | Flock D | Scrap L | Scrap D |
|---|---|---|---|---|---|---|
| Body text on ground (4.5) | 10.96 | 14.99 | 11.93 | 13.48 | 12.45 | 14.31 |
| Body text on surface (4.5) | 15.93 | 12.00 | 15.94 | 10.43 | 16.36 | 11.41 |
| Body text on sunken (4.5) | 13.48 | 13.70 | 13.69 | 11.94 | 13.82 | 12.81 |
| Muted text on ground (4.5) | 6.39 | 8.51 | 6.95 | 8.31 | 7.25 | 8.43 |
| Muted text on surface (4.5) | 9.28 | 6.81 | 9.29 | 6.43 | 9.53 | 6.72 |
| Muted text on sunken (4.5) | 7.85 | 7.78 | 7.98 | 7.36 | 8.05 | 7.55 |
| Text on accent (4.5) | 5.87 | 6.59 | 6.89 | 7.79 | 6.49 | 8.30 |
| Text on pop (4.5) | 11.45 | 11.99 | 9.10 | 8.55 | 7.05 | 7.50 |
| Danger text on surface (4.5) | 5.53 | 5.70 | 5.53 | 4.82 | 5.68 | 5.39 |
| Danger text on ground (4.5) | **3.80** | 7.13 | **4.14** | 6.23 | **4.32** | 6.77 |
| Danger icon on dangerFill (3) | 4.43 | 5.83 | 4.43 | 5.83 | 4.43 | 5.83 |
| Toast text on toast (4.5) | 15.93 | 14.99 | 15.93 | 14.99 | 15.93 | 14.99 |
| Ad text on ad band (4.5) | 7.09 | 8.16 | 7.09 | 8.16 | 7.09 | 8.16 |
| Sticker ink on gold (4.5) | 10.74 | 10.74 | 10.74 | 10.74 | 10.74 | 10.74 |
| Outline vs ground (3) | 10.96 | 12.95 | 11.93 | 11.99 | 12.45 | 12.85 |
| Outline vs surface (3) | 15.93 | 10.37 | 15.94 | 9.28 | 16.36 | 10.24 |
| Outline vs accent fill (3) | 5.87 | **1.97** | 6.89 | **1.54** | 6.49 | **1.55** |
| Accent fill vs ground (3) | **1.87** | 6.59 | **1.73** | 7.79 | **1.92** | 8.30 |
| Pop fill vs ground (3) | **1.04** | 11.99 | **1.31** | 8.55 | **1.77** | 7.50 |
| Surface vs ground (3) | **1.45** | **1.25** | **1.34** | **1.29** | **1.31** | **1.25** |
| Star fill vs surface (3) | **1.48** | 9.19 | **1.48** | 7.77 | **1.52** | 8.69 |
| Off star vs surface (3) | 9.28 | 6.81 | 9.29 | 6.43 | 9.53 | 6.72 |
| Focus ring vs ground (3) | 3.62 | 7.80 | 3.94 | 6.82 | 4.11 | 7.40 |
| Focus ring vs sunken (3) | 4.45 | 7.13 | 4.52 | 6.04 | 4.57 | 6.63 |

What the numbers mean: all text passes where Toybox puts it; light fills are weak against the ground but always outlined; in dark the fills themselves stand 6.6–12:1 off the ground, so the shape is clear even where the chalk outline is close to the fill; panels are delimited by their outline, never by their fill; dark hard shadows (1.2–1.3:1) are depth cues, not boundaries.

## Danger colours: icon tiles, text and the hold-to-confirm label

- **`danger` on `dangerFill` is an icon pair (3:1).** `dangerFill` is the tint behind destructive icons (the danger row's icon tile, the reset dialog's art tile) and the S12 error note; what sits on it in `danger` is an icon and an edge, never resting text. Light measures 4.43:1, dark 5.83:1: both pass. `check-contrast.mjs` checks it under `shell-contrast` at 3:1, and the parity references use exactly these colours, so the design is not changed and no `--allow` is needed.
- **Danger text sits only on `surface`** and must reach 4.5:1 there (`text-contrast`, `danger` on `surface`); a danger text pair at 4.43:1 fails. The error note's body text is `text` on `dangerFill` (4.5:1, `shell-contrast`).
- **The hold-to-confirm label** (S14 "Reset all progress") is the one place where danger text crosses `dangerFill`: while the finger is down, the fill grows under the resting label for 2 s, and the label meets 4.43:1 in light on the part already filled. Its resting state (danger on surface) passes 4.5:1, so this is a transient state of a control, not a resting text pair. It stays listed as an open owner decision in `toybox-design-system` (a lighter light `dangerFill`, `#FFDFE2`, would give 4.62:1 but is not in the mockup). Mention it once in the report of a release candidate; do not change the design colour on your own and do not pass `--allow` for it.

## Board palettes: board-palettes.json and board-contrast.json

Each game's board has its own palette file, `apps/<game-id>/src/board/board-palettes.json`, with four sets of identical tokens: `light`, `dark`, `colorBlindLight`, `colorBlindDark` (values `#RRGGBB`, or `#RRGGBBAA` for translucent tokens such as a ghost). A board palette says nothing about which colour sits on which, so the board declares that beside it in `board-contrast.json`:

```json
{
  "edge": "wall",
  "text": [["number", "normal"], ["number", "armoured"], ["number", "fast"]],
  "graphics": [["wall", "background"], ["wall", "lane"], ["heart", "wall"]],
  "shapes": [["block", "cell"], ["ghost", "cell"], ["beam", "lane"], ["tray", "background"], ["block", "tray"], ["normal", "lane"], ["armoured", "lane"], ["fast", "lane"]],
  "distinct": [["normal", "armoured", "fast", "block"]]
}
```

(That is Line Siege's; the board template's names `lit`, `cell`, `edge`, `mark`, `label` and `hint`.)

`check-contrast.mjs` detects the board shape (for every `apps/*/src/board/board-palettes.json`, or one passed with `--palette`) and checks, in all four sets:

| Key | Rule | Minimum |
|---|---|---|
| `text` | `[fg, bg]` text (digits, labels) | 4.5:1 (`text-contrast`) |
| `graphics` | `[fg, bg]` icons, marks, rings, hearts | 3:1 (`non-text-contrast`) |
| `shapes` | `[fill, ground]` filled shapes that `draw()` edges with the `edge` token: the Toybox rule, the shape stands 3:1 off its ink edge or off its ground | 3:1 (`board-contrast`) |
| `distinct` | token lists that must stay apart, in `colorBlindLight` and `colorBlindDark` only | 0.07 OKLab under protan, deutan, tritan (`cvd-separation`) |

Translucent colours are composited over their ground first (and a translucent ground over `background`). A missing `board-contrast.json`, or one that names a token the palette lacks, fails `board-pairs`. The game's palette test (`templates/root-test/palette-a11y.test.ts`) reads the same `distinct` lists and checks them with `checkCategoricalColors`, so the colour-blind separation of pieces and kinds is also a Jest test.

## Colour blindness: never colour alone

- Toybox gives every state a shape cue: check or dash in toggles and pause keys, a check in the chosen segment and option, dashed edge plus padlock on locked tiles and packs, filled vs hollow stars, dashed edge on disabled buttons, check / cross / play marks in the week strip. So the **Shell's colour-blind palette equals the standard one** (the `Palette` type still requires both modes; the app writes the same objects).
- The colour-blind switch keeps its full effect on the **boards**: each game's `board-palettes.json` has `light`, `dark`, `colorBlindLight` and `colorBlindDark` sets, the colour-blind sets from a CVD-safe hue family (Okabe–Ito), and `draw()` shows meaning by shape or symbol as well (Line Siege: normal monsters are pills, armoured ones squarer with a thick ink ring, fast ones carry a chevron).

## The colour-blind check and its calibration

Machado–Oliveira–Fernandes (2009) matrices at severity 1.0 on linear sRGB, distance in OKLab (Ottosson), where one just-noticeable difference is about 0.02. The piece colours must stay at least **0.07** apart (3.5 JND) under protanopia, deuteranopia and tritanopia. Code: `templates/shell-theme/cvd.ts`, `checkCategoricalColors()`. The piece colours are the `distinct` lists of the board's `board-contrast.json`, read from its colour-blind sets (Line Siege's normal `#CC79A7`, armoured `#56B4E9`, fast `#E69F00` and block `#0072B2` stay 0.085 apart or more).

| Set (smallest pairwise distance) | Normal | Protanopia | Deuteranopia | Tritanopia | At 0.07 |
|---|---|---|---|---|---|
| Okabe–Ito, 8 colours | 0.156 | 0.096 | 0.076 | 0.085 | pass |
| Okabe–Ito, 5 colours | 0.156 | 0.114 | 0.110 | 0.086 | pass |
| Red / green / blue / orange | 0.186 | **0.007** | **0.039** | 0.068 | fail |
| Tableau subset (6) | 0.139 | 0.038 | **0.007** | 0.089 | fail |

## Focus and Increase Contrast

- The focus ring is `focus` (`#C8157A` light / `#FF8AD8` dark, the same in every game): 3 pt solid, 2 pt outside the control's border. It shows on the locked level tile the player just tapped (with its "unlock by finishing level n" toast) and on keyboard or Switch Control focus on iPad.
- Palettes meet AA by default, so no separate high-contrast palette is required (Apple: provide one only if the default does not meet the minimum).
