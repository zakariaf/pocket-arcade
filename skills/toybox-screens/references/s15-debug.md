# S15 Debug menu

S15 is the debug menu of test builds, for the owner and for automated tests; it never ships in a store build.

## Contents

- What the product requires
- Layout, top to bottom
- States and variants
- Data the model supplies
- Templates
- testIDs
- Copy keys
- Reference images
- Pitfalls

## What the product requires

- Jump to any level; unlock all; give stars; set the date; show the level seed and game state; force test ads always or never; toggle Premium without a purchase; force the language, direction and digits; simulate offline; export and import the save as text.
- Test builds only: the code is reached only through `TEST_ONLY` so Metro drops it from store bundles.

## Layout, top to bottom

Under the status bar: the hazard strip (20 pt; gold and toy-ink stripes at -45 deg, 3 pt rules). Top bar "Debug menu" with Back and, at the end, the small ink sticker "Test build" (tilt +5 deg, `bug` icon). Body: one list of 14 rows: Jump to level (`grid`, value 12) · Unlock all (`lock`) · Give stars (`star-filled`) · Set date (`calendar`, value = date) · Show state (`doc`) · Always show test ads (`ad`, toggle on) · Never show ads (`close`, toggle off) · Premium on (gold `crown`, toggle off) · Force language (`globe`, value "en · ltr · 123", isolated LTR) · Simulate offline (`wifi-off`, toggle off) · Export save (`forward`) · Import save (`back`) · Error log (`alert`, value 0) · Font test (`hash`). A tall frame; the body scrolls.

## States and variants

English in every language on purpose (the deck's debug keys are English in all four).

## Data the model supplies

`DebugModel` (in `debug-view.tsx`): `values` (level, date, locale, errors), `switches` (ads-always-test, ads-never, premium, offline), `networkAttempts` (the JS network guard's blocked attempts, drawn under the list as `debug.network-attempts`, which every E2E smoke flow asserts is `0`; not in the design), `importField` (the Import save row's paste field; drawn while `isOpen`), `isReducedMotion`, `onBack`, `onAction`, `onToggle`. `use-debug-model.ts` reaches services only through `useDebugServices()` (e2e-maestro's `app/debug-services-context.tsx`, provided by the app root in test builds): the offline switch calls `setOffline`, the Premium switch `setPremium` (save first, then `debug-premium-set`; never StoreKit or `premium-granted`), "Set date" `setDate` (only `today()` moves). The debug services also offer `createConsent(geography)` for a consent test in a chosen geography (never `createAdmobConsentAdapter`); S15 has no row for it yet (the design's fourteen rows do not include one), so it is reached only from a test or a debug link. `debug-rows.ts` holds the fourteen rows. The list has no tab (the Toybox `List`); switch rows are `ListRow` `end="toggle"` with `isOn` and `onPress`, tool rows `end="chevron"`; the stripes are the code-drawn `HazardStrip` (`testID="debug.hazard-strip"`).

**Import save** (spec 7.6; the design draws the row without its field): the row opens the model's `importField` (`DebugImportField`: `isOpen`, `text`, `error`, `onChangeText`, `onSubmit`, `onCancel`), and while it is open the view draws `DebugImportSave` (`debug-import-save.tsx`) under the list, above the network counter: a multiline text field `debug.import-save-field` (a `TextInput` in the body text style, 120 pt tall, a 2 pt ink edge; VoiceOver reads it as a text field labelled "Import save from text"), the block button `debug.import-save-button` ("Import save from text", `back` icon, `onSubmit`), and, when the pasted text was refused, the reason as an alert toast `debug.import-save-error` (English on purpose, like every debug text; VoiceOver announces it). e2e-maestro's `use-debug-model.ts` fills the field: `onSubmit` imports through the debug link handler's `importSave` (the save codec, then one write) and closes the field when it worked.

**Font test page** (spec 7.6): the Font test row (`debug.font-test-row`) opens the `FontTest` route of the Debug group (e2e-maestro's model navigates; the route is test-only: navigation-and-routing's `font-test-route.tsx` renders `TEST_ONLY.FontTestScreen`, so store bundles never carry it). The page (`font-test.screen`, a scrolling frame under the home indicator; the design draws no page) names every Toybox type role and component text style (`FONT_TEST_VARIANTS`: the seven roles, then every style of `TYPE_STYLES`) and draws each in en, de, fa and ckb with the fonts and line heights the app uses (`AppText` with the sample's `language`). The samples hold the glyphs a font or a line box gets wrong first: English digits and the en dash, German umlauts and ß, the Persian madda (آ) and every hamza seat (ئ أ ؤ ء) with Persian digits, and the Kurdish ێ ڵ ڕ ۆ with Arabic-Indic digits. Use it to spot clipped marks, a wrong line box or a fallback font on the simulator; parity's text probe measures the same roles. Back is the stack's edge swipe (the page has no controls). Files: `font-test-samples.ts` (pure data, tested), `use-font-test-model.ts` (tested), `font-test-view.tsx` (tested), `font-test-screen.tsx` (the route file: model hook, then view).

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/debug/`.

- `packages/shell/src/screens/debug/debug-rows.ts`
- `packages/shell/src/screens/debug/debug-view.tsx` and `debug-import-save.tsx`
- `packages/shell/src/screens/debug/debug-screen.tsx`
- `packages/shell/src/screens/debug/debug-view.test.tsx` (the rows, the switches, and the Import save field, button and refusal)
- `packages/shell/src/screens/debug/font-test-samples.ts`, `use-font-test-model.ts`, `font-test-view.tsx`, each with its test, and `font-test-screen.tsx`
- From e2e-maestro: `use-debug-model.ts` (with `importField` and the Font test navigation) and the debug services; from navigation-and-routing: `navigation/font-test-route.tsx`

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

Chosen states the design does not draw may also set: `debug.network-attempts` (the counter under the list), `debug.import-save-field`, `debug.import-save-button` and `debug.import-save-error` (the open Import save row), and `font-test.screen` (the font test page's root).

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

## Reference images

- `assets/reference/s15-debug-menu.png` (normal; phone-tall)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- Importing the debug screen or the font test page from anywhere but `test-only-entry.ts`.
- Translating the debug rows.
- Faking the Import save row or the Font test page with a "not available" sheet: both ship.
