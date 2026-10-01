# Toybox: chosen values and open owner questions

## Contents

- Chosen values (picked where the mockup was silent or inconsistent)
- States the mockup does not draw
- Mock-only parts (never built)
- Open issues for the owner
- Not verified on a device

## Chosen values

Each is marked **Chosen** where it appears in the other references.

1. Dark ink family per game: the palette data tints dark `ink`, `inkSoft`, `outline`, `shadow`, `onAccent` and `onPop` per game (and the light surface and sunken too), although the design plan said games swap only ground, accent and pop.
2. Sticker and chip radius 8 (the token card says 6; everything is drawn at 8).
3. Elevations 2 (toggle knob) and 4 (icon button), taken from the component CSS.
4. `body` line height 1.32 (CSS) rather than the note's 1.3; `label` 1.25 / 1.45; `number` 1.1 in both scripts; in code every line height is snapped to the device pixel grid (`snapToPixels`: 22.44 -> 67/3 at 3x), never rounded to whole points and never left fractional (type-and-fonts.md, "Line heights on the pixel grid").
5. Release spring `mass: 1` (Reanimated defaults to 4).
6. `LilitaOne.ttf` renamed from `LilitaOne-Regular.ttf` so file name = PostScript name; licence files `<Family>-OFL.txt`.
7. Colour-blind palette = standard palette (shapes carry meaning).
8. Physical sticker padding (9 left / 11 right in both directions, as the mockup's `padding: 5px 11px 5px 9px`, so in RTL the larger pad sits next to the icon) and unmirrored sticker tilt in RTL.
17. Border widths as rendered: `STROKE.tile` 2 (token 2.5), because Chrome floors a CSS border of 1 px or more to whole px and the references are Chrome renders; icon strokes, rings and Skia strokes keep their token values (layout-shape-tokens.md, "Strokes").
18. `rowLabelStrong` (17 Bold, 1.32 / 1.5), a text style the mockup draws for strong and danger rows but the token file lacks; `check-design-system` expects it as a documented override.
19. A key that stays pushed in moves by layout (`top: elevation`), not by a transform, so VoiceOver, Maestro and the parity bounds see where it is drawn.
20. The level-tile number (`levelNumber`) has line height 1.45 in fa and ckb, not 1.0. This is a token-file and design change, decided by the lead on 2026-09-30: at 1.0 iOS clipped the tops of Vazirmatn's digits on every Persian level tile (Chrome let them overflow, so the old references hid it). The tile keeps its 62 pt height and the mini stars sit lower; the references were re-rendered as an intended reference change.
21. The score value (`scoreValue`, 44 pt) has line height 1.45 in fa and ckb as well (lead decision L9, 2026-09-30; token file `typeRoles.scoreValue.arabicLineHeight` 1 -> 1.45 and the mockup rule `.ar .sc-v{line-height:1.45}`): at 1.0 the Persian score on S7, the endless and the daily results lost the tops of its digits, like the level number did. 44 pt in Latin, 191/3 pt at 3x in fa and ckb; the references were re-rendered as an intended reference change. `check-design-system` rule `persian-number-clip` keeps both numbers at 1.45 or more.
22. The light `dangerFill` is `#FFDCDF` (owner decision O5, 2026-09-30; it was `#FFD9DD`). It keeps `#FFD9DD`'s hue and saturation and takes the first 8-bit lightness at which `danger` `#C4243A` reaches 4.5:1: danger on it 4.52:1, text `#1D1B3A` 13.03:1, muted text `#43406A` 7.6:1. The dark `#4A1F3A` is unchanged (danger `#FF8593` 5.83:1, text 12.27:1). So the S14 hold label ("Hold to reset", 17 pt Bold `danger`) reads at 4.5:1 or more in every fill state, and accessibility's `check-contrast` checks danger on `dangerFill` as a 4.5 text pair in both schemes, with no exception.
23. Arabic-script text is placed as Chrome places it: `AppText`'s overflow guard pads a Vazirmatn line by half its overflow inside a wrapper that keeps the line box (type-and-fonts.md, "Persian overflow on iOS"). It is derived from the font's own metrics, not measured per size, so it is not a glyph nudge.
24. Display text wraps balanced (the mockup's `.d`: `text-wrap: balance`) through `useBalancedWrap`; body text wraps greedily.
25. `statListHeading` (15 Bold, 1.32 / 1.5), the stat list's heading row (`.slist>div:first-child`), is a second mockup override beside `rowLabelStrong`.
26. The nudge text style has no underline: `QuietButton` draws the design's 2 pt line 5 pt under the text (`.quiet`: `text-decoration-thickness: 2px`, `text-underline-offset: 5px`), because iOS's own underline is 1 pt thick at its own depth.
9. The dark `line` colour is shared by all games (`rgba(228,224,255,.16)`).
10. Fixed top bar and pinned banner on long screens; the banner band collapses with the slot.
11. Toast position above the banner (14 pt over the bottom of the body), about 3 s on screen.
12. Hold-to-confirm fills linearly over 2 s (the mockup draws a static 46 %).
13. Confetti falls with the success sticker's slap. The saved Reduce motion setting hides it; when motion only holds still (a parity capture) it draws its pieces at rest. It scatters from the left in every language (never mirrored).
14. Focus ring also on iPad keyboard / Switch Control focus.
15. The "Phone language" sticker marks the phone's own language.
16. Tabular figures only for stat values (the `number` role and `statValueCompact`, the design's `.sv`: `font-variant-numeric: tabular-nums`); Lilita One has none, Vazirmatn's make Persian stat values as wide as the design's. Rubik `tnum` is not used.

## States the mockup does not draw

Home and S9 after today's daily is played; Daily and Endless results; Continue for Premium owners; the Premium owners' Settings group; the reset-statistics, newer-save and crash dialogs; S5 on its own; pressed segment, slider and pause key; large-text layouts. The layouts chosen for them belong to the screens; the tokens here apply unchanged.

## Mock-only parts

The S3 consent sheet (Google draws the real form), the 320 x 50 banner placeholder and "Ad" chip, the board placeholder, the how-to-play pictures (each game draws its own).

## Open issues for the owner

1. **Dark ink per game** (Chosen 1). If the owner prefers one dark ink for all games, change the token file and every palette together.
2. **Generic contrast checks.** A generic palette test that demands primary vs background 3:1, starOn vs surface 3:1 and danger vs background 4.5:1 fails every light Toybox palette by design; use the Toybox rules in `contrast.md` instead.
3. **Copy deck is a draft:** fa and ckb await the owner's own native review (owner step O6: listed in every report under "Owner steps (not blocking)", never waited for); longer final strings may change wrapping, so re-check S2, the home keys and stickers after the review.
4. **Pixel-parity device size:** the mockup phone is 390 x 844; the baseline simulator is 402 x 874 (the parity renderer widens the design frame).

## Not verified on a device

`boxShadow` and `outline*` rendering and their cost with many tiles, `outline` around rotated or dashed views, the spring feel, and the Toybox fonts in a Release build. Check them in the first simulator build and report what you saw.
