# The app-state stores: pattern, domains, selectors, tests

How Pocket Arcade holds app state: four thin Zustand 5 stores over pure reducers, created from the loaded save document and provided through React context. `scripts/check-stores.mjs` checks the pattern in the source; `scripts/check-reducers.mjs` runs the reducers against their rules.

## Contents

- Three kinds of state, one home each
- The four domain stores
- The pattern: factory, reduce, persist, publish
- Composition: createShellStores and StoresProvider
- Action names
- Reducers
- Writes that span several stores
- Selectors and the useShallow rule
- Reading a store outside React
- The Premium store is different
- Testing a store
- What the checkers report

## Three kinds of state, one home each

| State | Lives in | Persisted | Example |
|---|---|---|---|
| Navigation | React Navigation's state (one native stack) | no; rebuilt at launch, a run in progress is reopened from the save | "Settings is on top of Home" |
| App state | four Zustand stores: settings, progress, stats, premium | yes, as sections of the one save document | theme, stars, streak, Premium |
| A run (one level, daily, endless or tutorial) | a per-run vanilla Zustand store holding a `GameSession` | yes, as the save document's `run` section | board state, undo history, move count |

The save document is the single source of truth for everything persisted. Stores are hydrated from it once at startup and write back through `SaveService.update`; nothing else touches SQLite. Zustand's `persist` middleware, AsyncStorage and MMKV are never used: a second persistence path would have its own version number and no migration.

## The four domain stores

| Store (hook) | State | Actions (`type`) | Save sections it writes |
|---|---|---|---|
| settings (`useSettingsStore`) | `settings`, `firstRun` | `set-language`, `set-digits`, `set-sound`, `set-music`, `set-vibration`, `set-theme`, `set-color-blind`, `set-reduce-motion`, `set-hints-during-play`, `finish-tutorial` | `settings`, `firstRun` |
| progress (`useProgressStore`) | `progress`, `daily`, `hints`, `upsell` | `record-level-result`, `record-endless-score`, `use-free-hint`, `record-upsell-shown` | `progress`, `daily`, `hints`, `upsell` |
| stats (`useStatsStore`) | `stats` | `reset-statistics` | `stats` |
| premium (`usePremiumStore`, files in `stores/premium/`) | the entitlement plus the S12 purchase state machine | its own actions (premium-purchase work) | `premium`, written by its service before the store publishes |

- The ads service writes its frequency history and last consent answer into the `ads` section through `SaveService.update`; it needs no React store.
- A finished run is not a store action. The run end writes level result, daily result, statistics (and ad history) in ONE `save.update` with the backup refreshed, then every section store re-reads its sections (`updateAndPublish`, below). The same goes for "Reset all progress".
- The daily and statistics maths (`recordDailyResult`, `recordFinishedRun`, `applyRunEnd`) are pure functions owned by the daily-and-statistics work; this skill only guarantees that the stores publish what they wrote.

## The pattern: factory, reduce, persist, publish

```ts
// packages/shell/src/stores/progress-store.ts (abridged; the full file is a template)
export function createProgressStore(save: SaveService): ProgressStore {
  return createStore<ProgressStoreState>()((set, get) => ({
    ...progressSliceOf(save.doc()),            // hydrated once, from the loaded document
    dispatch: (action) => {
      const current = get();
      const next = progressReducer(current, action);   // 1. reduce (pure)
      if (next === current) return;                    //    nothing changed: no write, no render
      const { progress, daily, hints, upsell } = next;
      save.update((doc) => ({ ...doc, progress, daily, hints, upsell }));  // 2. persist
      set({ progress, daily, hints, upsell });                             // 3. publish
    },
  }));
}

export function useProgressStore<TSlice>(selector: (state: ProgressStoreState) => TSlice): TSlice {
  return useStore(useStores().progress, selector);
}
```

Why each part:

- **A factory, never a module-level store.** Tests create fresh stores per test over an in-memory save; a singleton leaks state between tests and between app starts (a direction reload re-runs module code).
- **`createStore` from `zustand/vanilla` plus `useStore(store, selector)`.** Services (ads, Premium listeners) read the same stores outside React with `getState()`. `create` from `zustand` makes a hook-store singleton, so it is not used.
- **Persist before publish.** `save.update` validates and commits one SQLite transaction synchronously; when it returns, the change is on disk. Publishing second means a screen never shows a value that is not saved. If the write throws, nothing is published.
- **Write only your own sections.** Each store's recipe spreads `doc` and replaces only its sections, so two stores never overwrite each other.
- **Skip no-op writes.** A reducer returns the same object when nothing changes (a second free hint the same day, a lower endless score); the store then neither writes nor re-renders.
- **Resets refresh the backup.** Every stats action is a reset, so the stats store passes `{ refreshBackup: true }`: a later backup restore cannot bring old numbers back. Per-change settings and progress writes touch the `current` slot only.

## Composition: createShellStores and StoresProvider

