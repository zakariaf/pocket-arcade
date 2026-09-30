# Toybox: concept, principles and the 16 rules

## Contents

- The concept
- The four principles
- What Toybox avoids
- The 16 rules (with why and how each is checked)
- Units and conventions
- Scope: what Toybox draws and what it does not

## The concept

Every Pocket Arcade game is a small toy: a wall of blocks under siege, a tilting field of sheep, a junkyard of clumsy robots. Toybox dresses the Shell (every screen except the game board) like the **shop shelf those toys sit on**: chunky plastic keys with one thick ink outline, hard shadows that a finger pushes the key into, and die-cut stickers for anything worth celebrating. Each game only repaints the shelf, so all 26 apps feel like one family.

In one line: a toy-shop shelf, chunky plastic keys, die-cut stickers, boxed toys, one ink.

## The four principles

1. **Raised means you can press it.** Buttons, tiles and keys cast a hard 3 to 6 pt shadow and sink into it when pressed. Panels that only hold information lie flat (outline, no shadow).
2. **One ink, many paints.** Outline, text and shadow are one ink. A game swaps its paints (ground, surface, sunken, accent, pop, and in dark its tinted ink family); shapes, sizes and stickers never change.
3. **Stickers carry news.** Streaks, new bests, Premium, locks and test builds arrive as tilted stickers with a white die-cut ring. Everything else sits square.
4. **Shape before colour.** Stars are filled or hollow, locked tiles are dashed with a padlock, toggles show a check or a dash, the chosen segment is pushed in and carries a check. Colour only confirms.

## What Toybox avoids

- Soft blurred drop shadows, glass and backdrop blur.
- Gradient fills on buttons or cards: every paint is flat.
- Pill buttons: the biggest control radius is 14 pt.
- Fills without an ink edge, which melt into the ground.
- White or cream screen grounds: the ground is always a painted wash.
- Emoji and clip-art: icons are one 24-unit path each.
- Centred screens: text starts at the start edge; only the splash, the result stars and the result title are centred.
- Tilted body text: only stickers, flags, art tiles and logos rotate, never more than 8 degrees (logos up to 17 degrees on the lose screen).

## The 16 rules

Each rule says why it exists and how it is checked. `check-design-system` rule ids are in brackets; "components" means the `toybox-components` skill checks it.

1. **Give every pressable control a hard shadow, and nothing else.** Buttons, keys, icon buttons, option cards, segments, level tiles and toggle knobs have a shadow offset straight down by their elevation (3, 4, 5, 6 pt; the knob 2 pt, dialogs 8 pt), with no blur and no spread, in `shadow`. Panels, lists, rows, chips, toasts and stickers have none.
   *Why:* "raised = pressable" is the system's affordance. *Check:* no `shadowRadius`, `shadowOpacity`, `shadowOffset`, `shadowColor` anywhere and no `elevation` style key [`no-blur-shadow`]; hard shadows only through `RaisedSurface` and `hardShadow()`.
2. **Press = sink.** On press, a raised control moves down by its elevation and its shadow shrinks to 0; buttons also squash to scale (1.03, 0.94) in 70 ms ease-out, then spring back with overshoot (320 ms). Pushed-in states (selected segment, chosen option, "on" pause key, disabled, busy) sit at the pressed offset without a shadow, moved there by layout (`top`), because VoiceOver and Maestro ignore transforms.
   *Why:* the key must feel like plastic. *Check:* `RaisedSurface` is the only press implementation (components); a pushed-in key has `top: elevation` [`sunk-by-layout`].
3. **Edge every fill with ink.** Controls and panels: 3 pt outline in `border`; tiles, segments, stickers, chips, icon tiles, the slider track and bars: 2 pt as rendered (2.5 in the token file; Chrome floors CSS borders to whole px, and the references are Chrome renders); separators: 2 pt `line`. Dashed 2 to 3 pt means locked, disabled or a placeholder.
   *Why:* the light accent and pop fills are only 1.0 to 1.9:1 against the ground; the outline (at least 10.9:1) is what makes the shape visible. *Check:* `palette-fill` proves each fill has a 3:1 edge or ground.
