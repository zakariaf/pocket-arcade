---
name: settings-and-preferences
description: Builds S11 settings end to end, from saved fields and defaults to reducer actions, row visibility, row handlers and the effect of each setting (language, digits, audio, vibration, theme, reduce motion, hints). Use when adding or changing a setting or its row. Not for S11 layout (use toybox-screens).
---

# Settings and preferences

Every S11 setting is saved in one place, changed by one action, shown by one row, and applied by code outside the Settings screen, at once and without a Save button; a script proves the chain for every field.

## Rules that must hold

1. **Settings live only in the save document's `settings` section, written through the settings store.** The store reduces, calls `save.update` (sync, one transaction), then publishes; so the screen never shows a value that is not on disk. No AsyncStorage, MMKV, SecureStore or side caches.
2. **Exactly the eleven fields, with the agreed first-launch values:** `language: null` (System), `digits: 'automatic'`, sound on at 80, music off at 60, vibration on, `theme: 'system'`, colour-blind off, `reduceMotion: 'system'`, hints on. Music stays off by default so it never plays over the player's own music; System values follow the phone.
3. **One pure reducer action per change** (`set-language`, `set-digits`, `set-sound`, `set-music`, `set-vibration`, `set-theme`, `set-color-blind`, `set-reduce-motion`, `set-hints-during-play`, `finish-tutorial`). Volumes are integer percent, rounded and clamped 0..100 in the reducer.
4. **Every setting has an effect outside the Settings screen, applied immediately:** language and digits through `LocalizedRoot`, theme and colour-blind through `ThemeProvider`, reduce motion through `useReduceMotion`, sound and music through `connectAudioSettings`, vibration through the haptics adapter's `isEnabled`, hints through the game host. A setting nothing reads is a bug the player can see.
5. **Rows that do not apply are hidden, never greyed:** Music without game music, Vibration without haptics (iPad), Ad privacy choices unless privacy options are required, Remove ads for Premium owners (they see "Premium – active"). A game without music (Line Siege) is compared in visual parity against the no-music S11 and S6 variants, which the capture picks from `parity/game-facts.json`; never force the Music rows on to match the base frame.
6. **A direction flip needs the restart dialog.** Changing between LTR and RTL languages switches the text at once but the layout only after "Restart now"; the save is untouched either way.
7. **Resets never touch settings, first-run state or Premium, and each is ONE `updateAndPublish` write.** "Reset all progress" deletes levels, stars, run, daily results and statistics; "Reset statistics" only the stats section; both confirm in S14 first, then `updateAndPublish(save, stores, { recipe, refreshBackup: true })` (`settings-resets.ts`), so every section store re-reads the save. A bare `save.update` leaves Home, Levels and S10 showing old numbers until a restart.
8. **Reduce motion is read only through `useReduceMotion()`; the Settings row reads `useReduceMotionSetting()` (`app/use-reduce-motion-setting.ts`).** Reanimated's `useReducedMotion()` is a load-time constant that ignores the Shell setting. `useReduceMotion()` is also true during a parity capture (every loop holds still); the row shows the saved choice, never that freeze.
9. **Rows carry the design's testIDs** (`settings.<row>-switch|-row`, from `settings-rows.ts`), so tests and the Toybox screen agree.
10. **Every switch plays the toggle feedback once, after its dispatch.** `use-settings-model.ts` passes `onToggled: () => { playUiFeedback(services, 'toggle'); }` to `createPreferenceActions`: the `ui.toggle` sound with the selection pulse, through the ports (so "Sound off" is already silent and "Vibration off" already still). Sliders play nothing; segments and link rows tap through their press host.

## Workflow

