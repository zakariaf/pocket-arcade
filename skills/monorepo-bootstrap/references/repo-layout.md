# The monorepo layout the bootstrap creates

What the Pocket Arcade repository looks like right after the bootstrap, which later skill grows each part, and why the layout is fixed. Read this before running the generator, and again when a later skill asks where a file goes.

## Contents

- One repo, four kinds of workspace
- The tree after the bootstrap
- What the bootstrap deliberately leaves out
- Who maintains each file afterwards
- Consuming workspaces as TypeScript source
- Pre-existing folders at the root

## One repo, four kinds of workspace

About 26 games share one framework (the Shell), so everything lives in one npm-workspaces monorepo and a Shell fix reaches every game at its next release. There are exactly four kinds of workspace, declared by `"workspaces": ["apps/*", "packages/*"]` in the root `package.json`:

| Workspace | Package name | Holds | Runs in |
|---|---|---|---|
| `packages/game-kit` | `@e07/game-kit` | pure TypeScript: the `GameModule` contract, seeded PRNG, geometry, timeline, date keys, bot harness | app, Jest, Node |
| `packages/shell` | `@e07/shell` | everything the same in every game: screens, navigation, stores, save, services, i18n, theme, game host, config composer, config plugins | app, Jest (composer: Node) |
| `packages/tooling` | `@e07/tooling` | Node scripts: gates, build, release, screenshots, audits, level generation, art, scaffolding | Node only |
| `apps/<game-id>` | `@e07/<game-id>` | one Expo app per game: the game module and its configuration | app, Jest |

`@e07` is a placeholder scope until the framework is named; renaming it later is one search-and-replace over `package.json` files and imports. Dependencies point one way: game-kit ← shell ← app entry files; tooling may import anything and nothing imports tooling (the `architecture-and-boundaries` skill owns the details and the ESLint zones that enforce them).

Why not pnpm, yarn or bun: they are not installed on the build Mac and npm 11 workspaces are enough. Why not a copy of the Shell per game: 26 forks drift. Why not a package registry: it needs a hosted service.

## The tree after the bootstrap

```
<repo>/
  package.json  package-lock.json  .npmrc  .nvmrc  .mise.toml  .gitignore
  tsconfig.base.json  tsconfig.json  tsconfig.stryker.json
  eslint.config.mjs  .prettierrc.json  .prettierignore  knip.json  lefthook.yml  quality-gates.json
  babel.config.js  jest.config.js  jest.setup.ts  jest.sim.config.js  stryker.config.json
  AGENTS.md  CLAUDE.md  .claude/settings.json
  skills/                     the project skills (ignored by Prettier, ESLint, Jest)
  packages/
    game-kit/   package.json tsconfig.json
                src/contract/result.ts (+ test)            the shared Result type
    shell/      package.json tsconfig.json
                src/app-env.d.ts                            EXPO_PUBLIC_* and process declarations
                src/i18n/intl-polyfills.ts, intl-status.ts (+ test)   Jest setupFiles needs them
                src/config/ game-config.ts ads-config.ts app-variant.ts (+ test)
                            game-extra.ts with-shell.ts (+ test)       the config composer (Node world)
                plugins/with-app-variant-marker.ts          local config plugin (default export)
    tooling/    package.json tsconfig.json license-exceptions.json
                src/quality/ check-quality-gates.ts gate-diff.ts (+ test)    the guardrail
                src/deps/    check-deps.ts release-age-excludes.ts banned-packages.ts app-lockstep.ts (+ tests)
                src/clock/   system-clock.ts                the only tooling file that reads the clock
                src/audit/   audit-licenses.ts license-policy.ts (+ test)
                src/git/     check-commit-message.ts commit-message-rules.ts (+ test)
                src/hooks/   after-edit.ts                  the Claude Code PostToolUse hook
  apps/
    line-siege/ package.json    the minimal runtime set (expo, react, react-native, expo-system-ui,
                                Skia, Gesture Handler, Reanimated, Worklets, @e07/shell)
                tsconfig.json   includes the Shell's app-env.d.ts and navigation/react-navigation.d.ts
                metro.config.js .gitignore (ios/, android/, build/, dist/, sfx-preview/)
                app.config.ts   export default withShell(gameConfig, process.env);
                game.config.ts  every per-game value (spec section 11), filled for Line Siege v1
                index.ts        bootstrap placeholder until the Shell boot exists
                assets/fonts/   the five Toybox TTFs and three OFL texts, byte for byte
                src/i18n/       en.json de.json fa.json ckb.json: the canonical Line Siege catalogs
```

