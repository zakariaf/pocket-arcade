# Toybox contrast: measured values and the palette rules

## Contents

- Measured contrast for the three painted games
- What the numbers mean
- The Toybox palette rules (what scripts and tests enforce)
- The generic WCAG checks Toybox replaces

All values are WCAG 2.2 ratios (relative-luminance formula, sRGB threshold 0.04045), **Derived** from the paints. L = light, D = dark; bold = below the need.

## Measured contrast

| Pair (need) | Line L | Line D | Flock L | Flock D | Scrap L | Scrap D |
|---|---|---|---|---|---|---|
| Body text on ground (4.5) | 10.96 | 14.99 | 11.93 | 13.48 | 12.45 | 14.31 |
| Body text on surface (4.5) | 15.93 | 12.00 | 15.94 | 10.43 | 16.36 | 11.41 |
| Body text on sunken (4.5) | 13.48 | 13.70 | 13.69 | 11.94 | 13.82 | 12.81 |
| Muted text on ground (4.5) | 6.39 | 8.51 | 6.95 | 8.31 | 7.25 | 8.43 |
| Muted text on surface (4.5) | 9.28 | 6.81 | 9.29 | 6.43 | 9.53 | 6.72 |
| Muted text on sunken, disabled (4.5) | 7.85 | 7.78 | 7.98 | 7.36 | 8.05 | 7.55 |
| Text on accent (4.5) | 5.87 | 6.59 | 6.89 | 7.79 | 6.49 | 8.30 |
| Text on pop (4.5) | 11.45 | 11.99 | 9.10 | 8.55 | 7.05 | 7.50 |
| Danger text on surface (4.5) | 5.53 | 5.70 | 5.53 | 4.82 | 5.68 | 5.39 |
| Danger text on ground (4.5) | **3.80** | 7.13 | **4.14** | 6.23 | **4.32** | 6.77 |
| Danger label on dangerFill, hold (4.5; check-contrast checks the pair at 3:1 as an icon pair) | **4.43** | 5.83 | **4.43** | 5.83 | **4.43** | 5.83 |
| Success icon on surface (3) | 4.79 | 8.48 | 4.79 | 7.17 | 4.92 | 8.02 |
| Toast text on toast (4.5) | 15.93 | 14.99 | 15.93 | 14.99 | 15.93 | 14.99 |
| Ad text on ad band (4.5) | 7.09 | 8.16 | 7.09 | 8.16 | 7.09 | 8.16 |
| Sticker ink on gold (4.5) | 10.74 | 10.74 | 10.74 | 10.74 | 10.74 | 10.74 |
| Sticker ink on accent paper (4.5) | 5.87 | 6.57 | 6.89 | 8.88 | 6.49 | 8.72 |
| Sticker ink on pop paper (4.5) | 11.45 | 11.95 | 9.10 | 9.75 | 7.05 | 7.88 |
| White on ink sticker (4.5) | 16.53 | 16.53 | 16.53 | 16.53 | 16.53 | 16.53 |
| Outline vs ground (3) | 10.96 | 12.95 | 11.93 | 11.99 | 12.45 | 12.85 |
| Outline vs surface (3) | 15.93 | 10.37 | 15.94 | 9.28 | 16.36 | 10.24 |
| Outline vs accent fill (3) | 5.87 | **1.97** | 6.89 | **1.54** | 6.49 | **1.55** |
| Outline vs pop fill (3) | 11.45 | **1.08** | 9.10 | **1.40** | 7.05 | **1.71** |
| Accent fill vs ground (3) | **1.87** | 6.59 | **1.73** | 7.79 | **1.92** | 8.30 |
| Pop fill vs ground (3) | **1.04** | 11.99 | **1.31** | 8.55 | **1.77** | 7.50 |
| Surface vs ground (3) | **1.45** | **1.25** | **1.34** | **1.29** | **1.31** | **1.25** |
| Star fill vs surface (3) | **1.48** | 9.19 | **1.48** | 7.77 | **1.52** | 8.69 |
| Star edge vs star fill (3) | 10.74 | **1.13** | 10.74 | **1.19** | 10.74 | **1.18** |
| Off star vs surface (3) | 9.28 | 6.81 | 9.29 | 6.43 | 9.53 | 6.72 |
| Focus ring vs ground (3) | 3.62 | 7.80 | 3.94 | 6.82 | 4.11 | 7.40 |
| Focus ring vs sunken (3) | 4.45 | 7.13 | 4.52 | 6.04 | 4.57 | 6.63 |
| Hard shadow vs ground (3) | 10.96 | **1.21** | 11.93 | **1.33** | 12.45 | **1.26** |

