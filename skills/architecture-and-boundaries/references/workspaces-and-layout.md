# Workspaces, the repository tree and the manifests

The shape of the one Pocket Arcade monorepo: the four kinds of workspace and what each owns, the canonical tree, the `package.json` of every workspace, and how every tool reads the packages as TypeScript source. Read this before adding a package, an app, a dependency or a top-level folder.

## Contents

- The four kinds of workspace
- Who owns what inside them
- The repository tree
- Manifests
- Packages are consumed as TypeScript source
- Rules that follow

## The four kinds of workspace

The repository holds one reusable framework (the Shell) and about 26 small games. Every game ships as its own app, but all of them live in one npm-workspaces monorepo and consume the Shell as TypeScript source, so a fix in the Shell reaches every game at its next release.

| Workspace | Package name | Contains | Runs in |
|---|---|---|---|
| `packages/game-kit` | `@e07/game-kit` | pure TypeScript: the `GameModule` contract, seeded PRNG, geometry, timeline, date keys, bot harness, solver helpers | app, Jest, Node |
| `packages/shell` | `@e07/shell` | everything the same in every game: screens S1–S15, navigation, stores, save, services, i18n, theme, game host, config composer, config plugins | app, Jest (config composer: Node) |
| `packages/tooling` | `@e07/tooling` | Node scripts: build, release, screenshots, audits, level generation, art rendering, scaffolding | Node only |
| `apps/<game-id>` | `@e07/<game-id>` | one Expo app: the game module (rules, levels, board, art, sounds, tutorial, texts) and its configuration | app, Jest |

`@e07` is a placeholder scope until the framework is named. Renaming it is one search-and-replace over the `package.json` files and imports. Declared by `"workspaces": ["apps/*", "packages/*"]` in the root `package.json`; there is no fifth kind (`check-layout.mjs` rule `workspaces`).

## Who owns what inside them

Other skills own the inside of several parts; this skill owns the boundaries between them and the placement of files.

| Topic | Skill |
|---|---|
| Versions, installs, upgrades | dependency-management, expo-sdk-upgrade |
| File and identifier names | naming-conventions |
| tsconfig files, the ESLint config, limits | typescript-and-lint-rules |
| UI components, theme, hooks | toybox-components, toybox-design-system, react-components-and-hooks |
| Navigation, stores, save document | navigation-and-routing, state-stores, save-persistence-and-migrations |
| Engine functions, board, gestures, real-time loop | game-rules-engine, board-rendering-skia, board-gestures-and-input, realtime-game-loop |
| Audio, haptics, code-drawn art | game-audio-and-haptics, code-drawn-art-and-icons |
| Languages, direction, `startShell` | i18n-strings-and-catalogs, rtl-and-direction |
| Ads, consent, purchase | admob-ads, premium-purchase |
| Network and privacy audits | privacy-and-network-audit |
| iOS builds and releases | ios-simulator-build, ios-release-testflight |
| npm scripts, hooks, CI | quality-gates |

## The repository tree

Folders are canonical. Files listed are the ones other parts rely on.

