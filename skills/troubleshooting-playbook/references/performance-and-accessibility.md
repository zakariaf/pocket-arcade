# Performance and accessibility

Measurement traps and accessibility findings. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- Accessibility
- Rendering
- Cold start
- Budgets

## Accessibility

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `perf-text-scale-values` | Large-text screenshots look unscaled | content_size categories map to font scales (large 1.0, accessibility-medium 1.786, accessibility-extra-extra-extra-large 3.571) | Use simctl ui <udid> content_size accessibility-extra-extra-extra-large for the 200% pass; cap with maxFontSizeMultiplier 2 | verified | `accessibility` |
| `perf-toybox-contrast-pairs` | checkPaletteContrast fails every light Toybox palette | It requires primary/background, starOn/surface ≥3 and danger/background ≥4.5, which Toybox light palettes miss by design | Proposal: check border/background and border/primary ≥3 and danger/surface ≥4.5 (owner decision) | open | `accessibility` |
| `perf-hold-label-contrast` | The hold-to-confirm label measured 4.43:1 on the light danger fill during the hold (needs 4.5) | The old light dangerFill #FFD9DD was a little too dark for 17 pt bold danger text | Decided (owner, O5): the light dangerFill is #FFDCDF (same hue, lighter), where danger text reaches 4.52:1 (text 13.03:1, muted text 7.6:1); the dark fill is unchanged; check-contrast checks danger on dangerFill as a 4.5 text pair in both themes, with no exception. Copy the current tokens (toybox-design-system) | documented | `accessibility` |
| `perf-hit-region-size` | Board cells are below 44 pt at 402x874 and nothing fails | BoardLayout does not expose the smallest hit region yet (cell size plus 2 x HIT_SLOP of 8 pt) | Expose it from BoardLayout and assert >= 44 pt in each game | open | `accessibility` |
| `perf-smart-invert` | Smart Invert changes the board colours | The board canvas is inverted like other content | Set accessibilityIgnoresInvertColors on BoardCanvas (the palette already has a dark variant) | documented | `accessibility` |
| `perf-reduce-motion-springs` | Reduce Motion is on but buttons still sink and spring | No root MotionConfig applies the reduce-motion setting to Reanimated's layout and spring animations | Wrap the app root in the MotionConfig from toybox-design-system's motion reference, fed by useReduceMotion | documented | `toybox-design-system` |
| `perf-adjustable-no-actions` | VoiceOver swipe up or down does nothing on a slider | accessibilityRole 'adjustable' without accessibilityActions increment and decrement | Add both actions and onAccessibilityAction; check-a11y-code requires them | documented | `accessibility` |

## Rendering

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `perf-box-shadow-device` | boxShadow or outline looks different on device | Not verified on the simulator yet | Check in the first simulator build; the fallback is the RaisedSurface shadow View | open | `toybox-design-system` |
| `perf-promotion-60hz` | Animations run at 60 Hz on a ProMotion iPhone | Info.plist lacks CADisableMinimumFrameDurationOnPhone = true | withShell sets it; check-perf-code reports promotion-plist | documented | `performance-budgets` |

## Cold start

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `perf-js-cold-start` | JS-only cold-start timing looks fast but launch feels slow | JS timing misses about 90% of the launch on the simulator | Measure process start to first frame with the native ProcessStart module (median 539 ms over 66 launches) | verified | `performance-budgets` |
| `perf-polyfill-cold-start` | Cold start over 1 s on an older iPhone | The forced FormatJS polyfills cost about 11 ms on the Mac simulator, more on old phones; bundle grows about 0.9 MB | Measure on a device before changing the polyfill policy | open | `performance-budgets` |
| `perf-cold-start-old-launches` | check-perf-report fails on cold starts recorded by an older build | The perf log survives app updates, so earlier builds were mixed in | Use the current checker (judges the latest 5 cold starts; the simulator baseline drops the first of the latest 6) | verified | `performance-budgets` |

## Budgets

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `perf-budgets-without-device` | A budget fails on a real device | The 6 MB bundle, 150 MB memory and 1,000 draw-call budgets are first estimates from probes | Tighten after the pilot game's first owner report, with a Gate-Change trailer | open | `performance-budgets` |
