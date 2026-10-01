---
name: dependency-management
description: Adds, upgrades or removes npm packages under the pinning policy - npx expo install, exact pins, 7-day release age, dated excludes, script approval, banned list, licences. Use when installing or bumping a package. Not for SDK majors (expo-sdk-upgrade) or network audits (privacy-and-network-audit).
---

# Dependency management

Keeps every package in the Pocket Arcade monorepo on the verified Expo SDK 57 set: the right version, in the right workspace, pinned, old enough, reviewed, allowed to ship, and identical in every app.

## Rules that must hold

1. **Use exactly the versions in the versions table** (`references/versions.md`, machine copy `assets/versions.json`). Change a version only through the procedures, and change the table row in the same commit. *Why:* npm `latest` is the wrong major for several packages today (React Native 0.87, TypeScript 7, ESLint 10, Jest 30, Skia 2.13); one written truth stops "upgrades" from memory.
2. **Install Expo-managed runtime packages only with `npx expo install <pkg>@<table spec>` inside every `apps/<game>`, and keep the specifier it writes** (`npx expo install expo-constants@~57.0.19` writes `~57.0.19`; exact where Expo pins exactly). *Why:* Expo tests one coherent native set per SDK and `expo install --check` verifies it; without the spec, `npx expo install` asks Expo's online versions list, which names a patch the day it is published (it wrote `~57.0.20` on 2026-09-29, the table said `~57.0.19`). A same-day Expo patch is a `WARN` with its due date, never an install.
3. **Pin every other package exactly** (`.npmrc` `save-exact=true`), in the workspace the table names: app-wide libraries in every app, Shell-only libraries in `packages/shell`, tools as root devDependencies. *Why:* patch releases of native wrappers change binaries; an exact pin turns every change into a reviewed commit.
4. **Keep every app in lockstep, with one copy of everything pinned.** Every native module is a dependency of every app with the identical specifier, a `peerDependencies` entry `"*"` of `packages/shell`, and a root `overrides` entry at the version the apps install (`react-native-screens` 4.26.2, not the range floor 4.26.0). The root `overrides` also pin `react` and `react-native` and every companion the table marks "root overrides" (the ten `@typescript-eslint/*` at the `typescript-eslint` pin). *Why:* autolinking only sees an app's own dependencies; a `"*"` peer lets npm put its newest release at the root next to the app's copy (duplicate native modules), and a caret range lets a second copy of a pinned tool in (two `@typescript-eslint` plugins crash ESLint).
5. **Commit `package-lock.json`, install fresh clones with `npm ci`, never delete the lockfile to "fix" an install.** *Why:* the lockfile is what makes 26 apps build identically.
6. **Keep `min-release-age=7`, `engine-strict=true` and `save-exact=true` in the root `.npmrc`.** A younger release enters only through a dated `# exclude-block expires=YYYY-MM-DD reason=…` block that the owner agreed to, and the block is deleted (never extended) on its date. *Why:* a 7-day wait lets most malicious or broken releases be pulled first.
7. **Approve install scripts one package at a time, after reading them**, until `npm approve-scripts --allow-scripts-pending` prints `No packages with unreviewed install scripts.` *Why:* npm will soon block unreviewed scripts; each approval is pinned to the reviewed version.
8. **Never add a banned package** (`references/supply-chain.md`): no router, OTA updates, dev client, NetInfo, analytics, crash reporting, purchase servers, web views, push, or direct HTTP clients. *Why:* the apps must never reach the network through our code (spec N1 to N3).
9. **Ship only MIT, ISC, Apache-2.0, BSD-2/3-Clause, 0BSD, OFL-1.1 or CC0-1.0 code;** any other licence needs an owner-approved entry in `packages/tooling/license-exceptions.json`.
10. **`npx expo install --check` and `npx expo-doctor` pass in every app** (the `check-deps.ts` step of `npm run verify`). *Why:* they see SDK drift that `tsc` and Jest cannot.
11. **Respect the held-back majors** (ESLint 10, TypeScript 7, Jest 30, React Navigation 8, Prettier 4, `react-native-audio-api` 1.0) until their triggers, and move Expo SDK majors only with the `expo-sdk-upgrade` skill. *Why:* each one breaks a verified part of the stack.
12. **Stop and ask the owner before adding a package that is not in the table,** before any dated exception, and before any licence exception. Bring the facts `plan-dependency.mjs --online` prints.
13. **Read a library's versioned docs before coding against it, never memory,** and re-verify a version row before trusting it when the table is more than a few weeks old.