```ts
// packages/shell/src/stores/create-shell-stores.ts
export function createShellStores(save: SaveService): ShellStores {
  return {
    settings: createSettingsStore(save),
    progress: createProgressStore(save),
    stats: createStatsStore(save),
    premium: createPremiumStore(save),
  };
}
```

- The composition root (`createShellApp`) calls `createShellStores(hydrated.save)` once, after the save is hydrated, and passes the result to `<StoresProvider stores={stores}>`. Test helpers (`renderWithShell`) call the same function over an in-memory save, so tests exercise the real factories.
- A domain factory (`createSettingsStore(...)`) is called nowhere else; `check-stores` reports `store-created-twice` otherwise.
- `useStores()` throws when there is no provider: a missing provider is a programmer error, never a silent default.
- `ShellStores` lists exactly the four stores; a new domain store is added here, in `createShellStores`, and in `updateAndPublish` when it holds a copy of save sections.

## Action names

- kebab-case, imperative, verb first: `set-<field>`, `toggle-<flag>`, `record-<fact>`, `use-<thing>`, `reset-<thing>`, `finish-<milestone>`, `apply-move`, `undo`, `pause`.
- Never an event name: `theme-changed`, `on-hint`, `level-completed`, `did-pause` are rejected by `check-stores` (`action-name`).
- The type is a discriminated union of readonly objects; the reducer switches over `action.type` with every case returning (the compiler's exhaustiveness plus `noImplicitReturns` catch a missing case).
- Time comes in the action (`{ type: 'use-free-hint', today }`), never from `Date` inside a reducer. `today` is a local calendar day `'YYYY-MM-DD'` from `ClockPort.today()`.

## Reducers

- Pure: no React, React Native, Zustand, Expo or service imports (types are fine), no `Date`, `Math.random` or `performance.now`. Schema defaults (`services/save/schema/`) may be imported; they are plain data.
- Never mutate: spread (`{ ...state, settings: { ...state.settings, theme } }`). `check-reducers` deep-freezes its input to prove it.
- One example test per action next to the reducer (`<name>-reducer.test.ts`), plus fast-check properties where a rule is a range or an idempotence (volume always within 0..100; `finish-tutorial` twice equals once).
- Rules the progress reducer keeps (spec 8.1, 8.5, S12):
  - `recordLevelResult` keeps the best result per level: max stars, max score, min moves (`null` = the game does not count moves), completions + 1, the first completion date kept.
  - `recordEndlessScore` keeps only the best endless score.
  - `use-free-hint` (`{ today, freePerDay }`): the game's own allowance per local day, `freePerDay` = `game.config.ts` `hints.freePerDay` as the build embeds it (`useGameExtra().hints.freePerDay`: 1 for a game with solver hints, 0 for one without, such as Line Siege). While today's allowance is used up (or is 0) the action returns the same state; a new day starts a fresh allowance. There is no allowance constant in the store: `freeHintsLeft(hints, today, freePerDay)` and `selectFreeHintsLeft(state, today, freePerDay)` take it from the config every time. Rewarded-ad hints and Premium's unlimited hints do not touch this section.
  - `record-upsell-shown`: the result-screen Premium line is recorded once per local day.
- Settings reducer rules: volumes are whole percentages clamped to 0..100; `set-language` also sets `firstRun.languageChosen`; `finish-tutorial` only sets `firstRun.tutorialDone`. The settings fields and rows themselves belong to the settings work; the store files are identical in both places.

## Writes that span several stores

```ts
// packages/shell/src/stores/update-and-publish.ts
export function updateAndPublish(save: SaveService, stores: SectionStores, write: SectionWrite): void {
  save.update(write.recipe, { refreshBackup: write.refreshBackup });   // one validated transaction
  const doc = save.doc();
  stores.settings.setState({ settings: doc.settings, firstRun: doc.firstRun });
  stores.progress.setState(progressSliceOf(doc));
  stores.stats.setState(statsSliceOf(doc));
}
```

Use it for the run end (`recipe: (doc) => applyRunEnd(doc, end, today)`, `refreshBackup: true`, before the result screen appears), "Reset all progress" (`resetAllProgress`, `refreshBackup: true`) and a debug import. Never compose such a write from several store dispatches: that would be several transactions, and a kill between them would leave stars without statistics. And never write it with a bare `save.update(...)` either: the disk would be right, but the progress, stats and settings stores would keep their old sections, so Home and S10 show stale stars and numbers until the next app start (`check-stores` reports `cross-section-write`). The game host therefore needs the `ShellStores` (or `useStores()`), not only the `SaveService`.

## Selectors and the useShallow rule

- A selector returns a primitive or a reference that already lives in the state (`state.settings.theme`, `state.progress.levels`, `state.daily`, `state.dispatch`). Those need nothing else.
- A selector that builds a new object or array on every call (`(s) => ({ a: s.x, b: s.y })`, `.map`, `.filter`, `Object.entries`, a spread) is wrapped in `useShallow`, imported from `zustand/shallow`:

```ts
const { isColorBlind, reduceMotion } = useSettingsStore(
  useShallow((state) => ({ isColorBlind: state.settings.colorBlind, reduceMotion: state.settings.reduceMotion })),
);
const pack = useProgressStore(useShallow((state) => selectPackStars(state, levels)));
```

- Why: in Zustand 5 a selector that returns a new reference each call makes `useSyncExternalStore` see a change on every render: "Maximum update depth exceeded". Zustand 4's third argument (`useStore(store, selector, shallow)`) no longer exists; `check-stores` reports it as `shallow-v4`.
- A store hook is never called without a selector (`useSettingsStore()` re-renders on every change); `check-stores` reports `selector-missing`.
- Named selectors live in `<domain>-selectors.ts`. A parameterised selector is a plain function called inside an inline selector: `useProgressStore((state) => selectFreeHintsLeft(state, today, freePerDay))` (returns a number, so no `useShallow`).
- A selector file that exports a builder (`selectPackStars` returns `{ earned, total }`) documents that it must be called through `useShallow`; `check-stores` finds every such builder and reports a call site without it.
- Destructured booleans get an `is…` name (`isColorBlind`); property names inside the document are data and keep their names (`colorBlind`).
- Derived screen data (the S9 and S10 summaries) comes from a pure `build…Summary(sections, today)` called in a hook with section-reference selectors, not from a selector that builds the model.

## Reading a store outside React

Services and the game host read with `stores.progress.getState()` and change state only through `dispatch`. They never call `setState` directly, except `updateAndPublish` after a cross-section write it has just persisted.

## The Premium store is different

The purchase service writes the `premium` section first (`persistPremium`, backup refreshed) and only then dispatches to the Premium store, which only publishes. `SaveService` enforces for every writer that Premium never turns off without an explicit revocation date (`keepPremiumUnlessRevoked`). So `check-stores` skips the persist-order check for `stores/premium/`, and the Premium reducer still needs its test file.

## Testing a store

- Build the save the way the app boots: `createTestSave()` (template `testing/create-test-save.ts`) plans a first launch over the in-memory fake store with strict validation and a throwing error log, then `readSlot('current')` decodes what is on disk.
- Persist-before-publish test: subscribe to the store, and inside the listener read the slot from disk; the listener must already see the new value.
- No-op test: dispatch an action that changes nothing and assert the slot's `writeCount` did not move.
- Selector test with React: `renderHook` inside `<StoresProvider stores={createShellStores(save)}>`; `renderHook` is async in React Native Testing Library 14 (`await renderHook(...)`).
- Store tests stay thin (persist-then-publish, backup refresh, clamping through the store); the rules live in reducer tests.

## What the checkers report

`check-stores.mjs` (static, reads the source):

| Rule | Means | Fix |
|---|---|---|
| `missing-file` | a store file of the standard layout is missing | copy it from `templates/` |
| `store-singleton` | `create` from `zustand`, or `createStore` at module level | a `create<Domain>Store(save)` factory, called in `createShellStores` |
| `store-created-twice` | a domain factory called outside `create-shell-stores.ts` (tests excepted) | use `createShellStores(save)` and `useStores()` |
| `store-persist-order` | `dispatch` never writes, or calls `set` before `save.update` | reduce, `save.update`, then `set` |
| `reducer-impure` | a reducer or selector imports runtime code or reads time or randomness | pass time in the action; import types only |
| `reducer-untested` | `x-reducer.ts` without `x-reducer.test.ts`, or a persisting store without a test | add the test next to it |
| `action-name` | an action type is not kebab-case or names an event | `set-…`, `record-…`, `use-…`, `reset-…` |
| `selector-missing` | a store hook called without a selector | pass a selector |
| `selector-new-object` | a selector builds a value without `useShallow` | wrap it, or select primitives |
| `shallow-v4` | `useStore(store, selector, equalityFn)` | `useShallow` |
| `second-persistence` | `zustand/middleware`, AsyncStorage or MMKV imported | persist through `SaveService.update` |
| `store-bypasses-save` | a store or the game host imports SQLite or the save store, or calls `store.write` | `save.update(recipe)` |
| `cross-section-write` | a `save.update` whose recipe runs `applyRunEnd` or `resetAllProgress` (or a file that does both without `updateAndPublish`) | `updateAndPublish(save, stores, { recipe, refreshBackup: true })` |

`check-reducers.mjs` imports the app's reducers (Node strips the TypeScript types) and runs them: `settings-volume`, `settings-first-run`, `progress-best`, `progress-free-hint`, `progress-upsell`, `session-move`, `session-undo`, `session-paused`, `session-continue`, `session-finished`, `reducer-mutates`, plus `missing-module` and `module-load` (a reducer that imports runtime code cannot be loaded, which is itself a purity failure).
