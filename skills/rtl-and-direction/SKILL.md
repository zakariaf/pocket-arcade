---
name: rtl-and-direction
description: Makes Pocket Arcade screens right-to-left correct for fa/ckb - direction switch and reload, logical styles, mirroring, directional icons, Persian digits, bidi isolation, Vazirmatn, LTR boards. Use when touching layout, icons, numbers or RTL screens. Not for translations (i18n-strings-and-catalogs).
---

# Right-to-left layout and direction

Persian and Sorani screens mirror exactly like their Toybox RTL design screenshots, the layout direction changes safely (one restart, never a loop), numbers use the chosen digits, and boards stay physical; a script proves the code follows every rule.

## Rules that must hold

1. **Style with logical keys only and build rows with `flexDirection: 'row'`.** `marginStart/End`, `paddingStart/End`, `start/end`, `border*Start*/End*`; never physical left/right keys in a style, never `row-reverse`. Why: React Native mirrors logical keys and rows by itself; physical keys and `row-reverse` break in one of the two directions.
2. **Render all text through `AppText` (or `<T>`) and align with `align="start" | "end"`.** Only `use-localized-text-style.ts` sets `textAlign` (through `TEXT_ALIGN`) and `writingDirection`. Why: the default `'auto'` stays physically left for an in-app Persian choice on an English phone (verified).
3. **Keep one direction source.** Only `packages/shell/src/i18n/direction.ts` reads `I18nManager`; components use `useDirection()`; navigation and `DirectionProvider` get `readLayoutDirection()`, never the language setting. Why: `isRTL` is fixed for the whole JS run, and between a language change and the restart text and layout disagree.
4. **Change direction only through `restartForDirection()`: `allowRTL` + `forceRTL` + `reloadAppAsync`, from a mounted component, after the save is written, at most once per direction.** Why: a reload during bundle evaluation crashed a Release build, and the guard turns a failed flip into a logged `give-up` instead of a crash loop.
5. **Run the direction check first in `start-shell.ts`, before any save write or render.** Why: module code runs again after the reload, so earlier writes happen twice.
6. **Configure `expo-localization` with `supportedLocales` only.** Why: `supportsRTL`/`forcesRTL` re-derive direction from the device at every launch and undo the in-app choice.
7. **Keep boards left-to-right (`BoardDirectionView`) unless the game declares `isMirroredInRtl`; mirror such a board in its `BoardLayout` mapping.** Never `scaleX: -1`; gestures stay physical. Why: a physical board must not flip with the text.
8. **Flip only `back`, `chevron`, `forward` and `undo`, inside `Icon` through `DIRECTIONAL_ICONS`.** Play, pause, clocks, stars, the lock, logos and pictures never flip. Why: only arrows point along the reading direction.
9. **Format every number with the tag from `localeTagFor(language, digits)`** (`{x, number}` in messages, `createNumberFormatter` elsewhere); ckb uses Persian-style `۰۱۲`; saves store plain numbers. Why: Hermes ignores digit selection without the polyfill and the tag, and the Numbers setting must win.
10. **Isolate free text inside sentences with FSI/PDI (`t()` or `isolate()`); no bidi controls in catalogs or source. A whole LTR text in an RTL row (S15's English labels in fa and ckb) is an LTR paragraph aligned to the row's start: `AppText textDirection="ltr"`.** Why: a Latin name must not reorder a Persian sentence; Vazirmatn lacks the Arabic Letter Mark; laid right to left, iOS drew a wrapped English label's first line 4.4 pt off the row's start ([references/digits-bidi-and-fonts.md](references/digits-bidi-and-fonts.md), "An LTR text in an RTL row").
11. **Embed Vazirmatn v33.003 Regular and Bold in every app with the `expo-font` plugin; never load fonts at runtime; never set `fontWeight` with a custom family.** Why: Persian and Sorani need the glyphs at the first frame, offline.
12. **Prove the layout in fa/ckb screenshots against the Toybox RTL design.** Jest sets the direction explicitly and cannot see layout. Why: mirroring, clipping and fonts are only visible on screen.

## Workflow

1. **First time (no direction layer yet).** Read [references/direction-switch.md](references/direction-switch.md). A file lands at Shell step 6 only if it and its test need nothing from step 7. At **Shell step 6** copy, each with its test, from `templates/shell-i18n/` into `packages/shell/src/i18n/` (skip files that already exist and are identical): `direction.ts`, `direction-plan.ts`, `direction-guard.ts`, `languages.ts`, `digits.ts`, `bidi.ts`, `fonts.ts` and `create-number-formatter.ts`; `templates/shell-save/` into `packages/shell/src/services/save/` and its node:sqlite test `templates/root-test/sqlite-kv-direction-guard-adapter.test.ts` into `test/integration/save/`. These and their tests import only each other, React Native, `expo` and `expo-sqlite`. At **Shell step 7** copy, each with its test, what renders through the Shell wrapper (`renderWithShell` needs the Toybox theme of step 7): `direction-context.tsx` (it has no test file of its own; `board-direction-view.test.tsx` and `use-localized-text-style.test.tsx` cover it), `language-context.tsx` (with i18n-strings-and-catalogs' provider and contexts, which import it and whose tests render through the wrapper), `templates/shell-game-host/` (`board-direction-view.tsx` and `board-direction-view.test.tsx`) into `packages/shell/src/game-host/`, and `use-localized-text-style.ts` with its test (it imports `snapToGrid` from the Toybox theme's `theme/type-styles.ts`). Copied at step 6 they fail `tsc` (the test imports `renderWithShell`), or, without their tests, the coverage gate; `check-rtl` rule `direction-files` prints `SKIP ... due at Shell step 7: packages/shell/src/app/start-shell.ts not yet created` until then. Also at step 7 copy `templates/shell-app/start-shell.ts` into `packages/shell/src/app/`, together with the composition root and the startup splash, because the entry imports them: game-host-integration's `createShellApp`, toybox-screens' `createStartupSplash` (`app/create-startup-splash.tsx`, the restart root) and the JS half of performance-budgets' `app/perf/` (the pure `markJsEntry()` in `cold-start.ts`, called right after `readParityLaunch()`, with the perf log and Home's mark); the native half of the perf layer (the process-start module) follows at Shell step 8 with the native rebuild. toybox-visual-parity's `app/parity-startup.tsx` (`readParityLaunch`, `parityLaunchFor`, `isHeldParitySplash`: a parity capture launches into one design frame; store builds always start normally) arrives when its harness is set up, before the first screen is compared with its design (Shell step 9 at the latest). Until it exists, leave out its import and its lines (every launch is then a normal one, and `markJsEntry()` is the first statement of `startShell`); the step that installs it puts them back as the template has them. Every root that renders text outside the navigator (the startup splash and the held parity splash, both from `createStartupSplash`) wraps itself in `<DirectionProvider direction={directionOf(language)}>`. Give the Shell root `DirectionProvider direction={readLayoutDirection()}` and `<Navigation direction={readLayoutDirection()} />`. Make sure each `apps/<game>/assets/fonts/` holds `Vazirmatn-Regular.ttf`, `Vazirmatn-Bold.ttf` and `Vazirmatn-OFL.txt` (the five Toybox fonts and three licence texts are copied by the toybox-design-system or new-game-scaffold work) and that the `expo-font` plugin list embeds them.
2. **Building or changing any screen or component.** Read [references/styling-and-mirroring.md](references/styling-and-mirroring.md) (logical keys, text alignment, icons, the Toybox RTL rules) and follow [examples/mirrored-row.md](examples/mirrored-row.md). Strings arrive translated; numbers arrive formatted.
3. **Numbers, dates in digits, free text, fonts.** Read [references/digits-bidi-and-fonts.md](references/digits-bidi-and-fonts.md). Format in the screen's model hook with `createNumberFormatter(localeTagFor(language, digits))`; isolate interpolated names.
4. **Language screens (S2, Settings -> Language).** Save first, then call `restartForDirection` when `planDirection` says `restart`: directly on S2 "Continue"; after the S14 "Restart to apply" dialog (Restart / Later) in Settings. Await `audio.dispose()` before the reload.
5. **Boards.** Wrap the board area in `BoardDirectionView` with the game's `isMirroredInRtl`. Draw Arabic-script board text with a Skia `Paragraph` (`TextDirection.RTL`, Vazirmatn); pass numbers as formatted strings.
6. **Tests.** Keep the template tests green (`direction-plan`, `direction`, `digits`, `bidi`, `fonts`, `use-localized-text-style`, `board-direction-view`, and the root `sqlite-kv-direction-guard-adapter` test). Give each new component with text one render at `{ language: 'fa', direction: 'rtl' }`. Read [references/testing-rtl.md](references/testing-rtl.md).
7. **Run the check** from the repo root and fix every `FAIL` line (each names the file, the rule and the fix) until it prints `RESULT: PASS`:
   `node ${CLAUDE_SKILL_DIR}/scripts/check-rtl.mjs .`
