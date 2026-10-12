# Text scaling (200 %) and reduce motion

## Contents

- Dynamic Type: what iOS sends and what the app does
- Font size on Android: font scale 2.0
- Layout rules at large text
- Toybox large-text layouts
- Reduce motion: one source of truth
- Toybox motion and its reduce-motion alternatives

## Dynamic Type: what iOS sends and what the app does

React Native's iOS `fontScale` per content-size category (from `RCTAccessibilityManager.mm`; ✓ = confirmed on the simulator):

| `simctl ui … content_size` | `fontScale` | Body 17 pt becomes (capped at 2×) |
|---|---|---|
| `large` (default) | 1.0 ✓ | 17 |
| `extra-extra-extra-large` | 1.353 | 23 |
| `accessibility-medium` | 1.786 ✓ | 30.4 |
| `accessibility-large` | 2.143 | 34 (cap) |
| `accessibility-extra-extra-extra-large` | 3.571 ✓ | 34 (cap) |

- `AppText` renders every text with `maxFontSizeMultiplier={2}`: text grows up to **200 %** (the product's requirement) and no further. Verified: the cap holds text at 2× in a screenshot at the largest size.
- Never `allowFontScaling={false}`, never a different `maxFontSizeMultiplier`, never raw font sizes (use type roles).

## Font size on Android: font scale 2.0

Android has no content-size categories: the system font size is one number, `font_scale` (Settings > Display > Font size; up to 2.0 on Android 14 and later, so on the API 35 emulator image). React Native reports it as `fontScale` (`useWindowDimensions()`), and the same `AppText` cap applies: text grows to 200 % and no further, `isLargeText` is true from 1.35 as on iOS.

- The 200 % pass on the emulator sets the scale by adb on the AVD's own serial, never on a device the session did not start, and resets it afterwards:

```sh
adb -s "$SERIAL" shell settings put system font_scale 2.0   # the 200 % pass
adb -s "$SERIAL" shell settings put system font_scale 1.0   # back to normal afterwards
```

- The e2e-maestro Android runner does this in its large-text step for the `a11y` flows (en and fa, phone and tablet AVDs), as the iOS runner does with `content_size`; the screenshot matrix's large-text set uses the same scale.
- Every layout rule below holds on Android unchanged; Android sizes are dp, the same numbers as pt.
- Not yet confirmed on the emulator: the `fontScale` React Native reads at `font_scale 2.0` (expected 2.0). The first Android large-text run checks it and records it here.

## Layout rules at large text

- Use `minHeight`, not a fixed `height`, on containers of text.
- No `numberOfLines` on sentences: text wraps, never truncates ("reflow rather than cut off").
- `useWindowClass()` gives `isLargeText` when `fontScale >= 1.35` (Dynamic Type "Extra Extra Extra Large" and above): stack horizontal rows vertically.
- Tiles and keys that hold text grow with the font: give them `minHeight` (the Toybox size) instead of `height`, and keep their width at least 44 pt (level tiles: 6 columns, about 51.7 pt on a 390 pt phone).
- Test layout functions at 320, 402, 744, 874, 1032 and 1376 pt wide and at `fontScale` 2.

## Toybox large-text layouts

The mockup has no large-text frames, so these are the chosen layouts at `isLargeText`:

- home keys, the two-button rows, the streak panels and 3-column stat grids **stack vertically**;
- row values drop under their labels (like wrap rows);
- level tiles grow in height with the font (the grid stays 6 columns on phones);
- the hero key grows taller (minimum 80 pt).

Check them in screenshots at `accessibility-extra-extra-extra-large` in en and fa: nothing clipped or overlapping, nothing truncated.

Clipping also happens at normal size when a Persian line box is too short: iOS cuts glyphs at the line box where Chrome (the design references) lets them overflow. At line height 1.0 the tops of Vazirmatn's digits on every fa level tile were cut off, so the level number now uses 1.45 in fa and ckb (the theme's `TYPE_STYLES.levelNumber`, a token-file change, lead decision L2). The 44 pt score (`TYPE_STYLES.scoreValue`: S7, the endless and daily results) lost the tops of its Persian digits the same way and uses 1.45 too (lead decision L9); keep only minimum heights around both, never a fixed row height. Beyond the line box, `AppText`'s overflow guard centres a Vazirmatn line's overflow as Chrome does, since iOS puts it all above the line and clips it (toybox-design-system). In fa and ckb screenshots look at the tops and bottoms of digits and of marks such as madda and hamza, not only at wrapping; a clipped glyph is a defect, never a waiver.

## Reduce motion: one source of truth

- `useReduceMotion()` (`packages/shell/src/app/use-reduce-motion.ts`) resolves the Settings row "Reduce motion" (`system` / `on` / `off`, default `system`) against the phone's switch in `systemA11yStore`. On Android the phone's switch is "Remove animations": React Native's `isReduceMotionEnabled` is true when the global transition animation scale is 0 (read in the React Native 0.86 Android source), so the same store and hook serve both platforms. Any 0 counts, so an emulator whose three animation scales are set to 0 for E2E runs (`adb -s <serial> shell settings put global transition_animation_scale 0`) runs with the phone's reduce motion on: with the row at `system` the app shows the reduce-motion alternatives below, which is what those runs must expect. `resolveReduceMotion(preference, isSystemOn)` is pure and tested.
- Never use Reanimated's `useReducedMotion()`: it is a constant captured at module load (read in the 4.5.1 source), so it ignores the setting and live changes.
- `<MotionConfig />` at the root sets Reanimated's global `ReducedMotionConfig` (`ReduceMotion.Always` / `Never`), so every `withTiming`/`withSpring`/layout animation that keeps the default `reduceMotion: ReduceMotion.System` follows the Shell setting. In development builds it logs "Reduced motion setting is overwritten with mode …", which is expected.
- Board animations do not go through it: they use `buildTimeline(events, isReduced ? 'reduced' : 'full')` — no screen shake, no particles, no zoom, no parallax, no overshoot.
- Functional timers (hold-to-confirm, 2 s) pass `reduceMotion: ReduceMotion.Never`: a safety hold must not finish instantly.
- Navigation transitions become fades when reduce motion is on (Apple: replace x/y/z motion with fades).

## Toybox motion and its reduce-motion alternatives

| Moment | Normal | Reduce motion |
|---|---|---|
| Press in: sink and squash | 70 ms ease-out | sink without squash; shadow swap instant |
| Release: spring back | 320 ms, overshoot (`withSpring({ damping: 12, stiffness: 420, mass: 1 })`) | instant return |
| Fill colour change | 120 ms | instant |
| Toggle knob slides | 300 ms, overshoot | instant |
| Result stars pop in one by one | 540 ms each, delays 250 / 400 / 550 ms | all three shown filled at once, 120 ms fade |
| Sticker slap (win title, New best, Premium active) | 420 ms from scale 1.7 | 120 ms fade |
| Toast drops in | 380 ms | 120 ms fade |
| Screen push | 260 ms slide in the reading direction | 150 ms cross-fade |
| Current level tile bobs | 1600 ms loop | no loop |
| Busy blocks hop | 900 ms loop | static blocks plus the busy text |
| Hold to confirm | 2000 ms linear fill from the start edge | unchanged (functional timer) |

`mass: 1` is written out because Reanimated 4.5.1's `withSpring` defaults mass to 4, which would make the release twice as slow and much bouncier.