1. Read [references/settings-model.md](references/settings-model.md): product rules, saved fields, defaults, actions, the row table and the effects table.
2. Store layer: copy `settings-reducer.ts` (+ `settings-reducer.test.ts`), `settings-selectors.ts` (+ `settings-selectors.test.ts`), `settings-store.ts` (+ `settings-store.test.ts`) to `packages/shell/src/stores/`. Write the test first when changing an action. (state-stores ships the same six files, all synced from the library, so they are byte-identical; copy them once.)
3. Rows and handlers: copy `settings-rows.ts` (+ test), `settings-preference-actions.ts` (+ test), `use-settings-model.ts` (+ test), `use-settings-context.ts` (+ test; `hasMusic` is `useGameHost().hasMusic`), `settings-resets.ts` (+ test) and `use-settings-resets.ts` to `packages/shell/src/screens/settings/`, `language-change.ts` (+ test) to `screens/settings/language/`, and `external-links.ts` (+ test: the store review page, the privacy policy page, the support mail and the licence texts; the one app file allowed to hold URLs) to `packages/shell/src/config/`. The Settings route is `const model = useSettingsModel(useSettingsContext()); const extras = useSettingsExtras();` (toybox-screens ships the extras hook). Read [references/rows-and-controls.md](references/rows-and-controls.md) for each control's behaviour, accessibility, feedback and copy keys. The S14 reset dialogs call `useSettingsResets()`'s `onConfirmResetStats` / `onConfirmResetProgress`.
4. Effects: copy `localized-root.tsx`, `connect-audio-settings.ts`, `use-reduce-motion-setting.ts`, `use-reduce-motion.ts`, `create-shell-haptics.ts` (each with its test) to `packages/shell/src/app/`, `use-hints-during-play.ts` (+ test) to `packages/shell/src/game-host/`, and `theme-provider.tsx` to `packages/shell/src/theme/` (the two reduce-motion files are the same as react-components-and-hooks ships, `theme-provider.tsx` the same as toybox-design-system's: copy once); the composition root calls `connectAudioSettings(stores.settings, audio)` and uses `createShellHaptics(stores.settings, clock)` as `services.haptics`, and the game host gates tips and nudges with `useHintsDuringPlay()` (effects table).
5. The S11 screen layout and testIDs come from the Toybox screen spec; feed it `useSettingsModel(useSettingsContext())` (the context reads `useGameHost().hasMusic` itself).
6. Adding or changing a setting: follow "Changing or adding a setting" in [references/settings-model.md](references/settings-model.md), including the schema migration and the checker's `FIELDS` table. Ask the owner first: it is a product change.
7. Run the tests (`npx jest packages/shell/src/stores packages/shell/src/screens/settings packages/shell/src/app --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/screens/settings/**/*.ts' --coverageThreshold='{}'`; paths first, because `--selectProjects` takes every following word as a project name; only `npm run test:coverage` judges the thresholds), then `node ${CLAUDE_SKILL_DIR}/scripts/check-settings.mjs .` from the repo root (a partial Shell without S11 prints `SKIP` lines for the S11 rows). Fix every `FAIL` line and rerun until it prints `RESULT: PASS`.

## Definition of done

- [ ] `SETTINGS_V<n>` holds the eleven fields; `DEFAULT_SETTINGS` holds the agreed values.
- [ ] Every settings action has a reducer case and a test; volume clamping has a property test.
- [ ] Each visible row dispatches its action; hidden rows follow `settingsGroupsFor` and its tests pass.
- [ ] Each field has its effect wired and tested (language, digits, theme, colour-blind, reduce motion, sound, music, vibration, hints).
- [ ] Choosing a language of the other direction opens "Restart to apply"; the same direction switches at once.
- [ ] Reset all progress keeps settings, first-run state and Premium; both resets are one `updateAndPublish` write each, and `settings-resets.test.ts` passes.
- [ ] Every switch plays the toggle feedback after its dispatch (`use-settings-model.test.tsx` hears `ui.toggle` and feels `selection`).
- [ ] During a parity capture the Reduce motion row still shows the saved choice (`use-settings-model.test.tsx`), while `useReduceMotion()` holds every animation still (`use-reduce-motion.test.ts`).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-settings.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **A local `useState` copy of a setting in the screen.** It drifts from the store and skips the save; read the store and dispatch.
- **A "Save" button or a delayed write.** Every change is saved at once; the store already persists before it publishes.
- **Reading `settings.reduceMotion` directly.** `'system'` must resolve against the phone's switch; use `useReduceMotion()`.
- **Passing `soundVolume` straight to the audio port.** The save keeps percent; divide by 100 (`toAudioSettings`).
- **Greying out rows that do not apply.** Hide them (Music, Vibration, Ad privacy choices), as the spec says.
- **Resetting settings with progress.** Only progress, run, daily, statistics, hints and upsell go.
- **Restarting the app for a same-direction language change.** Only a direction flip needs the restart.
- **`save.update(resetAllProgress, …)` from a dialog handler.** The disk is right but the progress and stats stores keep their old sections; use `updateAndPublish` (`check-settings` reports `reset-publish`).
- **Playing the toggle sound in the row component, or before the dispatch.** The row would sound twice (tap and toggle), and "Sound off" would still click; the handler plays it after dispatching.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/settings-model.md](references/settings-model.md) | Rules, saved fields, defaults, actions, row table, effects table, restart, resets, how to add a setting | Workflow step 1 and step 6 |
| [references/rows-and-controls.md](references/rows-and-controls.md) | Row behaviour, accessibility, S11a list, dialogs, copy keys, tests to write | Workflow step 3 |
| [templates/settings-reducer.ts](templates/settings-reducer.ts) | Pure reducer for every settings action | Workflow step 2 |
| [templates/settings-reducer.test.ts](templates/settings-reducer.test.ts) | One test per action + volume property | Workflow step 2 |
| [templates/settings-selectors.ts](templates/settings-selectors.ts) | Primitive selectors | Workflow step 2 |
| [templates/settings-selectors.test.ts](templates/settings-selectors.test.ts) | First-launch values, references, a dispatched change | Workflow step 2 |
| [templates/settings-store.ts](templates/settings-store.ts) | Reduce → save.update → set | Workflow step 2 |
| [templates/settings-store.test.ts](templates/settings-store.test.ts) | Persist-then-publish and clamping | Workflow step 2 |
| [templates/settings-rows.ts](templates/settings-rows.ts) | Groups, rows, visibility, row testIDs | Workflow step 3 |
| [templates/settings-rows.test.ts](templates/settings-rows.test.ts) | Visibility rules | Workflow step 3 |
| [templates/settings-preference-actions.ts](templates/settings-preference-actions.ts) | Row handlers (one action each) | Workflow step 3 |
| [templates/settings-preference-actions.test.ts](templates/settings-preference-actions.test.ts) | Handler tests | Workflow step 3 |
| [templates/use-settings-model.ts](templates/use-settings-model.ts) | The S11 screen's data and handlers | Workflow steps 3 and 5 |
| [templates/use-settings-model.test.tsx](templates/use-settings-model.test.tsx) | Language value, previews, live update | Workflow step 3 |
| [templates/use-settings-context.ts](templates/use-settings-context.ts) | Music (from the game host), haptics, consent and Premium facts for the rows | Workflow steps 3 and 5 |
| [templates/use-settings-context.test.tsx](templates/use-settings-context.test.tsx) | Its test: Music from the host, Vibration from haptics | Workflow step 3 |
| [templates/external-links.ts](templates/external-links.ts) | `packages/shell/src/config/external-links.ts`: the OS hand-off URLs (review page, store page for the S14 update dialog, privacy policy, support mail, licence texts) | Workflow step 3 |
| [templates/external-links.test.ts](templates/external-links.test.ts) | Its test (checks the URLs by their parts: no URL literal outside that file) | Workflow step 3 |
| [templates/settings-resets.ts](templates/settings-resets.ts) | The two resets, one `updateAndPublish` each | Workflow step 3 |
| [templates/settings-resets.test.ts](templates/settings-resets.test.ts) | Stores re-read, backup refreshed, settings and Premium kept | Workflow step 3 |
| [templates/use-settings-resets.ts](templates/use-settings-resets.ts) | The reset handlers bound to the app's save and stores (the S14 dialogs call them) | Workflow step 3 |
| [templates/language-change.ts](templates/language-change.ts) | set-language plan and restart decision | Workflow step 3 |
| [templates/language-change.test.ts](templates/language-change.test.ts) | Restart decision tests | Workflow step 3 |
| [templates/localized-root.tsx](templates/localized-root.tsx) | Language and digits effect | Workflow step 4 |
| [templates/localized-root.test.tsx](templates/localized-root.test.tsx) | Live language and digit switch | Workflow step 4 |
| [templates/connect-audio-settings.ts](templates/connect-audio-settings.ts) | Sound and music effect | Workflow step 4 |
| [templates/connect-audio-settings.test.ts](templates/connect-audio-settings.test.ts) | Audio effect tests | Workflow step 4 |
| [templates/use-reduce-motion.ts](templates/use-reduce-motion.ts) | `useReduceMotion()` for animations (frozen on during a parity capture) | Workflow step 4 |
| [templates/use-reduce-motion.test.ts](templates/use-reduce-motion.test.ts) | Its test: a capture freezes motion, the row stays as saved | Workflow step 4 |
| [templates/use-reduce-motion-setting.ts](templates/use-reduce-motion-setting.ts) | `useReduceMotionSetting()` (the Settings row's value, never frozen) and `resolveReduceMotion()` | Workflow step 4 |
| [templates/use-reduce-motion-setting.test.ts](templates/use-reduce-motion-setting.test.ts) | Resolution tests | Workflow step 4 |
| [templates/theme-provider.tsx](templates/theme-provider.tsx) | Theme and colour-blind effect | Workflow step 4 |
| [templates/create-shell-haptics.ts](templates/create-shell-haptics.ts) | Vibration effect: the haptics adapter asks the store at every pulse | Workflow step 4 |
| [templates/create-shell-haptics.test.ts](templates/create-shell-haptics.test.ts) | Vibration off stops the next pulse | Workflow step 4 |
| [templates/use-hints-during-play.ts](templates/use-hints-during-play.ts) | Hints effect: the game host's gate for tips and nudges | Workflow step 4 |
| [templates/use-hints-during-play.test.tsx](templates/use-hints-during-play.test.tsx) | Follows the setting live | Workflow step 4 |
| `scripts/check-settings.mjs` | Checker for fields, defaults, actions, rows, effects, resets (kept sections, one updateAndPublish), toggle feedback, single writer | Workflow step 7, and at the end |
| `scripts/lib/object-literal.mjs` | Helper that reads object literals | Never by hand |
| `scripts/selftest.mjs` | Proves the checker passes the good fixture and catches each planted bug | After changing the checker |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in (`check-lib.mjs` and the six settings store files, which are synced from the library: edit them there, never here) | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad Shell source trees for the self-test, and `slice/` (shell-slice.json: the S11 rules skipped outside the slice, strict inside it) | When adding a rule to the checker |

## Related skills

- `toybox-screens` - the S11, S11a and S14 layouts and their testIDs.
- `state-stores` - the store pattern and `useShallow` in general.
- `save-persistence-and-migrations` - the save document, schema versions and resets.
- `i18n-strings-and-catalogs` - catalogs, `t()` and the copy keys.
- `rtl-and-direction` - `restartForDirection` and the startup direction check.
- `game-audio-and-haptics` - the audio and haptics ports the effects drive.
- `premium-purchase` and `admob-ads` - the Premium rows and the ad privacy form.
