# Procedures: add, upgrade, remove, the monthly pass

The exact steps for every kind of dependency change, with the commands and the traps. Read it at the start of any dependency task; `plan-dependency.mjs` prints the same steps for one package.

## Contents

- Decide the kind of package first
- Add a package that is in the table
- Add a package that is not in the table
- Upgrade a package
- Remove a package
- The monthly dependency pass
- Commands that behave differently from what training data suggests
- A same-day Expo patch
- What to record in the commit

## Decide the kind of package first

| Kind | Examples | Where | How |
|---|---|---|---|
| Expo-managed runtime (in Expo's module map) | `expo-haptics`, `react-native-screens`, Skia, Reanimated | every app, same specifier; Shell peer `"*"`; root override at the installed version | `npx expo install <pkg>@<table spec>` inside each `apps/<game>` (`expo-constants@~57.0.19`); keep what it writes |
| Native runtime outside the map | `react-native-google-mobile-ads`, `expo-iap`, `react-native-audio-api` | every app, exact; Shell peer; root override | `npm install <pkg>@<exact> -w apps/<a> -w apps/<b> …` |
| JavaScript runtime used by apps and the Shell | `@react-navigation/native`, `@react-navigation/native-stack` | every app, exact; Shell peer | `npm install <pkg>@<exact> -w apps/<each>` |
| Shell-only JavaScript library | `zustand`, `valibot`, `react-intl`, `@formatjs/intl-*` | `packages/shell` dependencies only | `npm install <pkg>@<exact> -w packages/shell` |
| Development tool | ESLint plugins, Jest, Prettier, knip | root devDependencies, exact | `npm install -D <pkg>@<exact>` at the root |
| Tooling-only library | `@formatjs/icu-messageformat-parser` | `packages/tooling` devDependencies | `npm install -D <pkg>@<exact> -w packages/tooling` |

`packages/game-kit` has no dependencies at all. Expo-related dev tools (`typescript`, `jest`, `@types/jest`, `@types/react`, `jest-expo`, `eslint-config-expo`) are root devDependencies installed with npm at the exact version in the table, which lies inside Expo's range.

## Add a package that is in the table

1. `node ${CLAUDE_SKILL_DIR}/scripts/plan-dependency.mjs <pkg> --root .` prints the kind, where it belongs, its companions and every step. Add `--online` to check the publish age (honouring dated excludes), the licence and the install scripts on npm.
2. For an app-wide package, first add `"<pkg>": "*"` to `packages/shell/package.json` `peerDependencies` (except `expo-system-ui`) and `"<pkg>": "<table version>"` to the root `overrides` (the version the apps install, `4.26.2` for `~4.26.0`). In this order npm never satisfies the peer with its newest release: on 2026-09-29 a peer added without the override left `react-native-screens` 4.28.0 at the root beside the app's 4.26.2.
3. Run the install step(s) exactly as printed: `npx expo install <pkg>@<table spec>` in **each** app for Expo-managed packages (the spec keeps a same-day patch out; see "A same-day Expo patch"), or the exact `npm install` with `-w` flags and every companion in the same command (RNTL 14.0.1 with `test-renderer` 1.2.0). Install in every app in the same change, never one app first. `npm ls <pkg>` must show one version.
4. `npm approve-scripts --allow-scripts-pending`; read any new install script (`npm view <pkg>@<v> scripts`) and approve that one package (`npm approve-scripts <pkg>`); the list must end with `No packages with unreviewed install scripts.`
5. Write the code that imports it in the same change. `npm run -s knip` fails on an unused Shell library or tool; for an app-wide native module the Shell peer entry counts as a use in knip (verified 2026-09-28), so `check-deps-policy.mjs` fails with `unused-dependency` instead until some Shell, app or Jest-setup file imports it or a config plugin entry names it. A vendor SDK is imported only by its adapter (the `architecture-and-boundaries` skill); add its Jest root mock if importing it crashes Jest.
6. If it has a config plugin, add one line to `shellPlugins` in `packages/shell/src/config/shell-plugins.ts` (the Shell's one plugin list; `with-shell.ts` spreads it), with a comment naming the owning skill (never a second list, never `ios/`).
7. In every app: `npx expo install --check` and `npx expo-doctor`.
8. `node ${CLAUDE_SKILL_DIR}/scripts/check-deps-policy.mjs .` until `RESULT: PASS`, then `npm run -s check:fast`.
9. Native package: a clean prebuild and `npm run build:ios:sim` for every app, plus `npm run audit:network` and `npm run audit:privacy` (a new native module is a new network and privacy surface). Purchases: also the Tier-2 StoreKit tests.

## Add a package that is not in the table

A new dependency outside the table is an owner decision (stop and ask). Bring the owner a short case:

- what it is for and why the decided stack cannot do it;
- `plan-dependency.mjs <pkg>@<version> --root . --online`: age (at least 7 days), licence (MIT, ISC, Apache-2.0, BSD-2/3-Clause, 0BSD, OFL-1.1, CC0-1.0 for anything that ships), install scripts;
- whether it is native, pre-1.0, or network-capable (anything that can open a connection is almost always a no).

After a yes: add a row to `assets/versions.json` **and** `references/versions.md` (version, spec, install, where, why), then follow "Add a package that is in the table". The row lands in the same commit as the install.

## Upgrade a package

1. Candidates: `npx expo install --check` in each app lists Expo-managed packages behind the SDK's expected versions; `npm outdated` at the root lists the rest. Ignore majors that the held-back table blocks.
2. For each candidate: `npm view <pkg>@<version> time --json` (it must be at least 7 days old) and read its changelog. A needed fix younger than 7 days goes through a dated exception (the release-age reference) with the owner.
3. Update the table row (both files) to the new version, and its root override and companions with it (a Shell peer's override, the ten `@typescript-eslint/*` overrides for `typescript-eslint`).
4. Apply the change to **all apps together** (Expo-managed: `npx expo install <pkg>@<new table spec>` in each app, or `npx expo install --fix` once every expected version is at least 7 days old; others: `npm install <pkg>@<new> -w …`).
5. If the package's install script changed, re-review and re-approve (`npm approve-scripts <pkg>` rewrites the pinned approval); `check-deps-policy.mjs` reports a `stale-approval` otherwise.
6. `npm run verify`; pre-1.0 and native packages also a simulator smoke run (`npm run build:ios:sim` for every app); purchases the Tier-2 StoreKit tests; Skia also re-renders goldens (review, then a `Gate-Change:` trailer).
7. `check-deps-policy.mjs .` passes; commit the table rows, manifests and lockfile together.

Expo SDK majors (57 to 58) are not an upgrade of one package: they move every Expo-managed package at once and follow the `expo-sdk-upgrade` skill.

## Remove a package

1. `node ${CLAUDE_SKILL_DIR}/scripts/plan-dependency.mjs <pkg> --root . --remove` lists every workspace that declares it.
2. Remove its imports, its config plugin entry, its root Jest mock and any ESLint mention first; then `npm uninstall <pkg> -w <workspace>` for each workspace (root: without `-w`), and delete it from the Shell's `peerDependencies` and the root `overrides` (a leftover override is a `stale-override`).
3. Delete its row from the table (both files) unless it is only moving workspace.
4. `npm approve-scripts --allow-scripts-pending` (a stale approval is removed by npm), `npm run -s knip`, `check-deps-policy.mjs .`, and a prebuild for a native package.

## The monthly dependency pass

Once a month, and before each release:

1. In each app, `npx expo install --check`.
2. At the root, `npm outdated`.
3. For each candidate: age check, changelog, then the upgrade steps above.
4. All apps together; then `npm run verify`, `npm run build:ios:sim` for every app, `npm run e2e:ios`, and a screenshot-diff review.
5. Update the table and commit. Delete any dated exclude block whose date has passed.

## Commands that behave differently from what training data suggests

- `npx expo install X -- --save-dev` puts the package into `dependencies`. Use `npx expo install X --dev`.
- For a package outside Expo's map, `npx expo install <pkg>` just runs `npm install --save <pkg>` at npm `latest` and writes a caret (a probe got `^17.2.0`). Use `npm install <pkg>@<exact>` instead.
- `npx expo install expo-haptics@~57.0.3` writes `~57.0.3` even with `save-exact=true` (Expo writes the specifier into `package.json` itself); that tilde is correct for Expo-managed packages. `npm install -D typescript@~6.0.3` under `save-exact` writes `6.0.3`.
- `npx expo install <pkg>` without a version asks Expo's online versions list, not the installed `expo`: on 2026-09-29 it wrote `~57.0.20` for `expo-constants` (published that morning) while the table, the module map of the installed `expo` 57.0.25 and the root override said 57.0.19. With the table spec, `npx expo install expo-constants@~57.0.19` prints `Using ~57.0.19 instead of ~57.0.20 for expo-constants because this version was explicitly provided` and writes `~57.0.19` (verified 2026-09-30).
- `npm install` with an existing lockfile, and `npm ci`, install the locked versions without re-checking age; the 7-day policy acts when a version enters the lockfile.
- `npm ls --parseable` redacts UUID-like path segments as `***`; read `package-lock.json` instead.
- `npm approve-scripts` is unaware of workspaces: approvals live in the root `package.json` `allowScripts`.
- `npm approve-scripts --allow-scripts-pending` exits 0 whether or not something is pending; read the text.
- Skia 2.6.2's postinstall copies about 205 MB of xcframeworks and needs approval; Skia 2.6.5 and later have none (SDK 58 ships 2.11.2).
- `expo install --check` does not look at root devDependencies; compare `jest-expo` with `node -p "require('expo/bundledNativeModules.json')['jest-expo']"`.
- Never delete `package-lock.json` to "fix" an install, and never remove the policy lines of `.npmrc`.
- `npm install` ends with "N moderate severity vulnerabilities" and suggests `npm audit fix --force`. The count grows as advisories are published (12 on 2026-09-28, 23 on 2026-09-30); `npm audit` is not a gate. On the SDK 57 set every advisory seen so far sits in build tooling (`uuid` 7 in the `xcode` parser of Expo's config plugins, `qs` in Stryker's `typed-rest-client`), none ships in the app, and `--force` would move `expo` to another SDK. Never run `npm audit fix`. For each advisory, `npm explain <pkg>` shows who pulls it in: under `expo` → `@expo/config-plugins` or `@expo/cli`, or under a dev tool, it is build tooling that never reaches the bundle (`--omit=dev` does not separate it, because `expo` is an app dependency). An advisory in code that ships is fixed by upgrading that package through "Upgrade a package" (or by the next Expo patch through `npx expo install --fix`), and reported to the owner.

## A same-day Expo patch

Expo publishes patches of the SDK line often, and its online versions list names them the day they appear. So a new patch (for example `expo-constants` 57.0.20 on 2026-09-29) can show up three ways: a bare `npx expo install <pkg>` writes it, `npx expo install --check` and `expo-doctor` ask for it, and the bootstrap's dated exclude block (while it lasts) lets `expo-*` past the 7-day age. What to do:

1. Keep the table spec. Install with `npx expo install <pkg>@<table spec>`; if a manifest already holds the newer specifier, run that command in each app (it rewrites the specifier), then `npm install` so the lockfile follows. `check-deps-policy.mjs` names the command in its `expo-spec` and `table-version` fix lines.
2. Leave the patch alone for 7 days. `check-deps.ts` (the last step of `npm run verify`) prints it as a `WARN` line with the day it becomes due and passes; report that line to the owner as information.
3. On the due date the same mismatch fails. Then move it through "Upgrade a package": the table row (both files), `npx expo install <pkg>@<new spec>` in every app, the root override if the package has one, `npm install`, one commit.

Never add an exclude for such a patch, never pass `--fix` to Expo's checks inside the 7 days, and never add the package to `expo.install.exclude` (it would silence the due-date check for good).

## What to record in the commit

- Type and scope: `build(deps): …` for dependency-only changes, or the feature commit that needed the package (the install belongs with its first user).
- The body names each package, old and new version, why, and the age and licence checks.
- `Gate-Change: <reason>` when `.npmrc` or `packages/tooling/license-exceptions.json` changes (both are gated paths).
- The table rows (`assets/versions.json`, `references/versions.md`) change in the same commit.
