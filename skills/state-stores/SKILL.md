---
name: state-stores
description: Builds and checks Zustand stores - factories, pure reducers, persist-then-publish, useShallow selectors, updateAndPublish, the GameSession reducer. Use when adding a store, action, selector or undo/continue logic, or on Maximum update depth. Not for the save file (save-persistence-and-migrations).
---

# State stores

App state lives in four thin Zustand 5 stores over pure reducers, created from the loaded save document; a run lives in a pure `GameSession` changed by one reducer. Every change is reduced, saved, then published, and two scripts prove it.

## Rules that must hold

1. **One store per domain (settings, progress, stats, premium), made by a `create<Domain>Store(save)` factory and created once in `createShellStores(save)`.** No module-level stores and no `create` from `zustand`: tests need fresh stores per test, and a direction reload re-runs module code.
2. **Every `dispatch` reduces, persists, then publishes:** `next = reducer(get(), action)`; if the reducer can return the same object (a refused or no-op action), stop there; `save.update(recipe)` with only this store's sections; then `set(...)`. The screen never shows a value that is not on disk, and a failed write publishes nothing.
3. **All logic sits in pure reducers with imperative kebab-case actions** (`set-theme`, `record-level-result`, `use-free-hint`, `reset-statistics`). Reducers import no runtime code, never mutate, never read `Date` or randomness; "today" arrives in the action. Pure reducers are tested without React and replay the same everywhere.
4. **A selector returns a primitive or a reference already in the state. One that builds an object or array is wrapped in `useShallow` from `zustand/shallow`; no store hook is called without a selector.** In Zustand 5 a new reference per call loops ("Maximum update depth exceeded"), and the v4 equality argument is gone.
5. **A write that spans sections (run end, "Reset all progress", debug import) is ONE `updateAndPublish(save, stores, { recipe, refreshBackup: true })`: one validated `save.update`, then every section store re-reads the document.** Several dispatches would be several transactions (a kill between them leaves stars without statistics), and a bare `save.update` leaves the stores showing old numbers until a restart.
6. **A run is a `GameSession` changed only by `gameSessionReducer`, in a per-run store whose persist callback runs before publish.** The board animates only what is already saved, so a kill mid-animation loses nothing.
7. **The save document is the only persistence.** No `zustand/middleware` persist, AsyncStorage or MMKV; stores and the game host never import SQLite or the save store, they call `save.update`. One document means one version number and tested migrations.
8. **Every reducer has a test file next to it, and every persisting store a thin persist-before-publish test.** The rules of the product (best result kept, one free hint a day, one continue per run) are only safe while a test pins them.

## Workflow

1. Read [references/store-pattern.md](references/store-pattern.md): the domains table, the pattern, action names, selectors, cross-section writes, tests and every checker rule. Read [references/game-session.md](references/game-session.md) before touching a run, undo, continue, hints or the saved run.
2. Check the prerequisites in the app repo: the save layer (`SaveService`, `createFakeSaveStore`, `planLoad`, the schema in `services/save/`), `ClockPort` (`services/clock/clock-port.ts` with `nowMs`, `today` and `msUntilNextLocalDay`; `TEST_CLOCK` in `testing/create-test-save.ts` implements all three) and the Premium store (`stores/premium/premium-store.ts`). If the save layer or the clock port is missing, build it first (save-persistence-and-migrations ships both); the stores are hydrated from `save.doc()`.
3. New Shell: first install Zustand into the Shell package, exactly this pinned line from the repo root (the dependency policy's plan for `zustand`; the repo's `.npmrc` sets `save-exact=true`, so npm writes the exact version):

   ```sh
   npm install zustand@5.0.15 -w packages/shell
   ```

   Every store template imports `zustand`, so without it `tsc` fails with `TS2307: Cannot find module 'zustand'`. Then copy `templates/packages/shell/src/` into `packages/shell/src/` (stores, `app/stores-context.tsx`, game host, testing helpers). The settings files are the same files the settings work uses; keep them identical. Wire `createShellStores(hydrated.save)` into the composition root and `<StoresProvider>`.
4. New action: write the failing reducer test first (one example per action, a fast-check property for ranges and idempotence), add the union member and the reducer case, and name it by rule 3. The store's `dispatch` stays generic.
5. New read in a component or hook: pick or add a selector in `<domain>-selectors.ts`; a value built per call goes through `useShallow` (see [examples/use-display-settings.ts](examples/use-display-settings.ts) and [examples/use-hint-button.ts](examples/use-hint-button.ts)).
6. Cross-section change: compose the pure section functions in one recipe and call `updateAndPublish(save, stores, { recipe, refreshBackup: true })`.
7. Run logic: copy the `game-host/` templates, create the run store with `createRunWriter(save, game.persistence)` as its persist callback, restore a saved run with `restoreRun` (it comes back paused), and add the game's two property tests (undo k moves; replay reproduces the snapshot). The run end is not a run-store write: the composition root gives the game host `writeRunEnd: (write) => updateAndPublish(save, stores, write)` (rule 5; the game-host-integration skill wires it).
8. Run the tests: `npx jest packages/shell/src/stores packages/shell/src/game-host --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/stores/**/*.ts' --coverageThreshold='{}'` (paths first; only `npm run test:coverage` judges the thresholds) and `npx tsc -p packages/shell --noEmit`.
9. Run the checks from the repo root: `node ${CLAUDE_SKILL_DIR}/scripts/check-reducers.mjs .` and `node ${CLAUDE_SKILL_DIR}/scripts/check-stores.mjs .`. Fix every `FAIL` line (each names file, rule and fix) and rerun until both print `RESULT: PASS`.

