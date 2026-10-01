---
name: architecture-and-boundaries
description: Places Pocket Arcade code by workspace, folder and import zone (game-kit, Shell, tooling, apps), the nine ports and fakes, the GameModule seam, withShell wiring, build variants. Use when placing a new file, package, port or game, or on an import-boundary error. Not for names (naming-conventions).
---

# Architecture and boundaries

One monorepo holds one reusable Shell and about 26 game apps. This skill keeps its shape: four kinds of workspace, dependencies that point one way, every external service behind a port, one seam between a game and the Shell, one wiring pattern per app, build variants that decide what a build contains, and a place for every file. Two checkers prove the repo still has that shape.

## Rules that must hold

1. **Exactly four kinds of workspace.** `packages/game-kit`, `packages/shell`, `packages/tooling` and one `apps/<game-id>` per game, declared by `"workspaces": ["apps/*", "packages/*"]`. Why: one Shell change reaches every game; a fifth package is an owner decision (stop and ask).
2. **Dependencies point one way.** game-kit ← shell ← apps; tooling may import anything and no app, Shell or game-kit code imports tooling (only root Node tests under `test/` may call a tooling helper); the Shell never imports an app; apps never import each other. Why: spec N5 (one Shell) and headless rules for bots, solvers and replays.
3. **Rules and levels are pure.** `apps/<id>/src/{rules,levels}` import only game-kit and their own rules/levels files; game-kit imports only itself; no React, React Native, Expo, Skia, zustand or Shell. Why: they must run in plain Node, identically on every device.
4. **A game reaches the Shell only through its seam.** Game code imports only the game-facing Shell modules (`game-host/`, `art/`, `i18n/messages.ts`, `services/audio/audio-port.ts`, `services/audio/synth/`, `theme/theme-types.ts`) and exports one `ShellGameModule<Types>`; the Shell touches a game's own types only inside `createGameHost<T>`. Why: screens, stores and navigation stay game-agnostic with no casts.
5. **Every external service sits behind a port.** The type lives in `services/<port>/<port>-port.ts`, only `<vendor>-<port>-adapter.ts` imports the SDK, and every port has an in-memory `fake-<port>.ts`; the nine ports keep their canonical names. Adapters and stores are created once, in the composition root (`createDeviceAdapters()` and `createShellParts`, game-host-integration), and handed down through `ServicesProvider`/`StoresProvider`; React Context carries dependencies only. Why: Jest never touches native code and swapping a vendor touches one file.
6. **App code never imports Node-world code.** Not even with `import type`: `packages/tooling`, `packages/shell/plugins`, `app.config.ts` and any config file that reaches `node:*` or `expo/config-plugins` stay out of app programs; only neutral config files (types, pure parsers) are shared. Why: a type-only import still drags `process` and `node:fs` into the app program.
7. **Packages are TypeScript source.** Packages have `"type": "module"` and `"exports": { "./*": "./src/*" }` (the Shell also `./plugins/*`), no build step, no `main`, no barrel; every native module is a dependency of every app with one version, and a Shell `peerDependency`; the root `overrides` pins `react` and `react-native`. Why: Metro, Jest, tsc and Node all resolve source through `exports`, and two Reacts break Jest.
8. **Per-game values live only in `game.config.ts`.** App code never imports it; `withShell` embeds the runtime subset as `expo.extra.game`, read by `readGameExtra()`; never put `null` in `extra` (it arrives as `{}` and crashes the parser). The app id is always `io.applander.<game id without hyphens>` (iOS bundle and Android package; Line Siege `io.applander.linesiege`) and Premium is `<bundleId>.premium` (owner decision O4): `withShell` throws on anything else, `com.example.*` included. Why: one file per game, real ad IDs reach only live builds, and a placeholder id must never reach a build.
9. **Each app is wired the same way.** `app.config.ts` is one statement, `export default withShell(gameConfig, process.env);`; `index.ts` is 3 lines ending in `startShell(<game>Game)`; native settings come only from `withShell`, the ONE plugin list `shellPlugins` (`packages/shell/src/config/shell-plugins.ts`, one line per native module naming its owner skill) and path-referenced plugins in `packages/shell/plugins/`. Why: Continuous Native Generation, the polyfills and direction check must run first, and a second plugin list is how a module silently goes missing from a build.
10. **Build variants decide inclusion.** `APP_VARIANT` and `EXPO_PUBLIC_APP_VARIANT` (same value) and `ADS_MODE` are set for every build; test-only code is reachable only through `packages/shell/src/app/test-only.ts` behind the literal `process.env.EXPO_PUBLIC_APP_VARIANT === 'store'` comparison; every app's `metro.config.js` keys `cacheVersion` on the variant. Why: verified twice, an imported constant or an unkeyed cache shipped the debug menu in a store build.
11. **Every file has one home.** Place files by the placement table; a new kind of file gets a row (the owner decides). No module does work at import time: no database, adapter, domain store or AudioContext creation and no direction switch at module level. Why: the agent finds code by path, and a direction reload re-runs every module.

