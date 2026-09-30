# Decisions and open issues (components)

Values the mockup does not fix, states it does not draw, and open questions an owner may still decide. Say which of these a change touches when reporting, and ask before changing a Chosen value.

## Chosen values (built into the templates)

| Where | Chosen | Why |
|---|---|---|
| Sticker and chip radius | 8 | the token card says 6; the CSS draws 8 |
| Elevations 2 (knob) and 4 (icon button) | from the CSS | the elevation card lists only 0 / 3 / 5 / 6 / 8 |
| Release spring | `mass: 1` | Reanimated 4.5.1 defaults mass to 4 (twice as slow, much bouncier) |
| Sticker padding | physical: left 9, right 11 in both directions (the logical pads swap in RTL) | the CSS pads `5px 11px 5px 9px`, so in fa the larger pad stays on the right, next to the icon |
| Edge widths | as rendered: 2 for the token file's 2.5, 1 for 1.5 (`asRenderedBorder`) | the references are Chrome renders; Chrome floors CSS borders to whole px, and parity measures 2.0 pt |
| Group tab | flush with the list start, on the list's top edge (`marginStart` 0, `overlap` 0) | the references draw it at x = 20 with the list edge unbroken |
| Segmented control inner gaps | `faceGap` 1, `labelColumnGap` 3 | `.seg>span { gap: 1px }`, `.sg-l { gap: 0 3px }` in the mockup CSS; not in the token file |
| Strong and danger row labels | `rowLabelStrong` (17 Bold, 1.32 / 1.5) through `isStrong` / `isDanger` | the design's strong row; the `label` role's 1.25 was 1.2 pt short per line |
| Pushed-in keys | moved by layout (`top: elevation`) | Maestro and VoiceOver ignore transforms; the design measures the sunk key |
| Sticker tilt | not mirrored in RTL | the mockup keeps the same angle in both directions |
| Banner band | collapses with the slot (zero height until an ad loads) | an empty band would be a grey hole |
| Banner position | Home and Statistics: pinned under the body; Levels: the last item of the body column (`marginTop: 'auto'`, the wrapper cancels the 20 pt gutters) | the design's S8 `.body` closes with the banner; the long Statistics capture shows it pinned at the end |
| Toast | above the banner, 14 pt over the body's bottom; about 3 s (S8's locked-tile toast: absolute, 352 pt below the body's top, as the design draws it) | parity compares the S8 toast with the design, so S8 follows it |
| Hold-to-confirm | 2 s linear fill from the start edge, 150 ms empty on release; `frozenProgress` holds a static fill for the parity capture only | the mockup draws a static 46 % fill |
| Confetti | falls with the success sticker's slap; nothing under reduce motion | the mockup is static |
| Focus ring | on the tapped locked tile and on iPad keyboard focus | the mockup draws only the tile |
| "Phone language" sticker | marks the phone's own language | the mockup draws it on the selected option because that is the default |
| Slider step for VoiceOver | 10 % | not in the design |
| Dialog overlay | padding 28 × 20 around the card, card = body width | from the S14 frames |
| Stat grid short row | empty cells keep the column widths | three stats in two columns |
| Keys in pair cells | `layoutStyle` `{ flexGrow: 1 }` (Home keys, Pause toggle keys), never `flex: 1` | a zero basis collapsed the Pause toggle row to 0 pt on the device |
| Locked pack edge | the panel's ink edge, dashed, on `sunken` | the design draws `3px dashed` ink; a `textMuted` edge failed S8 |
| Persian level numbers | line height 1.45 in fa and ckb (1 in en and de); the tile stays 62 tall, the stars sit lower | at 1.0 iOS clips Vazirmatn's digits; the token file and design changed to 1.45 on 2026-09-30 (lead-approved, an intended reference change) |
| Score-rated win line | `ScorePanel` `line.kind` `'score'`: "Score 1,840 – best 1,840" (`.score-line`); moves-rated games keep `'moves'` (`.moves-line`) | par is never shown for a score-rated level (Line Siege); decided 2026-09-30 with a design-derived S7 variant |

## States the mockup does not draw

Built as described, but no design capture proves them: pressed segment, slider dragging and pressed pause key (all as a level tile: sink 3); Daily and Endless results; Continue for Premium owners; Premium owners' Settings group; the reset-statistics, newer-save and crash dialogs; large-text layouts (rows wrap, dialog rows wrap, key grids stack).

## Open issues

1. **Hold-to-confirm label contrast.** During the hold, the 17 pt Bold `danger` label sits on `dangerFill` at 4.43:1 in light (needs 4.5). Options for the owner: a lighter light `dangerFill` (`#FFDFE2` gives 4.62:1; not in the mockup), or accept it as a transient state. The template keeps the design's `dangerFill`; accessibility's `check-contrast.mjs` checks danger on `dangerFill` as an icon pair (3:1, which it passes) and body text on `dangerFill` at 4.5:1; the hold label's 4.43:1 stays an open owner decision that goes into every report, never an `--allow`.
2. **Unverified on device:** `boxShadow` crispness and cost with many tiles, `outline` (the focus ring) around rotated or dashed views, and the spring feel. Check in the first simulator build; the fallback for a shadow is a shadow View inside `RaisedSurface`.
3. **Copy is a draft.** Persian and Sorani await native review; longer final strings may change wrapping, so re-check option cards, Home keys and stickers after the review.
4. **Screen gutters.** The top bar pads 16 and the body 20; a screen frame that pads its column by 16 would double the gutter. The banner band itself has no negative margin (a -20 margin inside the band made it 40 pt too wide): on Home and Statistics the slot is pinned outside the body's gutters, and on Levels the screen's wrapper around the slot cancels them once.
