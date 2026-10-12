# Layout direction: the switch, the reload and the guard

How the app decides between left-to-right (en, de) and right-to-left (fa, ckb), and how it changes direction safely. The code is in `templates/shell-i18n/direction*.ts`, `templates/shell-save/` and `templates/shell-app/start-shell.ts`.

## Contents

- Facts the design rests on
- The modules
- start-shell.ts: the order of work
- The three flows
- Navigation follows the layout
- Roots outside the navigator
- expo-localization
- What is verified and what is not
- Android

## Facts the design rests on

Verified on 2026-09-26 in a Release build on an English iOS 26.5 simulator (Expo SDK 57, React Native 0.86.3):

- **`I18nManager.isRTL` is a constant for the whole JS run.** React Native computes it once when the module loads. Changing direction needs `I18nManager.allowRTL(rtl)` **and** `I18nManager.forceRTL(rtl)`, then a JS reload.
- **`reloadAppAsync()` from `expo` is enough on iOS.** After `allowRTL(true) + forceRTL(true) + reloadAppAsync()`, `isRTL` was true, a `flexDirection: 'row'` strip with `marginStart` mirrored, and the forced RTL persisted across relaunch and reinstall.
- **Reloading during bundle evaluation crashes a Release build** ("startSurface failed. Global was not installed"). Reloading from a **mounted component** (the startup splash's effect, or a button handler) worked for both flips.
- **Module-level code runs once before the reload**, so anything that writes the save at import time writes it twice. The direction check therefore runs before any save write.
- `allowRTL(false)` is what keeps an English UI left-to-right on a Persian phone; both calls are always made.
- `expo-updates` is banned (no network), so it is never the reload mechanism.

## The modules

| File | Job |
|---|---|
| `packages/shell/src/i18n/direction.ts` | The **only** module that touches `I18nManager`: `readLayoutDirection()`, `forceLayoutDirection(d)`, `restartForDirection(d, guard)` (writes the guard, forces, reloads). ESLint exempts only this file. |
| `packages/shell/src/i18n/direction-plan.ts` | Pure `planDirection({ language, layout, pendingRestart })` -> `'keep' | 'restart' | 'give-up'`, and `languageFromRawSave(raw)` (reads `settings.language` from an unvalidated save; tolerates garbage). |
| `packages/shell/src/i18n/direction-guard.ts` | The `DirectionGuard` port: `readPending()`, `writePending(direction | null)`. |
| `packages/shell/src/services/save/sqlite-kv-direction-guard-adapter.ts` | The guard on `expo-sqlite/kv-store` (key `shell.pending-direction-restart`), a separate small database, so the save document is not touched before the check. Sync API: safe before the first render. Tested in `test/integration/save/sqlite-kv-direction-guard-adapter.test.ts`: the real kv-store code runs its SQL on node:sqlite (only expo-sqlite's native `openDatabaseSync` is replaced), including a simulated JS reload with `jest.isolateModules`. |
| `packages/shell/src/i18n/direction-context.tsx` | `DirectionProvider` / `useDirection()`. The root passes `readLayoutDirection()`; tests pass `'rtl'` explicitly. |

`planDirection`:

- desired direction (from the language) equals the current layout -> `keep`;
- we already reloaded for this direction and it still does not match -> `give-up` (never a crash loop: continue in the current layout and log `direction-restart-failed` to the error log, visible in the debug menu);
- otherwise -> `restart`.

This also repairs drift, for example after a device restore brought back an old `forceRTL` value.

## start-shell.ts: the order of work

1. `import '@e07/shell/i18n/intl-polyfills.ts';` is the first import (Hermes needs the polyfills before anything else). The comment lines above it include `// device-only: covered by every simulator launch and the RTL flow ...`: the entry registers a root component, so Jest cannot run it, and the test and coverage gates honour that marker; every module it calls has its own test.
2. No module-level side effects: no database open, no store hydration, no save write, not even the cold-start mark. A direction reload re-runs every module, so work at import time would happen twice.
3. `startShell(game)`: first `readParityLaunch()` (toybox-visual-parity's `app/parity-startup.tsx`; `{ kind: 'normal' }` in store builds and normal launches), then, right after it, `markJsEntry()`: the cold-start clock's JS entry mark (`app/perf/cold-start.ts`, a pure in-memory timestamp kept once per runtime, so a direction reload marks its new runtime again and nothing is written). A malformed `-parity` request registers only its error view and stops. Then create the guard, resolve the language with a **read-only peek** of the save (`peekCurrentSave()`, which never validates, migrates or writes; a parity frame uses its request's `lang` instead), read the pending marker, `planDirection(...)`.

**When the entry and its imports land.** A file lands at Shell step 6 only if it and its test need nothing from step 7. So step 6 has `direction.ts`, `direction-plan.ts`, `direction-guard.ts`, `languages.ts`, `digits.ts`, `bidi.ts`, `fonts.ts`, `create-number-formatter.ts` and the guard adapter, each with its test: they import only each other, React Native, `expo` and `expo-sqlite`. `direction-context.tsx`, `language-context.tsx` (with i18n-strings-and-catalogs' provider and contexts, which import it) and `BoardDirectionView` (with `board-direction-view.test.tsx`) wait for **Shell step 7**: the board wrapper's test renders through `renderWithShell`, which needs the Toybox theme, and `direction-context.tsx` has no test of its own (the step-7 tests cover it), so either one at step 6 breaks `tsc` or leaves the coverage gate red (verified on 2026-10-01 on a Shell built step by step: with these, the i18n providers and contexts and `route-guards.ts` at step 7, step 6 passes `tsc`, ESLint, Prettier and `test:coverage` (151 suites, functions 94.65 %), and `check-rtl` and `check-navigation` print their not-yet-due SKIP lines; with them at step 6 the functions coverage was 89.8 % against the 90 % gate). `check-rtl` rule `direction-files` prints `SKIP packages/shell/src/game-host/board-direction-view.tsx [direction-files] due at Shell step 7: packages/shell/src/app/start-shell.ts not yet created` until the entry exists, then requires all three. `start-shell.ts` lands at **Shell step 7**, together with what it imports: the composition root (`createShellApp`, game-host-integration), the startup splash (`createStartupSplash`, toybox-screens) and the JS half of the cold-start layer `app/perf/` (performance-budgets: `cold-start.ts`, `perf-log.ts`, `use-cold-start-mark.ts` and the other `app/perf/*.ts` files with their tests). `use-localized-text-style.ts` also waits for step 7, because it imports the Toybox theme's `type-styles.ts`. The native half of the perf layer (the process-start module, its podspec and module config) follows at Shell step 8 with the native rebuild; `markJsEntry()` itself is pure JS, so the entry calls it from step 7 on, and `check-rtl`'s `cold-start-mark` rule is strict from the moment `app/perf/cold-start.ts` exists. The parity harness (`app/parity-startup.tsx`, toybox-visual-parity) arrives when it is set up, before the first screen is compared with its design (Shell step 9 at the latest). Until it exists, leave out its import and its lines (every launch is a normal one, and `markJsEntry()` is the first statement of `startShell`); the step that installs it puts them back exactly as the template has them.
4. `restart` -> `registerRootComponent(createStartupSplash({ game, language, restart }))` (`packages/shell/src/app/create-startup-splash.tsx`, the toybox-screens skill's S1 restart root: it draws the splash from the game module with its own i18n, theme and `DirectionProvider direction={directionOf(language)}`, since no save, stores or game host exist yet), whose mount effect calls `restart` = `restartForDirection(directionOf(language), guard)`. The player sees at most one extra splash frame; no dialog at startup.
5. `keep` / `give-up` -> clear the marker, then `registerRootComponent(createShellApp({ game, language, directionPlan }))`; a parity frame adds `launch: parityLaunchFor({ request, game })` (its fixture data, stand-in ports, first route and root contexts, which the composition root applies), and the S1 frame keeps the splash up instead (`isHeldParitySplash`, a restart that never runs), registered wrapped in the parity root, `registerRootComponent(withParityRoot(parity.request, createStartupSplash({ game, language, restart: holdSplash })))`, because the splash sits outside the Shell root and the capture's hierarchy must still carry the launch's marker. Only now does the app hydrate the save.

Each game's `apps/<game>/index.ts` is three lines of code: import `startShell`, import the game module, `startShell(game)`.

## The three flows

| When | What happens |
|---|---|
| **Every startup** | `startShell` -> `planDirection`. `keep`: clear the marker, render. `restart`: the splash restarts once it is mounted. `give-up`: clear the marker, render in the current layout, log the failure. |
| **S2, first-run language choice** | Tapping a language previews it at once (text, including "Continue", switches). **Continue** saves `settings.language` and `firstRun.languageChosen` together; if `planDirection` says `restart`, it awaits `audio.dispose()` and calls `restartForDirection` (the Continue tap is the one tap). Until the reload the Shell's unsaved `restart` store keeps S2 on screen (the tutorial never mounts in the old direction), and S2 saves no other language meanwhile. A reload that fails keeps S2 on screen too (`fail()`, logged): Continue tries again, and a language of the current direction lets go (`cancel()`) and goes on. After the reload the first-run flow sees `languageChosen && !tutorialDone` and opens the tutorial. |
| **Settings -> Language** | Selecting a language saves it and switches the text at once. If its direction differs from `readLayoutDirection()`, show the S14 dialog (`settings.language.restart.title` / `.body`: "Restart to apply" / "The layout direction changes after a quick restart. Your progress is saved.") with **Restart** (primary) and **Later**. Restart awaits `audio.dispose()`, then `restartForDirection`. Later keeps the current layout until the next cold start, where the startup check fixes it. |

Always write the save **before** `restartForDirection` (synchronous SQLite writes are complete when they return), and call it only from a mounted component's handler or effect. After the Shell has started, every reload (S2 Continue, the S14 Restart, the test-only debug link's `lang=`) goes through `restartAfterAudio({ audio, guard, onDisposeError }, direction)` in `packages/shell/src/app/restart-after-audio.ts` (`templates/shell-app/`, Shell step 7 with its test), the one place that awaits `audio.dispose()` before `restartForDirection`. A dispose that fails goes to `onDisposeError` (the error log) and the reload still runs: the save already holds the new language, so skipping the reload would leave the layout in the old direction until the next cold start. Only the boot's restart, which runs before any audio exists, calls `restartForDirection` itself.

A launch that flips direction is slower by design; performance runs label those launches and leave them out of the cold-start budget.

## Navigation follows the layout

`<Navigation direction={readLayoutDirection()} … />` (React Navigation 7 static API) and `DirectionProvider direction={readLayoutDirection()}` both take the **layout** direction, never the language setting. Between a language change and the restart, text is already in the new language but the layout is not; navigation and layout must agree. Page transitions then slide in the reading direction (fades when reduce motion is on).

## Roots outside the navigator

Every root that renders text outside the navigator sets the direction of its own language: `<DirectionProvider direction={directionOf(language)}>` around everything it draws. Today that is `createStartupSplash` (`app/create-startup-splash.tsx`), which is both the restart splash (registered while the layout flips) and the held S1 parity splash. The Shell root follows the layout (`readLayoutDirection()`), because between a language change and the restart the layout has not flipped yet; a splash root has no such gap, since it is drawn for the language it restarts into.

Why: the restart splash had `I18nProvider` and the theme but no `DirectionProvider`, so `useLocalizedTextStyle` wrote the Persian tagline with `writingDirection: 'ltr'`, and its full stop stood at the right end of the second line (the S1 fa parity capture moved the ink by 3.6 pt; the ink box was identical). `check-rtl` rule `root-direction-provider` fails a startup splash without it.

## expo-localization

The plugin entry is `['expo-localization', { supportedLocales: { ios: LOCALES, android: LOCALES } }]` with `LOCALES = ['en', 'de', 'fa', 'ckb']`, and nothing else. `supportsRTL` / `forcesRTL` re-derive the direction from the device language at every launch (read in the 57.0.2 source) and would undo an in-app Persian choice on an English phone. `check-rtl.mjs` fails on either flag.

## What is verified and what is not

- Verified (iOS 26.5 simulator, Release): the reload flow from a mounted component, persistence of `forceRTL` across relaunch and reinstall, the crash when reloading during bundle evaluation, `-AppleLanguages "(ckb)"` giving `getLocales()[0].languageTag === 'ckb'`.
- Verified for Android in Jest (2026-10-12, `jest-expo/android`, `direction.android.test.ts`): the same `restartForDirection` writes the guard, then calls `allowRTL` and `forceRTL` on the Android `I18nManager`, then reloads once; a reload that leaves the layout unchanged gives up. Read in the React Native 0.86.3 source: Android's `I18nUtil.isRTL` is `applicationHasRtlSupport && (forceRTL || (allowRTL && device RTL))`, and the two flags live in the app's preferences (`com.facebook.react.modules.i18nmanager.I18nUtil`), written with `apply()`, so the reload's new React instance reads them back.
- Not yet verified on an Android device: the flip on the emulator (Android step 7's `03-language-switch` flow) and Vazirmatn drawn from the first frame (Android step 5's screenshots); how iOS reports Sorani from the real Settings language list (`ckb` vs `ku-Arab`; both are handled by `resolveLanguage`).

## Android

The direction switch is the same code on Android; four facts keep it working there.

- **`android:supportsRtl="true"` must stay in the manifest.** Android's `I18nUtil.isRTL` returns false whenever the application lacks `FLAG_SUPPORTS_RTL`, whatever `forceRTL` says, so a config that turns it off leaves Persian and Sorani left-to-right after the restart. The Expo template's manifest sets it true and `android/` is generated by prebuild; `check-rtl` rule `android-supports-rtl` fails an app config, the Shell config or a Shell config plugin that sets it to false.
- **`forceRTL` plus `reloadAppAsync`, once, after the save.** Exactly the iOS order: the language is saved (synchronous SQLite), the guard is written, `allowRTL` and `forceRTL` are set (both, also `false` for English on a Persian phone), then one `reloadAppAsync` from a mounted component. The guard turns a reload that did not flip into `give-up`, never a loop. expo-localization's Android plugin adds `locale|layoutDirection` to the activity's `configChanges`, so a change of the phone's language does not recreate the activity; the app's own choice still needs the reload.
- **Persian digits on Hermes.** Hermes on Android, like on iOS, ignores the `-u-nu-` digit choice natively; the same forced `@formatjs/intl-numberformat` polyfill (the first import of `start-shell.ts`) formats `۱۲۳` there. The `unit-android` project loads the same polyfills, and Android step 5's screenshots are the device proof.
- **Vazirmatn by file name.** Android resolves `fontFamily` by the font file's name in the APK's assets (the `expo-font` plugin copies `assets/fonts/*.ttf`), not by the PostScript name. The families are the file base names (`Vazirmatn-Regular`, `Vazirmatn-Bold`, `LilitaOne`, `Rubik-Regular`, `Rubik-Bold`), so one string works on both platforms; never add `fontWeight` to a custom family (Android then looks for a `<family>_bold` file, finds none and fakes the weight on the regular face).
