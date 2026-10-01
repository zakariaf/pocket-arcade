# Packages, game ids, npm scripts, env variables, commits and tags

The names outside the source files: workspace packages, game ids, bundle and product ids, npm scripts, environment variables, commit headers, branches and release tags. Read this when adding a workspace, a game, a script, a variable or a release step.

## Contents

- Packages, apps and store identifiers
- npm scripts
- Environment variables
- Commits, branches and tags (names only)

## Packages, apps and store identifiers

| Thing | Rule | Example |
|---|---|---|
| Workspace package | `@<scope>/<folder>` | `@e07/game-kit`, `@e07/shell`, `@e07/tooling` |
| App workspace | `@<scope>/<game-id>` | `@e07/line-siege` |
| Game id / app folder / Expo `slug` / commit scope | kebab-case, stable forever | `line-siege` |
| `GameModule.identity.id`, `GameConfig.id`, the save document's `gameId` | the same game id | `line-siege` |
| Display name (`expo.name`) | the game's real name; prebuild derives the Xcode scheme from it without spaces | `Line Siege` → `LineSiege.xcworkspace` |
| Bundle id (iOS) and package (Android) | exactly `io.applander.<game id without hyphens>`, all lowercase, the same on both platforms (owner decision O4, 2026-09-30); `bundleIdFor(gameId)` in `scripts/lib/names.mjs` computes it | `io.applander.linesiege` |
| Premium product id | `<bundle id>.premium` | `io.applander.linesiege.premium` |
| Game types | game id in PascalCase + role | `LineSiegeState`, `LineSiegeMove`, `LineSiegeTypes` |
| Game module export | game id in camelCase + `Game` | `lineSiegeGame` in `apps/line-siege/src/index.ts` |

- `@e07` is a placeholder scope until the framework is named. Renaming it is one search-and-replace over the `package.json` files and imports; every workspace always uses one scope (`package-name`).
- `check-file-names.mjs` checks that `game.config.ts` has `id` equal to the folder name, a valid `bundleId`, and a premium `productId` of `<bundleId>.premium` (`game-id`), and that the `bundleId` is exactly `io.applander.<folder id without hyphens>` (`bundle-id-applander`; `apps/tile-drop` needs `io.applander.tiledrop`). The owner uses the Applander domain for every game, so a new game never asks for a bundle id: the scaffold writes it, and a placeholder such as `com.example.*` fails.
- Games whose ids differ only by hyphens (`tile-drop` and `tiledrop`) would share a bundle id; the catalogue has no such pair, and a new game id must keep it that way.
- Cross-folder imports use the package name plus the path under `src/` and the file extension: `@e07/shell/ui/app-text.tsx`.

## npm scripts

The root script names are canonical and never renamed:

`verify`, `check:fast`, `format`, `format:check`, `lint`, `typecheck`, `test`, `test:golden`, `test:sim`, `test:coverage`, `test:mutation`, `knip`, `audit:network`, `audit:privacy`, `audit:licenses`, `i18n:verify`, `e2e:ios`, `screenshots:ios`, `build:ios:sim`, `release:ios`, `new-game`.

A new script follows the same shape: `<verb>` or `<area>:<verb>`, kebab-case words (`npm-script-name`; regex `^[a-z0-9]+(-[a-z0-9]+)*(:[a-z0-9]+(-[a-z0-9]+)*)*$`, so `i18n:verify` and `e2e:ios` fit). Pass a game with `-- --app <game-id>` and a build variant with `--variant test|store`. The quality-gates skill owns what each script runs.

## Environment variables

- UPPER_SNAKE_CASE always (`env-var`).
- Build-time variables: `APP_VARIANT` (`test` | `store`) and `ADS_MODE` (`off` | `test` | `live`).
- A value the app reads at runtime is prefixed `EXPO_PUBLIC_` (Expo inlines only those, and only with dot access) and declared in `packages/shell/src/app-env.d.ts`. Today that is only `EXPO_PUBLIC_APP_VARIANT`. App code reading any other variable, or reading one with `process.env['X']`, fails `env-var`.
- Release credentials are referenced by id only: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `APPLE_TEAM_ID` (never the key itself).
- Tooling passes `EXPO_NO_TELEMETRY=1` and `CI=1` to Expo commands.

## Commits, branches and tags (names only)

The git-commits-and-reporting skill owns commit bodies, trailers and reports; these are the name formats:

| Name | Format | Example |
|---|---|---|
| Commit header | `<type>(<scope>): <subject>`, at most 72 characters, imperative, lowercase start, no trailing period | `feat(line-siege): fire a beam when a column clears` |
| Commit type | `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`, `style`, `revert` | |
| Commit scope | a folder under `apps/` or `packages/` (`line-siege`, `shell`, `game-kit`, `tooling`), or `repo`, `deps`, `docs`, `ci`, `skills` | |
| Gate trailer | `Gate-Change: <reason>` when a gated file changes | `Gate-Change: new golden for daily 2026-09-26` |
| Spec trailer | `Spec-Change: <spec section and what changed>` when a test expectation changes because the spec changed | |
| Branch (only when needed) | `<type>/<scope>-<slug>` | `feat/line-siege-endless-mode` |
| Build tag | `<game-id>/v<X.Y.Z>+<build>`, after every successful upload | `line-siege/v1.0.0+8` |
| Release tag | `<game-id>/v<X.Y.Z>`, when the owner says "ship" | `line-siege/v1.0.0` |

`X.Y.Z` is `expo.version` (CFBundleShortVersionString); `<build>` is the monotonic build number in `game.config.ts` (CFBundleVersion). Both tag forms pass `git check-ref-format`. The Shell and the packages are not tagged: they ship inside the apps. Never move or reuse a tag.
