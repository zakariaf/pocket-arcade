# File and folder names

How every kind of file is named, from pure modules to Maestro flows, and the fixed names that tools own. Read this before creating any file or folder. Where a file lives (which workspace and folder) is the architecture-and-boundaries skill's job; this page owns only the names.

## Contents

- The rule of thumb
- Patterns by kind of file
- Ports, adapters and fakes
- Tests, goldens, sims and fixtures
- Catalogs, levels, flows, plugins, tooling
- Tool-owned names
- The path header

## The rule of thumb

The path answers "what is this?" and "who owns it?". The canonical layout fixes the top of every path (`packages/game-kit`, `packages/shell`, `packages/tooling`, `apps/<game-id>`); below it, names are kebab-case nouns or verb phrases. Every dot-separated part of a file name is kebab-case: `save-v1.full.json`, `app.config.ts`, `daily-seed.golden.test.ts`.

## Patterns by kind of file

| Kind of file | Pattern | Example | Main export |
|---|---|---|---|
| Pure logic module | `<verb>-<noun>.ts` or `<noun>.ts` | `apply-move.ts`, `sfc32.ts`, `board-layout.ts` | named after the file (`applyMove`) |
| Component | `<noun>.tsx` | `level-tile.tsx`, `top-bar.tsx` | `LevelTile` + `LevelTileProps` |
| Screen | `screens/<screen>/<screen>-screen.tsx` | `screens/home/home-screen.tsx` | `HomeScreen` |
| Nested screen | `screens/<parent>/<screen>/<screen>-screen.tsx` | `screens/settings/language/language-screen.tsx` | `LanguageScreen` or, after the route, `SettingsLanguageScreen` |
| Screen model hook | `use-<screen>-model.ts` next to the screen | `screens/home/use-home-model.ts` | `useHomeModel` |
| Hook | `use-<noun-or-verb>.ts` | `use-board-gestures.ts` | `useBoardGestures` (one hook per file) |
| Store / reducer / selectors | `<domain>-store.ts`, `<domain>-reducer.ts`, `<domain>-selectors.ts` | `premium-store.ts` | `usePremiumStore`, `premiumReducer`, `select…` |
| Pure domain model | `<domain>-model.ts` | `daily-model.ts` | the model functions |
| Port type | `<port>-port.ts` (or the canonical name kebab-cased) | `ads-port.ts`, `save-store.ts`, `sql-driver.ts` | `AdsPort`, `SaveStore`, `SqlDriver` |
| Adapter | `<vendor>-<port>-adapter.ts` | `admob-ads-adapter.ts` | `createAdmobAdsAdapter` |
| Fake | `fake-<port>.ts` | `fake-purchase.ts`, `fake-save-store.ts` | `createFakePurchase`, `createFakeSaveStore` |
| Ambient declarations | `<topic>.d.ts` | `app-env.d.ts`, `react-navigation.d.ts` | none |
| Game type bag (for the Shell) | `apps/<game-id>/src/<game-id>-types.ts` | `src/line-siege-types.ts` | `LineSiegeTypes` (the `ShellGameTypes` bag) |
| Game engine types | `apps/<game-id>/src/rules/<game-id>-types.ts` | `src/rules/line-siege-types.ts` | `LineSiegeState`, `LineSiegeMove`, `LineSiegeEvent`, `LineSiegeResult` |
| Catalog | `<language>.json` | `src/i18n/ckb.json` | — |
| Level table | `pack-<n>.json` | `src/levels/pack-1.json` | — |
| Maestro flow | `e2e/flows/<area>/<nn>-<name>.yaml` | `packages/shell/e2e/flows/smoke/01-first-launch.yaml`, `apps/line-siege/e2e/flows/smoke/10-level-1.yaml` | — |
| Maestro sub-flow | `packages/shell/e2e/subflows/<name>.yaml` | `subflows/debug-setup.yaml` | — |
| Config plugin | `with-<capability>.ts` | `plugins/with-storekit-test.ts` | default export `withStorekitTest` |
| Tooling script | `<verb>-<noun>.ts` in `packages/tooling/src/<area>/` | `git/check-commit-message.ts`, `deps/audit-licenses.ts` | the pure function it wraps |

`check-file-names.mjs` checks the main export (`export-name`) for hooks, screens, `ui/` and `screens/` components, adapters, `*-save-store.ts` and `*-sql-driver.ts` implementations, fakes, ports, store hooks in `stores/`, reducers and config plugins. Two spellings are also accepted: a component in a nested screen folder may carry its parent route (`screens/settings/language/language-view.tsx` → `LanguageView` or `SettingsLanguageView`, after the route `SettingsLanguage`), and a `.tsx` module whose main export is a JSX helper function uses the camelCase file name (`ui/picture-path.tsx` → `picturePath`).

## Ports, adapters and fakes