8. **Look at it.** Capture every changed screen in fa and ckb (light and dark, phone and tablet, and at 200 % text) and compare it with its Toybox RTL design screenshot, using the list in the testing reference; run the RTL Maestro flow (`templates/e2e/03-language-switch.yaml`) after any change to the language flows.

## Definition of done

- [ ] No physical left/right style key, `row-reverse`, `textAlign` literal, hand-set `writingDirection` or `scaleX: -1` outside `Icon`.
- [ ] Only `direction.ts` touches `I18nManager` and `reloadAppAsync`; navigation and the Shell root's `DirectionProvider` use `readLayoutDirection()`; the startup splash root wraps itself in `DirectionProvider direction={directionOf(language)}`; `start-shell.ts` (Shell step 7) plans the direction before anything writes or renders and calls `markJsEntry()` right after `readParityLaunch()`, never at module scope.
- [ ] Boards sit in `BoardDirectionView`; `DIRECTIONAL_ICONS` is exactly the arrows that exist.
- [ ] Every number uses a `localeTagFor` tag; free text in sentences is isolated; no bidi controls in catalogs or source; Vazirmatn Regular and Bold ship in every app.
- [ ] The RTL template tests pass (the guard adapter's node:sqlite test included; `start-shell.ts` carries its `// device-only: covered by ...` line), and each new component has an fa/RTL render in its test.
- [ ] fa and ckb screenshots of every changed screen match the Toybox RTL design (mirrored rows, right-aligned text, unflipped board, Persian digits, nothing clipped at 200 %).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-rtl.mjs .` prints `RESULT: PASS`.

## Anti-patterns

- **"Fixing" RTL with `row-reverse`, `I18nManager.isRTL ? … : …` or swapped `marginLeft`/`marginRight`.** It double-flips in the other direction. Use `row` and logical keys; React Native mirrors them.
- **Setting `textAlign: 'right'` for Persian.** Under an RTL layout `'right'` is the end edge, so the text lands on the left. Use `AppText align`.
- **Reloading at module scope, or calling `reloadAppAsync` from a screen.** It crashes Release builds and skips the guard. Use `restartForDirection` from a mounted component.
- **Deriving layout direction from the language.** Text switches at once, layout only after the restart; follow `readLayoutDirection()`.
- **A root outside the navigator without its own `DirectionProvider`.** The restart and held parity splash wrote the Persian tagline left to right (its full stop at the wrong end); `createStartupSplash` wraps its root in `DirectionProvider direction={directionOf(language)}`.
- **Copying `start-shell.ts`, `direction-context.tsx` or `BoardDirectionView` at Shell step 6.** The entry imports `createShellApp`, `createStartupSplash` and `app/perf/`, and the board wrapper's test renders through `renderWithShell`; all land at step 7 (a test held back while its file is copied leaves the coverage gate red). Step 6 has the direction modules, digits, bidi, fonts and the guard.
- **Flipping a whole board, a clock or a play icon.** Only direction arrows flip; mirrored boards remap coordinates.
- **Hard-coding `'fa'` or omitting the locale in `Intl.NumberFormat`.** The Numbers setting and ckb's digits are lost. Use the `localeTagFor` tag.
- **Pasting RLM/LRM or other bidi controls to nudge text into place.** Isolate the free text instead; Vazirmatn lacks ALM.
- **Trusting a green Jest run for layout.** Jest has no layout engine and mocks `isRTL`; only screenshots show mirroring.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/direction-switch.md](references/direction-switch.md) | The verified facts, the direction modules, `start-shell.ts` order, the three flows, navigation, expo-localization | Workflow steps 1 and 4 |
| [references/styling-and-mirroring.md](references/styling-and-mirroring.md) | Logical keys, rows and grids, text alignment, safe areas, which icons flip, the Toybox RTL rules, boards | Workflow steps 2 and 5 |
| [references/digits-bidi-and-fonts.md](references/digits-bidi-and-fonts.md) | Digit tags and outputs, numbers outside messages, the Numbers setting, FSI/PDI, Vazirmatn, Arabic line heights | Workflow step 3 |
| [references/testing-rtl.md](references/testing-rtl.md) | What Jest can and cannot see, the tests to keep, simulator commands, the Maestro flow, the screenshot checklist | Workflow steps 6 and 8 |
| [examples/mirrored-row.md](examples/mirrored-row.md) | A settings row that mirrors correctly, its test, and the wrong versions the checker catches | Workflow step 2 |
| `templates/shell-i18n/` | Direction modules (`direction`, `direction-plan`, `direction-guard`, `direction-context`), `use-localized-text-style` (pixel-snapped line heights), `fonts`, digits, number formatter (`createNumberFormatter`, `createPercentFormatter`, with its test), bidi, languages, language context, and their tests. `fonts.ts`, `use-localized-text-style.ts` and their tests are synced from the library (identical to the design system's copies; do not edit here) | Workflow step 1; copy to `packages/shell/src/i18n/` |
| `templates/shell-save/sqlite-kv-direction-guard-adapter.ts` | The pending-restart guard on `expo-sqlite/kv-store` | Workflow step 1 |
| `templates/root-test/sqlite-kv-direction-guard-adapter.test.ts` | Its test: the real kv-store SQL on node:sqlite (fresh install, write, reload, clear, garbage) | Workflow step 1; copy to `test/integration/save/` |
| `templates/shell-app/start-shell.ts` | The entry: polyfills first, the parity read and the cold-start mark (`markJsEntry()` right after `readParityLaunch()`; lands at Shell step 7 with the composition root, the startup splash and the JS half of `app/perf/`), then the direction check, then the app (device-only: covered by the simulator launch and the RTL flow) | Workflow step 1 |
| `templates/shell-game-host/` | `BoardDirectionView` (keeps boards LTR) and its test, copied together at Shell step 7 | Workflow steps 1 and 5 |
| `templates/e2e/03-language-switch.yaml` | Maestro flow: English -> Persian, one restart, progress kept (synced from the library, identical to e2e-maestro's copy; do not edit here) | Workflow step 8; copy to `packages/shell/e2e/flows/rtl/` |
| `scripts/check-rtl.mjs` | Checks 20 rules across the Shell, game-kit and apps: 17 RTL rules, the startup splash's own `DirectionProvider` (`root-direction-provider`), the entry's cold-start mark (`cold-start-mark`, once `app/perf/` exists) and the step-7 direction files (`direction-files`: `direction-context.tsx` and `BoardDirectionView` with its test; a not-yet-due SKIP before step 7) | Workflow step 7, after every layout change |
| `scripts/lib/source-scan.mjs` | JSX, call and import scanning helpers for the checker | Read only when changing the checker |
| `scripts/selftest.mjs` | Proves the checker passes the good fixture and catches each planted bug | After changing the checker or fixtures |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in (check-lib, the RTL flow, `fonts.ts` and `use-localized-text-style.ts` with their tests) | When adding a shared file |
| `tests/fixtures/` | A good mini app repo and one planted bug per rule | When adding a rule |

## Related skills

- `i18n-strings-and-catalogs` - the texts, keys, plurals and the `t()` API.
- `toybox-design-system` - type roles, faces and line heights per script.
- `toybox-visual-parity` - comparing RTL screens with their design screenshots.
- `board-rendering-skia` - `BoardLayout` mirroring and Skia paragraphs on boards.
- `settings-and-preferences` - the Language and Numbers rows.
- `accessibility` - text scaling and VoiceOver order in RTL.