## Workflow

1. Name the task: add, upgrade, remove, the monthly pass, a dated exception, or a failing dependency gate. For a failing gate go straight to "When a gate in this area fails" in [references/supply-chain.md](references/supply-chain.md).
2. Read the package's row in [references/versions.md](references/versions.md) (kind, version, specifier, workspace, why), then the matching section of [references/procedures.md](references/procedures.md).
3. Plan: `node ${CLAUDE_SKILL_DIR}/scripts/plan-dependency.mjs <pkg>[@<version>] --root . --online` (use `--remove` to remove; without network drop `--online` and check age and licence by hand with `npm view <pkg>@<v> time license scripts --json`). The plan names every companion to install in the same command and the root override a Shell peer needs. A `FAIL` line (`banned`, `do-not-add`, `held-back`, `not-in-table`, `version-differs`, `too-young`, `licence`) means stop: fix the request, follow the upgrade procedure, or ask the owner.
4. Too young but needed: read [references/release-age-policy.md](references/release-age-policy.md), get the owner's agreement, fill `templates/npmrc-exclude-block.txt` (expiry = publish date + 7 days) and append it to `.npmrc` after one blank line.
5. Run the printed install steps exactly, in order: for a native module first the Shell peer `"*"` and its root override (so npm never puts another release at the root), then `npx expo install <pkg>@<table spec>` in each app (the plan prints the spec; keep it); otherwise the exact `npm install … -w …` with its companions in the same command. All apps in the same change, never one app first.
6. If the package has a config plugin, add one line to `shellPlugins` in `packages/shell/src/config/shell-plugins.ts`, the Shell's one plugin list that `with-shell.ts` spreads, with a comment naming the owning skill (never a second list, never an edit in `ios/`).
7. Approve install scripts as in [references/supply-chain.md](references/supply-chain.md) ("Install scripts"); re-approve after any version bump.
8. Write the code that imports the package in the same change; a vendor SDK is imported only by its adapter. knip catches an unused Shell library or tool, but not an app-wide native module once the Shell lists it as a peer (the peer counts as a use); `check-deps-policy.mjs` catches that one (`unused-dependency`).
9. In every app: `npx expo install --check` and `npx expo-doctor`.
10. Run `node ${CLAUDE_SKILL_DIR}/scripts/check-deps-policy.mjs .`; fix every `FAIL` line (each names the file, the rule and the fix) and rerun until `RESULT: PASS`. Then `npm run -s check:fast` and `npm run -s knip`.
11. Native or pre-1.0 package: hand off for a clean prebuild and a Release simulator build of every app (`ios-simulator-build`), plus the network and privacy audits; purchases also need the StoreKit tests.
12. Commit as in [references/procedures.md](references/procedures.md) ("What to record in the commit"): package, old and new version, age and licence checks; `Gate-Change:` when `.npmrc` or `license-exceptions.json` changed; the table rows in the same commit. Follow [examples/add-expo-haptics.md](examples/add-expo-haptics.md).
13. If a tooling gate file under `packages/tooling/src/{deps,clock,audit}/` is missing or damaged, restore it from `templates/tooling-deps/` (same relative path) and rerun its Jest tests.

## Definition of done

