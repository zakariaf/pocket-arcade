# 02 · Architecture and folders

> **What this doc decides.** The shape of the one monorepo: which workspace owns what, which way dependencies may point and how lint enforces it, where every kind of file goes, and the TypeScript seams between the parts: the nine ports and the `GameModule` contract (spec section 10). It also fixes how a game app is wired (`game.config.ts` → `withShell` → `app.config.ts`, the 3-line `index.ts`), how game configuration reaches the runtime, and the recipes for adding a screen, a port or a game.
> **Binding source:** [99-final-decisions.md](99-final-decisions.md) A.5, A.8, A.9, B.11–B.16, C, D.34–D.36 and F. Problems found while writing are listed under [Open issues](#open-issues).
> **Related docs:** [01-stack-and-versions.md](01-stack-and-versions.md) (versions), [03-naming.md](03-naming.md) (names), [04-code-style-and-limits.md](04-code-style-and-limits.md) (lint zones and tsconfigs), [06-navigation-state-persistence.md](06-navigation-state-persistence.md) (stores, save, boot), [08-game-engine.md](08-game-engine.md) (engine and board types), [09-sound-haptics-art.md](09-sound-haptics-art.md) (audio, haptics, art ports), [10-i18n-and-rtl.md](10-i18n-and-rtl.md) (startShell, direction), [11-ads-admob.md](11-ads-admob.md) (ads and consent ports), [12-in-app-purchase.md](12-in-app-purchase.md) (purchase port), [14-ios-build-and-release.md](14-ios-build-and-release.md) (build variants), [16-quality-gates-hooks-ci.md](16-quality-gates-hooks-ci.md) (scripts and gates). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

---

## 1. Introduction

The repository holds one reusable framework (the Shell) and about 26 small games. Every game ships as its own app, but all of them live in one npm-workspaces monorepo and consume the Shell as TypeScript source, so a fix in the Shell reaches every game at its next release.

There are four kinds of workspace:

| Workspace | Package name | Contains | Runs in |
|---|---|---|---|
| `packages/game-kit` | `@e07/game-kit` | pure TypeScript: the `GameModule` contract, seeded PRNG, geometry, timeline, date keys, bot harness | app, Jest, Node |
| `packages/shell` | `@e07/shell` | everything the same in every game: screens S1–S15, navigation, stores, save, services, i18n, theme, game host, config composer, config plugins | app, Jest (config composer: Node) |
| `packages/tooling` | `@e07/tooling` | Node scripts: build, release, screenshots, audits, level generation, art rendering, scaffolding | Node only |
| `apps/<game-id>` | `@e07/<game-id>` | one Expo app: the game module (rules, levels, board, art, sounds, tutorial, texts) and its configuration | app, Jest |

`@e07` is a placeholder scope until the framework is named (spec D6). Renaming it is one search-and-replace over `package.json` files and imports.

Other docs own the inside of several parts; this doc owns the boundaries between them and the contract types:

| Topic | Owner |
|---|---|
| Versions, installs, upgrade policy | docs/01 |
| File and identifier names | docs/03 |
| `tsconfig` files, the complete `eslint.config.mjs`, import style, DI rules | docs/04 |
| UI components, theme (`Palette`), hooks | docs/05 |
| Navigation, stores, save document, SQLite, hydration | docs/06 |
| Jest projects, test layout | docs/07 |
| Engine functions (`GameEngine`), board (`GameBoard`), timeline, gestures, real-time loop | docs/08 |
| Audio/haptics ports, sound bank, code-drawn art (`GameArt`) | docs/09 |
| Languages, direction, `startShell` | docs/10 |
| Ads and consent ports, `ads-config.ts` | docs/11 |
| Purchase port, Premium | docs/12 |
| Network and privacy audits | docs/13 |
| Build variants (`APP_VARIANT`, `ADS_MODE`), `app-variant.ts`, `test-only.ts`, `metro.config.js`, release | docs/14 |
| npm scripts, hooks, CI, `quality-gates.json` | docs/16 |

---

## 2. Rules

1. **Keep exactly four kinds of workspace:** `packages/game-kit`, `packages/shell`, `packages/tooling` and one `apps/<game-id>` per game, declared by `"workspaces": ["apps/*", "packages/*"]` in the root `package.json`.
   *Why:* FINAL A.8; one repo lets one Shell change reach every game, and npm workspaces are first-class in Expo. **Source:** [Expo monorepos guide](https://docs.expo.dev/guides/monorepos/).
2. **Point dependencies one way only:** game-kit ← shell ← app entry files; game code (`apps/*/src`) may use game-kit and the Shell's game-facing types, and its `rules/` and `levels/` use game-kit only; tooling may import anything; nothing imports tooling; the Shell never imports an app; apps never import each other.
   *Why:* spec N5 (one Shell), FINAL A.8 zones; pure rules must run headless for bots, solvers and replays (spec 8.13). *Enforced by:* docs/04 patterns `GAME_KIT_BOUNDARY`, `SHELL_BOUNDARY`, `PURE_IMPORTS`, `NO_TOOLING`, plus the app zones of section 5.3.
3. **Consume every workspace package as TypeScript source.** Each `package.json` has `"type": "module"` (packages) and `"exports": { "./*": "./src/*" }` (the Shell also `"./plugins/*": "./plugins/*"`); there is no build step, no `dist/` and no barrel `index.ts`.
   *Why:* Metro, Jest, `tsc` and Node 26 all resolve package exports to source (verified, section 12); a build step would be one more thing to forget.
4. **Import with the file extension and never with `../`:** the same folder or below `./x.ts`, `./src/x.ts`; any other folder `@e07/<package>/<path under src>.ts(x)` (docs/04 rule 19).
   *Why:* Node type stripping (tooling, `app.config.ts`) needs extensions and ignores tsconfig `paths`. **Source:** [Node.js TypeScript](https://nodejs.org/api/typescript.html). *Enforced by:* docs/04 rule 19.
5. **List every native module as a direct dependency of every app, with identical versions; the Shell lists them as `peerDependencies`; the root `package.json` pins `react` and `react-native` with `overrides`.**
   *Why:* autolinking and `npx expo install --check` only see an app's own dependencies; and without the override npm installed React 19.3.0 at the root next to the app's 19.2.3 (verified; Jest resolves from the root). **Source:** [Expo monorepos guide](https://docs.expo.dev/guides/monorepos/) ("Duplicate React Native versions … are not supported").
6. **Put every external service behind a port type** in `packages/shell/src/services/<port>/<port>-port.ts`; only its adapter imports the vendor SDK; every port has an in-memory `fake-<port>.ts`.
   *Why:* FINAL F and D.34; Jest never touches native code, and swapping a vendor touches one file.
7. **Create adapters and stores once, in the composition root** (`packages/shell/src/app/create-shell-app.tsx`), and hand them down through `ServicesProvider` and `StoresProvider`. React Context carries dependencies only, never changing app state.
   *Why:* FINAL A.5; every test swaps real adapters for fakes without module mocks.
8. **A game talks to the Shell only through `GameModule`** (game-kit), bound by the Shell as `ShellGameModule<T>`; the Shell touches a game's own types only inside `createGameHost<T>`.
   *Why:* spec 10 ("nothing else is needed to become a full app"); TypeScript has no existential types, so one generic seam avoids casts everywhere else.
9. **Keep every per-game value in `apps/<game-id>/game.config.ts`** (typed `GameConfig`, spec 11). App code never imports it: `withShell` embeds the runtime subset as `expo.extra.game` (and docs/11's `extra.adUnits`), read by `read-game-extra.ts`.
   *Why:* one file per game (spec 2.2); real ad unit IDs reach only live builds (docs/11 rule 17).
10. **Never put `null` into `expo.extra`; omit the key instead.**
    *Why:* verified: `null` values arrived as `{}` both in `npx expo config --json` and in the embedded app config read by `expo-constants` on the simulator, which made a strict parser throw at launch.
11. **`app.config.ts` is one statement: `export default withShell(gameConfig, process.env);`.** Every native setting comes from `withShell` and config plugins; local plugins live in `packages/shell/plugins/`, are referenced by path string and default-export the plugin.
    *Why:* Continuous Native Generation (FINAL A.1); Expo applies path-referenced plugins with its own internals (a function plugin applied inside `withShell` failed: "`_internal.projectRoot` isn't defined", verified).
12. **`apps/<game-id>/index.ts` is the 3-line entry:** import `startShell`, import the module, call `startShell(module)` (docs/10).
    *Why:* FINAL A.8; the polyfills and the direction check must run before anything else, and they live in the Shell.
13. **Build variants follow docs/14:** `APP_VARIANT` (`test|store`) with `EXPO_PUBLIC_APP_VARIANT`, `ADS_MODE` (`off|test|live`); test-only code is reachable only through `packages/shell/src/app/test-only.ts` (app code, not the Node-world `src/config/`); each app's `metro.config.js` keys Metro's cache on the variant.
    *Why:* verified twice (docs/14 and this doc): without the cache key a store export made after a test export shipped the debug menu.
14. **Place every file by the table in section 10.** A new kind of file gets a row in the same commit.
    *Why:* the agent finds code by path; a predictable place is cheaper than a search.
15. **`npx expo config --json`, `npx expo install --check` and `npx expo-doctor` pass for every app** (part of `npm run verify`).
    *Why:* they catch composer bugs and version drift that `tsc` and Jest cannot see. **Source:** [Expo CLI](https://docs.expo.dev/more/expo-cli/).
16. **No module does work at import time** except `@e07/shell/i18n/intl-polyfills.ts` and pure in-memory marks such as docs/15's `markJsEntry()` (docs/10): no database open, no store creation, no native call at module level.
    *Why:* a direction reload re-runs every module; writes before it would happen twice (FINAL C.31).

---

## 3. The repository tree

Folders are canonical (FINAL A.8). Files listed are the ones other docs rely on; "(docs/NN)" marks the owner when it is not this doc.

```
<repo>/
  package.json            workspaces, overrides, scripts (names: FINAL F; commands: docs/16)
  package-lock.json  .npmrc  .nvmrc  .mise.toml          (docs/01)
  tsconfig.base.json  tsconfig.json                      (docs/04: root program = tests + Node-side config)
  eslint.config.mjs  .prettierrc.json  knip.json  lefthook.yml  quality-gates.json   (docs/04, docs/16)
  jest.config.js  jest.sim.config.js  jest.setup.ts  babel.config.js  __mocks__/     (docs/07)
  AGENTS.md  CLAUDE.md  .claude/settings.json            (docs/16)
  docs/                   these engineering docs
  test/                   Node-typed tests and helpers (docs/07): integration/<area>/, goldens/, sims/
    integration/save/     node-sqlite-sql-driver.ts  sqlite-save-store.test.ts   (docs/06)
                          save-write.perf.test.ts (docs/15)
    goldens/boards/       skia-golden.ts (docs/07)  <game-id>-board.golden.test.ts (docs/08)
    sims/<game-id>/       *.sim.test.ts bot and balance runs (docs/07)
  packages/
    game-kit/             @e07/game-kit: PURE TypeScript (no React/RN/Expo/Skia/Shell)
      src/contract/       game-module.ts game-rules.ts levels.ts teaching.ts stats.ts testing.ts
                          persistence.ts realtime.ts messages.ts game-identity.ts
                          game-engine.ts input-intent.ts (docs/08)
      src/rng/            sfc32.ts (docs/08)
      src/geom/           board-layout.ts classify-swipe.ts vec2.ts sweep.ts spatial-hash.ts (docs/08)
      src/timeline/       track.ts sample.ts particles.ts fixed-step.ts (docs/08)
      src/dates/          date-key.ts daily-seed.ts (docs/06)
      src/testing/        play-bot.ts (docs/08)  property helpers
      src/solver/         generic search helpers for game solvers
    shell/                @e07/shell: the React Native framework
      src/app-env.d.ts    EXPO_PUBLIC_* declarations (docs/04)
      src/app/            start-shell.ts (docs/10) create-shell-app.tsx hydrate-save.ts startup-splash.tsx
                          shell-app.tsx services-context.tsx stores-context.tsx read-game-extra.ts
                          use-checkpoint-on-background.ts (docs/06) shell-error-boundary.tsx (docs/05)
                          test-only.ts test-only-api.ts test-only-entry.ts (docs/14)
                          perf/ frame recorder, cold-start log, perf log (docs/15, test builds only)
      src/navigation/     root-stack.tsx navigation-root.tsx route-params.ts route-guards.ts
                          debug-route.tsx react-navigation.d.ts (docs/06)
      src/screens/<screen>/  first-run consent home game pause result levels daily stats settings
                          (+ settings/language, about, privacy, licences) premium how-to-play debug
      src/ui/             AppText, buttons, top bar, dialogs, code-drawn icons (docs/05)
      src/game-host/      shell-game-module.ts game-host.ts game-session-*.ts saved-run.ts (docs/06)
                          board-types.ts board-canvas.tsx use-board-gestures.ts use-fixed-step-loop.ts … (docs/08)
      src/art/            game-art.ts (docs/09)
      src/services/<port>/  ads consent purchase save clock connectivity audio haptics error-log
      src/stores/         settings-* progress-* stats-* daily-model.ts stats-model.ts (docs/06)
                          premium/ (docs/12: premium-state, -reducer, -transitions, -store, -view, evidence)
      src/i18n/           intl-polyfills.ts languages.ts direction.ts … catalogs/{en,de,fa,ckb}.json (docs/10)
      src/theme/          theme-types.ts tokens.ts theme-set.ts make-styles.ts (docs/05)
      src/testing/        render-with-shell.tsx flush-microtasks.ts (docs/07) test-palette.ts (docs/05)
                          find-inaccessible-pressables.ts palette-checks.ts (docs/15)
      src/config/         NODE WORLD: with-shell.ts shell-plugins.ts game-config.ts game-extra.ts
                          privacy-manifest.ts (docs/13) ads-config.ts skadnetwork-ids.ts (docs/11)
                          app-variant.ts (docs/14) external-links.ts (docs/04)
      plugins/            local Expo config plugins: with-<capability>.ts (default export)
      ios/  expo-module.config.json   the ProcessStart native module (pod E07Shell) behind the
                          cold-start log (docs/15); the only native code the apps ship
    tooling/              @e07/tooling: Node scripts (docs/16 and each topic doc)
      src/                one folder per area, CLIs included (script paths: docs/16): build/ release/ asc/
                          ios/ e2e/ visual/ audit/ deps/ quality/ i18n/ ads/ storekit/ clock/ git/ hooks/
                          save/ (inspect-save.ts, docs/06) art/ (render-art.ts) audio/ (render-sfx-wav.ts)
                          scaffold/ (new-game.ts)
      config/             export-options-{test,store}.plist (docs/14)
      network-audit/      js-baseline.json native-baseline.json (docs/13)
      scripts/            install-maestro.sh (docs/07)
      license-exceptions.json   (docs/16)
  apps/
    line-siege/           @e07/line-siege: one Expo app per game
      package.json  tsconfig.json  metro.config.js (docs/14)  .gitignore (ios/ android/ build/)
      app.config.ts       export default withShell(gameConfig, process.env)
      game.config.ts      every per-game value (spec 11)
      index.ts            3 lines: startShell(lineSiegeGame)
      src/index.ts        exports lineSiegeGame: ShellGameModule<LineSiegeTypes>
      src/line-siege-types.ts   the ShellGameTypes bag
      src/rules/          state, moves, events, create/applyMove/outcome/intentToMove   (PURE, DETERMINISTIC)
      src/levels/         pack-<n>.json (docs/03) difficulty curve solver              (PURE, DETERMINISTIC)
      src/board/          board-palettes.json/.ts to-view.ts layout-board.ts draw-board.ts build-timeline.ts
                          <game>-board.ts draw-board.test.ts (docs/08, docs/09); pixel goldens: test/goldens/boards/
      src/sim/            real-time games only (docs/08)
      src/art/            game-art.ts draw-icon.ts (docs/09)
      src/credits/        credits.json credits.test.ts: S11d rows for fonts, sounds, word lists (docs/09)
      src/sounds/         sound-bank.ts (docs/09)
      src/tutorial/       tutorial script, how-to-play pages
      src/testing/        bot policy, example states
      src/i18n/           en.json de.json fa.json ckb.json (docs/10)
      e2e/flows/  e2e/baselines/                         (docs/07)
      assets/fonts/       Vazirmatn-Regular.ttf Vazirmatn-Bold.ttf OFL.txt (docs/10; copied by the scaffold)
      assets/generated/   icon and splash PNGs rendered by render-art.ts (docs/09)
```

Generated and local-only folders (`apps/*/ios`, `apps/*/android`, `apps/*/build`, `apps/*/sfx-preview`, `tools/`, `reports/`, `dist-audit/`, `coverage/`, `.stryker-tmp/`) are gitignored; docs/16 section 4 has the complete `.gitignore`.

---

## 4. Workspace manifests

### 4.1 Root `package.json` (the parts this doc owns)

```jsonc
// package.json (root): scripts are listed in docs/16, engines follow docs/01 rule 11; overrides are owned here
{
  "name": "e07-games",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=22.18", "npm": ">=11.17.0" },
  // One React and one React Native in the whole tree. Without this, npm installed
  // react 19.3.0 at the root (pulled by a dev tool's peer) next to the app's 19.2.3.
  "overrides": { "react": "19.2.3", "react-native": "0.86.3" }
}
```

When the Expo SDK changes, the `overrides` values change in the same commit as the apps' `react` and `react-native` (docs/01 section 3.5). Check with `npm ls react react-native`: exactly one version of each.

### 4.2 `packages/shell/package.json`

```json
{
  "name": "@e07/shell",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./plugins/*": "./plugins/*",
    "./*": "./src/*"
  },
  "dependencies": {
    "@e07/game-kit": "*",
    "valibot": "1.5.0",
    "zustand": "5.0.15"
  },
  "peerDependencies": {
    "@react-navigation/native": "*",
    "@react-navigation/native-stack": "*",
    "expo": "*",
    "expo-constants": "*",
    "expo-localization": "*",
    "expo-sqlite": "*",
    "react": "*",
    "react-native": "*",
    "react-native-safe-area-context": "*",
    "react-native-screens": "*"
  }
}
```

The peer list grows with each native module the Shell uses (Skia, Reanimated, Worklets, Gesture Handler, AdMob, expo-iap, audio, haptics, network, fonts, splash). Every entry in it must also be a dependency of every app (rule 5). Pure JavaScript libraries the Shell alone uses are ordinary dependencies of the Shell: the block shows the set verified with docs/06's code, and docs/10 adds `react-intl` and the four `@formatjs/intl-*` polyfills (exact versions from docs/01 section 3.2).

### 4.3 `packages/game-kit/package.json` and `packages/tooling/package.json`

```json
{
  "name": "@e07/game-kit",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { "./*": "./src/*" }
}
```

```json
{
  "name": "@e07/tooling",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { "./*": "./src/*" },
  "dependencies": { "@e07/game-kit": "*", "@e07/shell": "*" }
}
```

game-kit has no dependencies at all. Tooling imports the pure parts of the Shell (save codec and schema, config composer) and of the apps (rules, levels, art) directly as TypeScript.

### 4.4 `apps/<game-id>/package.json`

```jsonc
// apps/line-siege/package.json (runtime part; Expo-managed specifiers are what `npx expo install` writes)
{
  "name": "@e07/line-siege",
  "version": "1.0.0",
  "private": true,
  "main": "index.ts",
  "exports": { "./*": "./src/*" },
  "dependencies": {
    "@e07/game-kit": "*",
    "@e07/shell": "*",
    "@react-navigation/native": "7.4.1",
    "@react-navigation/native-stack": "7.19.2",
    "expo": "~57.0.25",
    "expo-constants": "~57.0.19",
    "expo-localization": "~57.0.2",
    "expo-sqlite": "~57.0.3",
    "expo-system-ui": "~57.0.4",
    "react": "19.2.3",
    "react-native": "0.86.3",
    "react-native-safe-area-context": "~5.7.0",
    "react-native-screens": "~4.26.0"
    // + every other native module of the Shell (docs/01 versions table)
  }
}
```

- The `exports` map exists only so game code can reach its own folders without `../`: `import type { LineSiegeState } from '@e07/line-siege/rules/line-siege-types.ts';` resolves to `apps/line-siege/src/rules/line-siege-types.ts` (docs/04 rule 19, docs/09's tooling imports use the same form).
- Pure JavaScript libraries only the Shell imports (`valibot`, `zustand`, `react-intl`) are **not** app dependencies (knip would report them unused). `expo-system-ui` is: `userInterfaceStyle: 'automatic'` needs it, and knip's Expo plugin expects it (docs/16, verified there).
- Apps have no `"type"` field because `metro.config.js` is CommonJS (docs/14). Node therefore prints `MODULE_TYPELESS_PACKAGE_JSON` when a tooling script imports app code (see [Open issues](#open-issues)).
- Install with `npx expo install <pkg>` inside the app for Expo-managed packages and `npm install -E <pkg>@<version> -w apps/<game-id>` otherwise (docs/01 rules 2–3).

---

## 5. Dependency boundaries

### 5.1 The allowed graph

```
                    ┌──────────────────────────────┐
                    │ packages/tooling (Node only) │ ── may import anything below
                    └──────────────────────────────┘
apps/<id>/app.config.ts ──► shell/src/config/** (Node world) ──► shell/plugins/** (by path string)
apps/<id>/index.ts ──► shell/src/app/start-shell.ts, apps/<id>/src/index.ts
apps/<id>/src/{board,art,sounds,sim,tutorial,testing,index.ts} ──► shell game-facing types, game-kit
apps/<id>/src/{rules,levels} ──► game-kit only                      (PURE + DETERMINISTIC)
packages/shell/src ──► game-kit                                      (never an app, never tooling)
packages/game-kit/src ──► nothing of ours                            (PURE + DETERMINISTIC)
```

### 5.2 What enforces each edge

The rules live in docs/04's `eslint.config.mjs` (one config for the whole monorepo). This table maps each boundary to the construct that enforces it.

| Boundary | Enforced by (docs/04) | Status |
|---|---|---|
| game-kit imports nothing of ours and no framework | `GAME_KIT_BOUNDARY` + `PURE_IMPORTS` | enforced |
| `apps/*/src/{rules,levels}` pure | `PURE` files + `PURE_IMPORTS` (bans React, RN, Expo, Skia, zustand, `@e07/shell`) | enforced |
| Shell never imports an app or tooling | `SHELL_BOUNDARY` (`@e07/**` except shell and game-kit), `NO_TOOLING` | enforced |
| Runtime code never imports tooling or Node built-ins | `NO_TOOLING`, `NODE_BUILTINS` in `RUNTIME_IMPORTS` | enforced |
| No parent-relative imports | `PARENT_IMPORT` | enforced |
| Only the adapter imports its SDK | `VENDOR_SDK_PATHS` + the `ADAPTERS` exemption block | enforced |
| Apps never import each other | block 5-zones (`import/no-restricted-paths`, one zone per app) | enforced |
| Game code outside `rules/levels` imports only the Shell's game-facing folders | block 5-zones (`GAME_FACING`) | enforced |
| Determinism (no `Math.random`, `Date.now`, transcendental `Math.*`) in rules, levels, sim, geom, game-kit | `DETERMINISTIC` + `no-restricted-properties` | enforced |

### 5.3 App zones

Two edges are not covered by docs/04's package-name patterns: an app importing another app (both are workspaces, so `@e07/flock-tilt/...` resolves), and game code importing Shell internals such as stores or screens. `import/no-restricted-paths` works on resolved file paths, so it catches both regardless of how the import is spelled. The block lives in docs/04's config as block 5-zones (with `APP_IDS` and `GAME_FACING`): see [docs/04 section 3](04-code-style-and-limits.md#3-eslint-the-complete-eslintconfigmjs). Game code may import only `game-host/`, `art/`, `services/audio/audio-port.ts`, `services/audio/synth/`, `theme/theme-types.ts` and `i18n/messages.ts` (docs/10's `asGameKey`). Two details that cost time in verification: a `target` given as a glob must match files (`./apps/*/src/**/*`), and `basePath` must be the repo root, not the working directory of the lint run.

---

## 6. Ports and adapters

### 6.1 The nine ports

| Port (FINAL F) | File | Device adapter | Fake | Contract owner |
|---|---|---|---|---|
| `AdsPort` | `services/ads/ads-port.ts` | `admob-ads-adapter.ts` | `fake-ads.ts` | docs/11 |
| `ConsentPort` | `services/consent/consent-port.ts` | `admob-consent-adapter.ts` (Google UMP and Apple's ATT prompt, FINAL H.1) | `fake-consent.ts` | docs/11 |
| `PurchasePort` | `services/purchase/purchase-port.ts` | `expo-iap-purchase-adapter.ts` | `fake-purchase.ts` | docs/12 |
| `SaveStore` (+ `SqlDriver`) | `services/save/save-store.ts`, `sql-driver.ts` | `sqlite-save-store.ts`, `expo-sqlite-sql-driver.ts` | `fake-save-store.ts`; Jest SQL: `test/integration/save/node-sqlite-sql-driver.ts` | docs/06 |
| `ClockPort` | `services/clock/clock-port.ts` | `system-clock-adapter.ts` | `fake-clock.ts` | this doc / docs/06 |
| `ConnectivityPort` | `services/connectivity/connectivity-port.ts` | `expo-network-connectivity-adapter.ts` | `fake-connectivity.ts` | docs/11 |
| `AudioPort` | `services/audio/audio-port.ts` | `audio-api-audio-adapter.ts` | `fake-audio.ts` | docs/09 |
| `HapticsPort` | `services/haptics/haptics-port.ts` | `expo-haptics-adapter.ts` | `fake-haptics.ts` | docs/09 |
| `ErrorLogPort` | `services/error-log/error-log-port.ts` | `sqlite-error-log-adapter.ts` | `fake-error-log.ts` | docs/04 (type), docs/06 (storage) |

All paths are under `packages/shell/src/`. Adapter factories are `create` + the PascalCase file name (`createAdmobAdsAdapter`, `createSqliteSaveStore`, docs/03). The signatures below are the contract; the owning doc explains the behaviour behind each member.

### 6.2 Signatures

```ts
// packages/shell/src/services/ads/ads-port.ts (docs/11)
import type { ReactNode } from 'react';

export type AdUnitIds = {
  readonly banner: string;
  readonly interstitial: string;
  readonly rewarded: string;
};
export type FullscreenResult = 'shown' | 'unavailable';
export type RewardResult = 'rewarded' | 'dismissed' | 'unavailable';
export type BannerSlotProps = {
  readonly onLoaded: () => void; // the slot collapses until this fires (no empty box)
  readonly onFailed: () => void; // failed loads are silent (spec 8.8)
};

// The Shell's view of an ad SDK. Only admob-ads-adapter.ts touches the real SDK.
export type AdsPort = {
  // After consent: request configuration + SDK initialize. Idempotent.
  readonly initialize: () => Promise<void>;
  readonly preloadInterstitial: () => void;
  readonly preloadRewarded: () => void;
  readonly isRewardedLoaded: () => boolean;
  // Notifies when rewarded availability changes, so "Watch an ad" buttons appear/disappear.
  readonly subscribeRewardedLoaded: (listener: (isLoaded: boolean) => void) => () => void;
  // Resolve when the ad CLOSED (or immediately with 'unavailable'). Never reject.
  readonly showInterstitial: () => Promise<FullscreenResult>;
  readonly showRewarded: () => Promise<RewardResult>;
  readonly renderBanner: (props: BannerSlotProps) => ReactNode;
};
```

```ts
// packages/shell/src/services/consent/consent-port.ts (docs/11)
export type ConsentInfo = {
  readonly canRequestAds: boolean;
  readonly isPrivacyOptionsRequired: boolean; // show the "Ad privacy choices" row (S11)
};

// Apple's App Tracking Transparency answer (FINAL H.1); 'denied' includes "restricted".
export type TrackingStatus = 'not-determined' | 'authorized' | 'denied' | 'unavailable';

export type ConsentPort = {
  // Every launch (not Premium, ads enabled). Offline: returns the last session's answer.
  readonly refresh: () => Promise<ConsentInfo>;
  // Screen S3: shows Google's form only where required. Offline: returns cached info.
  readonly showFormIfRequired: () => Promise<ConsentInfo>;
  // Settings > Ad privacy choices.
  readonly showPrivacyOptions: () => Promise<ConsentInfo>;
  // iOS ATT, read without asking (decides whether the S3 intro is needed).
  readonly getTrackingStatus: () => Promise<TrackingStatus>;
  // S3, after Google's form: Apple's prompt only while 'not-determined'. Never rejects.
  readonly requestTrackingIfNotDetermined: () => Promise<TrackingStatus>;
};
```

```ts
// packages/shell/src/services/purchase/purchase-port.ts (docs/12)
export type StoreProduct = {
  readonly productId: string;
  readonly displayPrice: string; // store-formatted fallback
  readonly price: number | null;
  readonly currency: string;
};

// A StoreKit 2 transaction the platform has already verified on device (JWS checked).
export type StoreTransaction = {
  readonly productId: string;
  readonly transactionId: string;
  readonly state: 'purchased' | 'pending';
  readonly revocationDateMs: number | null; // refund / Family Sharing revocation evidence
  readonly handle: unknown; // opaque; given back to finish()
};

export type PurchaseFailure = 'cancelled' | 'deferred' | 'already-owned' | 'unavailable' | 'failed';

export type PurchaseEvent =
  | { readonly type: 'transaction'; readonly transaction: StoreTransaction }
  | { readonly type: 'failure'; readonly failure: PurchaseFailure; readonly code: string };

export type PurchasePort = {
  readonly connect: () => Promise<boolean>;
  // null when the store returns no product (StoreKit returns [] instead of throwing).
  readonly fetchProduct: (productId: string) => Promise<StoreProduct | null>;
  // Resolves when the sheet was requested; the outcome arrives through subscribe().
  readonly requestPurchase: (productId: string) => Promise<void>;
  readonly finish: (transaction: StoreTransaction) => Promise<void>;
  // AppStore.sync(). 'sync-failed' covers a cancelled Apple Account prompt and offline.
  readonly restore: () => Promise<'synced' | 'sync-failed'>;
  // Every verified transaction incl. refunded ones (Transaction.all), for evidence.
  readonly readTransactions: () => Promise<readonly StoreTransaction[]>;
  readonly subscribe: (listener: (event: PurchaseEvent) => void) => () => void;
};
```

```ts
// packages/shell/src/services/save/save-store.ts (docs/06)
export type SlotName = 'current' | 'backup';

/** One row of save_slots: the whole save document as JSON plus its envelope. */
export type SlotRecord = {
  readonly schemaVersion: number;
  readonly appVersion: string;
  readonly writtenAtMs: number;
  readonly writeCount: number;
  /** FNV-1a 32 of payload, 8 hex chars. */
  readonly checksum: string;
  readonly payload: string;
};

/** Storage port for the save document. Knows rows, not documents. */
export type SaveStore = {
  readonly read: (slot: SlotName) => SlotRecord | null;
  /** Writes the given slots in ONE transaction. */
  readonly write: (slots: { readonly current?: SlotRecord; readonly backup?: SlotRecord }) => void;
  /** Copies a slot row into save_quarantine (kept for the debug export), bounded to 10 rows. */
  readonly quarantine: (slot: SlotName, reason: string, atMs: number) => void;
  /** PRAGMA wal_checkpoint(TRUNCATE): called when the app goes to the background. */
  readonly checkpoint: () => void;
};
```

```ts
// packages/shell/src/services/save/sql-driver.ts (docs/06)
/** Values we bind: no blobs, no booleans (store 0/1), no undefined. */
export type SqlValue = string | number | null;

/** A result row; values are unknown until a guard narrows them. */
export type SqlRow = Readonly<Record<string, unknown>>;

/**
 * The whole SQL surface of the app. Two implementations:
 * expo-sqlite-sql-driver.ts (device) and node-sqlite-sql-driver.ts (Jest, tooling).
 */
export type SqlDriver = {
  /** DDL and PRAGMAs; may contain several statements; no parameters. */
  readonly exec: (sql: string) => void;
  readonly run: (sql: string, params: readonly SqlValue[]) => void;
  /** First row or null. */
  readonly get: (sql: string, params: readonly SqlValue[]) => SqlRow | null;
  /** BEGIN; work(); COMMIT. On throw: ROLLBACK and rethrow. */
  readonly transaction: (work: () => void) => void;
};

/** What the driver factories return; the app never closes its main connection. */
export type ClosableSqlDriver = SqlDriver & { readonly close: () => void };
```

```ts
// packages/shell/src/services/clock/clock-port.ts
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

/**
 * The only source of wall-clock time in the app. Game rules never read time; screens
 * and services receive a ClockPort (test builds wrap it to "set the date", S15).
 */
export type ClockPort = {
  /** Epoch milliseconds: records, ad spacing, play-time deltas (clamped). Never rules. */
  readonly nowMs: () => number;
  /** Today's local calendar day 'YYYY-MM-DD'; changes at local midnight (spec S9). */
  readonly today: () => DateKey;
};
```

```ts
// packages/shell/src/services/connectivity/connectivity-port.ts (docs/11)
export type ConnectivityPort = {
  readonly isOnline: () => boolean; // last known value; false until the first report
  readonly subscribe: (listener: (isOnline: boolean) => void) => () => void;
};
```

`AudioPort` and `HapticsPort` are copied from docs/09, which owns them (with the adapters `audio-api-audio-adapter.ts` and `expo-haptics-adapter.ts`):

```ts
// packages/shell/src/services/audio/audio-port.ts (docs/09)
import type { SoundRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';

export type SoundCategory = 'sfx' | 'ui' | 'music';

export type SoundSpec = {
  readonly category: SoundCategory;
  readonly recipe: SoundRecipe;
  /** Same sound cannot restart sooner than this (default 30 ms). */
  readonly minIntervalMs?: number;
  /** Music only: loop the buffer. */
  readonly isLoop?: boolean;
};

export type SoundBank = Readonly<Record<string, SoundSpec>>;

export type ChannelSetting = { readonly isOn: boolean; readonly volume: number };

/** From the settings store. Music defaults to OFF (FINAL-DECISIONS B.20, spec 8.7). */
export type AudioSettings = { readonly effects: ChannelSetting; readonly music: ChannelSetting };

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  effects: { isOn: true, volume: 0.8 },
  music: { isOn: false, volume: 0.6 },
};

/** The ONLY audio API the Shell and games use. Adapter: audio-api-audio-adapter.ts. */
export type AudioPort = {
  /** Synthesises and uploads every buffer of the bank (call once at startup). */
  readonly load: (bank: SoundBank) => void;
  /** Plays a sound now or after `delayMs` (timeline cues). Silently ignores unknown ids. */
  readonly play: (soundId: string, delayMs?: number) => void;
  /** Stops sounds scheduled for the future (timeline fast-forward, pause). */
  readonly cancelPending: () => void;
  readonly applySettings: (settings: AudioSettings) => void;
  readonly startMusic: (soundId: string) => void;
  readonly stopMusic: () => void;
  readonly suspend: () => Promise<void>;
  readonly resume: () => Promise<void>;
  /** Before reloadAppAsync (direction change) and in tests. */
  readonly dispose: () => Promise<void>;
};
```

```ts
// packages/shell/src/services/haptics/haptics-port.ts (docs/09)
import type { HapticCue } from '@e07/game-kit/timeline/track.ts';

export type { HapticCue };

/** The ONLY haptics API the Shell and games use. Adapter: expo-haptics-adapter.ts. */
export type HapticsPort = {
  /** False on devices without a Taptic Engine: Settings hides the Vibration row. */
  readonly isSupported: boolean;
  /** Fire-and-forget. Gated by the Vibration setting and throttled; never throws. */
  readonly play: (cue: HapticCue) => void;
};
```

```ts
// packages/shell/src/services/error-log/error-log-port.ts (docs/04 section 6.2)
export type ErrorSource =
  | 'render'
  | 'frame-callback'
  | 'save'
  | 'ads'
  | 'purchase'
  | 'audio'
  | 'haptics'
  | 'unhandled-rejection'
  | 'global-handler'
  | 'boot'
  | 'i18n'
  | 'network';

export type ErrorLogEntry = {
  readonly atMs: number;
  readonly source: ErrorSource;
  readonly message: string;
};

/** Spec 8.14: the local error log. `record` never throws and never rejects. */
export type ErrorLogPort = {
  readonly record: (source: ErrorSource, error: unknown) => void;
  readonly entries: () => readonly ErrorLogEntry[];
};
```

### 6.3 Injection

The composition root builds each adapter once and passes the set down. Components read ports with `useServices()`; services and stores receive ports as factory arguments; pure functions receive plain values (docs/04 section 6.5).

```tsx
// packages/shell/src/app/services-context.tsx
import { createContext, use } from 'react';

import type { AdsPort } from '@e07/shell/services/ads/ads-port.ts';
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ConnectivityPort } from '@e07/shell/services/connectivity/connectivity-port.ts';
import type { ConsentPort } from '@e07/shell/services/consent/consent-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';
import type { PurchasePort } from '@e07/shell/services/purchase/purchase-port.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { JSX, ReactNode } from 'react';

/** Every port the UI may use, created once in the composition root (fakes in tests). */
export type Services = {
  readonly ads: AdsPort;
  readonly audio: AudioPort;
  readonly clock: ClockPort;
  readonly connectivity: ConnectivityPort;
  readonly consent: ConsentPort;
  readonly errorLog: ErrorLogPort;
  readonly haptics: HapticsPort;
  readonly purchase: PurchasePort;
  readonly save: SaveService;
};

const ServicesContext = createContext<Services | null>(null);

export type ServicesProviderProps = {
  readonly services: Services;
  readonly children: ReactNode;
};

export function ServicesProvider({ services, children }: ServicesProviderProps): JSX.Element {
  return <ServicesContext value={services}>{children}</ServicesContext>;
}

/** Returns the ports. A missing provider is a programmer error, so it throws. */
export function useServices(): Services {
  const services = use(ServicesContext);
  if (services === null) throw new Error('useServices() needs a <ServicesProvider> above it');
  return services;
}
```

`save` is the `SaveService` (docs/06), not the raw `SaveStore`: nothing but the save service writes the save document.

---

## 7. The `GameModule` contract

### 7.1 Design

A game module is a plain object of data and pure functions. Two constraints shape its type:

- **game-kit may not name Skia, React Native or any Shell type** (docs/04 `PURE_IMPORTS`), yet a board must draw on an `SkCanvas`, art uses Skia, sounds use the Shell's `SoundBank` and the UI palette uses the Shell's `Palette`. So `GameModule` is generic over a `TPresentation` slot, and the Shell binds that slot to its own types in `ShellGameModule<T>`. This settles docs/08's open issue 2 ("GameModule is generic over its board type").
- **docs/08 owns the engine and board members.** `GameModule.engine` is docs/08's `GameEngine` (`create`, `listMoves`, `applyMove`, `outcome`, `intentToMove`, `buildTimeline`) and `presentation.board` is docs/08's `GameBoard` (`isMirroredInRtl`, `toView`, `layout`, `draw`, `buildPaths`, `describe`). Hit-testing is game-kit's generic `hitTest` (`geom/board-layout.ts`) over the `BoardLayout` regions that `layout` returns, so a game does not write one.

Spec section 10, item by item:

| Spec 10 item | Member |
|---|---|
| Game id, name in 4 languages | `identity.id`, `identity.nameId` (catalog key); store names per language in `game.config.ts` |
| Logo and app icon drawn in code | `presentation.art` (docs/09 `GameArt`: `drawIcon` for icon variants and splash logo) |
| Palette light and dark | `presentation.palette` (docs/05 `Palette`: standard/colour-blind × light/dark); board tokens in `presentation.art.palettes` (docs/09) |
| Sound set | `presentation.sounds` (docs/09 `SoundBank`); track cues name sound ids (docs/08) |
| Start state from seed and difficulty | `engine.create(seed, difficulty)` |
| Moves allowed in a state | `engine.listMoves` |
| Apply a move → state + events | `engine.applyMove` |
| Is it over (win, lose with reason) | `engine.outcome` |
| Score and goal/progress line | `rules.hud` |
| Undo, hints, continue supported and how | `rules.undo`, `rules.hints`, `rules.continueRun` |
| Level generator | `engine.create` + `levels.difficultyFor` + `levels.table` (generated by tooling) |
| Solver or checker, par | `levels.solver` (tooling and tests only) |
| Packs, difficulty curve, star thresholds, pack names | `levels.packs`, `levels.table[].stars` |
| Daily difficulty | `levels.daily` |
| Endless supported | `levels.endless` |
| Draws the board, mirror flag | `presentation.board.draw`, `.isMirroredInRtl`, `.layout` |
| Turns taps/swipes/drags into moves | `engine.intentToMove` (input from docs/08's `useBoardGestures`) |
| Animates events, respects Reduce motion | `engine.buildTimeline(events, motion)` |
| Scripted tutorial level | `teaching.tutorial` |
| 3–5 how-to-play steps | `teaching.howToPlay` (drawn by the board's own `draw`) |
| 2–4 game-specific counters | `stats.counters` |
| Every string in en, de, fa, ckb | `texts` |
| Bot | `testing.bot` (docs/08 `BotPolicy`) |
| Example states for screenshots | `testing.examples` |
| Save points for real-time games (FINAL A.6) | `persistence.savePolicy`, `realtime.savePoints`, `realtime.snapshot` |

### 7.2 The contract files (game-kit)

The engine types are docs/08's and are not repeated: `packages/game-kit/src/contract/game-engine.ts` (`Outcome`, `ApplyResult`, `GameEngine`) and `contract/input-intent.ts` (`InputIntent`), with `BoardTarget` from `geom/board-layout.ts` and `Track`, `Motion`, `HapticCue` from `timeline/track.ts`.

```ts
// packages/game-kit/src/contract/game-module.ts
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { GameIdentity } from '@e07/game-kit/contract/game-identity.ts';
import type { GameRules } from '@e07/game-kit/contract/game-rules.ts';
import type { LevelsSpec } from '@e07/game-kit/contract/levels.ts';
import type { GameTexts } from '@e07/game-kit/contract/messages.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';
import type { RealtimeSpec } from '@e07/game-kit/contract/realtime.ts';
import type { StatsSpec } from '@e07/game-kit/contract/stats.ts';
import type { TeachingSpec } from '@e07/game-kit/contract/teaching.ts';
import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';

/**
 * Everything a game provides to become a complete app (spec section 10).
 * `TPresentation` carries the members whose types live in the Shell (Skia board, art,
 * sounds, UI palette), which game-kit may not import: the Shell binds it as
 * ShellGameModule (packages/shell/src/game-host/shell-game-module.ts).
 */
export type GameModule<TState, TMove, TEvent, TPresentation, TSim = never> = {
  readonly identity: GameIdentity;
  /** create · listMoves · applyMove · outcome · intentToMove · buildTimeline (docs/08). */
  readonly engine: GameEngine<TState, TMove, TEvent>;
  readonly rules: GameRules<TState, TMove, TEvent>;
  readonly levels: LevelsSpec<TState, TMove>;
  readonly presentation: TPresentation;
  /** null for turn-based games (about 24 of 26). */
  readonly realtime: RealtimeSpec<TState, TSim> | null;
  readonly teaching: TeachingSpec<TState, TMove>;
  readonly stats: StatsSpec<TEvent>;
  readonly texts: GameTexts;
  readonly testing: TestingSpec<TState, TMove>;
  readonly persistence: PersistenceSpec<TState, TMove>;
};
```

```ts
// packages/game-kit/src/contract/game-identity.ts
/**
 * Spec 10 IDENTITY. Logo/icon drawing, the palette and the sound set are typed by the
 * Shell and live in `presentation` (see shell-game-module.ts).
 */
export type GameIdentity = {
  /** kebab-case; equals apps/<id>, GameConfig.id and the save document's gameId. */
  readonly id: string;
  /** Catalog key of the in-game title (store names per language are in game.config.ts). */
  readonly nameId: string;
};
```

```ts
// packages/game-kit/src/contract/messages.ts
/** The four shipped languages (spec N6). */
export type LanguageCode = 'en' | 'de' | 'fa' | 'ckb';

/** A semantic catalog key; game keys start with the game id ('line-siege.lose.broke-through'). */
export type MessageId = string;

/** A message id plus its ICU placeholder values; the Shell formats it with t(). */
export type Message = {
  readonly id: MessageId;
  readonly values: Readonly<Record<string, number | string>>;
};

/** One flat ICU catalog: semantic key -> ICU MessageFormat string. */
export type Catalog = Readonly<Record<MessageId, string>>;

/** Spec 10 TEXTS: all four catalogs; a missing key fails `npm run i18n:verify`. */
export type GameTexts = Readonly<Record<LanguageCode, Catalog>>;
```

```ts
// packages/game-kit/src/contract/game-rules.ts
import type { ApplyResult } from '@e07/game-kit/contract/game-engine.ts';
import type { Message, MessageId } from '@e07/game-kit/contract/messages.ts';

/** Top bar (S5): the score and the goal/progress line, e.g. "Moves 5 / Par 7". */
export type Hud = {
  readonly score: number;
  readonly goal: Message;
};

export type UndoPolicy =
  | { readonly kind: 'none' }
  | { readonly kind: 'unlimited' }
  | { readonly kind: 'limited'; readonly perLevel: number };

export type HintPolicy<TState, TMove> =
  | { readonly kind: 'none' }
  | { readonly kind: 'solver'; readonly suggest: (state: TState) => TMove | null };

/** Spec 8.10: at most one continue per level or run, only after a loss. */
export type ContinuePolicy<TState, TEvent> =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'once';
      readonly descriptionId: MessageId;
      readonly apply: (lost: TState) => ApplyResult<TState, TEvent>;
    };

/** Spec 10 RULES beyond the engine functions (docs/08 owns GameEngine). Pure. */
export type GameRules<TState, TMove, TEvent> = {
  readonly hud: (state: TState) => Hud;
  readonly undo: UndoPolicy;
  readonly hints: HintPolicy<TState, TMove>;
  readonly continueRun: ContinuePolicy<TState, TEvent>;
};
```

```ts
// packages/game-kit/src/contract/levels.ts
import type { MessageId } from '@e07/game-kit/contract/messages.ts';

/** Spec 8.1: puzzle games rate against par, score games against thresholds. */
export type StarRule =
  | { readonly kind: 'par'; readonly par: number }
  | { readonly kind: 'score'; readonly thresholds: readonly [number, number, number] };

/** One shipped level: generated by tooling, solver-checked, committed as JSON. */
export type LevelEntry = {
  /** 1-based and global across packs ("Level 12"). */
  readonly level: number;
  readonly seed: number;
  readonly difficulty: number;
  readonly stars: StarRule;
};

/** Spec S8: packs unlock by stars collected. */
export type LevelPack = {
  readonly id: string;
  readonly nameId: MessageId;
  readonly firstLevel: number;
  readonly levelCount: number;
  readonly starsToUnlock: number;
};

export type SolveResult<TMove> =
  | { readonly kind: 'solved'; readonly par: number; readonly line: readonly TMove[] }
  | { readonly kind: 'unsolvable' }
  | { readonly kind: 'budget-exceeded' };

/** Proves a level winnable and computes par. Tooling and tests only, never at runtime. */
export type Solver<TState, TMove> = {
  readonly solve: (start: TState, maxNodes: number) => SolveResult<TMove>;
};

/** Spec 10 LEVELS, 8.2 modes, 8.3 daily. The generator is GameEngine.create(seed, difficulty). */
export type LevelsSpec<TState, TMove> = {
  /** Difficulty curve; tooling regenerates the pack-<n>.json tables from it. */
  readonly difficultyFor: (level: number) => number;
  readonly packs: readonly LevelPack[];
  /** From src/levels/pack-<n>.json, concatenated; one entry per shipped level. */
  readonly table: readonly LevelEntry[];
  readonly solver: Solver<TState, TMove> | null;
  readonly daily:
    | { readonly kind: 'none' }
    | { readonly kind: 'daily'; readonly difficulty: number; readonly salt: number };
  readonly endless:
    { readonly kind: 'none' } | { readonly kind: 'endless'; readonly difficulty: number };
};
```

```ts
// packages/game-kit/src/contract/teaching.ts
import type { MessageId } from '@e07/game-kit/contract/messages.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** Where the tutorial hand points; 'hud' elements are the Shell's top-bar buttons. */
export type TutorialPointer =
  | { readonly kind: 'target'; readonly target: BoardTarget }
  | { readonly kind: 'drag'; readonly from: BoardTarget; readonly to: BoardTarget }
  | { readonly kind: 'hud'; readonly element: 'undo' | 'hint' | 'pause' }
  | { readonly kind: 'none' };

/** One short sentence, one pointer, one expected action (spec S13). */
export type TutorialStep<TMove> = {
  readonly messageId: MessageId;
  readonly pointer: TutorialPointer;
  readonly expect: { readonly kind: 'any-move' } | { readonly kind: 'move'; readonly move: TMove };
};

/** A how-to-play page, illustrated by drawing `example` with the game's own board. */
export type HowToPlayStep<TState> = {
  readonly titleId: MessageId;
  readonly bodyId: MessageId;
  readonly example: TState;
  readonly pointer: TutorialPointer;
};

/** Spec 10 TEACHING. Skip appears from the second step (S13). */
export type TeachingSpec<TState, TMove> = {
  readonly tutorial: { readonly start: TState; readonly steps: readonly TutorialStep<TMove>[] };
  /** 3 to 5 pages (contract test). */
  readonly howToPlay: readonly HowToPlayStep<TState>[];
};
```

```ts
// packages/game-kit/src/contract/stats.ts
import type { MessageId } from '@e07/game-kit/contract/messages.ts';

/**
 * A game-specific statistic (S10 card; 2 to 4 per game). When a run ends the Shell
 * replays its final move line, measures each move's events and folds the numbers in.
 */
export type CounterSpec<TEvent> = {
  /** kebab-case and stable forever: it is a key in the save document. */
  readonly id: string;
  readonly labelId: MessageId;
  readonly aggregate: 'sum' | 'max';
  readonly measure: (events: readonly TEvent[]) => number;
};

export type StatsSpec<TEvent> = { readonly counters: readonly CounterSpec<TEvent>[] };
```

```ts
// packages/game-kit/src/contract/testing.ts
import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';

/** States for the screenshot matrix, the debug menu and E2E setup (spec 10 TESTING). */
export type ExampleStateId = 'start' | 'middle' | 'win' | 'lose';

export type TestingSpec<TState, TMove> = {
  /** A reasonable player for balance runs; randomPolicy() is the baseline (docs/08). */
  readonly bot: BotPolicy<TState, TMove>;
  readonly examples: Readonly<Record<ExampleStateId, () => TState>>;
};
```

```ts
// packages/game-kit/src/contract/persistence.ts
/** When a real-time game's run is written. Never per frame. */
export type SavePoint = 'wave-end' | 'turn-end' | 'pause' | 'background' | 'level-end';

export type SavePolicy =
  | { readonly kind: 'after-every-move' }
  | { readonly kind: 'save-points'; readonly points: readonly SavePoint[] };

/**
 * How the in-progress run lives inside the Shell's save document. The Shell owns the
 * document; the game owns the shape of its state and moves (both JSON-serialisable).
 */
export type PersistenceSpec<TState, TMove> = {
  /** Bump when the shape of TState or TMove changes; add a migrateState step. */
  readonly stateVersion: number;
  /** Validates JSON from disk; null = invalid (the run is dropped, results are kept). */
  readonly parseState: (json: unknown) => TState | null;
  /** Validates one logged move before replay; null = undo history dropped. */
  readonly parseMove: (json: unknown) => TMove | null;
  /** Upgrades an older run state; null = cannot (the run is dropped, results are kept). */
  readonly migrateState: (json: unknown, fromVersion: number) => TState | null;
  readonly savePolicy: SavePolicy;
};
```

```ts
// packages/game-kit/src/contract/realtime.ts
import type { SavePoint } from '@e07/game-kit/contract/persistence.ts';

/**
 * Continuous games only (Halo Drift). Turn-based and simulate-then-replay games set
 * `realtime: null`. `step` and `drainEvents` match docs/08's FixedStepSim, so the
 * module can be handed to useFixedStepLoop unchanged.
 */
export type RealtimeSpec<TState, TSim> = {
  /** JS: build the typed-array sim from a fresh or saved state. */
  readonly createSim: (state: TState) => TSim;
  /** Worklet: one tick with the current integer command; mutates `sim` in place. */
  readonly step: (sim: TSim, command: number) => void;
  /** Worklet: copy out and clear this frame's events as a flat int list. */
  readonly drainEvents: (sim: TSim) => readonly number[];
  /** JS: JSON snapshot of a sim copy (`sim.get()`), taken only at save points. */
  readonly snapshot: (sim: TSim) => TState;
  readonly savePoints: readonly SavePoint[];
  /** JS: true when a drained batch contains a save-point event (e.g. wave end). */
  readonly isSavePoint: (events: readonly number[]) => boolean;
};
```

How the Shell uses the save-point members (docs/06 and docs/08): the game host stops the loop at a save point (wave end, pause, background), reads the sim copy with `sim.get()` on the JS thread, calls `snapshot`, and writes the run with the recorded `(tick, command)` log. Turn-based games (`savePolicy.kind === 'after-every-move'`) are written after every `applyMove`, before the animation starts (FINAL B.12).

### 7.3 The Shell binding

```ts
// packages/shell/src/game-host/shell-game-module.ts
import type { GameModule } from '@e07/game-kit/contract/game-module.ts';
import type { GameArt } from '@e07/shell/art/game-art.ts';
import type { GameBoard } from '@e07/shell/game-host/board-types.ts';
import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';
import type { Palette } from '@e07/shell/theme/theme-types.ts';

/** Names a game's types once; apps/<game>/src/<game>-types.ts declares the concrete bag. */
export type ShellGameTypes = {
  readonly state: unknown;
  readonly move: unknown;
  readonly event: unknown;
  readonly view: unknown;
  /** Board palette token names (docs/08 BoardColors, docs/09 palettes). */
  readonly token: string;
  /** Real-time games: the typed-array sim (docs/08). Turn-based games: never. */
  readonly sim: unknown;
};

/**
 * The members game-kit cannot name because their types live in the Shell:
 * the Skia board (docs/08), code-drawn art and sounds (docs/09), the UI palette (docs/05).
 */
export type GamePresentation<T extends ShellGameTypes> = {
  readonly board: GameBoard<T['state'], T['view'], T['token']>;
  readonly art: GameArt<T['token']>;
  readonly sounds: SoundBank;
  readonly palette: Palette;
};

/** What apps/<game>/src/index.ts exports and startShell() accepts. */
export type ShellGameModule<T extends ShellGameTypes> = GameModule<
  T['state'],
  T['move'],
  T['event'],
  GamePresentation<T>,
  T['sim']
>;
```

A game declares its bag once:

```ts
// apps/line-siege/src/line-siege-types.ts
import type { BoardToken } from '@e07/line-siege/board/board-palettes.ts';
import type { LineSiegeView } from '@e07/line-siege/board/to-view.ts';
import type {
  LineSiegeEvent,
  LineSiegeMove,
  LineSiegeState,
} from '@e07/line-siege/rules/line-siege-types.ts';

/** The one place Line Siege names its types for the Shell (ShellGameTypes). */
export type LineSiegeTypes = {
  readonly state: LineSiegeState;
  readonly move: LineSiegeMove;
  readonly event: LineSiegeEvent;
  readonly view: LineSiegeView;
  readonly token: BoardToken;
  readonly sim: never;
};
```

### 7.4 The only generic seam: `createGameHost`

Screens, stores and navigation must not know a game's state type, but TypeScript cannot store "a module of some unknown type" and use it later (no existential types; a `GameModule<Specific>` is not assignable to `GameModule<unknown>` because function parameters are contravariant under `strictFunctionTypes`). Instead of casting, the Shell closes over the typed module once and exposes a type-erased handle.

```ts
// packages/shell/src/game-host/game-host.ts
import { restoreRun } from '@e07/shell/game-host/saved-run.ts';

import type { SessionRules } from '@e07/shell/game-host/game-session-types.ts';
import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { ComponentType } from 'react';

export type BoardHostProps = { readonly testID: string };

/**
 * The Shell's type-erased handle on the game. createGameHost<T> is the ONLY generic seam:
 * everything that touches the game's state, move and event types lives in its closure, so
 * screens, stores and navigation never see them and no cast is needed.
 */
export type GameHost = {
  readonly id: string;
  /** Renders the active session's board (docs/08 GameBoardHost + useBoardGestures). */
  readonly BoardHost: ComponentType<BoardHostProps>;
  readonly counterIds: readonly string[];
  readonly hasSavedRun: () => boolean;
};

function sessionRules<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
): SessionRules<T['state'], T['move'], T['event']> {
  const { create, applyMove, outcome } = game.engine;
  return { create, applyMove, outcome, undo: game.rules.undo, continueRun: game.rules.continueRun };
}

/** At boot: validate the saved run with the game's own parsers; drop only the run if invalid. */
function dropInvalidRun<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
  save: SaveService,
): void {
  const saved = save.doc().run;
  if (saved === null) return;
  const restored = restoreRun(sessionRules(game), game.persistence, saved);
  if (restored.kind === 'dropped') save.update((doc) => ({ ...doc, run: null }));
}

export function createGameHost<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
  save: SaveService,
  BoardHost: ComponentType<BoardHostProps>,
): GameHost {
  dropInvalidRun(game, save);
  return {
    id: game.identity.id,
    BoardHost,
    counterIds: game.stats.counters.map((counter) => counter.id),
    hasSavedRun: () => save.doc().run !== null,
  };
}
```

`GameHost` grows as screens need more (session controls, HUD, hint, continue); every addition stays type-erased (strings, numbers, callbacks, components), never `T['state']`. The `GameSession` reducer, `restoreRun` and the per-session store are in docs/06; the board host and gestures in docs/08.

### 7.5 Contract tests every game runs

A shared helper in `packages/game-kit/src/testing/` runs these against each module (`apps/<game>/src/contract.test.ts`); they are pure and fast.

| Test | Asserts |
|---|---|
| identity | `identity.id` equals the folder name and `GameConfig.id` |
| texts | every `MessageId` referenced by `identity`, `rules.hud` goal ids, `levels.packs`, `teaching`, `stats`, lose reasons exists in all four catalogs |
| determinism | `create(seed, d)` twice gives deep-equal states; replaying a bot game twice gives identical outcomes (docs/08) |
| legality | every move `intentToMove` returns is in `listMoves(state)` for 1,000 generated intents |
| serialisation | `JSON.parse(JSON.stringify(state))` deep-equals `state`; `parseState` accepts it; the same for moves and `parseMove` |
| levels | `levels.table` covers `packs` exactly, levels are numbered 1…n, `GameConfig.levels` matches the packs; with a solver, every entry is solvable and its par matches |
| teaching | 3–5 how-to-play pages; every tutorial `expect.move` is legal at its step |
| stats | 2–4 counters, ids kebab-case and unique |
| config | modes enabled in `GameConfig.modes` are supported by `levels.daily` / `levels.endless`; `isContinueAllowed` only with `continueRun.kind === 'once'` |

---

## 8. Wiring a game app

### 8.1 `game.config.ts`: every field of spec section 11

```ts
// apps/line-siege/game.config.ts
import type { GameConfig } from '@e07/shell/config/game-config.ts';

/** Spec section 11: every per-game value lives here. Read by app.config.ts only. */
export const gameConfig: GameConfig = {
  id: 'line-siege',
  appName: { en: 'Line Siege', de: 'Line Siege', fa: 'محاصره خط', ckb: 'گەمارۆی هێڵ' },
  bundleId: 'io.applander.linesiege', // io.applander.<id without hyphens> (FINAL H.4)
  appStoreId: null,
  version: '1.0.0',
  buildNumber: 1,
  premium: { productId: 'io.applander.linesiege.premium', priceNote: 'EUR 1.99 (D3)' },
  ads: {
    isEnabled: true,
    policy: {
      minLevelsCompletedBeforeFirst: 3,
      minMsBetweenInterstitials: 180_000,
      minLevelsCompletedBetween: 2,
    },
    ids: {
      ios: {
        appId: 'ca-app-pub-1234567890123456~1234567890',
        units: {
          banner: 'ca-app-pub-1234567890123456/1111111111',
          interstitial: 'ca-app-pub-1234567890123456/2222222222',
          rewarded: 'ca-app-pub-1234567890123456/3333333333',
        },
      },
      android: null,
    },
  },
  modes: { daily: true, endless: true },
  levels: { packCount: 3, levelsPerPack: 30 },
  hints: { freePerDay: 1 },
  isContinueAllowed: true,
  links: {
    privacyPolicy: { host: 'example.com', path: '/line-siege/privacy' },
    supportEmail: 'support@example.com',
  },
  store: {
    audience: 'general',
    ageRating: {
      advertising: true,
      violenceCartoonOrFantasy: 'INFREQUENT_OR_MILD',
      gambling: false,
    },
  },
};
```

The AdMob IDs above are the new-game scaffold's placeholders in the documented format (docs/11). `check-game-app --stage complete`, `assertLiveIds` and the release gates reject them by name (publisher `1234567890123456`), and they reject any app ID outside `io.applander.*`, such as `com.example.*` (FINAL H.4, docs/14 section 3.8). `ageRating` uses App Store Connect's `ageRatingDeclarations` attribute names; on 2026-09-26 the API listed `advertising` (boolean, `true` for every game with ads) and the level values `NONE`, `INFREQUENT_OR_MILD`, `FREQUENT_OR_INTENSE`, `INFREQUENT`, `FREQUENT`; the store step picks the answers. The display names in `fa` and `ckb` are machine-written and need the native-speaker review (spec 7.4).

```ts
// packages/shell/src/config/game-config.ts
// Neutral file: read by Node (app.config.ts) and by the app program; types only.
import type { AdmobGameIds } from './ads-config.ts';

export type LanguageCode = 'en' | 'de' | 'fa' | 'ckb';

/** An ASC `ageRatingDeclarations` value; the API lists both the old and the new scale. */
export type AgeRatingLevel =
  'NONE' | 'INFREQUENT_OR_MILD' | 'FREQUENT_OR_INTENSE' | 'INFREQUENT' | 'FREQUENT';

/** App Store Connect age-rating answers, keyed by ASC attribute name (store step). */
export type AgeRatingAnswers = Readonly<Record<string, AgeRatingLevel | boolean>>;

/** Spec section 11: ONE file per game, apps/<game>/game.config.ts. */
export type GameConfig = {
  /** kebab-case; equals GameModule.identity.id and the apps/<id> folder. */
  readonly id: string;
  readonly appName: Readonly<Record<LanguageCode, string>>;
  /**
   * Same id on iOS and Android: io.applander.<id without hyphens>, lowercase (FINAL H.4),
   * which also matches ^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$
   */
  readonly bundleId: string;
  /** Numeric Apple ID of the App Store Connect record (rate link); null until created. */
  readonly appStoreId: string | null;
  /** Marketing version, semver. */
  readonly version: string;
  /** Monotonic integer; CFBundleVersion and versionCode. Bumped by release:ios. */
  readonly buildNumber: number;
  readonly premium: {
    /** `${bundleId}.premium` */
    readonly productId: string;
    /** Human note only; prices live in the store consoles (D3: EUR 1.99). */
    readonly priceNote: string;
  };
  /** Spec 8.8 + 4.3; field meanings in docs/11. */
  readonly ads: {
    readonly isEnabled: boolean;
    readonly policy: {
      readonly minLevelsCompletedBeforeFirst: number;
      readonly minMsBetweenInterstitials: number;
      readonly minLevelsCompletedBetween: number;
    };
    readonly ids: AdmobGameIds;
  };
  readonly modes: { readonly daily: boolean; readonly endless: boolean };
  /** Must match GameModule.levels.packs (a contract test checks it). */
  readonly levels: { readonly packCount: number; readonly levelsPerPack: number };
  readonly hints: { readonly freePerDay: number };
  readonly isContinueAllowed: boolean;
  /** No URL literals in app code (N3 lint): external-links.ts builds https://<host><path>. */
  readonly links: {
    readonly privacyPolicy: { readonly host: string; readonly path: string };
    readonly supportEmail: string;
  };
  readonly store: {
    readonly audience: 'general' | 'children';
    readonly ageRating: AgeRatingAnswers;
  };
};
```

Spec 11 → field: app name per language → `appName`; store id / bundle id → `bundleId`, `appStoreId`; version → `version`, `buildNumber`; Premium product id and price note → `premium`; AdMob app and unit IDs per platform, test IDs in development → `ads.ids` (test IDs are chosen by `ADS_MODE`, never written here); frequency numbers and the master switch → `ads.policy`, `ads.isEnabled`; modes, packs and level counts → `modes`, `levels`; free hints per day → `hints.freePerDay`; continue allowed → `isContinueAllowed`; privacy policy link and support email → `links`; age rating answers and target audience → `store`.

The privacy link is stored as host + path because docs/04 forbids `https://` literals in app-bundle files; the one allowlisted file `packages/shell/src/config/external-links.ts` composes the URL.

### 8.2 `app.config.ts`

```ts
// apps/line-siege/app.config.ts
import { withShell } from '@e07/shell/config/with-shell.ts';

import { gameConfig } from './game.config.ts';

export default withShell(gameConfig, process.env);
```

- The explicit `.ts` extensions are required: Expo loads this file and Node type-strips everything it imports (`./game.config` without the extension fails with "Cannot find module"; with `NODE_OPTIONS=--no-strip-types` it fails with "Unexpected token '{'", both verified). Hence `engines.node >=22.18`.
- `export default` is the tool-demanded exception (docs/04 rule 21).
- `process.env` is passed in so `withShell` is a pure function a test can call with a plain object.

### 8.3 `index.ts`

```ts
// apps/line-siege/index.ts
import { startShell } from '@e07/shell/app/start-shell.ts';

import { lineSiegeGame } from './src/index.ts';
startShell(lineSiegeGame);
```

Three statements; the blank line is required by `import/order` (verified: without it ESLint fails). `startShell` (docs/10) runs the Intl polyfills first, the direction check second, then docs/06's `createShellApp`. The app never imports `game.config.ts` at runtime.

### 8.4 `src/index.ts`: the module

```ts
// apps/line-siege/src/index.ts
import { GAME_ART } from '@e07/line-siege/art/game-art.ts';
import { lineSiegeBoard } from '@e07/line-siege/board/line-siege-board.ts';
import { UI_PALETTE } from '@e07/line-siege/board/ui-palette.ts';
import ckb from '@e07/line-siege/i18n/ckb.json';
import de from '@e07/line-siege/i18n/de.json';
import en from '@e07/line-siege/i18n/en.json';
import fa from '@e07/line-siege/i18n/fa.json';
import { LEVELS } from '@e07/line-siege/levels/levels.ts';
import { LINE_SIEGE_ENGINE, LINE_SIEGE_RULES } from '@e07/line-siege/rules/line-siege-engine.ts';
import { LINE_SIEGE_PERSISTENCE } from '@e07/line-siege/rules/line-siege-persistence.ts';
import { LINE_SIEGE_STATS } from '@e07/line-siege/rules/line-siege-stats.ts';
import { SOUND_BANK } from '@e07/line-siege/sounds/sound-bank.ts';
import { LINE_SIEGE_TESTING } from '@e07/line-siege/testing/line-siege-testing.ts';
import { LINE_SIEGE_TEACHING } from '@e07/line-siege/tutorial/line-siege-teaching.ts';

import type { LineSiegeTypes } from './line-siege-types.ts';
import type { ShellGameModule } from '@e07/shell/game-host/shell-game-module.ts';

/** Line Siege as the Shell sees it (spec section 10). Assembly only; no logic here. */
export const lineSiegeGame: ShellGameModule<LineSiegeTypes> = {
  identity: { id: 'line-siege', nameId: 'line-siege.name' },
  engine: LINE_SIEGE_ENGINE,
  rules: LINE_SIEGE_RULES,
  levels: LEVELS,
  presentation: {
    board: lineSiegeBoard,
    art: GAME_ART,
    sounds: SOUND_BANK,
    palette: UI_PALETTE,
  },
  realtime: null,
  teaching: LINE_SIEGE_TEACHING,
  stats: LINE_SIEGE_STATS,
  texts: { en, de, fa, ckb },
  testing: LINE_SIEGE_TESTING,
  persistence: LINE_SIEGE_PERSISTENCE,
};
```

This is the shape to follow; the imported files are each game's own work. A complete toy module with every member filled in type-checked and linted clean against the contract above (see [Verified](#verified)).

### 8.5 `metro.config.js`

Owned by docs/14 (complete file there): it keys Metro's transform cache on `EXPO_PUBLIC_APP_VARIANT` via `config.cacheVersion`. Every app has it; the new-game scaffold copies it.

---

## 9. `withShell` and build variants

### 9.1 What `withShell` does

`withShell(gameConfig, env)` turns one game's config and the build environment into the complete Expo config. It runs in Node (type stripping), so every file it reaches uses relative `.ts` imports, erasable syntax and no React Native.

```ts
// packages/shell/src/config/with-shell.ts
// The config composer: game.config.ts + build env in, complete ExpoConfig out. Runs in Node
// (type stripping): relative imports with .ts extensions, erasable syntax, no RN imports.
import { adUnitsExtra } from './ads-config.ts';
import { resolveBuildVariant } from './app-variant.ts';
import { toGameExtra } from './game-extra.ts';
import { PRIVACY_MANIFESTS } from './privacy-manifest.ts';
import { shellPlugins } from './shell-plugins.ts';
import { TRACKING_USAGE } from './tracking-usage.ts';

import type { BuildEnv } from './app-variant.ts';
import type { GameConfig, LanguageCode } from './game-config.ts';
import type { ExpoConfig } from 'expo/config';

const LANGUAGES: readonly LanguageCode[] = ['en', 'de', 'fa', 'ckb'];
const BUNDLE_ID = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

function localizedNames(game: GameConfig): NonNullable<ExpoConfig['locales']> {
  return Object.fromEntries(
    LANGUAGES.map((lang) => [
      lang,
      {
        ios: {
          CFBundleDisplayName: game.appName[lang],
          NSUserTrackingUsageDescription: TRACKING_USAGE[lang], // Apple's ATT prompt (FINAL H.1)
        },
        android: { app_name: game.appName[lang] },
      },
    ]),
  );
}

function iosConfig(game: GameConfig, teamId: string | undefined): NonNullable<ExpoConfig['ios']> {
  return {
    bundleIdentifier: game.bundleId,
    buildNumber: String(game.buildNumber),
    deploymentTarget: '16.4',
    supportsTablet: true,
    ...(teamId === undefined ? {} : { appleTeamId: teamId }),
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      CADisableMinimumFrameDurationOnPhone: true,
      CFBundleAllowMixedLocalizations: true,
    },
    privacyManifests: PRIVACY_MANIFESTS,
  };
}

/** Pure: app.config.ts passes process.env; tests pass a plain object. */
export function withShell(game: GameConfig, env: BuildEnv): ExpoConfig {
  if (!BUNDLE_ID.test(game.bundleId)) {
    throw new Error(`bundleId ${game.bundleId} must match ${BUNDLE_ID.source}`);
  }
  const variant = resolveBuildVariant(env);
  const adsMode = game.ads.isEnabled ? variant.adsMode : 'off';
  const adUnits = adUnitsExtra(adsMode, game.ads.ids); // null unless ADS_MODE=live (docs/11)
  return {
    name: game.appName.en,
    slug: game.id,
    version: game.version,
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    ...(variant.appVariant === 'test' ? { scheme: `e07-${game.id}` } : {}),
    ios: iosConfig(game, env['APPLE_TEAM_ID']),
    android: { package: game.bundleId, versionCode: game.buildNumber },
    locales: localizedNames(game),
    updates: { enabled: false },
    experiments: { reactCompiler: true },
    extra: {
      appVariant: variant.appVariant,
      adsMode,
      ...(adUnits === null ? {} : { adUnits }), // rule 10: omit, never null
      game: toGameExtra(game),
    },
    plugins: [
      ...shellPlugins(game, adsMode),
      ['@e07/shell/plugins/with-app-variant-marker.ts', { appVariant: variant.appVariant }],
    ],
  };
}
```

Field by field:

| Field | Why |
|---|---|
| `orientation: 'portrait'`, `supportsTablet: true` | spec: portrait-first; iPad still rotates (prebuild writes all four iPad orientations) and iOS 27 makes iPhone windows resizable, so layouts never assume a size (docs/05, docs/08) |
| `userInterfaceStyle: 'automatic'` | the blank template's `light` stops dark mode from following the phone (FINAL A.7) |
| `scheme` only in test builds | debug deep links (Maestro setup) exist only where the debug handler exists |
| `ios.deploymentTarget: '16.4'` | built-in key since SDK 56 (docs/14) |
| `appleTeamId` from `APPLE_TEAM_ID` | writes `DEVELOPMENT_TEAM`; absent for simulator builds (docs/14) |
| `usesNonExemptEncryption: false` | skips the export-compliance question (FINAL A.9) |
| `CADisableMinimumFrameDurationOnPhone` | 120 Hz on ProMotion (FINAL B.19) |
| `CFBundleAllowMixedLocalizations` + `locales` | the home-screen name and the ATT prompt text (`NSUserTrackingUsageDescription`) per language. **Source:** [Expo localization guide](https://docs.expo.dev/guides/localization/) |
| `privacyManifests` | aggregated required-reason APIs (FINAL C.24; `npm run audit:privacy`, docs/13) |
| `updates.enabled: false` | no OTA network traffic (N3) |
| `experiments.reactCompiler` | FINAL A.2 |
| `extra.appVariant`, `adsMode`, `adUnits` | docs/11 and docs/14 runtime inputs; `adUnits` only in live builds (absent, not `null`: rule 10; `readAdsExtra` reads a missing key as no units) |
| `extra.game` | the runtime subset of `GameConfig` (below) |

```ts
// packages/shell/src/config/shell-plugins.ts
import { admobPluginOptions } from './ads-config.ts';
import { SKADNETWORK_IDS } from './skadnetwork-ids.ts';
import { TRACKING_USAGE } from './tracking-usage.ts';

import type { AdsMode } from './app-variant.ts';
import type { GameConfig } from './game-config.ts';
import type { ExpoConfig } from 'expo/config';

type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

const LOCALES = ['en', 'de', 'fa', 'ckb'];
const VAZIRMATN = './assets/fonts/Vazirmatn';

/** Every native module the Shell links, with the options FINAL-DECISIONS fixes. */
export function shellPlugins(game: GameConfig, adsMode: AdsMode): PluginEntry[] {
  return [
    'expo-sqlite',
    ['expo-localization', { supportedLocales: { ios: LOCALES, android: LOCALES } }],
    ['expo-font', { fonts: [`${VAZIRMATN}-Regular.ttf`, `${VAZIRMATN}-Bold.ttf`] }],
    'expo-iap',
    ['react-native-google-mobile-ads', admobPluginOptions(adsMode, game.ads.ids, SKADNETWORK_IDS)],
    // Apple's ATT prompt (FINAL H.1): the one writer of NSUserTrackingUsageDescription (base text).
    ['expo-tracking-transparency', { userTrackingPermission: TRACKING_USAGE.en }],
    [
      'react-native-audio-api',
      {
        iosBackgroundMode: false,
        androidPermissions: [],
        androidForegroundService: false,
        disableFFmpeg: true,
        disableStaticExternalLibs: true,
      },
    ],
  ];
}
```

- Paths in plugin options are relative to the app folder (Expo's project root). The Vazirmatn files live in each app's `assets/fonts/` (docs/10 owns them; the new-game scaffold copies them), which is also where the board goldens and art scripts load them from (docs/07, docs/08, docs/09).
- `expo-localization` gets only `supportedLocales`, never `supportsRTL`/`forcesRTL` (FINAL C.30).
- `expo-tracking-transparency` is in every variant, so every build carries `NSUserTrackingUsageDescription` (the module crashes on a status read without it); only an `ADS_MODE=test|live` build ever asks (docs/11 rule 21). `packages/shell/src/config/tracking-usage.ts` holds the four texts of the copy-deck key `consent.tracking.usage-description` as a plain `Record<LanguageCode, string>`, because `app.config.ts` runs under Node type stripping without JSON imports; its test asserts that each text equals the Shell catalog's `consent.tracking.usage-description` (docs/10), so the two never drift. Not yet compiled or run (added 2026-09-30).
- docs/09 adds the splash and icon plugin entries and docs/01 the Xcode-27 scene-support entry; they append to this list rather than creating a second one.

### 9.2 Runtime configuration: `extra.game`

```ts
// packages/shell/src/config/game-extra.ts
// Node side: the runtime subset of GameConfig that withShell embeds as expo.extra.game.
// App code never imports game.config.ts; it reads this through read-game-extra.ts.
import type { GameConfig } from './game-config.ts';

/**
 * JSON only, and no nulls: the embedded app config turned `null` into `{}` on the device
 * (verified with SDK 57), so an absent value is an absent key.
 */
export type GameExtra = {
  readonly id: string;
  readonly appStoreId?: string;
  readonly premiumProductId: string;
  readonly adPolicy: {
    readonly isAdsEnabled: boolean;
    readonly minLevelsCompletedBeforeFirst: number;
    readonly minMsBetweenInterstitials: number;
    readonly minLevelsCompletedBetween: number;
  };
  readonly modes: GameConfig['modes'];
  readonly levels: GameConfig['levels'];
  readonly hints: GameConfig['hints'];
  readonly isContinueAllowed: boolean;
  readonly links: GameConfig['links'];
};

export function toGameExtra(game: GameConfig): GameExtra {
  return {
    id: game.id,
    ...(game.appStoreId === null ? {} : { appStoreId: game.appStoreId }),
    premiumProductId: game.premium.productId,
    adPolicy: { isAdsEnabled: game.ads.isEnabled, ...game.ads.policy },
    modes: game.modes,
    levels: game.levels,
    hints: game.hints,
    isContinueAllowed: game.isContinueAllowed,
    links: game.links,
  };
}
```

```ts
// packages/shell/src/app/read-game-extra.ts
import Constants from 'expo-constants';
import * as v from 'valibot';

import type { GameExtra } from '@e07/shell/config/game-extra.ts';

const COUNT = v.pipe(v.number(), v.safeInteger(), v.minValue(0));

const GAME_EXTRA = v.object({
  id: v.string(),
  appStoreId: v.exactOptional(v.string()),
  premiumProductId: v.string(),
  adPolicy: v.object({
    isAdsEnabled: v.boolean(),
    minLevelsCompletedBeforeFirst: COUNT,
    minMsBetweenInterstitials: COUNT,
    minLevelsCompletedBetween: COUNT,
  }),
  modes: v.object({ daily: v.boolean(), endless: v.boolean() }),
  levels: v.object({ packCount: COUNT, levelsPerPack: COUNT }),
  hints: v.object({ freePerDay: COUNT }),
  isContinueAllowed: v.boolean(),
  links: v.object({
    privacyPolicy: v.object({ host: v.string(), path: v.string() }),
    supportEmail: v.string(),
  }),
});

/** The runtime game config embedded by withShell (expo.extra.game). A mismatch is a build bug. */
export function readGameExtra(extra: unknown = Constants.expoConfig?.extra): GameExtra {
  const game: unknown =
    typeof extra === 'object' && extra !== null ? Reflect.get(extra, 'game') : undefined;
  return v.parse(GAME_EXTRA, game);
}

/** Marketing version for the save rows and About (S11b). */
export function readAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}
```

`readGameExtra` throws on a mismatch on purpose: it runs once in `createShellApp` at startup, so a composer bug fails the first simulator launch and the E2E smoke run, never silently in the field.

### 9.3 Local config plugins

A local plugin is an ESM TypeScript file in `packages/shell/plugins/`, named `with-<capability>.ts` (docs/03), with a default export, referenced from `withShell` by its package path. Runtime imports from Expo use `expo/config-plugins.js` (the `expo` package has no `exports` map, so the bare `expo/config-plugins` does not resolve from ESM: `ERR_MODULE_NOT_FOUND`, verified).

```ts
// packages/shell/plugins/with-app-variant-marker.ts
import { withInfoPlist } from 'expo/config-plugins.js';

import type { ConfigPlugin } from 'expo/config-plugins.js';

type Options = { readonly appVariant: string };

/** Writes E07AppVariant into Info.plist so the store-artifact gate can assert 'store'. */
const withAppVariantMarker: ConfigPlugin<Options> = (config, { appVariant }) =>
  withInfoPlist(config, (next) => ({
    ...next,
    modResults: { ...next.modResults, E07AppVariant: appVariant },
  }));

/** @public Loaded by Expo from withShell's path string, so it must be the default export. */
export default withAppVariantMarker;
```

The `@public` tag keeps knip from reporting the default export as unused (docs/16, section 8).

The marker gives docs/14's store-artifact gate a second, native-side signal next to the JS sentinel: `plutil -extract E07AppVariant raw <App>.app/Info.plist` must print `store`.

### 9.4 Build variants

The variant matrix, `app-variant.ts` (`resolveBuildVariant`), `test-only.ts` and `metro.config.js` are docs/14's. This doc adds three observations from its own verification:

| What | Result |
|---|---|
| `expo export` store → test → store → test without `--clear`, with docs/14's `metro.config.js` | every bundle correct: the store bundles never contained the debug screen or the `SHELL_TEST_BUILD_ONLY` sentinel; test bundles did |
| the same without the `cacheVersion` line | the second export reused the first variant's transforms (store bundle with the debug screen) |
| `xcodebuild` Release with `APP_VARIANT=test EXPO_PUBLIC_APP_VARIANT=test` exported in the shell | the embedded Hermes bundle contained the sentinel: the Xcode bundling phase inherits the environment |

---

## 10. File placement

| Kind of file | Location | Example |
|---|---|---|
| Game contract type | `packages/game-kit/src/contract/` | `game-module.ts` |
| Pure shared algorithm (RNG, geometry, timeline, dates) | `packages/game-kit/src/<area>/` | `dates/date-key.ts` |
| Shell screen | `packages/shell/src/screens/<screen>/<screen>-screen.tsx` | `screens/home/home-screen.tsx` |
| Screen model hook | next to the screen: `use-<screen>-model.ts` | `screens/home/use-home-model.ts` |
| Overlay inside a screen (S6, S7) | `packages/shell/src/screens/<overlay>/` | `screens/pause/pause-overlay.tsx` |
| Presentational component | `packages/shell/src/ui/` | `ui/primary-button.tsx` |
| Navigation | `packages/shell/src/navigation/` | `root-stack.tsx` |
| Store, reducer, selectors | `packages/shell/src/stores/<domain>-{store,reducer,selectors}.ts`; a domain with more files gets `stores/<domain>/` | `stores/settings-store.ts`, `stores/premium/premium-store.ts` (docs/12) |
| Pure domain model used by a store | `packages/shell/src/stores/<domain>-model.ts` | `stores/daily-model.ts` |
| Port type | `packages/shell/src/services/<port>/<port>-port.ts` | `services/clock/clock-port.ts` |
| Adapter | `packages/shell/src/services/<port>/<vendor>-<port>-adapter.ts` | `admob-ads-adapter.ts` |
| Fake | `packages/shell/src/services/<port>/fake-<port>.ts` | `fake-clock.ts` |
| Service (logic over ports) | `packages/shell/src/services/<port>/<name>.ts` | `services/ads/ad-policy.ts` |
| Save schema, codec, migrations, fixtures | `packages/shell/src/services/save/{schema,migrations,fixtures}/` | `schema/save-doc-v1.ts` |
| Game host (session, board host, gestures, loop) | `packages/shell/src/game-host/` | `game-session-reducer.ts` |
| Composition root, providers, boot | `packages/shell/src/app/` | `create-shell-app.tsx` |
| Test-only code (debug menu, harness hooks) | exported by `packages/shell/src/app/test-only-entry.ts`, reached only through `TEST_ONLY` (docs/14) | `app/test-only.ts` |
| Config composer (Node world) | `packages/shell/src/config/` | `with-shell.ts` |
| Local Expo config plugin | `packages/shell/plugins/with-<capability>.ts` | `with-storekit-test.ts` |
| Native code (Expo module) | `packages/shell/ios/`, `packages/shell/expo-module.config.json` | `ProcessStartModule.swift` (docs/15) |
| Fonts | `apps/<id>/assets/fonts/` | `Vazirmatn-Regular.ttf` (docs/10) |
| Shell catalogs | `packages/shell/src/i18n/catalogs/<lang>.json` | `catalogs/fa.json` |
| Game rules (pure) | `apps/<id>/src/rules/` | `apply-move.ts` |
| Level table and generator inputs | `apps/<id>/src/levels/` | `pack-1.json` (docs/03) |
| Board (Skia, worklets) | `apps/<id>/src/board/` | `draw-board.ts` |
| Real-time simulation | `apps/<id>/src/sim/` | `halo-sim.ts` |
| Art, sounds | `apps/<id>/src/art/`, `apps/<id>/src/sounds/` | `draw-icon.ts`, `sound-bank.ts` |
| Game credits for S11d | `apps/<id>/src/credits/` | `credits.json` (docs/09) |
| Tutorial and how-to-play | `apps/<id>/src/tutorial/` | `line-siege-teaching.ts` |
| Bot and example states | `apps/<id>/src/testing/` | `line-siege-testing.ts` |
| Game catalogs | `apps/<id>/src/i18n/<lang>.json` | `src/i18n/ckb.json` |
| Unit test | next to the unit: `<unit>.test.ts(x)` | `daily-model.test.ts` |
| Data or pixel golden | next to the unit: `<unit>.golden.test.ts` | `draw-board.golden.test.ts` |
| Bot simulation | `<unit>.sim.test.ts` or `test/sims/<game-id>/` | `balance.sim.test.ts` |
| Test needing Node APIs | root `test/integration/<area>/` | `test/integration/save/sqlite-save-store.test.ts` |
| E2E flow, screenshot baseline | `apps/<id>/e2e/flows/`, `apps/<id>/e2e/baselines/` | `flows/smoke/01-first-launch.yaml` |
| Generated images | `apps/<id>/assets/generated/` | `icon-light.png` |
| Node script, CLI or module (never directly in `src/`) | `packages/tooling/src/<area>/<verb>-<noun>.ts` | `save/inspect-save.ts`, `art/render-art.ts` |
| Vendor SDK mock for Jest | root `__mocks__/<package>.ts` | `__mocks__/expo-iap.ts` |

---

## 11. Recipes

### 11.1 Add a Shell screen

1. Decide whether it is a route. Routes are S2–S15 except the Pause and Result overlays and S14 dialogs (docs/06 section 2). A new route needs a spec change; overlays and dialogs do not.
2. Write the failing RNTL test first (`screens/<screen>/<screen>-screen.test.tsx`), rendered through `renderWithShell` (docs/07 section 3.8.7), querying by role.
3. Create `screens/<screen>/<screen>-screen.tsx` exporting `<Name>Screen`, and `use-<screen>-model.ts` that reads stores with selectors and calls `t()`.
4. Register the route in `navigation/root-stack.tsx` in the right group; add params to `navigation/route-params.ts` if it takes any (typed through `StaticScreenProps`).
5. Add every string to the four Shell catalogs (`npm run i18n:verify`), give every tappable element a `testID` `<screen>.<element>` (docs/03).
6. Add a Maestro step to the shell smoke flow and the screen to the screenshot matrix (docs/07).
7. `npm run check:fast`, commit.

### 11.2 Add a service or port

1. Name the port (`<Name>Port`) and write the type in `services/<port>/<port>-port.ts` with only vendor-neutral types. If it is one of the nine in FINAL F, use that exact name.
2. Write `fake-<port>.ts` first, then the service logic (pure functions plus a small factory taking the port) test-first against the fake.
3. Write `<vendor>-<port>-adapter.ts`: the only file importing the SDK. Add its SDK to docs/04's `VENDOR_SDK_PATHS` (with `Gate-Change:`), add a root `__mocks__/<sdk>.ts` if importing it in Jest crashes.
4. Install the SDK in every app (rule 5) and add it to the Shell's `peerDependencies`; if it has a config plugin, add the entry to `shell-plugins.ts`.
5. Add the port to `Services`, create the adapter in `createShellApp`, and the fake in `renderWithShell`.
6. Run `npm run audit:network` (a new native module is a new network surface, docs/13) and `npm run audit:privacy`.

### 11.3 Add a game

1. `npm run new-game -- --app <game-id>` scaffolds `apps/<game-id>/` from Line Siege's skeleton: `package.json` (`@e07/<game-id>`, the shared dependency set), `tsconfig.json`, `metro.config.js`, `app.config.ts`, `index.ts`, a `game.config.ts` whose app ID is already `io.applander.<game-id without hyphens>` with the Premium product ID `<app id>.premium` (FINAL H.4) and whose AdMob IDs are placeholders, `assets/fonts/` (Vazirmatn and `OFL.txt`), and empty `src/` folders. The bundle id also matches `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$`. The completeness check and the release gates reject `com.example.*` and the placeholder AdMob IDs by name until the owner's real IDs replace them.
2. Fill `game.config.ts`; `npx expo config --json` must pass.
3. Write the game test-first in this order (FINAL D.41): rules (examples + properties), level generator (goldens + solver properties), persistence (`parseState`, `parseMove`, round trip), board (view, layout, draw goldens), timeline, tutorial, stats counters, texts.
4. Declare the `ShellGameTypes` bag and assemble `src/index.ts`; the contract tests (section 7.5) must pass.
5. Generate the level table and art (`packages/tooling`), run bot sims (`npm run test:sim`).
6. Nothing is added to `quality-gates.json`: its `apps/*/tsconfig.json` key and the ESLint globs cover every app (docs/16 section 7). Run `npm run verify`, the Release simulator build, E2E and the screenshot matrix.
7. Human steps (App Store Connect record, AdMob app and units) follow docs/14 and docs/11.

---

## 12. Workspace packages consumed as TypeScript source

Nothing is compiled ahead of time. Each tool reads `.ts` directly:

| Tool | How `@e07/shell/ui/app-text.tsx` resolves | Verified |
|---|---|---|
| Metro (`expo export`, Xcode bundling) | `node_modules/@e07/shell` symlink → package `exports` `"./*": "./src/*"`; Expo's monorepo defaults add the root to `watchFolders`; Babel transforms the source; React Compiler applies to Shell code | yes: store and test exports, Release simulator build and launch |
| Jest (jest-expo, babel-jest) | same symlink and `exports`; `transformIgnorePatterns` does not exclude workspace packages because their real path is outside `node_modules` | yes: 31 tests incl. self-references |
| `tsc` 6 (`moduleResolution: bundler`) | `exports` + `allowImportingTsExtensions`; one program per workspace (docs/04) | yes: all projects |
| ESLint (`import/*` rules) | `eslint-import-resolver-typescript` through the same `exports` | yes: zones fire on resolved paths |
| Node 26 (tooling, `app.config.ts`) | package self-reference through `exports`; the symlink resolves to the real path under `packages/`, which is outside `node_modules`, so type stripping is allowed | yes |

Consequences to remember:

- **Node refuses to type-strip files inside a `node_modules` path.** Workspace packages work only because npm links them and Node follows the link to `packages/…`. Do not publish these packages or install them as tarballs. **Source:** [Node.js TypeScript](https://nodejs.org/api/typescript.html) ("refuses to handle TypeScript files inside folders under a node_modules path").
- **Node ignores tsconfig `paths`**, so no `@/` aliases anywhere: the package name is the alias.
- **Tooling can import app code** (level generation, art rendering, bots) because game rules are plain TypeScript with explicit extensions.
- **One React.** Metro in the harness bundled only the app's React copy even while a duplicate sat at the root, but Jest resolves from the root; the `overrides` in 4.1 removes the duplicate everywhere.

---

## Checklist

- [ ] `npm ls react react-native` shows one version of each; every native module is a dependency of every app with the same version, and a Shell `peerDependency`.
- [ ] Every workspace `package.json` has the `exports` map from section 4; packages have `"type": "module"`.
- [ ] No `../` imports, every relative import has its extension, no `index.ts` barrels (except the two app entry files).
- [ ] game-kit, `apps/*/src/rules` and `apps/*/src/levels` import no React, RN, Expo, Skia, zustand or Shell code.
- [ ] Vendor SDKs are imported only by their adapter files; each port has a fake.
- [ ] `apps/<id>/app.config.ts` is the one `withShell(gameConfig, process.env)` statement; `index.ts` is the 3-line entry; no runtime file imports `game.config.ts`.
- [ ] `expo.extra` contains no `null` (`npx expo config --json | grep -n '{}'` shows nothing unexpected).
- [ ] `npx expo config --json`, `npx expo config --type introspect`, `npx expo install --check` and `npx expo-doctor` pass for every app and variant.
- [ ] The app's module is `ShellGameModule<Types>`; the section 7.5 contract tests pass.
- [ ] New files are where section 10 says; a new kind of file got a row.
- [ ] The store bundle has no debug sentinel and `E07AppVariant` is `store` (docs/14 gate).

---

## Sources

- Expo monorepos guide: https://docs.expo.dev/guides/monorepos/
- Expo TypeScript guide (app config in TypeScript): https://docs.expo.dev/guides/typescript/
- Expo app config reference (`locales`, `ios.*`, `plugins`, `extra`): https://docs.expo.dev/versions/v57.0.0/config/app/
- Expo localization guide (display name per language): https://docs.expo.dev/guides/localization/
- Expo config plugins: https://docs.expo.dev/config-plugins/introduction/
- Expo environment variables (`EXPO_PUBLIC_`, dot access): https://docs.expo.dev/guides/environment-variables/
- Expo Constants: https://docs.expo.dev/versions/v57.0.0/sdk/constants/
- Metro configuration (`cacheVersion`): https://metrobundler.dev/docs/configuration/#cacheversion
- Metro package exports: https://metrobundler.dev/docs/package-exports/
- Node.js TypeScript type stripping: https://nodejs.org/api/typescript.html
- Node.js v22.18.0 (type stripping on by default): https://nodejs.org/en/blog/release/v22.18.0
- Node.js packages: subpath patterns and self-referencing: https://nodejs.org/api/packages.html#subpath-patterns and https://nodejs.org/api/packages.html#self-referencing-a-package-using-its-name
- npm `overrides`: https://docs.npmjs.com/cli/v11/configuring-npm/package-json#overrides
- TypeScript `allowImportingTsExtensions`: https://www.typescriptlang.org/tsconfig/#allowImportingTsExtensions
- TypeScript `strictFunctionTypes` (parameter contravariance): https://www.typescriptlang.org/tsconfig/#strictFunctionTypes
- eslint-plugin-import `no-restricted-paths`: https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md
- valibot: https://valibot.dev/ and https://www.npmjs.com/package/valibot

---

## Verified

On 2026-09-26, in a throwaway npm-workspaces monorepo with the canonical layout (`scratchpad/rn/writer-arch-nav/ws`: `packages/{game-kit,shell,tooling}`, `apps/line-siege`, root `test/`), on macOS with Node 26.4.0, npm 11.17.0, Xcode 26.6, iOS 26.5 simulator (iPhone 17), and expo 57.0.25, react-native 0.86.3, react 19.2.3, TypeScript 6.0.3, ESLint 9.39.5, typescript-eslint 8.70.1, eslint-plugin-import 2.32.0, Jest 29.7.0, jest-expo 57.0.5, Metro 0.84.6, @expo/cli 57.0.27, @react-navigation/native 7.4.1, native-stack 7.19.2, expo-sqlite 57.0.3, expo-constants 57.0.19, zustand 5.0.15, valibot 1.5.0, Prettier 3.9.9:

- **Contract.** Every file of section 7 plus stub copies of docs/08's engine and board types, docs/09's `GameArt`/`SoundBank` and docs/05's `Palette` type-checked under the strict tsconfig; a complete toy `ShellGameModule` compiled, including `createGameHost<T>` with no cast.
- **Lint.** All code blocks in this doc passed docs/04's complete `eslint.config.mjs` (copied verbatim from the doc) with `--max-warnings 0`. The app-zone block of section 5.3, appended to that config, rejected app→app and app→Shell-store imports and accepted `game-host`/`theme` type imports.
- **Composer.** `npx expo config --json` and `--type introspect` for `test/test`, `store/live` and `store/off`: correct app IDs (Google sample IDs in test), 50 SKAdNetwork IDs, Vazirmatn fonts, no background modes, URL scheme only in test, `deploymentTarget` 16.4, `E07AppVariant` from the path-referenced local plugin, `extra.game` present. Failure cases: unset `EXPO_PUBLIC_APP_VARIANT` with `APP_VARIANT=store`, `store`+`test` ads, and `NODE_OPTIONS=--no-strip-types` all failed loudly. `null` in `extra` printed as `{}`.
- **Metro and variants.** `expo export --platform ios` with `@e07/<pkg>/<path>.ts(x)` self-references: store/test alternation correct with the cache key, wrong without it.
- **Device.** Prebuild + Release simulator build (arm64, `CODE_SIGNING_ALLOWED=NO`, ~2 min clean): the 3-line `index.ts` → `startShell` → `createShellApp` booted, read `extra.game` and the version through `expo-constants`, wrote the save; `npx expo-doctor` 21/21.
- **Tooling.** `node packages/tooling/src/save/inspect-save.ts` (type stripping) imported Shell save modules and ran the real SQL; Node printed `MODULE_TYPELESS_PACKAGE_JSON` when it imported app files (apps have no `"type"`).
- **Reviewer re-run (2026-09-26, `scratchpad/rn/verify-architecture-state/ws`).** Every code block of this doc and docs/06 extracted verbatim into a copy of the harness, with docs/04's current `tsconfig` files and `eslint.config.mjs`, docs/14's `src/app/test-only.ts`, docs/10's kv guard adapter and stubs for the files `src/index.ts` imports: `tsc` passes for all five programs, ESLint `--max-warnings 0` (plus the section 5.3 zones, including `services/audio/synth`) and Prettier pass, Jest 9 suites / 31 tests pass. `npx expo config --json` for `test/test`, `store/live` and `store/off`: `extra.adUnits` only in `store/live`, `E07AppVariant` from the `@public` plugin. Package facts checked on npm and in `node_modules` (versions above, `expo` has no `exports` map, `ios.deploymentTarget` in `@expo/config-types` 57.0.2, SDK 57 map: `expo-system-ui ~57.0.4`), and App Store Connect's `ageRatingDeclarations` attributes on developer.apple.com.
- **Integration pass (2026-09-26, `scratchpad/integ/ws`, a copy of the reviewer's workspace).** `shellPlugins` now points `expo-font` at the app-relative `./assets/fonts/` (docs/10 owns the files): `npx expo config --type introspect` in `apps/line-siege` resolved `UIAppFonts` to both Vazirmatn files, and failed in `expo-font`'s `resolveFontPaths` when the folder was missing. `ErrorSource` gained `'boot'`, `'i18n'` and `'network'` and the Shell program still type-checks; `line-siege-types.ts` imports `LineSiegeView` from docs/08's `board/to-view.ts`; the root `engines` now include docs/01's `npm >=11.17.0`.
- **App zones merged (2026-09-26, `scratchpad/fix-final/repo` and `ws06`).** With the zones inside docs/04's single config: an app→app import (a second probe app) and an app→Shell-store import fail; `asGameKey` from `@e07/shell/i18n/messages.ts`, the audio port and the theme types pass; the config loads without an `apps/` folder; the docs/02 and docs/06 workspace copy lints clean (176 files).
- **Re-verify** when versions age: `npm view <pkg> version` for each row of docs/01's table, `npx expo install --check` and `npx expo-doctor` in every app, `npx expo config --json` for every variant, then rerun `npm run verify` and one Release simulator build.

---

## Open issues

1. **Resolved: app zones are in docs/04's listing** (block 5-zones, merged 2026-09-26, with `services/audio/synth` for docs/09's recipe tests and `i18n/messages.ts` for docs/10's `asGameKey`).
2. **`MODULE_TYPELESS_PACKAGE_JSON` for app code in tooling.** The packages now declare `"type": "module"` (docs/04, docs/14), but apps cannot while `metro.config.js` is CommonJS (docs/14). Verified alternative: `"type": "module"` plus renaming the file to `metro.config.cjs` (Metro found it; the variant cache key still worked; `expo-doctor` passed). Decide in docs/14; until then the warning is harmless noise.
3. **Resolved: `ErrorSource` now has `'boot'`, `'i18n'` and `'network'`** (docs/04 section 6.2, copied in section 6.2 here). `createShellApp` logs docs/10's `direction-restart-failed` as `'boot'` (docs/06), the i18n provider's `onError` records `'i18n'` (docs/10), and the test-only network guard records `'network'` (docs/13).
4. **Resolved: `null` in `expo.extra` becomes `{}` on the device.** `withShell` above omits `adUnits` unless it has units (rule 10), docs/11's `readAdsExtra` reads a missing key as "no units", and docs/11's checklist now says "no `adUnits` key" for test builds.
5. **Resolved: store file paths.** docs/12 keeps the Premium store in `packages/shell/src/stores/premium/` (section 3 tree), and docs/05's examples now import `@e07/shell/stores/premium/premium-store.ts`.
6. **`index.ts` "3 lines" (FINAL A.8)** holds only because `startShell` takes the module alone and the runtime config arrives through `expo.extra`. Any future need to pass `game.config.ts` values at runtime must go through `extra`, not another statement.
