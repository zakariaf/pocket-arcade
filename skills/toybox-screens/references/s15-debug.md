# S15 Debug menu

S15 is the debug menu of test builds, for the owner and for automated tests; it never ships in a store build.

## Contents

- What the product requires
- Layout, top to bottom
- States and variants
- Languages: English texts, the language's digits (L13)
- Design parity (L12)
- Data the model supplies
- Templates
- testIDs
- Copy keys
- Reference images
- Pitfalls

## What the product requires

- Jump to any level; unlock all; give stars; set the date; show the level seed and game state; force test ads always or never; toggle Premium without a purchase; force the language, direction and digits; simulate offline; export and import the save as text.
- Test builds only: the code is reached only through `TEST_ONLY` so Metro drops it from store bundles.
- Debug menu > Performance (performance-budgets' owner tools): record frame times, share the perf report, run the save benchmark, and see the perf log's size and its newest cold start at a glance.

## Layout, top to bottom

Under the status bar: the hazard strip (20 pt; gold and toy-ink stripes at -45 deg, 3 pt rules), first, at y 62-82 on the parity phone. Then the top bar (66 pt, y 82-148) "Debug menu" with Back and, at the end, the small ink sticker "Test build" (tilt +5 deg, `bug` icon), **centred in the bar**: the design's box is 283.1, 94.6, 103.9 x 36.8 in en and 14.9, 93.3, 108.3 x 39.4 in fa (the tilted sticker's bounds). A `Sticker` aligns itself to the start of its parent (`alignSelf: 'flex-start'`), which in the bar's row is the top: the round-4 badge sat at y 81, 13.6 pt high (12.3 in fa), over the strip. `debug-view.tsx` therefore wraps it in a View with `alignSelf: 'center'`. Body (from y 154): one list of 14 rows: Jump to level (`grid`, value 12) · Unlock all (`lock`) · Give stars (`star-filled`) · Set date (`calendar`, value = date) · Show state (`doc`) · Always show test ads (`ad`, toggle on) · Never show ads (`close`, toggle off) · Premium on (gold `crown`, toggle off) · Force language (`globe`, value "en · ltr · 123", isolated LTR) · Simulate offline (`wifi-off`, toggle off) · Export save (`forward`) · Import save (`back`) · Error log (`alert`, value 0) · Font test (`hash`). Under the list: the Import save field while that row is open, then the network counter (`debug.network-attempts`), then the **Performance** group, which the design does not draw (test builds only, like the whole menu): the heading "Performance" (`debug.perf.heading`, `heading` role, a header for VoiceOver), then `DEBUG_PERF_ROWS` in order: the switch key "Record frame times" (`debug.perf-record-switch`: a `ToggleKey` with the `motion` icon and the On / Off state, spanning the body), the row button "Share performance report" (`debug.perf-share-row`, `forward`), the row button "Run save benchmark" (`debug.perf-benchmark-row`, `clock`), and one summary line (`debug.perf-summary`, 14 muted, start-aligned): "Performance log: 12 entries · cold 2 · 1122 ms · save p95 0.41 ms" (the entry count from `debug.perf.summary`, then the log's own numbers, never translated). A tall frame; the body scrolls.

## States and variants

The design draws one state: "Always show test ads" on, every other switch off, the date set to Sunday 27 Sep, level 12, the error log empty. The Import save field and the Performance group are the Chosen states the design does not draw.

## Languages: English texts, the language's digits (L13)