The pilot is always Line Siege v1 (`--app line-siege`; the generator refuses another id). Its per-app files are the same bytes the `new-game-scaffold` skill writes, because both skills sync them from one shared template set (`game.config.ts`, the placeholder `index.ts`, `package.json`, `.gitignore`, `tsconfig.json`, `metro.config.js`, `app.config.ts`) and one shared renderer (`scripts/lib/app-files.mjs`). The pilot's `game.config.ts` settings come from the game's rules: `modes` daily and endless on (the levels spec has a daily and an endless run), `hints.freePerDay: 0` (Line Siege has no exact solver, so no hint), `isContinueAllowed: true` (one continue: the monsters fall back and the board clears a little), and `violenceCartoonOrFantasy: 'INFREQUENT_OR_MILD'` (blocks hit cartoon monsters); a new game defaults to `'NONE'` and the owner confirms the answer at step G1. The catalogs are copied from the canonical Line Siege set (24 keys per language, lose reasons `line-siege.lose.broke-through` and `line-siege.lose.board-full`; fa and ckb marked for native review), never rendered. So the pilot passes the new-game checks (`check-game-app.mjs --stage scaffold`) straight after the bootstrap, without moving a file.

Generated or local-only folders are gitignored: `apps/*/ios`, `apps/*/android`, `apps/*/build`, `apps/*/dist`, `apps/*/sfx-preview`, `/tools/` (Maestro), `reports/`, `dist-audit/`, `coverage/`, `.stryker-tmp/`, `node_modules/`, `.expo/`.

## What the bootstrap deliberately leaves out

The skeleton holds only what its own configs and gates need, so every gate that exists can be green on day one:

