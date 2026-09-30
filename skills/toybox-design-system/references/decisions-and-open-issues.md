# Toybox: chosen values and open owner decisions

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
20. The level-tile number (`levelNumber`) has line height 1.45 in fa and ckb, not 1.0. This is a token-file and design change, decided by the lead on 2026-09-30: at 1.0 iOS clipped the tops of Vazirmatn's digits on every Persian level tile (Chrome let them overflow, so the old references hid it). The tile keeps its 62 pt height and the mini stars sit lower; the references were re-rendered as an intended reference change. `scoreValue` keeps 1.0.
9. The dark `line` colour is shared by all games (`rgba(228,224,255,.16)`).
10. Fixed top bar and pinned banner on long screens; the banner band collapses with the slot.
11. Toast position above the banner (14 pt over the bottom of the body), about 3 s on screen.
12. Hold-to-confirm fills linearly over 2 s (the mockup draws a static 46 %).
13. Confetti falls with the success sticker's slap and is hidden under reduce motion.
14. Focus ring also on iPad keyboard / Switch Control focus.
15. The "Phone language" sticker marks the phone's own language.
16. Game names and the tabular-figures question: Rubik `tnum` is not used.

## States the mockup does not draw

Home and S9 after today's daily is played; Daily and Endless results; Continue for Premium owners; the Premium owners' Settings group; the reset-statistics, newer-save and crash dialogs; S5 on its own; pressed segment, slider and pause key; large-text layouts. The layouts chosen for them belong to the screens; the tokens here apply unchanged.

## Mock-only parts

The S3 consent sheet (Google draws the real form), the 320 x 50 banner placeholder and "Ad" chip, the board placeholder, the how-to-play pictures (each game draws its own).

## Open issues for the owner

1. **Dark ink per game** (Chosen 1). If the owner prefers one dark ink for all games, change the token file and every palette together.
2. **Hold-to-confirm label contrast.** During the 2 s hold, the 17 pt Bold `danger` label sits on `dangerFill` at 4.43:1 in light (needs 4.5). Options: a lighter light `dangerFill` (`#FFDFE2` gives 4.62:1; not in the mockup), or accept it as a transient state. Until the owner decides, keep the mockup value; accessibility's `check-contrast.mjs` checks danger on `dangerFill` as an icon pair (3:1, which it passes) and body text on `dangerFill` at 4.5:1; the hold label's 4.43:1 stays an open owner decision that goes into every report, never an `--allow`.
3. **Generic contrast checks.** A generic palette test that demands primary vs background 3:1, starOn vs surface 3:1 and danger vs background 4.5:1 fails every light Toybox palette by design; use the Toybox rules in `contrast.md` instead.
4. **Copy deck is a draft:** fa and ckb await native review; longer final strings may change wrapping, so re-check S2, the home keys and stickers after the review.
5. **Pixel-parity device size:** the mockup phone is 390 x 844; the baseline simulator is 402 x 874 (the parity renderer widens the design frame).

## Not verified on a device

`boxShadow` and `outline*` rendering and their cost with many tiles, `outline` around rotated or dashed views, the spring feel, and the Toybox fonts in a Release build. Check them in the first simulator build and report what you saw.
