# Keys and inputs

Anatomy, measurements (pt, exactly as `COMPONENT_SPECS` holds them: the as-rendered specs, see "Edge widths as rendered" below), states, accessibility and testIDs for everything the player presses or sets. Colour names are theme roles: `accent` = `theme.colors.primary`, `onAccent` = `onPrimary`, `ink` = `text`/`icon`, `inkSoft` = `textMuted`, `outline` = `border`; `gold`, `dangerFill`, `toyInk`, `cut`, `line` come from `SHELL_COLORS[theme.scheme]`.

## Contents

1. [Press model shared by every raised key](#press-model-shared-by-every-raised-key)
2. [Button (4.1) and quiet button](#button-41-and-quiet-button)
3. [Hero key (4.2)](#hero-key-42)
4. [Row button (4.3)](#row-button-43)
5. [Home keys (4.4)](#home-keys-44)
6. [Icon button (4.5)](#icon-button-45)
7. [Busy blocks and splash loader (4.24)](#busy-blocks-and-splash-loader-424)
8. [Pause toggle key (4.25)](#pause-toggle-key-425)
9. [Toggle (4.6)](#toggle-46)
10. [Segmented control (4.7)](#segmented-control-47)
11. [Slider (4.8)](#slider-48)
12. [Progress bar (4.9)](#progress-bar-49)
13. [Option card and radio mark (4.10)](#option-card-and-radio-mark-410)

## Press model shared by every raised key

Every raised key composes `RaisedSurface` (it lives in `ui/raised-surface.tsx`, shipped with the theme). The face sits on a hard shadow offset straight down by its elevation (blur 0, spread 0, colour `shadow`); pressing sinks the face into the shadow.

| Elevation | pt | Used by |
|---|---|---|
| flat | 0 | panels, lists, rows, chips, toasts, stickers, quiet buttons |
| knob | 2 | toggle knob |
| tile | 3 | level tiles, segments, slider thumb, pause toggle keys |
| iconButton | 4 | icon buttons (48 and 44) |
| control | 5 | buttons, row buttons, home keys, option cards |
| hero | 6 | the hero key |
| dialog | 8 | dialogs (static, not pressable) |

| Control | Pressed | Reduce motion |
|---|---|---|
| Buttons, hero key, row buttons, keys | translateY(e) scale(1.03, 0.94), shadow 0 | translateY only |
| Icon button | translateY(4) scale(1.05, 0.93) | translateY only |
| Level tile | translateY(3) scale(1.04, 0.94) | translateY only |
| Quiet button | scale(0.97), `sunken` background | no scale |
| Selected segment, option card, "on" pause key | pushed in: moved down e by layout (`top: e`), no shadow, static | same |
| Disabled button | pushed in (by layout), `sunken` fill, `inkSoft` text, dashed `inkSoft` edge | same |
| Busy button | pushed in (by layout), label kept, three hopping blocks | static blocks |

**Pushed in means moved by layout.** A key that stays down (`isPushedIn`, `isDisabled`, `isBusy`) gets `top: elevation` on its Pressable; the `translateY` transform is only the transient press. VoiceOver and Maestro report layout frames and ignore transforms, and the design measures the sunk position (the chosen "Automatic" segment sits 3 pt below its neighbours), so a transform-sunk key failed the parity bounds by 3 pt.

**Edge widths as rendered.** The token file gives tiles, segments, the toggle knob and key, the slider track and the progress bar a 2.5 pt edge, but the committed design references are Chrome renders, and Chrome floors a CSS border of 1 px or more to whole px: every reference draws 2 (every `.layout.json` style says `2px solid`, the parity gates measure 2.0 pt). `write-component-specs.mjs` therefore writes each CSS border as rendered, `asRenderedBorder(w) = w >= 1 ? floor(w) : w`, and the measurements below say "2 (token 2.5)". Rings (box-shadow), icon and Skia strokes keep their token values. Never type 2.5 into a component; the token file itself is never edited.

Timing: press in 70 ms ease-out; release springs back with `RELEASE_SPRING` (damping 12, stiffness 420, **mass 1**; Reanimated 4.5.1 defaults mass to 4); fill colour change 120 ms. `RaisedSurface` does all of this; a component only passes `elevation`, `radius`, `fill`, `edgeColor`, `isPushedIn`, `isDisabled`, `isBusy` and its face style.

**Never `flex: 1` inside a pair-layout cell.** The screens put the Home keys and the Pause toggle keys each in a `usePairLayout` cell: a column View that shares the row. There `flex: 1` (React Native's shorthand for grow 1, shrink 1, basis 0) is a zero basis on the cell's vertical axis: on the device the Pause row measured 0 pt and the Sound and Vibration keys spilled over the Home button below. Unit tests cannot see it (Jest has no layout engine). The key's `layoutStyle` is `{ flexGrow: 1 }`: it keeps its content height and grows to the row's tallest key. `check-components` fails `pair-cell-flex` for a `KeyButton` or `ToggleKey` whose layout style has `flex: 1` or `flexBasis: 0`, and each key's test pins `flexGrow: 1`, basis auto and no `flex`. (`flex: 1` along a row's own axis, as the segments of a segmented control use it, is fine: that axis has a definite width.)

Sound: every press runs the Shell's tap feedback first. `RaisedSurface`, `QuietButton` and `ListRow` call `const onPressFeedback = usePressFeedback();` (from `@e07/shell/app/press-feedback-context.tsx`, provided once by ShellApp with `playUiFeedback(services, 'tap')`) and run it in their press handler before the component's `onPress`. A switch (`accessibilityRole="switch"`: `ToggleKey`, a toggle `ListRow`) skips it: its handler plays the toggle feedback (sound plus the selection pulse) after dispatching. Outside the provider the hook is a no-op, so component tests need no audio fake; a test that wants to see it wraps the render in `<PressFeedbackProvider onPress={...}>`.

## Button (4.1) and quiet button

**Template:** `button.tsx` (`Button`, kinds primary, secondary, pop, danger, quiet; sizes regular and hero), `quiet-button.tsx` (`QuietButton`), paint table in `button-paint.ts` (`kindPaint`).

**Anatomy:** a raised key: face (fill, 3 pt `outline`, radius 14) on a hard shadow of 5; content row centred, gap 10: optional start icon (24), label (`label` role: 17 Rubik Bold, line height 1.25), optional end icon (24).

*Measurements* (`button`): minHeight 54 · paddingBlock 10 · paddingInline 18 · gap 10 · radius 14 · border 3 · elevation 5 · iconSize 24.

| Kind | Fill | Label and icons | Edge |
|---|---|---|---|
| primary | `accent` | `onAccent` | `outline` |
| secondary (default) | `surface` | `ink` | `outline` |
| pop | `pop` | `onPop` | `outline` |
| danger | `surface` | `danger` | `danger` |
| quiet | none (the 3 pt edge folds into the padding) | `ink`, underlined 2 pt, offset 5 | none, no shadow |

**States:** default · pressed (see the press model) · disabled (`isDisabled`: `sunken` fill, `inkSoft` label, dashed `inkSoft` edge, pushed in; quiet: `inkSoft`, no transform) · busy (`isBusy`: label kept, the start icon replaced by three hopping 9 pt blocks in the label colour; pushed in; `accessibilityState.busy`).

**Layout:** `isBlock` stretches to the body width. `isInRow` makes a button share a row (dialog rows, Replay / Levels): flex 1 1 with a 120 pt basis, so two buttons wrap at 200 % text.

*Quiet button* (`quietButton`): minHeight 44 · paddingBlock 8 · paddingInline 10 · underlineThickness 2 · underlineOffset 5 · elevation 0. A flat `Pressable` (the one allowed besides `RaisedSurface` and `ListRow`): pressed = `sunken` background and scale 0.97.

**Accessibility:** role `button`, name = the visible label, `accessibilityState` `{ disabled, busy }`, optional translated `hint` only when the result is not obvious.

**Do:** keep the label on one line where it fits and let it wrap centred at 200 % text; put the icon at the start, except forward arrows ("Next", "Continue"), which sit at the end (`iconEnd`). **Don't:** use accent for destructive actions; put two primary buttons side by side (a pair is secondary + primary: Later / Restart now, Previous / Next); give a quiet button a shadow.

## Hero key (4.2)

`<Button kind="primary" size="hero" cap="play" ... />`. A primary button 80 tall with elevation 6 and the `heroKeyLabel` style (25, display face). With a **cap** (Play, Resume, Try again, Buy, Play a level): a 50 × 50 square at the start (3 pt `outline` edge, radius 11, `surface` fill, 26 pt `ink` icon), start padding 12, content start-aligned. Without a cap (Continue, Next level, Choose options): label centred, forward icon at the end.

*Measurements* (`heroKey`): minHeight 80 · paddingBlock 10 · paddingInline 18 · paddingStartWithCap 12 · gap 10 · radius 14 · border 3 · elevation 6 · capSize 50 · capRadius 11 · capBorder 3 · capIcon 26.

**States:** as the button with elevation 6 (pressed translateY 6; busy and disabled pushed in; a disabled cap keeps its square). **Do:** one per screen, always a block. **Don't:** two lines of text in it; use it for Cancel or destructive actions.

## Row button (4.3)

**Template:** `row-button.tsx` (`RowButton`: `icon`, `iconPaint`, `label`, `description`, `kind` secondary or pop).

**Anatomy:** a block button laid out as a row, start-aligned, min height 68, padding 10 × 14, gap 12: icon tile (38) · text column (label 17 Rubik Bold, gap 1; description `rowButtonDescription` 14, `inkSoft` on secondary, `onPop` on pop) · chevron 22 at the end. Endless card ("Endless – Best 4,210": secondary, accent tile) and the Premium key (pop, gold tile).

*Measurements* (`rowButton`): minHeight 68 · paddingBlock 10 · paddingInline 14 · gap 12 · chevron 22 · labelGap 1. Elevation 5.

**Accessibility:** one button whose name is "label, description". **testID parts:** `.icon`, `.label`, `.description`. **Don't:** use it inside a list (lists use flat rows).

## Home keys (4.4)

**Template:** `key-button.tsx` (`KeyButton`). Three secondary keys in a 3-column grid (gap 10), each 94 tall, padding 10 × 6, content stacked and centred, gap 6: icon 30, label 15 Rubik Bold (line height 1.2 / 1.4), up to two lines. Levels (`grid`), Statistics (`stats`), How to play (`book`).

*Measurements* (`key`): minHeight 94 · paddingBlock 10 · paddingInline 6 · gap 6 · icon 30 · columns 3 · columnGap 10.

**Layout:** each key grows into its pair cell (`layoutStyle` `{ flexGrow: 1 }`, never `flex: 1`; see the press model above), so the three keys share the row's height in a row and keep their own height when stacked.

**Do:** at 200 % text the screen stacks the three keys vertically (the grid is the screen's job).

## Icon button (4.5)

**Template:** `icon-button.tsx` (`IconButton`, sizes regular 48 and small 44).

**Anatomy:** a 48 × 48 raised square (radius 12) or 44 × 44 (radius 11), 3 pt `outline` edge, `surface` fill, 24 pt `ink` icon centred, elevation 4. Back (start of every top bar; flips in RTL through the icon's directional set), settings gear, pause, undo and hint.

*Measurements* (`iconButton`): size 48 · sizeSmall 44 · radius 12 · radiusSmall 11 · border 3 · elevation 4 · icon 24.

**Accessibility:** `label` is required (an icon has no text to read). **Don't:** go below 44 pt; add `hitSlop`.

## Busy blocks and splash loader (4.24)

**Template:** `busy-blocks.tsx` (`BusyBlocks`, size button or splash).

**Busy blocks:** three 9 × 9 squares (radius 2) in the current text colour, gap 5, hopping 7 pt (900 ms loop, 120 ms stagger, boing; keyframes 0 %, 60 %, 100 % at rest, 30 % at −7). Inside busy buttons (before the label) and the restoring toast. Reduce motion: static. Pair them with `accessibilityState.busy` and a text ("Buying…", "Restoring…"): inside a button they are hidden from VoiceOver.

*Measurements* (`busy`): block 9 · radius 2 · gap 5 · hop 7.

**Splash loader:** three 14 × 14 squares, radius 4, `ink`, gap 9, the same hop, 44 pt above the bottom of the body; stands alone, so it is an image labelled "Loading" (`splash.loader`).

*Measurements* (`splashLoader`): block 14 · radius 4 · gap 9 · paddingBottom 44.

## Pause toggle key (4.25)

**Template:** `toggle-key.tsx` (`ToggleKey`).

**Anatomy:** one of three keys in a 3-column grid (gap 10) inside the Pause dialog: min 84 tall, padding 6 × 4, gap 3, radius 10, 2 pt `outline` edge (as rendered), `surface`, elevation 3, stacked and centred: 26 pt icon (sound, music, vibration), label 14 Bold, state line 13 regular with a 13 pt check or dash + "On" / "Off".

*Measurements* (`toggleKey`): minHeight 84 · paddingBlock 6 · paddingInline 4 · gap 3 · radius 10 · border 2 (token 2.5) · elevation 3 · icon 26 · stateIcon 13 · columns 3 · columnGap 10.

**States:** off (raised) · on (`accent` fill, `onAccent`, pushed in: 3 lower by layout, no shadow) · pressed (Chosen, not drawn: as a level tile). **Accessibility:** role `switch`, `accessibilityState.checked`, name = label. **testID parts:** `.icon`, `.label`, `.state` (`pause.sound-switch.state`).

**Layout:** the Pause screen puts each key in a `usePairLayout` cell (a column View), and the key grows into it with `layoutStyle` `{ flexGrow: 1 }`. Never `flex: 1` inside a pair-layout cell: that zero basis collapsed the Pause toggle row to 0 pt on the device, with the keys drawn over the Home button (verified on the simulator; the controls test pins `flexGrow: 1`, basis auto, no `flex`).

## Toggle (4.6)

**Template:** `toggle.tsx` (`Toggle`, visual only).

**Anatomy:** track 58 × 36, radius 10, 3 pt `outline` edge; knob 26 × 26, radius 7, 2 pt `outline` edge (as rendered), `surface` fill, knob shadow 2, inset 2 from the track's inner edge; the knob holds a 15 pt icon: `check` when on, `dash` when off.

*Measurements* (`toggle`): width 58 · height 36 · radius 10 · border 3 · knob 26 · knobRadius 7 · knobBorder 2 (token 2.5) · knobInset 2 · knobTravel 22 · knobElevation 2 · knobIcon 15.

**States:** off (track `sunken`, knob at the start, dash) · on (track `accent`, knob at the end after travelling 22, check) · slide 300 ms boing; under reduce motion the knob jumps. The travel follows the reading direction (the knob ends on the left in RTL).

**Accessibility:** the toggle is not a separate target: the whole 60 pt settings row is the switch (`ListRow end="toggle"`: role `switch`, `accessibilityState.checked`). **Do:** keep the check / dash (shape before colour). **Don't:** use colour alone; animate under reduce motion.

## Segmented control (4.7)

**Template:** `segmented-control.tsx` (`SegmentedControl<TValue>`).

**Anatomy:** a row of equal segments (flex 1 each), gap 8, each min 48 tall, padding 5 × 3, radius 10, 2 pt `outline` edge (as rendered), `surface` fill, elevation 3; label 15 Rubik Bold centred (14 inside a settings row, `isInRow`), wraps; optional preview line 13 regular under it (the Numbers row shows `123` / `123` / `۱۲۳`).

*Measurements* (`segmentedControl`): minHeight 48 · gap 8 · radius 10 · border 2 (token 2.5) · elevation 3 · paddingBlock 5 · paddingInline 3 · checkIcon 15 · faceGap 1 · labelColumnGap 3.

**Inner gaps (mockup overrides).** The token file lacks two gaps the design draws: `faceGap` 1 between the label line and the preview line (`.seg>span { gap: 1px }`) and `labelColumnGap` 3 between the check and the label (`.sg-l { gap: 0 3px }`). `write-component-specs.mjs` adds both from its commented override table; the face takes `gap: SEG.faceGap` and the label row `columnGap: SEG.labelColumnGap`. Without them the labels sat 0.5-2 pt off and the chosen label's ink window caught the check glyph.

**States:** unselected (raised) · selected (`accent` fill, `onAccent` text, 15 pt check before the label, pushed in: 3 lower by layout, no shadow) · pressed (Chosen, not drawn: as a level tile). One segment is always selected.

**Accessibility:** the row is a `radiogroup` named by `label`; each segment is a `radio` with `accessibilityState.selected`. **testID:** the group `settings.theme-control`; segments `<segmentTestIDBase>.<value>` (`settings.theme-segment.dark`) with `.label` and `.preview`. **Don't:** show the check on more than one segment.

## Slider (4.8)

**Template:** `slider.tsx` (`Slider`, value 0..1).

**Anatomy:** a 44 pt tall target (min width 120). Track: 14 tall at top 15, radius 5, 2 pt `outline` edge (as rendered), `sunken` fill; fill from the **start edge** to the value in `accent`, closed by a 2 pt `outline` edge at its end; thumb 30 × 30 at top 7, radius 9, 3 pt `outline` edge, `surface` fill, shadow 3, centred on the value.

*Measurements* (`slider`): height 44 · minWidth 120 · trackTop 15 · trackHeight 14 · trackRadius 5 · trackBorder 2 (token 2.5) · thumb 30 · thumbTop 7 · thumbRadius 9 · thumbBorder 3 · thumbElevation 3.

**States:** normal · off (`isOff`: the sound or music it controls is off, fill `inkSoft`) · dragging (Chosen, not drawn: thumb pushed in, translateY 3, no shadow). RTL fills right to left.

**Input:** `Gesture.Race(pan, tap)` from react-native-gesture-handler 2.32 with `runOnJS(true)` into `onChange`. The pan starts only after 8 pt sideways (`activeOffsetX([-8, 8])`) and fails after 8 pt up or down (`failOffsetY`), so a vertical swipe that starts on the slider still scrolls the Settings list (a `minDistance(0)` pan would swallow it and jump the volume); a tap jumps to the tapped point. Tests find the gestures through `gestureTestID` (`<id>.pan`, `<id>.tap`) with `fireGestureHandler` from `react-native-gesture-handler/jest-utils`; the first `ACTIVE` event calls `onStart`, later ones `onUpdate`.

**Accessibility:** role `adjustable`, name = label, `accessibilityValue` 0–100, `increment` / `decrement` actions step 10 % (Chosen). **testID parts:** `.fill`.

## Progress bar (4.9)

**Template:** `progress-bar.tsx`. 16 tall (min width 60), radius 6, 2 pt `outline` edge (as rendered), `sunken` track, `accent` fill from the start edge with a 2 pt `outline` end edge (token 2.5). S8 pack progress. Not interactive: role `progressbar` with a translated label ("28 of 90 stars") and `accessibilityValue`.

*Measurements* (`progressBar`): height 16 · minWidth 60 · radius 6 · border 2 (token 2.5) · fillEdge 2 (token 2.5).

## Option card and radio mark (4.10)

**Templates:** `option-card.tsx` (`OptionCard`), `radio-mark.tsx` (`RadioMark`).

**Option card (S2 language choice):** a raised row, min 66 tall, padding 10 × 14, gap 12, radius 14, 3 pt `outline` edge, `surface`, elevation 5: language autonym (`optionNameChoice` 21 Bold, in its own script and direction: pass `language`) · optional sticker (`badge`: "Phone language", small, tilt +3) · radio mark at the end. Selected: `accent` fill, `onAccent` text, pushed in, the radio shows a check.

*Measurements* (`optionCard`): minHeight 66 · paddingBlock 10 · paddingInline 14 · gap 12 · radius 14 · border 3 · elevation 5.

**Radio mark:** 32 × 32 square, radius 9, 3 pt `outline` edge, `surface` fill, 20 pt `check` when selected, empty otherwise. Decorative: the card or row around it is the `radio`.

*Measurements* (`radio`): size 32 · radius 9 · border 3 · icon 20.

**Accessibility:** the card is a `radio` with `accessibilityState.selected` and `accessibilityLanguage` for the autonym. **testID parts:** `.radio` (`language-choice.language-row.fa.radio`). **Chosen:** the "Phone language" sticker marks the phone's own language, not the selection.

Reference crops: `assets/reference/light-buttons.png`, `dark-buttons.png`, `light-hero-key.png`, `light-toggle.png`, `light-segmented-control.png`, `light-slider.png`.
