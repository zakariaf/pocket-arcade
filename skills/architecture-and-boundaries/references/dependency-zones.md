# Dependency zones: which code may import which

The one-way dependency graph of the monorepo, the zones every file belongs to, what enforces each edge (the ESLint config and `check-boundaries.mjs`), and the Node-world/app-world split. Read this before adding an import across folders, and whenever an import is rejected.

## Contents

- The allowed graph
- Zones
- What enforces each edge
- The app zones and the game-facing Shell modules
- Vendor SDKs and banned packages
- Node world versus app world
- Cycles and parent imports
- The ESLint blocks that carry the zones

## The allowed graph

Dependencies point one way: game-kit ← shell ← app entry files. Tooling may import anything; nothing imports tooling. The Shell never imports an app; apps never import each other.

```
                    ┌──────────────────────────────┐
                    │ packages/tooling (Node only) │ ── may import anything below
                    └──────────────────────────────┘
apps/<id>/app.config.ts ──► shell/src/config/** (Node world) ──► shell/plugins/** (by path string)
apps/<id>/index.ts ──► shell/src/app/start-shell.ts, apps/<id>/src/index.ts
apps/<id>/src/{board,art,sounds,sim,tutorial,testing,i18n,index.ts} ──► shell game-facing modules, game-kit
apps/<id>/src/{rules,levels} ──► game-kit only                        (PURE + DETERMINISTIC)
packages/shell/src ──► game-kit                                        (never an app, never tooling)
packages/game-kit/src ──► nothing of ours                              (PURE + DETERMINISTIC)
```

Why: spec N5 (one Shell for every game); pure rules must run headless for bots, solvers and replays (spec 8.13); the Shell must never learn a game's types except through the `GameModule` seam.

## Zones

`check-boundaries.mjs` puts every `.ts`/`.tsx` file in one zone by path:

