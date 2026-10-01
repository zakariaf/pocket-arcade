# Testing right-to-left

Jest proves the decisions (direction plan, digits, bidi, alignment and font of text); only screenshots prove the layout. Both are required.

## Contents

- What Jest can and cannot see
- The RTL tests to keep
- Simulator commands
- The RTL Maestro flow
- The screenshot matrix and what to look for

## What Jest can and cannot see

- The React Native Jest preset mocks `I18nManager.isRTL = false`, and Jest computes no layout. So component tests **set the direction explicitly**: `renderWithShell(ui, { language: 'fa', direction: 'rtl' })`.
- Jest can assert the i18n contract of text: `toHaveStyle({ writingDirection: 'rtl', textAlign: TEXT_ALIGN.start, fontFamily: 'Vazirmatn-Bold' })` (write `TEXT_ALIGN.start`, never the physical literal: the text-align rule applies to tests too).
- Jest cannot see mirroring, clipping or font rendering: those are checked in screenshots.

## The RTL tests to keep

| Test (template) | Asserts |
|---|---|
| `direction-plan.test.ts` | keep / restart / give-up for every combination; `languageFromRawSave` tolerates garbage |
| `direction.test.ts` | the layout reads LTR in Jest; `restartForDirection` writes the guard, then reloads once with a reason |
| `digits.test.ts` | the digit table; ckb gets Persian-style digits; Persian decimal and percent signs; Latin on request |
| `create-number-formatter.test.ts` | `createPercentFormatter`: a 0.62 rate is "62%", "62 %", "۶۲٪" in en, de, fa/ckb, Latin on request, whole percentages only |
| `bidi.test.ts` | FSI/PDI code points; `stripIsolates` |
| `fonts.test.ts` | the family per language, weight and face (Vazirmatn for fa/ckb, Lilita One for game names everywhere) |
| `use-localized-text-style.test.tsx` | the pixel-snapped line height per script (55/3, 67/3, 77/3 at 3x), direction, start/end alignment, no tracking in Arabic script |
| `sqlite-kv-direction-guard-adapter.test.ts` (root `test/integration/save/`) | the pending-restart marker on the real kv-store SQL over node:sqlite: fresh install, write, survive a reload, clear, ignore garbage |
| `board-direction-view.test.tsx` | the board area is `direction: 'ltr'` in an RTL layout unless the game mirrors |
| `t.test.tsx` (text contract) | a fa sentence renders with `writingDirection: 'rtl'`, start alignment and Vazirmatn |

Every new screen or component with text or a row gets one RTL render in its test (`{ language: 'fa', direction: 'rtl' }`) that at least renders without a missing-message error; add a style assertion only for the text contract above.

## Simulator commands

Verified with Xcode 26.6 on the iOS 26.5 simulator:

| Purpose | Command |
|---|---|
| "System" language path | `xcrun simctl launch <udid> io.applander.<gameId without hyphens> -AppleLanguages "(fa)" -AppleLocale fa_IR` (Line Siege: `io.applander.linesiege`) (Sorani: `-AppleLanguages "(ckb)" -AppleLocale ckb_IQ`) |
| Forced in-app language and digits (test variant) | the debug deep link, or launch arguments read by test-only code with React Native's `Settings.get('<key>')`, e.g. `-shellLanguage ckb -shellDigits latin` |
| Screenshot | `xcrun simctl status_bar <udid> override --time 9:41`, then `xcrun simctl io <udid> screenshot out.png` |
| 200 % text | `xcrun simctl ui <udid> content_size accessibility-extra-extra-extra-large` (reset with `large`) |
| App logs | `xcrun simctl spawn <udid> log show --last 2m --info --debug --style compact --predicate 'process == "<App>" AND eventMessage CONTAINS "[TAG]"'` |

Only Release builds of the test variant are used for these checks.

## The RTL Maestro flow

`templates/e2e/03-language-switch.yaml` (copy to `packages/shell/e2e/flows/rtl/`): English -> Settings -> Language -> فارسی -> "Restart to apply" -> Restart -> Home comes back (mirrored) -> Levels still shows the seeded stars. It uses the canonical testIDs (`home.settings-button`, `settings.language-row`, `settings-language.language-row.fa`, `restart-dialog.restart-button`, `levels.level-tile.1`) and the project's debug-setup subflow. The stars are read from the tile's VoiceOver label (`text: '.*[3۳٣].*'`), because `levels.level-tile.1.stars-3` is a crop-only part inside the tile button that Maestro never lists. Run it with the project's e2e runner in en; it proves one restart, no crash loop and kept progress.

## The screenshot matrix and what to look for

The matrix is 4 languages × light/dark × phone/tablet, plus 200 % text; fa and ckb are the RTL half. Compare every RTL screen with its Toybox design screenshot, and read each capture (the Read tool) for:

- text starting at the right edge, never left-aligned Persian;
- rows mirrored (first item on the right), chevrons and back arrows pointing left, play/clock/star icons unflipped;
- fills (sliders, progress, hold-to-confirm, toggles "on") growing from the right;
- the board **not** mirrored (unless the game opted in), board numbers in the chosen digits;
- Persian digits wherever a number is shown (level tiles, scores, dates, charts), unless the Numbers setting says Latin;
- Latin names (game names, pack names) in place inside Persian sentences;
- no clipped marks or overlapping lines at 200 % text; nothing truncated.

Report each defect as screen, language, expected, seen; turn it into a failing test or a check first when it can be automated.