## What the numbers mean

- **All text passes AA where Toybox puts it:** body, muted, on-accent, on-pop, sticker, toast and ad texts are at least 4.8:1 in every game and scheme.
- **Light accent, pop and star fills are weaker than 3:1 against the ground (1.0 to 1.9:1) and the star against the surface (1.5:1).** By design: every such fill carries the 3 pt ink outline (10.9 to 16.4:1), which is the visual boundary WCAG 1.4.11 asks for, and filled vs hollow stars differ in shape.
- **Dark outline vs accent / pop fills is low (1.1 to 2.0:1)**, but there the fills themselves stand 6.6 to 12:1 off the ground.
- **Surface vs ground is 1.25 to 1.45:1 in every paint:** panels, lists and keys are delimited by their ink outline, never by their fill (rule 3).
- **Dark hard shadows are faint (1.2 to 1.3:1)**: depth cues, not boundaries.
- **Danger text on the light ground fails (3.8 to 4.3:1):** Toybox never puts danger text on the ground; it is always on a surface (4.8 to 5.7:1). Rule: danger text only on `surface`.
- **The danger label during hold-to-confirm** sits on `dangerFill` at 4.43:1 in light (just under 4.5 for 17 pt Bold). Open owner decision (see `decisions-and-open-issues.md`); accessibility's `check-contrast.mjs` checks danger on `dangerFill` as an icon pair (3:1, which it passes) and body text on `dangerFill` at 4.5:1; the hold label's 4.43:1 stays an open owner decision that goes into every report, never an `--allow`.
- **Focus** is at least 3.6:1 against every ground and 4.4:1 against the sunken locked tile.

## The Toybox palette rules

`checkToyboxPalette()` (app test helper) and `check-design-system` / `write-palette` (scripts) enforce the same rules on every game palette:

| Rule id | Holds when |
|---|---|
| `palette-hex` | all 16 fields are uppercase `#RRGGBB` |
| `palette-contrast` | text, textMuted on background, surface and sunken at 4.5:1; onPrimary on primary and onPop on pop at 4.5:1; danger on surface at 4.5:1; border on background and surface at 3:1; focus on background and sunken at 3:1; starOff on surface at 3:1 |
| `palette-fill` | primary, pop and starOn each stand 3:1 either off the border (light paints) or off what they sit on (background, surface; dark paints) |
| `palette-one-ink` | in light: text, border, shadow, onPrimary, onPop, icon = `#1D1B3A`; textMuted, starOff = `#43406A` |
| `palette-shell-constant` | danger, focus and starOn equal the Shell constants of the scheme |
| `palette-colorblind` | `colorBlind.light` and `colorBlind.dark` are the same objects as `standard` |
| `palette-mismatch` | a game the token file knows uses exactly its paint |

## The generic checks Toybox replaces

A generic palette check that demands `primary` vs `background` at 3:1, `starOn` vs `surface` at 3:1 and `danger` vs `background` at 4.5:1 fails every light Toybox palette by design, on exactly these three pairs (Line Siege: danger on background 3.80:1, primary on background 1.87:1, starOn on surface 1.48:1). For Toybox check `border` vs `background` and the fill rule above, and `danger` vs `surface`, instead.