Lead decision L13: S15 is a test-only screen, so its texts stay English in all four languages, like every other debug text. Every key under `debug.` (the copy deck's rows, the title and badge, and the Shell extras `debug.perf.*`) has its English text in de, fa and ckb; i18n-strings-and-catalogs' catalog checkers fail a translated debug text (rule `debug-english`), `check-screens` fails `extra-key-catalog` when a Shell catalog's `debug.perf.*` text is not the English one, and the fa/ckb review sheet leaves debug keys out.

- **Labels in fa and ckb** keep the language's font and line height (Vazirmatn 17 at 1.5, as the design draws them) and are laid as **LTR paragraphs aligned to the row's start**: `ListRow labelDirection="ltr"` (AppText `textDirection`, useLocalizedTextStyle's `writingDirection: 'ltr'`), never bidi controls (rtl-and-direction, "An LTR text in an RTL row"). Laid right to left, iOS kept the trailing space of the wrapped first line of "Force language, direction and digits" inside the line and drew it 4.4 pt off the row's start; the design draws both lines flush with it.
- **Values follow the language's digits** (D65): "۱۲", "یکشنبه، ۲۷ سپتامبر", "fa · rtl · ۱۲۳" (the locale value isolated LTR) and "۰" in fa. e2e-maestro's `use-debug-model.ts` formats them with the language's formatters (`createNumberFormatter(localeTagFor(language, digits))` and the date message), never `String(n)`; the view draws what the model gives.
- `debug-view.test.tsx` renders S15 in en and fa and pins the label of "Force language, direction and digits": English text, the language's font and line height, `writingDirection: 'ltr'`, `textAlign` start.

## Design parity (L12)

Lead decision L12: S15 keeps design parity like every other screen. The frame `s15-debug-menu` is signed off in light and dark, en and fa, at its planned scroll offsets (toybox-visual-parity). Its frame state is `debug-ads-always-test`: e2e-maestro's `use-debug-model.ts` opens it once on mount, through the "Always show test ads" switch's own handler (the debug ads override `'always-test'`), never by a parity branch in the view. Because S15 is reached through the test-only entry, the model reads `parityFrameState()` straight from `app/parity/parity-session.ts`; `useParityOpener` reads the gate `app/test-only.ts` and would close an import loop through it (`check-boundaries` rule `import-cycle`). Every other value of the frame (date 27 Sep, jump to level 12, Premium off, the forced locale, offline off, error log 0) comes from the parity fixture save. The Shell's step 9 is done only when `check-screens --screen S15` and toybox-visual-parity's `check-signoff --screen S15` print `RESULT: PASS`.

Verified on 2026-10-01 on the parity simulator (iPhone 16 Pro, iOS 26.5) with a test build of the full Shell and Line Siege: with this layout (the strip first, the badge centred in the bar, the English labels laid LTR, the hazard stripes in the design's phase), e2e-maestro's opener and its digits, `run-parity --frame s15-debug-menu` passed light and dark, en and fa, at the top and at the planned scroll offset (8 captures, 0 problems). Before, the round-4 view failed every variant: the badge 13.6 pt high (12.3 in fa), the fa label 4.4 pt off, the stripes 8.3 pt off, the switch off and Latin digits in fa.

## Data the model supplies

`DebugModel` (in `debug-view.tsx`): `values` (level, date, locale, errors), `switches` (ads-always-test, ads-never, premium, offline), `networkAttempts` (the JS network guard's blocked attempts, drawn under the list as `debug.network-attempts`, which every E2E smoke flow asserts is `0`; not in the design), `importField` (the Import save row's paste field; drawn while `isOpen`), `perf` (`DebugPerf`, the Performance group: `isRecording`, `onToggleRecording`, `onShare`, `onRunBenchmark`, `entriesCount` = `PerfLog.entries().length`, and `summary`, the log's numbers "cold 2 · 1122 ms · save p95 0.41 ms"), `isReducedMotion`, `onBack`, `onAction`, `onToggle`. `use-debug-model.ts` reaches services only through `useDebugServices()` (e2e-maestro's `app/debug-services-context.tsx`, provided by the app root in test builds): the offline switch calls `setOffline`, the Premium switch `setPremium` (save first, then `debug-premium-set`; never StoreKit or `premium-granted`), "Set date" `setDate` (only `today()` moves). The debug services also offer `createConsent(geography)` for a consent test in a chosen geography (never `createAdmobConsentAdapter`); S15 has no row for it yet (the design's fourteen rows do not include one), so it is reached only from a test or a debug link. `debug-rows.ts` holds the fourteen rows. The list has no tab (the Toybox `List`); switch rows are `ListRow` `end="toggle"` with `isOn` and `onPress`, tool rows `end="chevron"`; the stripes are the code-drawn `HazardStrip` (`testID="debug.hazard-strip"`).

**Performance** (test builds; performance-budgets documents the tools as "Debug menu > Performance"): e2e-maestro's `use-debug-model.ts` fills `perf` from `DebugServices.perf`, the perf layer's `DebugPerfActions` over the test build's perf log (created once by `createDebugParts` through `TEST_ONLY.createDebugPerfActions`): the switch calls `setRecording(!isRecording())` (the board hosts' frame sampler records only while it is on; turning it off appends the recorded frames entry), Share calls `share()` (the iOS share sheet with the log as JSON; the app itself sends nothing), and Run save benchmark calls `runSaveBenchmark()` (300 writes of the largest save into a scratch database, then one `save-benchmark` entry with p50, p95 and max). `summary` is `perfSummaryText(perfSummaryOf(entries))` from `screens/debug/debug-perf.ts`. The view draws the group from `DEBUG_PERF_ROWS` (`debug-rows.ts`) in `debug-perf-section.tsx`; each map entry `debug.perf-*` must be set there (check-screens `debug-perf-rows`). The texts are the Shell extras `debug.perf.heading`, `.record`, `.share`, `.benchmark` and `.summary`, English in all four catalogs like every debug text.

**Import save** (spec 7.6; the design draws the row without its field): the row opens the model's `importField` (`DebugImportField`: `isOpen`, `text`, `error`, `onChangeText`, `onSubmit`, `onCancel`), and while it is open the view draws `DebugImportSave` (`debug-import-save.tsx`) under the list, above the network counter: a multiline text field `debug.import-save-field` (a `TextInput` in the body text style, 120 pt tall, a 2 pt ink edge; VoiceOver reads it as a text field labelled "Import save from text"), the block button `debug.import-save-button` ("Import save from text", `back` icon, `onSubmit`), and, when the pasted text was refused, the reason as an alert toast `debug.import-save-error` (English on purpose, like every debug text; VoiceOver announces it). e2e-maestro's `use-debug-model.ts` fills the field: `onSubmit` imports through the debug link handler's `importSave` (the save codec, then one write) and closes the field when it worked.

**Font test page** (spec 7.6): the Font test row (`debug.font-test-row`) opens the `FontTest` route of the Debug group (e2e-maestro's model navigates; the route is test-only: navigation-and-routing's `font-test-route.tsx` renders `TEST_ONLY.FontTestScreen`, so store bundles never carry it). The page (`font-test.screen`, a scrolling frame under the home indicator; the design draws no page) names every Toybox type role and component text style (`FONT_TEST_VARIANTS`: the seven roles, then every style of `TYPE_STYLES`) and draws each in en, de, fa and ckb with the fonts and line heights the app uses (`AppText` with the sample's `language`). The samples hold the glyphs a font or a line box gets wrong first: English digits and the en dash, German umlauts and ß, the Persian madda (آ) and every hamza seat (ئ أ ؤ ء) with Persian digits, and the Kurdish ێ ڵ ڕ ۆ with Arabic-Indic digits. Use it to spot clipped marks, a wrong line box or a fallback font on the simulator; parity's text probe measures the same roles. Back is the stack's edge swipe (the page has no controls). Files: `font-test-samples.ts` (pure data, tested), `use-font-test-model.ts` (tested), `font-test-view.tsx` (tested), `font-test-screen.tsx` (the route file: model hook, then view).

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/debug/`.

- `packages/shell/src/screens/debug/debug-rows.ts` (the fourteen rows and `DEBUG_PERF_ROWS`)
- `packages/shell/src/screens/debug/debug-view.tsx`, `debug-import-save.tsx` and `debug-perf-section.tsx` (the Performance group)
- `packages/shell/src/screens/debug/debug-screen.tsx`
- `packages/shell/src/screens/debug/debug-view.test.tsx` (the strip before the bar and the badge centred in it, the English labels laid LTR at the row's start in en and fa, the rows, the switches, the Import save field, button and refusal, and the Performance group: its three controls fire their handlers, the switch shows On and Off, the summary reads the count and the numbers)
- `packages/shell/src/screens/debug/font-test-samples.ts`, `use-font-test-model.ts`, `font-test-view.tsx`, each with its test, and `font-test-screen.tsx`
- From e2e-maestro: `use-debug-model.ts` (with `importField`, `perf` and the Font test navigation), `debug-perf.ts` and the debug services; from navigation-and-routing: `navigation/font-test-route.tsx`

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S15` prints every element with its English text.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `debug.screen` | ScreenFrame | none |  |  |  |
| `debug.hazard-strip` | HazardStrip | none |  |  |  |
| `debug.top-bar` | TopBar | none |  |  | .back-button .title |
| `debug.top-bar.badge` | Sticker (ink sm, bug, +5 deg) | text | `debug.badge` |  |  |
| `debug.list` | ListGroup | none |  |  |  |
| `debug.jump-to-level-row` | ListRow | button |  |  | .icon .label .value |
| `debug.unlock-all-row` | ListRow | button |  |  | .icon .label |
| `debug.give-stars-row` | ListRow | button |  |  | .icon .label |
| `debug.set-date-row` | ListRow | button |  |  | .icon .label .value |
| `debug.show-state-row` | ListRow | button |  |  | .icon .label |
| `debug.ads-always-test-switch` | ListRow | switch |  |  | .icon .label .toggle |
| `debug.ads-never-switch` | ListRow | switch |  |  | .icon .label .toggle |
| `debug.premium-switch` | ListRow | switch |  |  | .icon .label .toggle |
| `debug.force-locale-row` | ListRow | button |  |  | .icon .label .value |
| `debug.offline-switch` | ListRow | switch |  |  | .icon .label .toggle |
| `debug.export-save-row` | ListRow | button |  |  | .icon .label |
| `debug.import-save-row` | ListRow | button |  |  | .icon .label |
| `debug.error-log-row` | ListRow | button |  |  | .icon .label .value |
| `debug.font-test-row` | ListRow | button |  |  | .icon .label |

Chosen states the design does not draw may also set: `debug.network-attempts` (the counter under the list), `debug.import-save-field`, `debug.import-save-button` and `debug.import-save-error` (the open Import save row), `debug.perf-record-switch`, `debug.perf-share-row`, `debug.perf-benchmark-row` and `debug.perf-summary` (the Performance group, always drawn in a test build), and `font-test.screen` (the font test page's root).

## Copy keys

| Key | English |
|---|---|
| `common.back` | Back |
| `debug.title` | Debug menu |
| `debug.badge` | Test build |
| `debug.jump-to-level` | Jump to level |
| `debug.unlock-all` | Unlock all levels |
| `debug.give-stars` | Give stars |
| `debug.set-date` | Set date |
| `date.weekday-day-month` | {weekdayName}, {day, number} {monthName} |
| `debug.show-state` | Show level seed and game state |
| `debug.ads-always-test` | Always show test ads |
| `debug.ads-never` | Never show ads |
| `debug.premium-toggle` | Premium on (no purchase) |
| `debug.force-locale` | Force language, direction and digits |
| `debug.offline` | Simulate offline |
| `debug.export-save` | Export save as text |
| `debug.import-save` | Import save from text |
| `debug.error-log` | Error log |
| `debug.font-test` | Font test page |
| `debug.perf.heading` (Shell text) | Performance |
| `debug.perf.record` (Shell text) | Record frame times |
| `debug.perf.share` (Shell text) | Share performance report |
| `debug.perf.benchmark` (Shell text) | Run save benchmark |
| `debug.perf.summary` (Shell text) | Performance log: {entriesCount, plural, =0 {empty} one {# entry} other {# entries}} |

## Reference images

- `assets/reference/s15-debug-menu.png` (normal; phone-tall)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- Importing the debug screen or the font test page from anywhere but `test-only-entry.ts`.
- Translating the debug rows (L13), or formatting their values with `String(n)` (the digits follow the language).
- The "Test build" badge as a bare Sticker in the bar's end slot: it rides up to the top of the row, over the hazard strip. Centre it (`alignSelf: 'center'` on its wrapper).
- An English label in fa laid right to left, or nudged with LRM or LRE: lay it as an LTR paragraph (`labelDirection="ltr"`).
- Faking the Import save row or the Font test page with a "not available" sheet: both ship.
- A Performance group that invents testIDs, sits between the list and the network counter, or reads the perf layer from the view: the rows come from `DEBUG_PERF_ROWS`, the actions from the model.