- [ ] Every changed package is at its table version and specifier, in the workspace the table names, in every app at once, with a Shell peer and a root override for app-wide native packages and its companions installed with it.
- [ ] `npm ls <pkg>` shows one version for every package the change touched (and `npm ls react react-native @typescript-eslint/eslint-plugin`).
- [ ] The table rows (`assets/versions.json` and `references/versions.md`) changed in the same commit as the manifests and `package-lock.json`.
- [ ] `npm approve-scripts --allow-scripts-pending` prints `No packages with unreviewed install scripts.`; `npm ls react react-native` shows one version each.
- [ ] `npx expo install --check` and `npx expo-doctor` pass in every app (an Expo patch younger than 7 days is a `WARN` line with its due date in `check-deps.ts`, reported, not installed); `npm run -s knip` and `npm run -s check:fast` are green.
- [ ] No banned package anywhere, no undated or expired exclude, no licence outside the allowlist without an owner-approved exception.
- [ ] Native or pre-1.0 changes: every app's Release simulator build launched.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-deps-policy.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **Installing from memory or from npm `latest`** (`npm install react-native`, `npm install @shopify/react-native-skia`): the newest release is the wrong major. Take the table row.
- **`npx expo install <pkg>` for a package outside Expo's map**: it runs a plain `npm install --save` at npm `latest` and writes a caret (a probe got `^17.2.0`). Use `npm install <pkg>@<exact> -w apps/<each>`.
- **`npx expo install X -- --save-dev`**: it puts the package into `dependencies`. Use `npx expo install X --dev`, or npm at the root for tools.
- **Installing in one app "to try it first"**: lockstep breaks and `check-deps` fails; plan it for all apps.
- **Installing a package before the code that uses it**: knip or `unused-dependency` fails, and the package ages unreviewed.
- **Deleting `package-lock.json`, `--force` or `--legacy-peer-deps` when an install fails**: `ETARGET` means too young, `ERESOLVE` means off the SDK set. Go back to the table.
- **Extending an expired exclude block or adding an undated exclude**: delete it on its date; locked versions stay installed.
- **`npm approve-scripts --all`** or approving without reading the script.
- **`npm audit fix` (or `--force`)**: it rewrites pins outside the table and can move `expo` to another SDK. The advisories on the SDK 57 set sit in build tooling (Expo's config plugins, Stryker), not the app; a real fix comes through the upgrade procedure.
- **A second `min-release-age=` (or `engine-strict=`, `save-exact=`) line, or an exclude outside a dated block in any spelling**: npm keeps the last value and reads `min-release-age-exclude = x` like `[]=x`; the checks fail on both.
- **Adding a native library at the root** because a root config names it: add it to knip's root `ignoreDependencies` instead; a root copy splits the version from the apps.
- **Bumping `react`, `react-native`, Reanimated, Skia or Gesture Handler by hand**: they move only with an Expo SDK (`expo-sdk-upgrade`).
- **Adding a Shell `"*"` peer without its root override, or installing RNTL without `test-renderer`**: npm fills the gap with its newest release (`react-native-screens` 4.28.0, `test-renderer` 1.3.0) and the tree holds two copies. Take the plan's companions and override. Likewise `jest-image-snapshot` without `@types/jest-image-snapshot` 6.4.2: typecheck fails `TS7016` in `test/goldens/boards/skia-golden.ts`.
- **Installing an Expo patch the day `expo install --check` asks for it**: it is younger than 7 days; `check-deps.ts` warns with the due date, and the patch moves on that date.
- **A bare `npx expo install <pkg>` for an Expo-managed package**: it writes whatever Expo's online versions list names today, which can be a patch published that morning (the bootstrap's dated block lets `expo-*` through the 7-day age). Pass the table spec: `npx expo install expo-constants@~57.0.19`.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/versions.md](references/versions.md) | The versions table: every allowed package, version, specifier, workspace and reason; do-not-add; held-back majors; toolchain; re-verify commands | Workflow step 2, before any install or review |
| [references/procedures.md](references/procedures.md) | Add, add outside the table, upgrade, remove, monthly pass, command traps, what the commit records | Workflow steps 2 and 12 |
| [references/release-age-policy.md](references/release-age-policy.md) | The complete `.npmrc`, verified npm 11.17 behaviour, the bootstrap block, dated exceptions, expiry | On `ETARGET`, before an exception, on an expiry date |
| [references/supply-chain.md](references/supply-chain.md) | Banned packages, options and pods; install scripts; licences; Expo alignment; the tooling gate files; fixes for failing gates | Before adding a package; when a dependency gate fails |
| [examples/add-expo-haptics.md](examples/add-expo-haptics.md) | A complete add: plan output, installs, approvals, checks, commit, owner line | Workflow step 12, as the model |
| `templates/npmrc-exclude-block.txt` | The dated exclude block (`__EXPIRES__`, `__REASON__`, `__PACKAGE__`) | Workflow step 4 |
| `templates/tooling-deps/` | `check-deps.ts`, release-age, banned, lockstep, clock and licence-audit tooling with tests (synced from the library; do not edit here) | Workflow step 13 |
| `assets/versions.json` | Machine copy of the versions table, held-back and do-not-add lists | Read by the scripts; edit with the table |
| `assets/banned-packages.json` | The banned list as patterns with scope and reason | Read by the scripts |
| `assets/expo-sdk-57-module-map.json` | Expo SDK 57's `bundledNativeModules.json` (what `npx expo install` writes) (synced from the library, the same file in dependency-management and expo-sdk-upgrade; do not edit here) | Read by the scripts when `node_modules` is absent |
| `scripts/plan-dependency.mjs` | Prints the policy plan for one package (its companions, the Shell peer and root override, the exact install commands, `npx expo install <pkg>@<table spec>` for Expo-managed ones) and fails a forbidden request (`--online` adds age, licence, scripts) | Workflow step 3 |
| `scripts/check-deps-policy.mjs` | Checks every manifest, the lockfile and `.npmrc` against the policy (26 rules, among them `peer-override`, `companion`, `stale-override` and `one-version`: two installed versions of a table package or companion) | Workflow step 10, and after any dependency change |
| `scripts/lib/policy.mjs` | Shared loaders for the table, banned list, module map and repo files | Read only to change a script |
| `scripts/lib/assemble-fixtures.mjs` | Builds each self-test case from the base repo plus its `mutation.json` | Read only to add a self-test case |
| `scripts/selftest.mjs` | Proves both scripts on a clean repo and 46 planted problems (37 for the checker, among them a nested `@typescript-eslint/eslint-plugin`, `test-renderer` 1.3.0, `jest-image-snapshot` without its types, a duplicate native module, a same-day Expo patch spec, and `expo-tracking-transparency` with a caret range or missing from one app; 9 for the plan, among them the RNTL and typescript-eslint companions), plus 4 passing plans (`pass-*`, checked by the shared runner) whose `npx expo install <pkg>@<spec>`, Shell peer, override and companion lines are pinned (`pass-plan-jest-image-snapshot`: the types install in the same command) | After changing a script, an asset or a fixture |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files copied into this skill | When adding a shared file |
| `tests/fixtures/` | The base repo and one `mutation.json` (+ `EXPECT.txt`, `ARGS.txt`, npm view samples) per case: `good`, `bad-*`, and the plan's `pass-*` cases | When adding a rule |

## Related skills

- `expo-sdk-upgrade` - moving every app to a new Expo SDK or Xcode major.
- `monorepo-bootstrap` - the first install of the repo and its `.npmrc`.
- `quality-gates` - `npm run verify` and the other gates around these checks.
- `privacy-and-network-audit` - the network audit, vendor-pod allowlist and privacy manifest after a native install.
- `ios-simulator-build` - the prebuild and Release simulator build after a native change.
- `architecture-and-boundaries` - where a new adapter goes and which files may import a vendor SDK.
- `git-commits-and-reporting` - commit format, trailers and the owner report.