| Zone | Files | May import |
|---|---|---|
| game-kit | `packages/game-kit/src/**` | game-kit only; npm packages except React, React Native, Expo, Skia, zustand, navigation and i18n libraries; no Node built-ins |
| shell | `packages/shell/src/**` except `config/` | shell and game-kit; npm packages; never an app, tooling, a Node built-in or a Node-world file |
| shell-node | `packages/shell/src/config/**`, `packages/shell/plugins/**` | shell, game-kit, Node built-ins, npm packages; never an app or tooling |
| tooling | `packages/tooling/**` | anything |
| app-entry | `apps/<id>/index.ts` | `@e07/shell/app/start-shell.ts` and its own `./src/index.ts` |
| app-config | `apps/<id>/app.config.ts` | `@e07/shell/config/**` and `./game.config.ts` |
| game-config | `apps/<id>/game.config.ts` | `@e07/shell/config/game-config.ts` (types only) |
| app-pure | `apps/<id>/src/{rules,levels}/**` | game-kit and its own rules/levels files; no framework packages (a `*.test.ts` there may also import its own app's other folders, such as the board timeline it replays; the engine assembly `rules/<id>-engine.ts` may import `board/build-timeline.ts`, the pure timeline builder the `GameEngine` contract names) |
| app-game | the rest of `apps/<id>/src/**` (tests included) | its own app, game-kit, and the game-facing Shell modules |
| tests | root `test/**`, `jest.setup.ts`, `__mocks__/**` | anything (Node world, never bundled; a sim may call a tooling report writer) |

## What enforces each edge

| Boundary | ESLint (the one `eslint.config.mjs`) | `check-boundaries.mjs` rule |
|---|---|---|
| game-kit imports nothing of ours and no framework | `GAME_KIT_BOUNDARY` + `PURE_IMPORTS` | `game-kit-pure` |
| `apps/*/src/{rules,levels}` pure | `PURE` files + `PURE_IMPORTS` (bans React, RN, Expo, Skia, zustand, `@e07/shell`) | `rules-pure` (also bans their own board/art files; a rules test may drive the game's own board or timeline code for a replay check, while every levels file, tests included, imports only game-kit and the game's own rules/ and levels/, exactly the zone level-generation-and-solvers' `check-levels.mjs` enforces) |
| the Shell never imports an app or tooling | `SHELL_BOUNDARY`, `NO_TOOLING` | `shell-direction`, `no-tooling-import` |
| runtime code never imports tooling or Node built-ins | `NO_TOOLING`, `NODE_BUILTINS` in `RUNTIME_IMPORTS` | `no-tooling-import`, `node-builtin` |
| no Node-world file in an app program, not even `import type` | the tsconfig worlds (the file fails to type-check) | `node-world-import` |
| no parent-relative imports | `PARENT_IMPORT` | `parent-import` |
| only the adapter imports its SDK | `VENDOR_SDK_PATHS` + the `ADAPTERS` exemption block | `vendor-sdk` (also catches subpaths) |
| apps never import each other | block 5-zones (`import/no-restricted-paths`, one zone per app) | `app-to-app` |
| game code imports only the game-facing Shell modules | block 5-zones (`GAME_FACING`) | `game-facing` |
| determinism in rules, levels, sim, geom, game-kit | `DETERMINISTIC` + `no-restricted-properties` | (typescript-and-lint-rules) |
| no import cycles | `import/no-cycle` | `import-cycle` |

`import/no-restricted-paths` works on resolved file paths, so it catches every spelling of an import; `check-boundaries.mjs` also resolves every import (relative paths and `@e07/<package>/<path>` through each package's `exports` map) before judging it.

## The app zones and the game-facing Shell modules

Game code may import only these Shell modules (`GAME_FACING`):

| Module | Why games need it |
|---|---|
| `game-host/` | `ShellGameModule`, `ShellGameTypes`, board types, `useBoardGestures`, the fixed-step loop |
| `art/` | `GameArt` (`palettes`, `logo`, `credits`), `LogoArt`, `CreditEntry` |
| `services/audio/audio-port.ts` | `SoundBank` and `SoundSpec` for the game's sound bank |
| `services/audio/synth/` | the pure synth recipes that game sound tests call |
| `theme/theme-types.ts` | `Palette` for the game's UI palette |

No i18n module is game-facing. A game's texts are plain message ids written as literals in its own code (optionally in `apps/<id>/src/i18n/keys.ts` tables of `as const` strings); the Shell turns them into text in one place, `gameMessageText(t, message)` in `packages/shell/src/i18n/game-message-text.ts`, the only caller of `asGameKey` (the i18n skill's `game-key-cast` rule).

The entry file `apps/<id>/index.ts` imports only `app/start-shell.ts`; `game.config.ts` imports only the `GameConfig` type. Stores, screens, services and the rest stay Shell internals: a game reaches them through the `GameModule` contract (references/game-module-seam.md).

Two details that cost time in verification: a `target` glob in `import/no-restricted-paths` must match files (`./apps/*/src/**/*`), and `basePath` must be the repo root, not the working directory of the lint run.

## Vendor SDKs and banned packages

Only the adapter file of a port imports its vendor SDK: `packages/shell/src/services/<port>/<vendor>-<port>-adapter.ts` (and the save implementations `*-save-store.ts`, `*-sql-driver.ts`).

| SDK | Port |
|---|---|
| `react-native-google-mobile-ads` | `AdsPort` and `ConsentPort` (two adapter files) |
| `expo-iap` | `PurchasePort` |
| `expo-sqlite` | `SaveStore` / `SqlDriver` |
| `react-native-audio-api` | `AudioPort` |
| `expo-haptics` | `HapticsPort` |
| `expo-network` | `ConnectivityPort` |
| `expo-tracking-transparency` | `ConsentPort`, and only in exactly `packages/shell/src/services/consent/admob-consent-adapter.ts` (`vendorSdkFiles` in `architecture-rules.json`; owner decision O1). In ESLint it is not a `vendor(...)` entry: `ATT_IMPORT` sits in the banned list, and the file-exact `ATT_ADAPTER` block lifts it for that one file with `allow: [ATT_IMPORT]`, so every other file, the other adapters included, keeps the ban |

ESLint's `paths` ban matches the bare module name only, so `import Storage from 'expo-sqlite/kv-store'` in a non-adapter file passes lint (seen in a verification workspace); `check-boundaries.mjs` compares package names and reports the subpath too. Put such code behind a port and an adapter: the key-value store has exactly two adapters, the direction guard's `services/save/sqlite-kv-direction-guard-adapter.ts` and the test-only debug store `services/save/sqlite-kv-debug-store-adapter.ts` (reached only through `TEST_ONLY`).

Banned everywhere (a port or the spec replaced them):

| Package | Instead |
|---|---|
| `axios`, `react-native-webview`, `expo-web-browser` | nothing: our code makes no network requests (N3) |
| `@react-native-community/netinfo` | `ConnectivityPort` (expo-network; NetInfo's reachability probe calls Google) |
| `expo-updates` | no OTA updates; restart with `reloadAppAsync` from `expo` |
| `expo-router` | the Shell's React Navigation 7 static stack |
| `expo-audio` | `AudioPort` (react-native-audio-api) |
| `expo-file-system`, `@react-native-async-storage/async-storage` | `SaveStore` (expo-sqlite) |
| `react-native-iap`, `react-native-purchases` | `PurchasePort` (expo-iap); no purchase server (N2) |
| `react-native-restart` | `reloadAppAsync` from `expo` |

## Node world versus app world

Node-world code runs in Node with type stripping: `packages/tooling`, `packages/shell/src/config`, `packages/shell/plugins`, `apps/<id>/app.config.ts`. App-world code is bundled by Metro and runs on Hermes.

- App code never imports a Node-world file, not even with `import type`: a type-only import still pulls the file into the app program, where `process` and `node:fs` do not type-check (verified: a type-only import into `with-shell.ts` fails).
- **Neutral files** in `src/config/` import nothing from Node and can be read by both worlds: `game-config.ts` (only the `GameConfig` type), `game-extra.ts` (the runtime subset type), `app-variant.ts` (a pure parser), `external-links.ts` (the store and privacy links). `check-boundaries.mjs` follows a config file's own imports: it reports `node-world-import` only when the target, or anything it imports, reaches a Node built-in, `expo/config-plugins`, a config plugin, tooling or an `app.config.ts`.
- `game.config.ts` imports its type from `@e07/shell/config/game-config.ts`, never from `with-shell.ts`.

## Cycles and parent imports

- `import/no-cycle` (max depth 10) and `check-boundaries.mjs` (`import-cycle`) report files that import each other in a loop; type-only imports are ignored. Break a cycle by moving the shared piece (usually a type) down into its own file.
- No `../` imports anywhere: the same folder or below is `./x.ts`, any other folder is `@e07/<package>/<path-under-src>.ts`. Node type stripping needs the extension and ignores tsconfig `paths`.

## The ESLint blocks that carry the zones

These are the zone parts of the one `eslint.config.mjs` (the typescript-and-lint-rules skill holds the complete file; change it there with a `Gate-Change:` trailer):

```js
const PARENT_IMPORT = {
  group: ['../*', '../../*', '../../../*', '../../../../*'],
  message: 'No parent-relative imports: use ./sibling.ts or the package name (@e07/shell/...).',
};
const NODE_BUILTINS = {
  group: ['node:*', 'fs', 'path', 'child_process', 'os', 'crypto', 'http', 'https', 'net'],
  message: 'Node built-ins do not exist in the app runtime.',
};
const NO_TOOLING = {
  group: ['@e07/tooling', '@e07/tooling/**'],
  message: 'Tooling is Node-only build code; the app never imports it.',
};
const SHELL_BOUNDARY = {
  group: ['@e07/**', '!@e07/shell', '!@e07/shell/**', '!@e07/game-kit', '!@e07/game-kit/**'],
  message: 'The Shell imports only @e07/shell/* and @e07/game-kit/*, never an app (spec N5).',
};
const GAME_KIT_BOUNDARY = {
  group: ['@e07/**', '!@e07/game-kit', '!@e07/game-kit/**'],
  message: 'game-kit is the bottom layer: it imports only itself.',
};
const PURE_IMPORTS = {
  group: ['react', 'react/*', 'react-native', 'react-native-*', 'react-native/*', '@react-native/*',
    'expo', 'expo-*', '@expo/*', '@shopify/*', '@e07/shell', '@e07/shell/*', 'zustand', 'zustand/*'],
  message: 'Rules, levels and game-kit are pure TypeScript: import only @e07/game-kit/* and siblings.',
};
const GAME_FACING = [
  './game-host', './art',
  './services/audio/audio-port.ts', './services/audio/synth', './theme/theme-types.ts',
];

// 5-zones: import/no-restricted-paths works on RESOLVED paths, so it catches every spelling.
{
  files: ['apps/*/src/**/*.{ts,tsx}', 'apps/*/index.ts'],
  rules: {
    'import/no-restricted-paths': ['error', {
      basePath: ROOT,
      zones: [
        ...APP_IDS.map((id) => ({
          target: `./apps/${id}`, from: './apps', except: [`./${id}`],
          message: 'Apps never import each other; shared code moves to the Shell or game-kit.',
        })),
        {
          target: './apps/*/src/**/*', from: './packages/shell/src', except: GAME_FACING,
          message: 'Game code uses only the Shell game-facing modules (game-host, art, audio, theme).',
        },
      ],
    }],
  },
},
```

`APP_IDS` is read from the folder names under `apps/` each time ESLint starts, so a new app is covered without editing the config (an empty repo without `apps/` loads too). The Shell's own block adds `SHELL_BOUNDARY`, game-kit's adds `GAME_KIT_BOUNDARY`, the `PURE` files add `PURE_IMPORTS`, and the `ADAPTERS` block lifts the vendor bans for adapter files only.

Verified on 2026-09-26: an app→app import and an app→Shell-store import fail; the audio port and the theme types pass; the config loads without an `apps/` folder.
