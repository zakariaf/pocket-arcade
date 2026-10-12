# Testing right-to-left

Jest proves the decisions (direction plan, digits, bidi, alignment and font of text); only screenshots prove the layout. Both are required.

## Contents

- What Jest can and cannot see
- The RTL tests to keep
- Simulator commands (iOS)
- Emulator commands (Android)
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
| `direction.android.test.ts` (`unit-android`, Android step 4) | on the Android modules: the guard, then `allowRTL` and `forceRTL` (both, also `false` for English), then one reload; a reload that left the layout unchanged gives up; Persian digits through the polyfills; the faces named by their file names |
| `digits.test.ts` | the digit table; ckb gets Persian-style digits; Persian decimal and percent signs; Latin on request |
| `create-number-formatter.test.ts` | `createPercentFormatter`: a 0.62 rate is "62%", "62 %", "۶۲٪" in en, de, fa/ckb, Latin on request, whole percentages only |
| `bidi.test.ts` | FSI/PDI code points; `stripIsolates` |
| `fonts.test.ts` | the family per language, weight and face (Vazirmatn for fa/ckb, Lilita One for game names everywhere) |
| `use-localized-text-style.test.tsx` | the pixel-snapped line height per script (55/3, 67/3, 77/3 at 3x), direction, start/end alignment, no tracking in Arabic script |
| `sqlite-kv-direction-guard-adapter.test.ts` (root `test/integration/save/`) | the pending-restart marker on the real kv-store SQL over node:sqlite: fresh install, write, survive a reload, clear, ignore garbage |
| `board-direction-view.test.tsx` | the board area is `direction: 'ltr'` in an RTL layout unless the game mirrors |
| `t.test.tsx` (text contract) | a fa sentence renders with `writingDirection: 'rtl'`, start alignment and Vazirmatn |

Every new screen or component with text or a row gets one RTL render in its test (`{ language: 'fa', direction: 'rtl' }`) that at least renders without a missing-message error; add a style assertion only for the text contract above.

## Simulator commands (iOS)

Verified with Xcode 26.6 on the iOS 26.5 simulator:

| Purpose | Command |
|---|---|
| "System" language path | `xcrun simctl launch <udid> io.applander.<gameId without hyphens> -AppleLanguages "(fa)" -AppleLocale fa_IR` (Line Siege: `io.applander.linesiege`) (Sorani: `-AppleLanguages "(ckb)" -AppleLocale ckb_IQ`) |
| Forced in-app language and digits (test variant) | the debug deep link, or launch arguments read by test-only code with React Native's `Settings.get('<key>')`, e.g. `-shellLanguage ckb -shellDigits latin` |
| Screenshot | `xcrun simctl status_bar <udid> override --time 9:41`, then `xcrun simctl io <udid> screenshot out.png` |
| 200 % text | `xcrun simctl ui <udid> content_size accessibility-extra-extra-extra-large` (reset with `large`) |
| App logs | `xcrun simctl spawn <udid> log show --last 2m --info --debug --style compact --predicate 'process == "<App>" AND eventMessage CONTAINS "[TAG]"'` |

Only Release builds of the test variant are used for these checks.

## Emulator commands (Android)

The same checks on the Android emulator (android-emulator-build's `e07-android-<purpose>` AVD on the `google_apis` image, API 35). Every call names its device with `adb -s <serial>` (`emulator-<port>`): several emulators share this Mac's adb server, and a call without a serial reaches whichever device answers. Not yet run on an emulator: Android step 5 makes the first build, and the RTL flow runs at Android step 7.

| Purpose | Command |
|---|---|
| "System" language path (per-app language, Android 13+; the app lists its locales through expo-localization's `supportedLocales`) | `adb -s <serial> shell cmd locale set-app-locales io.applander.<gameId without hyphens> --user current --locales fa-IR` (Sorani: `--locales ckb-IQ`; back with `--locales en`), then launch |
| Launch | `adb -s <serial> shell am start -W -n io.applander.<gameId without hyphens>/.MainActivity` |
| Forced in-app language and digits (test variant) | the debug deep link (`<scheme>://debug/setup?lang=ckb&digits=latin`, e2e-maestro's parameters): `adb -s <serial> shell am start -W -a android.intent.action.VIEW -d '<link>'` |
| Screenshot | the demo-mode clock first (`adb -s <serial> shell settings put global sysui_demo_allowed 1`, then `adb -s <serial> shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941`), then `adb -s <serial> exec-out screencap -p > out.png` (`exec-out`, so the PNG is not mangled) |
| 200 % text | `adb -s <serial> shell settings put system font_scale 2.0` (reset with `1.0`) |
| App logs | `adb -s <serial> logcat -d -s ReactNativeJS:V AndroidRuntime:E` |
| The stored direction (what `forceRTL` and `allowRTL` wrote) | `adb -s <serial> root`, then `adb -s <serial> shell cat /data/data/io.applander.<gameId without hyphens>/shared_prefs/com.facebook.react.modules.i18nmanager.I18nUtil.xml` (`RCTI18nUtil_forceRTL`, `RCTI18nUtil_allowRTL`; `adb root` works on the `google_apis` image, never on a Play Store image) |
| The manifest flag | `aapt2 dump xmltree --file AndroidManifest.xml <apk>` shows `android:supportsRtl` = true (the Expo template's value; `check-rtl` rule `android-supports-rtl` fails any config that turns it off) |

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