```
<repo>/
  package.json            workspaces, overrides, scripts
  package-lock.json  .npmrc  .nvmrc  .mise.toml
  tsconfig.base.json  tsconfig.json                      root program = tests + Node-side config
  eslint.config.mjs  .prettierrc.json  knip.json  lefthook.yml  quality-gates.json
  jest.config.js  jest.sim.config.js  jest.setup.ts  babel.config.js  __mocks__/
  AGENTS.md  CLAUDE.md  .claude/settings.json
  test/                   Node-typed tests and helpers: integration/<area>/, goldens/, sims/
    integration/save/     node-sqlite-sql-driver.ts  sqlite-save-store.test.ts  save-write.perf.test.ts
    goldens/boards/       skia-golden.ts  <game-id>-board.golden.test.ts
    sims/<game-id>/       *.sim.test.ts bot and balance runs
  packages/
    game-kit/             @e07/game-kit: PURE TypeScript (no React/RN/Expo/Skia/Shell)
      src/contract/       game-module.ts game-rules.ts levels.ts teaching.ts stats.ts testing.ts
                          persistence.ts realtime.ts messages.ts game-identity.ts
                          game-engine.ts input-intent.ts result.ts
      src/rng/            sfc32.ts
      src/geom/           board-layout.ts classify-swipe.ts vec2.ts sweep.ts spatial-hash.ts
      src/timeline/       track.ts sample.ts particles.ts fixed-step.ts
      src/dates/          date-key.ts daily-seed.ts
      src/levels/         star rating, level-table planning, pack progress, daily start (pure)
      src/testing/        play-bot.ts  property helpers
      src/solver/         generic search helpers for game solvers
    shell/                @e07/shell: the React Native framework
      src/app-env.d.ts    EXPO_PUBLIC_* declarations
      src/app/            start-shell.ts create-shell-app.tsx create-shell-parts.ts device-adapters.ts hydrate-save.ts create-startup-splash.tsx
                          shell-app.tsx services-context.tsx stores-context.tsx read-game-extra.ts
                          use-checkpoint-on-background.ts shell-error-boundary.tsx
                          system-a11y-store.ts use-reduce-motion.ts crash-screen.tsx
                          test-only.ts test-only-api.ts test-only-entry.ts
                          perf/ frame recorder, cold-start log, perf log (test builds only)
      src/navigation/     root-stack.tsx navigation-root.tsx route-params.ts route-guards.ts
                          debug-route.tsx react-navigation.d.ts
      src/screens/<screen>/  first-run consent home game pause result levels daily stats settings
                          (+ settings/language, about, privacy, licences) premium how-to-play debug
      src/ui/             AppText, buttons, top bar, dialogs, code-drawn icons
      src/game-host/      shell-game-module.ts game-host.ts game-session-*.ts saved-run.ts
                          board-types.ts board-canvas.tsx use-board-gestures.ts use-fixed-step-loop.ts
      src/art/            game-art.ts
      src/services/<port>/  ads consent purchase save clock connectivity audio haptics error-log
      src/stores/         settings-* progress-* stats-* daily-model.ts stats-model.ts
                          premium/ (premium-state, -reducer, -transitions, -store, -view, evidence)
      src/i18n/           intl-polyfills.ts languages.ts direction.ts messages.ts … catalogs/{en,de,fa,ckb}.json
      src/theme/          theme-types.ts tokens.ts theme-set.ts make-styles.ts
      src/testing/        render-with-shell.tsx flush-microtasks.ts test-palette.ts
                          find-inaccessible-pressables.ts palette-checks.ts
      src/config/         NODE WORLD: with-shell.ts shell-plugins.ts game-config.ts game-extra.ts
                          privacy-manifest.ts ads-config.ts skadnetwork-ids.ts
                          app-variant.ts external-links.ts
      plugins/            local Expo config plugins: with-<capability>.ts (default export)
      e2e/flows/<area>/   Shell journeys every game runs (01-09); e2e/subflows/ shared sub-flows
      ios/  expo-module.config.json   the ProcessStart native module behind the cold-start log;
                          the only native code the apps ship
    tooling/              @e07/tooling: Node scripts
      src/                one folder per area, CLIs included: build/ release/ asc/ ios/ e2e/ visual/
                          audit/ deps/ quality/ i18n/ ads/ storekit/ clock/ git/ hooks/ save/ art/
                          audio/ scaffold/
      config/             export-options-{test,store}.plist
      network-audit/      js-baseline.json native-baseline.json
      scripts/            install-maestro.sh
      license-exceptions.json
  apps/
    line-siege/           @e07/line-siege: one Expo app per game
      package.json  tsconfig.json  metro.config.js  .gitignore (ios/ android/ build/)
      app.config.ts       export default withShell(gameConfig, process.env)
      game.config.ts      every per-game value
      index.ts            3 lines: startShell(lineSiegeGame)
      src/index.ts        exports lineSiegeGame: ShellGameModule<LineSiegeTypes>
      src/line-siege-types.ts   the ShellGameTypes bag
      src/rules/          state, moves, events, create/applyMove/outcome/intentToMove   (PURE, DETERMINISTIC)
      src/levels/         pack-<n>.json difficulty curve solver                         (PURE, DETERMINISTIC)
      src/board/          board-palettes.ts to-view.ts layout-board.ts draw-board.ts build-timeline.ts
      src/sim/            real-time games only
      src/art/            logo-art.ts (LOGO_ART) game-art.ts (GAME_ART: palettes, logo, credits)
      src/sounds/         sound-bank.ts
      src/theme/          palette.ts: the game's UI palette (Toybox paint) for the Shell screens
      src/tutorial/       tutorial script, how-to-play pages
      src/testing/        bot policy, example states
      src/i18n/           en.json de.json fa.json ckb.json
      e2e/flows/<area>/   the game's own flows (10 and up)   e2e/baselines/
      assets/fonts/       the five Toybox TTFs and three *-OFL.txt texts (copied by the scaffold)
      assets/generated/   icon and splash PNGs rendered by the art tooling
```

Generated and local-only folders (`apps/*/ios`, `apps/*/android`, `apps/*/build`, `apps/*/sfx-preview`, `tools/`, `reports/`, `dist-audit/`, `coverage/`, `.stryker-tmp/`) are gitignored.

`check-layout.mjs` (rule `folders`) allows exactly these top-level folders under `packages/game-kit/src`, `packages/shell/src` and `apps/<id>/src`; tooling areas are kebab-case nouns, and no script sits directly in `packages/tooling/src/`.

## Manifests

Root `package.json` (the parts this skill owns; the quality-gates skill owns `scripts`):

```json
{
  "name": "e07-games",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=22.18", "npm": ">=11.17.0" },
  "overrides": { "react": "19.2.3", "react-native": "0.86.3" }
}
```