4. **Keep radii blocky.** 14 pt for buttons, panels, lists and option cards; 10 for tiles, segments and toggles; 22 for dialogs and the Premium art; 26 for the top of sheets. Never a pill, never a circle for a control.
   *Why:* blocky corners are the toy-key look. *Check:* [`no-pill`] flags a radius above 26, `999`/`9999`, `'50%'` and `x / 2`.
5. **Paint flat.** No gradients, no transparency except the scrim and the separator line, no blur. The only repeating fill is the S15 hazard strip.
   *Check:* [`no-gradient`].
6. **Games repaint paint, never shape.** A game supplies only its palette. Sizes, radii, strokes, type, stickers, gold, the cut ring, the semantic colours and the ad neutrals are Shell constants.
   *Check:* [`scale-mismatch`, `type-scale-mismatch`, `type-style-mismatch`, `shell-colors-mismatch`, `palette-mismatch`].
7. **Accent means "go".** Accent fills: the hero key (Play, Next, Resume, Try again, Buy), primary buttons, the current level tile, toggles that are on, the chosen segment and option, progress fills, done marks, chart bars, the pager dot, the calendar month band, the "on" pause keys. Pop fills: icon tiles, group tabs, the Premium key, the Continue-with-ad button, the home tagline sticker. Gold: stars, stickers, flags, Premium art.
8. **Destructive never looks like accent.** Danger buttons keep the surface fill and turn their text, icon and outline `danger`; danger rows turn the label `danger` bold and the icon tile `dangerFill` with a `danger` edge.
9. **Stickers carry news, and only stickers tilt.** Tilt between 2 and 8 degrees either way (default -4). Every sticker has a toy-ink edge (2.5 in the token file, 2 as rendered) and a 3.5 pt white die-cut ring. Body text never rotates. *Check:* components (rotation only in the allowed files).
10. **Shape before colour.** Every state has a non-colour cue: check or dash in toggles and pause keys, a check in the chosen segment and option, dashed edge plus padlock on locked tiles and packs, filled vs hollow stars, dashed edge on disabled buttons, check / cross / play marks in the week strip.
    *Why:* it lets the colour-blind palette equal the standard one [`palette-colorblind`].
11. **Start-align.** Screens read from the start edge. Only S1's content, the S7 chip, stars, title, sub-sticker and lose picture, the Pause "Home" link, the quiet nudges under a hero key, and the S3 Google sheet placeholder are centred.
12. **Use the type roles and component styles, never raw sizes.** Lilita One for display roles, never with a `fontWeight`; Rubik 400/700 for text; Vazirmatn in fa/ckb at the same sizes; game names always in Lilita One, isolated LTR.
    *Check:* [`no-raw-font-size`, `no-font-weight`, `no-letter-spacing`, `font-family`].
13. **One hero key per screen.** The 80 pt key appears at most once; everything else uses 54 pt buttons, rows or keys.
14. **Keep every target at least 44 x 44 pt.** Keys 48 to 94 pt tall, level tiles about 51 x 62 pt, toggle rows 60 pt (the whole row is the target), quiet buttons 44 pt.
15. **Banner only on Home, Levels and Statistics.** Never on Pause, Result, dialogs or Premium; gone for Premium owners.
16. **Respect reduce motion.** Every animation has its listed alternative (`motion.md`); the hold-to-confirm timer is functional and keeps its 2 s.

Colours in code come only from `theme.colors` and `SHELL_COLORS` [`no-color-literal`].

## Units and conventions

- 1 pt = 1 CSS px of the mockup's 390 x 844 pt phone at 1x. Line heights are ratios x font size. Angles in degrees; negative = counter-clockwise.
- "Start" and "end" follow the reading direction (left/right in LTR, mirrored in RTL).
- **Chosen** marks a value the mockup left open or contradicted, picked on purpose; **Derived** marks a computed value (contrast ratios, `#RRGGBBAA` twins); **Mock only** marks a placeholder that is never built. They are collected in `decisions-and-open-issues.md`.
- Colour roles keep the mockup's paint names (`ground`, `ink`, `inkSoft`, `accent`, `pop`...) next to the `ColorTokens` field they fill.

## Scope

Toybox covers S1 to S4 and S6 to S15, and the Shell parts of S5 (game top bar, pause entry). The board itself, its pieces and the how-to-play pictures are drawn by each game with its own board palette; Toybox only frames them. Screen texts are copy-deck keys.