- **Packages nobody imports yet.** knip fails on unused dependencies, so React Navigation, Zustand, valibot, expo-sqlite, AdMob, expo-iap, the audio library, react-intl, fast-check, RNTL and the rest arrive with the skill that first uses them, through the `dependency-management` skill, at the versions in its table.
- **The Shell boot.** `apps/<pilot>/index.ts` is a placeholder that registers an empty component. When `packages/shell/src/app/start-shell.ts` exists, it becomes the 3-line entry: import `startShell`, import the game module from `./src/index.ts`, call `startShell(module)`.
- **The full config composer.** `with-shell.ts` (and `with-shell.test.ts`) is the phase-0 composer: it starts without `ios.privacyManifests` and without the native-module plugin list. At the Shell's native step (before the first simulator build) architecture-and-boundaries' final `with-shell.ts` and `shell-plugins.ts` replace it: the privacy manifest, `shellPlugins(game, adsMode)` (the one list: AdMob, purchases, audio, fonts, SQLite, localization) and `withGameArt` last. `ads-config.ts` starts with the ID types, `assertLiveIds` and `adUnitsExtra`; admob-ads' `ads-config.ts` replaces it with the plugin options.
- **Root `__mocks__/`, `test/`, the Shell's font loading and generated art.** They come with the adapters, integration tests, the Toybox font setup and the art pipeline (the pilot already holds its font files and catalogs).
- **The tool scripts behind `i18n:verify`, `audit:network`, `audit:privacy`, `e2e:ios`, `screenshots:ios`, `build:ios:sim` and `release:ios`.** The npm scripts exist with their canonical commands; `check-monorepo.mjs` lists them as "pending" with the skill that builds each one. (`new-game` works from day one: the bootstrap writes `packages/tooling/src/scaffold/new-game.ts`, which forwards to the new-game-scaffold skill's generator.)

Consequence: `npm run verify` stops at step 4 (`i18n:verify`) until the i18n skill builds its script, and `test:sim` fails with "No tests found" until the first `*.sim.test.ts` exists. Never stub those scripts to make `verify` pass: a gate that passes without checking anything hides every later failure.

## Who maintains each file afterwards

The bootstrap writes each file once. After that, change a file only through the skill that owns it:

| Files | Maintained by |
|---|---|
| `package.json` scripts, `lefthook.yml`, `quality-gates.json`, `knip.json`, `.claude/settings.json`, `packages/tooling/src/{quality,hooks}/` | `quality-gates` |
| `tsconfig*.json`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore` | `typescript-and-lint-rules` |
| `.npmrc`, dependencies, `packages/tooling/src/{deps,clock,audit}/`, `license-exceptions.json` | `dependency-management` |
| `jest.config.js`, `jest.setup.ts`, `jest.sim.config.js`, `babel.config.js`, `stryker.config.json`, `tsconfig.stryker.json` | `unit-and-component-tests` |
| `packages/tooling/src/git/` | `git-commits-and-reporting` |
| `packages/shell/src/config/`, `plugins/`, workspace layout | `architecture-and-boundaries` |
| a new `apps/<game-id>`, `packages/tooling/src/scaffold/new-game.ts` | `new-game-scaffold` |
| Expo SDK moves | `expo-sdk-upgrade` |

Most of these are gated paths: a commit that changes them needs a `Gate-Change: <reason>` trailer, and the `ask` permission rules make Claude Code ask the owner before editing them.

## Consuming workspaces as TypeScript source

Nothing is compiled ahead of time. Each workspace `package.json` maps `"exports": { "./*": "./src/*" }` (the Shell also `"./plugins/*": "./plugins/*"`), so `@e07/shell/config/with-shell.ts` means `packages/shell/src/config/with-shell.ts`:

| Tool | How it resolves `@e07/shell/<path>.ts` |
|---|---|
| Metro | the `node_modules/@e07/shell` symlink plus the `exports` map; Expo's monorepo defaults watch the root |
| Jest | `moduleNameMapper` in `jest.config.js` maps `@e07/<pkg>/…` straight to `packages/<pkg>/src/…` |
| `tsc` 6 | `exports` plus `allowImportingTsExtensions`, one program per workspace |
| ESLint | `eslint-import-resolver-typescript` through the same `exports` |
| Node 26 (tooling, `app.config.ts`) | package self-reference through `exports`; the symlink resolves outside `node_modules`, so type stripping is allowed |

Rules that follow: imports carry the file extension (Node type stripping needs it), there are no `../` imports and no `@/` aliases (Node ignores tsconfig `paths`), and packages declare `"type": "module"`. Apps have no `"type"` because `metro.config.js` is CommonJS. Node refuses to type-strip files inside a `node_modules` path, so never publish or tarball-install the workspaces.

## Pre-existing folders at the root

The repo may already hold hand-written material before the monorepo exists: knowledge folders, design exports, notes, the owner's `README.md`. The generator treats every non-hidden top-level entry that is not part of the layout above as pre-existing:

- it adds `<folder>/` (or the file name) to `.prettierignore`, so `format:check` never reformats the owner's files;
- it adds `'<folder>/**'` to the `PRE_EXISTING` list in `eslint.config.mjs`, so ESLint never lints tools or scripts in them;
- Jest and `tsc` only look at `apps/`, `packages/`, `test/` and the root config files, so they need nothing. knip also picks up files named like tests (`*.test.*`, `__tests__/`, `__mocks__/`) anywhere; if a pre-existing folder holds such files, add `<folder>/**` to the `ignore` list of `knip.json` and `quality-gates.json` (the generator does not, because most folders hold none).

`skills/` and `.claude/` are ignored the same way by every tool, including Jest (`modulePathIgnorePatterns`) and knip (`"ignore": ["skills/**"]`; the `.claude/skills/<name>` links are not followed), because skill templates and fixtures contain `package.json` files named `@e07/shell` and friends, which made jest-haste-map report "Haste module naming collision" before the ignore was added (verified on 2026-09-28).

A folder added at the root later is not pre-existing: give it a place in the layout, or add it to both ignore lists with a `Gate-Change:` trailer. `check-monorepo.mjs` reports any top-level entry that neither belongs to the layout nor is ignored (`format-ignore`, `lint-ignore`).