One React and one React Native in the whole tree: without the override npm installed react 19.3.0 at the root (pulled by a dev tool's peer) next to the app's 19.2.3, and Jest resolves from the root (verified). When the Expo SDK changes, `overrides` change in the same commit as the apps' `react` and `react-native`. Check with `npm ls react react-native`: exactly one version of each (`check-layout.mjs` rule `one-react`).

The workspace manifests are `templates/package.root.json`, `templates/package.game-kit.json`, `templates/package.shell.json`, `templates/package.tooling.json` and `templates/package.app.json`, each synced from the library, so the bootstrap and this skill write the same bytes (the starting manifests; dependency-management adds each package when a skill first needs it). Their load-bearing fields:

| Workspace | Fields |
|---|---|
| game-kit | `"type": "module"`, `"exports": { "./*": "./src/*" }`, no dependencies at all |
| shell | `"type": "module"`, `"exports": { "./plugins/*": "./plugins/*", "./*": "./src/*" }`, pure-JS libraries it alone uses as `dependencies` (it starts with the `@formatjs/intl-*` polyfills; `valibot`, `zustand` and `react-intl` arrive with the skill that first imports them), every native module as a `"*"` peer with a root override at the apps' version |
| tooling | `"type": "module"`, `"exports": { "./*": "./src/*" }`, and `@e07/game-kit` / `@e07/shell` as dependencies once a tooling script imports them (knip reports an undeclared workspace import) |
| app | `"main": "index.ts"`, `"exports": { "./*": "./src/*" }`, no `"type"` (its `metro.config.js` is CommonJS), every native module of the Shell as a direct dependency with the same version as every other app |

- The app's `exports` map exists only so game code reaches its own folders without `../`: `import type { LineSiegeState } from '@e07/line-siege/rules/line-siege-types.ts'` resolves to `apps/line-siege/src/rules/line-siege-types.ts`.
- Pure JavaScript libraries only the Shell imports are **not** app dependencies (knip would report them unused). `expo-system-ui` is, because `userInterfaceStyle: 'automatic'` needs it.
- Install with `npx expo install <pkg>` inside the app for Expo-managed packages and `npm install -E <pkg>@<version> -w apps/<game-id>` otherwise (dependency-management).
- `check-layout.mjs` rules `manifest` and `native-deps` check all of this.

## Packages are consumed as TypeScript source

Nothing is compiled ahead of time. Each tool reads `.ts` directly (verified 2026-09-26):

| Tool | How `@e07/shell/ui/app-text.tsx` resolves |
|---|---|
| Metro (`expo export`, Xcode bundling) | `node_modules/@e07/shell` symlink → package `exports` `"./*": "./src/*"`; Expo's monorepo defaults add the root to `watchFolders`; Babel transforms the source; the React Compiler applies to Shell code |
| Jest (jest-expo, babel-jest) | the same symlink and `exports`; `transformIgnorePatterns` does not exclude workspace packages because their real path is outside `node_modules` |
| `tsc` 6 (`moduleResolution: bundler`) | `exports` + `allowImportingTsExtensions`; one program per workspace |
| ESLint (`import/*` rules) | `eslint-import-resolver-typescript` through the same `exports` |
| Node 26 (tooling, `app.config.ts`) | package self-reference through `exports`; the symlink resolves to the real path under `packages/`, outside `node_modules`, so type stripping is allowed |

- **Node refuses to type-strip files inside a `node_modules` path.** Workspace packages work only because npm links them and Node follows the link. Never publish these packages or install them as tarballs.
- **Node ignores tsconfig `paths`**, so no `@/` aliases anywhere: the package name is the alias.
- **Tooling can import app code** (level generation, art rendering, bots) because game rules are plain TypeScript with explicit extensions. Node prints a harmless `MODULE_TYPELESS_PACKAGE_JSON` when tooling imports app files (apps have no `"type"`); `"type": "module"` plus renaming the app's Metro file to `metro.config.cjs` also works (verified) if the noise matters.

## Rules that follow

- List every native module as a direct dependency of every app, with identical versions; the Shell lists them as `peerDependencies`. Autolinking and `npx expo install --check` see only an app's own dependencies ("duplicate React Native versions are not supported").
- `npx expo config --json`, `npx expo install --check` and `npx expo-doctor` pass for every app; they catch composer bugs and version drift `tsc` and Jest cannot see.
- No module does work at import time, except `@e07/shell/i18n/intl-polyfills.ts` (even the cold-start mark `markJsEntry()` runs inside `startShell`, right after `readParityLaunch()`): no database open, no adapter or domain-store creation, no native call that changes state, at module level. A direction reload (`reloadAppAsync`) re-runs every module; writes before it would happen twice (`check-layout.mjs` rule `import-time-work`). Canonical in-memory module state is fine: the OS-accessibility mirror `systemA11yStore` (a vanilla store) and the shared icon `Paint` in `icon-raster.ts`.