## Definition of done

- [ ] `ShellStores` holds settings, progress, stats and premium; only `createShellStores` calls the domain factories.
- [ ] Each `dispatch` writes only its own sections through `save.update`, then calls `set`; a reducer that returns the same object (refused action) causes no write.
- [ ] Every action name is an imperative kebab-case verb; time is passed in actions.
- [ ] Every selector call returns a primitive or state reference, or goes through `useShallow`.
- [ ] Run end and "Reset all progress" use one `updateAndPublish` write with the backup refreshed, never a bare `save.update`.
- [ ] Reducer, store, session, saved-run and run-writer tests pass, and `tsc` is clean.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-reducers.mjs .` prints `RESULT: PASS`
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-stores.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **`export const useThing = create(...)`.** A singleton hook-store shares state across tests and app starts; write a factory and add it to `createShellStores`.
- **`set(next)` and then `save.update(...)`, or a `setTimeout` "debounced save".** The screen then shows unsaved data, and a kill loses it; persist first, synchronously.
- **`useProgressStore((s) => ({ stars: s.x, best: s.y }))`.** A new object every render loops forever in Zustand 5; wrap it in `useShallow` or select two primitives.
- **`useSettingsStore()` to "get everything".** It re-renders on every change; select what the component shows.
- **Recording a finished run with three dispatches (progress, stats, daily), or with `save.update(applyRunEnd…)` alone.** Use one `updateAndPublish` recipe so the result screen appears only after everything is on disk and every store shows it.
- **`Date.now()` or `new Date()` in a reducer.** Pass `today` from `ClockPort` in the action; reducers must replay identically.
- **Event-style action names (`hint-used`, `themeChanged`).** Name the command: `use-hint`, `set-theme`.
- **Mutating `past` or `log` with `push`.** Spread into new arrays; `check-reducers` freezes the input to catch it.
- **Keeping undo history on disk.** Save the move log and snapshot; rebuild `past` by replay on restore.
- **A bare `npm install zustand` (or `@latest`, or a caret range).** It floats to whatever is newest, can be younger than the 7-day release age, and breaks the one-version pin; run exactly `npm install zustand@5.0.15 -w packages/shell` from the repo root.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/store-pattern.md](references/store-pattern.md) | Domains, the reduce-persist-publish pattern, actions, reducers, cross-section writes, selectors and useShallow, Premium store, tests, checker rules | Workflow step 1, and on any store change |
| [references/game-session.md](references/game-session.md) | GameSession types, what each action does, run store, when the run is written, saved run restore, game property tests | Workflow steps 1 and 7 |
| `templates/packages/shell/src/stores/` | `settings-*`, `progress-*`, `stats-*` reducers, selectors, stores and tests; `create-shell-stores.ts`; `update-and-publish.ts` (+ test) | Workflow steps 3 to 6 |
| `templates/packages/shell/src/app/stores-context.tsx` | `ShellStores`, `StoresProvider`, `useStores` | Workflow step 3 |
| `templates/packages/shell/src/game-host/` | Session types, reducer, per-run store, saved run, run writer, and their tests | Workflow step 7 |
| `templates/packages/shell/src/testing/` | `create-test-save.ts` (boot-like in-memory save) and `counter-game.ts` (tiny rules for session tests) | Workflow steps 4 and 7 |
| [examples/use-display-settings.ts](examples/use-display-settings.ts) | A hook with one primitive selector and one `useShallow` object selector | Workflow step 5 |
| [examples/use-hint-button.ts](examples/use-hint-button.ts) | A hook reading three stores and dispatching only from a handler | Workflow step 5 |
| `scripts/check-stores.mjs` | Static checker: factories, persist order, purity, action names, selectors, useShallow, second persistence, SQLite bypass, cross-section writes | Workflow step 9, and at the end |
| `scripts/check-reducers.mjs` | Runs the app's settings, progress and session reducers against their rules | Workflow step 9, and at the end |
| `scripts/lib/source-scan.mjs` | Call and selector scanning helpers for check-stores | Never by hand |
| `scripts/lib/app-modules.mjs` | Imports the app's TypeScript modules (Node type stripping, `@e07/*` resolution) | Never by hand |
| `scripts/lib/fixture-tree.mjs` | Builds the self-test trees (templates plus one planted bug) | Never by hand |
| `scripts/selftest.mjs` | Proves both checkers pass the templates and catch every planted bug | After changing a checker or a template |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in (`check-lib.mjs` and the six `settings-*` store files, synced from the library and identical to settings-and-preferences' copies: edit them there, never here) | When adding a shared file |
| `tests/fixtures/` | Planted-bug overlays (`bad-*/` with `EXPECT.txt`) for both checkers | When adding a checker rule |

## Related skills

- `save-persistence-and-migrations` - the SaveService, document schema and SQLite the stores write through.
- `settings-and-preferences` - the settings fields, S11 rows and the effect of each setting.
- `daily-and-statistics` - the daily and statistics maths and the run-end recipe.
- `game-host-integration` - mounting a game, HUD, pause and result flow around the run store.
- `premium-purchase` - the Premium store and its service.
- `react-components-and-hooks` - component rules for the hooks that read stores.
- `tdd-workflow` - the test-first loop for every reducer change.