A port's kebab name is its canonical type name without the `Port` suffix: `AdsPort` → `ads`, `PurchasePort` → `purchase`, `ErrorLogPort` → `error-log`. `SaveStore` and `SqlDriver` keep their role noun: `save-store`, `sql-driver`. That gives, for example:

```
packages/shell/src/services/
  ads/            ads-port.ts  admob-ads-adapter.ts  fake-ads.ts  ad-policy.ts  ad-policy.test.ts
  purchase/       purchase-port.ts  expo-iap-purchase-adapter.ts  fake-purchase.ts
  save/           save-store.ts  sql-driver.ts  sqlite-save-store.ts  expo-sqlite-sql-driver.ts  fake-save-store.ts
  clock/          clock-port.ts  system-clock-adapter.ts  fake-clock.ts
  error-log/      error-log-port.ts  fake-error-log.ts
```

- The adapter's factory is `create` + the PascalCase file name: `createAdmobAdsAdapter`, `createSqliteSaveStore`, `createFakePurchase`.
- A type ending in `Port` lives in its own `<port>-port.ts` (`port-file`); one port per file.
- Our own test doubles are in-memory fakes named `fake-<port>.ts`, never `*.mock.ts`, `mock-*.ts` or `*-mock.ts` (`fake-file`). Root `__mocks__/<package-name>.ts` exists only for vendor SDKs that crash when imported in Jest, and mirrors that package's names.

## Tests, goldens, sims and fixtures

| Kind | File | Runs in |
|---|---|---|
| Unit / component | `<unit>.test.ts(x)` next to the unit | `npm test` (Jest project `unit`) |
| Data golden | `<unit>.golden.test.ts` | `npm run test:golden` |
| Bot / balance simulation | `<unit>.sim.test.ts` | `npm run test:sim` (not pre-commit) |
| Performance | `<unit>.perf.test.ts` | `npm test` |
| Integration (needs Node APIs) | `test/integration/<area>/<name>.test.ts` (repo root) | `npm test` |
| Frozen save fixture | `fixtures/save-v<N>[.<case>].json` next to the migration tests (`save-v1.full.json`) | gated (`Gate-Change:`) |

No `.spec` files and no `__tests__/` folders (`test-file`). Fixture builders inside tests are `make<Thing>()` (`makeLineSiegeState({ score: 10 })`).

## Catalogs, levels, flows, plugins, tooling

- Catalogs are one flat JSON file per language code: `en.json`, `de.json`, `fa.json`, `ckb.json`, in `packages/shell/src/i18n/catalogs/` (Shell) and `apps/<game-id>/src/i18n/` (game) (`catalog-file`).
- Level tables are `apps/<game-id>/src/levels/pack-<n>.json` (`level-file`).
- Maestro flows are `e2e/flows/<area>/<nn>-<name>.yaml`, two-digit order first, always inside an area folder (`smoke`, `journeys`, `rtl`, `a11y`, ...) because the runner lists `flows/<area>/*.yaml` (`flow-file`). Shell journeys every game runs live in `packages/shell/e2e/flows/` and use `01`-`09`; a game's own flows live in `apps/<game-id>/e2e/flows/` and start at `10` (`10-level-1.yaml`). Shared sub-flows live in `packages/shell/e2e/subflows/<name>.yaml` (kebab-case, no number) and are never run on their own; Maestro would run a sub-flow placed under `flows/`.
- Local Expo config plugins are `packages/shell/plugins/with-<capability>.ts` and default-export `with<Capability>` (`plugin-file`, `export-name`).
- Tooling scripts are `<verb>-<noun>.ts` inside an area folder of `packages/tooling/src/` (`build/`, `release/`, `asc/`, `ios/`, `e2e/`, `visual/`, `audit/`, `deps/`, `quality/`, `i18n/`, `ads/`, `storekit/`, `clock/`, `git/`, `hooks/`, `save/`, `art/`, `audio/`, `scaffold/`).

## Tool-owned names

Tool-owned files keep the tool's spelling: `package.json`, `app.config.ts`, `game.config.ts`, `eslint.config.mjs`, `jest.config.js`, `jest.setup.ts`, `babel.config.js`, `metro.config.js`, `expo-module.config.json`, `__mocks__/<package-name>.ts`, Jest's `__snapshots__/` and `__image_snapshots__/`, `README.md`, `AGENTS.md`, `CLAUDE.md`. Font files keep their upstream names (`Vazirmatn-Regular.ttf`, `OFL.txt`) inside `assets/`. These sit outside the kebab checks or match kebab-case already.

## The path header

Line 1 of every `.ts`/`.tsx` file is a comment holding its repo-relative path:

```ts
// packages/shell/src/ui/app-text.tsx
```

A short note after the path on the same line is tolerated (`// packages/game-kit/src/rng/pick-at.ts — the one place that ...`), but the path comes first (`path-header`). A file-level directive such as `'worklet';` goes on line 2. Moving a file means updating its header in the same commit.