## Workflow

1. Name the task and read its reference before writing code:

   | Task | Read |
   |---|---|
   | new package, app folder, dependency or top-level folder | [references/workspaces-and-layout.md](references/workspaces-and-layout.md) |
   | an import across folders or packages, or a boundary lint error | [references/dependency-zones.md](references/dependency-zones.md) |
   | a new or changed service, adapter or fake | [references/ports-and-adapters.md](references/ports-and-adapters.md) |
   | wiring a game into the Shell, or a new contract member | [references/game-module-seam.md](references/game-module-seam.md) |
   | `game.config.ts`, `app.config.ts`, `index.ts`, `withShell`, a config plugin, a build variant, test-only code | [references/app-wiring-and-variants.md](references/app-wiring-and-variants.md) |
   | where a new file goes; adding a screen, a port or a game | [references/file-placement.md](references/file-placement.md) (the three recipes) |

2. Copy the matching template and fill every `__PLACEHOLDER__` (table below; `__GAME_ID__` is the game's folder name). For a port, follow the port recipe and imitate [examples/clock-port/clock-port.ts](examples/clock-port/clock-port.ts), [examples/clock-port/system-clock-adapter.ts](examples/clock-port/system-clock-adapter.ts) and [examples/clock-port/fake-clock.ts](examples/clock-port/fake-clock.ts). Files marked "synced from the library" in the Files table are shared with other skills byte for byte: to change one, edit its canonical copy in the skill library's shared folder and run `node skills/_library/sync-shared.mjs`. For a game, imitate [examples/game-config.ts](examples/game-config.ts) and [examples/line-siege-module.ts](examples/line-siege-module.ts). Let Prettier format filled files.
3. At the Shell's native step (Shell step 8: every package on the plugin list installed in every app, before the first simulator build), copy `templates/with-shell.ts`, `templates/with-shell.test.ts`, `templates/shell-plugins.ts` and `templates/shell-plugins.test.ts` to `packages/shell/src/config/`, replacing the bootstrap's phase-0 composer and its test; then `npx jest packages/shell/src/config --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/config/**/*.ts' --coverageThreshold='{}'` and `npx expo config --json` in every app (for each variant). The swap changes the phase-0 test's assertions on purpose, so commit it with this exact trailer line in the trailer paragraph (`check-test-edits` then accepts the changed assertions): `Spec-Change: with-shell final composer (phase 0 placeholder replaced)`. Other skills name `shellPlugins` for their module; none adds a second list.
4. Stop and ask the owner before a fifth workspace, a new game-facing Shell module, a new vendor SDK, or a change to the zones: each is an architecture change that also edits `eslint.config.mjs` (with a `Gate-Change:` trailer) and this skill's `assets/architecture-rules.json`.
5. Check (validation loop). When `node_modules` exist: `npm run lint`, `npm run typecheck`, `npm ls react react-native` (one version each), and in every app `npx expo config --json` (for the variants you touched), `npx expo install --check` and `npx expo-doctor`. Always: `node ${CLAUDE_SKILL_DIR}/scripts/check-layout.mjs .` and `node ${CLAUDE_SKILL_DIR}/scripts/check-boundaries.mjs .`. Fix every `FAIL` line (file, rule, fix) and rerun until both print `RESULT: PASS`.

In a new repo each file lands at the Shell build step the project index gives it (named in the table); a later game or port reuses the same destinations.

| Template | Destination in the app repo |
|---|---|
| `templates/package.root.json` | root `package.json` at Shell step 1, the bootstrap (the repo's one root manifest, synced from the library: workspaces, engines, overrides, scripts) |
| `templates/package.game-kit.json`, `templates/package.shell.json`, `templates/package.tooling.json` | `packages/<name>/package.json` at Shell step 1 |
| `templates/package.app.json` | `apps/<game-id>/package.json` at Shell step 1 |
| `templates/app.config.ts`, `templates/index.ts`, `templates/game.config.ts`, `templates/metro.config.js` | `apps/<game-id>/`: the bootstrap writes them at Shell step 1 with a placeholder `index.ts`, and the 3-line `index.ts` replaces it at step 7 |
| `templates/game-types.ts` | `apps/<game-id>/src/<game-id>-types.ts` at Shell step 7, with the game module |
| `templates/port.ts`, `templates/vendor-port-adapter.ts`, `templates/fake-port.ts`, `templates/fake-port.test.ts` | `packages/shell/src/services/<port>/<port>-port.ts`, `<vendor>-<port>-adapter.ts`, `fake-<port>.ts`, `fake-<port>.test.ts` |
| `templates/services-context.tsx` | `packages/shell/src/app/services-context.tsx` at Shell step 7, with the composition root |
| `templates/error-log-port.ts`, `templates/fake-error-log.ts`, `templates/fake-error-log.test.ts` | `packages/shell/src/services/error-log/` as is at Shell step 4, with the save layer (the SQLite adapter comes from save-persistence-and-migrations) |
| `examples/clock-port/clock-port.ts`, `fake-clock.ts`, `fake-clock.test.ts`, `system-clock-adapter.ts` | `packages/shell/src/services/clock/` as is, when missing (the same files the save skill ships at Shell step 4) |
| `templates/read-game-extra.ts`, `templates/read-game-extra.test.ts` | `packages/shell/src/app/` at Shell step 7, with the composition root (needs `valibot` in the Shell and `expo-constants` in every app and as a Shell peer) |
| `templates/app-variant.ts`, `templates/app-variant.test.ts` | `packages/shell/src/config/` at Shell step 1, the bootstrap |
| `templates/with-shell.ts`, `templates/with-shell.test.ts`, `templates/shell-plugins.ts`, `templates/shell-plugins.test.ts` | `packages/shell/src/config/` at the Shell's native step (Shell step 8): they replace the bootstrap's phase-0 `with-shell.ts` and its test once every plugin's package is installed (app-wiring-and-variants.md, "withShell") |
| `templates/test-only.ts`, `templates/test-only-api.ts`, `templates/test-only-entry.ts` | `packages/shell/src/app/` at Shell step 6 (the boot pieces that compile alone): the gate and the one shared test-only pair. At step 6 the pair holds only `TEST_BUILD_SENTINEL` (delete every other member and its export: a member joins once the file behind it exists), so `test-only.ts` compiles; the Shell core's members join at step 7, where `hydrate-save.ts` is the first save file that imports the gate. No step-4 or step-5 template imports it. `DebugScreen` stays out while S15 is outside `shell-slice.json` |
| `templates/with-app-variant-marker.ts` | `packages/shell/plugins/with-app-variant-marker.ts` at Shell step 1, the bootstrap (the shape of every local config plugin) |

## Definition of done

- [ ] `npm run lint` and `npm run typecheck` pass (the app zones, vendor bans and Node/app worlds are part of them).
- [ ] `npm ls react react-native` shows one version of each; every native module is a dependency of every app with the same version, and a Shell `peerDependency`.
- [ ] `npx expo config --json`, `npx expo install --check` and `npx expo-doctor` pass for every app you touched (and each variant you changed); `expo.extra` has no `null`.
- [ ] New files sit where the placement table says; a new kind of file got a row approved by the owner.
- [ ] A new port has its port file, adapter, fake and fake test, is in `Services`, is created once in the composition root (`device-adapters.ts`, faked in `create-test-adapters.ts`) and faked in `renderWithShell`.
- [ ] `app.config.ts` is the one `withShell` statement, `index.ts` the 3-line entry, `metro.config.js` keys the cache on the variant, and no runtime file imports `game.config.ts`.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-layout.mjs .` prints `RESULT: PASS` (workspaces, manifests, one React, wiring, folders, ports, placement, import-time work).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-boundaries.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **A `utils` package or a shared folder "for now".** Shared pure code goes into game-kit, shared React Native code into the Shell; a fifth workspace is an owner decision.
- **Importing a Shell store or screen from game code.** The game hands data to the Shell through its `GameModule`; if a game needs more, add a type-erased member to the seam.
- **Letting an SDK leak past its adapter.** A screen that imports `expo-iap` (or `expo-sqlite/kv-store`, which ESLint's bare-name ban misses) couples the UI to a vendor and to native code in Jest; take the port from `useServices()`.
- **`import type` from `with-shell.ts` or tooling "because it is only a type".** It still pulls Node into the app program; move the type to a neutral file.
- **An `IS_TEST_BUILD` constant around `require()`.** Metro keeps the module in the store bundle; only the literal comparison in `test-only.ts` strips it.
- **Test-only code reading `TEST_ONLY`.** The debug screen, its model, the parity harness and the perf tools are reached from `test-only-entry.ts`; importing `app/test-only.ts` again (directly or through `use-parity-opener.ts` or `use-reduce-motion.ts`) closes an import loop through the gate (`import-cycle`). They import the member from its own file, such as `parityFrameState` from `app/parity/parity-session.ts`.
- **Reading `game.config.ts` at runtime, or `null` in `extra`.** Runtime values come from `expo.extra.game` through `readGameExtra()`, with absent keys instead of `null`.
- **Creating stores, databases or adapters at module level.** A direction reload re-runs every module and doubles the writes; create them in the composition root (`createDeviceAdapters()`, `createShellParts`).
- **Editing `ios/` or setting native options outside `withShell`.** Prebuild regenerates `ios/`; use a config plugin in `packages/shell/plugins/`.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/workspaces-and-layout.md](references/workspaces-and-layout.md) | The four workspaces, owners, the full tree, manifests, TypeScript-source consumption, import-time work | Workflow step 1 (packages, folders, dependencies) |
| [references/dependency-zones.md](references/dependency-zones.md) | The allowed graph, zones, what enforces each edge, game-facing modules, vendor SDKs, banned packages, Node vs app world, the zone blocks of the ESLint config | Workflow step 1 (imports, boundary errors) |
| [references/ports-and-adapters.md](references/ports-and-adapters.md) | The nine ports with full signatures, injection, DI rules, the add-a-port recipe | Workflow step 1 (services) |
| [references/game-module-seam.md](references/game-module-seam.md) | The GameModule contract files, the Shell binding, `createGameHost`, contract tests | Workflow step 1 (wiring a game) |
| [references/app-wiring-and-variants.md](references/app-wiring-and-variants.md) | `GameConfig`, `app.config.ts`, `index.ts`, `withShell`, `extra.game`, config plugins, the variant matrix, test-only stripping, Metro cache | Workflow step 1 (wiring, variants) |
| [references/file-placement.md](references/file-placement.md) | The placement table and the add-a-screen, add-a-port, add-a-game recipes | Workflow step 1 (new files) |
| `templates/package.root.json` | Root manifest: workspaces, engines, one React, overrides, scripts (synced from the library; do not edit here) | New repo; SDK upgrade |
| `templates/package.game-kit.json` | game-kit's starting manifest (synced from the library: the bootstrap writes the same bytes) | New repo |
| `templates/package.shell.json` | The Shell's starting manifest with `exports`, the Intl polyfills and the first native peers (synced from the library); each later skill adds its own packages through dependency-management | New repo; a new native module |
| `templates/package.tooling.json` | Tooling's starting manifest (synced from the library) | New repo |
| `templates/package.app.json` | The pilot app's manifest (name, exports, workspace deps; synced from the library). Later apps copy the newest app's `package.json` in lockstep (new-game-scaffold) | New game |
| `templates/app.config.ts` | The one-statement app config (synced from the library, like `index.ts`, `metro.config.js`, `app-variant*.ts`, `test-only.ts` and `with-app-variant-marker.ts`: the other skills that write the same repo file get the same bytes; do not edit here) | New game |
| `templates/index.ts` | The 3-line app entry | New game |
| `templates/game.config.ts` | Every per-game value, with the new-game scaffold's placeholders (synced from the library) | New game |
| `templates/metro.config.js` | Metro config with the variant cache key | New game |
| `templates/game-types.ts` | The game's `ShellGameTypes` bag (synced from the library, the same bytes as game-host-integration's) | New game |
| `templates/port.ts` | A vendor-neutral port type | New service |
| `templates/vendor-port-adapter.ts` | The adapter: the only SDK importer, errors mapped to values | New service |
| `templates/fake-port.ts` | The in-memory fake with a call counter | New service |
| `templates/fake-port.test.ts` | Tests for the fake | New service |
| `templates/services-context.tsx` | `Services`, `ServicesProvider`, `useServices` with the nine ports | New repo; a new port |
| `templates/error-log-port.ts` | `ErrorLogPort`, `ErrorSource`, `ErrorLogEntry` (synced from the library; do not edit here) | New repo (before the save skill's adapter) |
| `templates/fake-error-log.ts` | `createFakeErrorLog`: the in-memory error log tests pass (synced from the library) | New repo |
| `templates/fake-error-log.test.ts` | Its tests (synced from the library) | With the fake |
| `templates/read-game-extra.ts` | `readGameExtra()` (valibot parse of `expo.extra.game`, throws on a composer bug) and `readAppVersion()` | New repo, before the composition root |
| `templates/read-game-extra.test.ts` | Its tests: the embedded config, the App Store id, an empty-object null, a missing key, no extra | With `read-game-extra.ts` |
| `templates/with-shell.ts` | The final config composer: phase 0 plus the app-id guard (`appIdOf`, owner decision O4), the privacy manifest, `shellPlugins`, the per-language name and ATT text (`locales`) and `withGameArt` | Shell native step (replaces the bootstrap's) |
| `templates/with-shell.test.ts` | Its tests: variants, ad units, names and ATT texts per language, the app ids (`com.example.*` and hyphens refused), the plugin order, the privacy manifest, the art only for a drawn game | With `with-shell.ts` |
| `templates/shell-plugins.ts` | `shellPlugins(game, adsMode)`: the ONE native-module plugin list, each line naming its owning skill (the `expo-tracking-transparency` entry included), and `TRACKING_USAGE_DESCRIPTIONS` read from the four Shell catalogs | Shell native step; a new native module |
| `templates/shell-plugins.test.ts` | Its tests: every module once, locales and fonts, bare `expo-iap`, AdMob ids per mode, the ATT entry with the catalog's en text | With `shell-plugins.ts` |
| `templates/app-variant.ts` | `resolveBuildVariant`: the variant matrix as code | New repo; a variant change |
| `templates/app-variant.test.ts` | Its tests (defaults, mismatch, forbidden pairs) | With `app-variant.ts` |
| `templates/test-only.ts` | The literal gate that strips test-only code from store bundles | New repo |
| `templates/test-only-api.ts` | `TestOnlyApi`, the type of the one shared test-only pair (synced from the library; do not edit here): one member per entry export; trim it to the members whose files exist (sentinel-only at Shell step 6) | Shell step 6 (sentinel only), then each step that adds a member's file |
| `templates/test-only-entry.ts` | The pair's entry: every test-only export `@public` plus `TEST_BUILD_SENTINEL` (synced from the library; do not edit here) | With `test-only-api.ts` |
| `templates/with-app-variant-marker.ts` | A local config plugin (default export, `@public`) | A new config plugin |
| [examples/clock-port/clock-port.ts](examples/clock-port/clock-port.ts) | A complete port type (the four clock files are synced from the library) | Workflow step 2 (ports); copy when the clock files are missing |
| [examples/clock-port/system-clock-adapter.ts](examples/clock-port/system-clock-adapter.ts) | Its device adapter | Workflow step 2 (ports) |
| [examples/clock-port/fake-clock.ts](examples/clock-port/fake-clock.ts) | Its controllable fake | Workflow step 2 (ports) |
| [examples/clock-port/fake-clock.test.ts](examples/clock-port/fake-clock.test.ts) | The fake's tests | Workflow step 2 (ports) |
| [examples/game-config.ts](examples/game-config.ts) | A complete `game.config.ts` (Line Siege) | Workflow step 2 (games) |
| [examples/line-siege-module.ts](examples/line-siege-module.ts) | A game's `src/index.ts`: assembly only | Workflow step 2 (games) |
| `scripts/check-boundaries.mjs` | Resolves every import and checks zones, purity, game-facing modules, Node world, vendor SDKs, banned packages, the test-only gate, `../` and cycles (a loop back through the test-only gate is named as such) | Workflow step 5 |
| `scripts/check-layout.mjs` | Checks workspaces, manifests, one React, native deps, app wiring, folders, port triples, placement and import-time work | Workflow step 5 |
| `scripts/lib/import-graph.mjs` | Builds and resolves the import graph (workspace `exports`, built-ins, packages), finds cycles and Node-world reach | Only when changing a checker |
| `scripts/lib/source-scan.mjs` | Dependency-free lexer for comments, strings and imports (synced from the library; do not edit here) | Only when changing a checker |
| `scripts/lib/workspaces.mjs` | Reads the workspace packages (synced from the library) | Only when changing a checker |
| `scripts/selftest.mjs` | Proves both checkers pass good fixtures and catch every planted bug | After changing a checker or the rules data |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/architecture-rules.json` | Workspaces, game-facing modules, vendor SDKs, banned packages, canonical folders, the nine ports | When the owner changes the architecture |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad mini repos for the self-test | When adding a rule to a checker |

## Related skills

- `typescript-and-lint-rules` - the ESLint config that carries the zones, and the tsconfig worlds.
- `naming-conventions` - names of the files and exports placed here.
- `monorepo-bootstrap` - creating the monorepo from empty with these manifests.
- `new-game-scaffold` - the script that creates an app with this wiring.
- `game-host-integration` - the game host behind `createGameHost` and the session flow.
- `game-rules-engine` - the engine types inside the `GameModule` contract.
- `ios-simulator-build` - building each variant and checking the store bundle.
