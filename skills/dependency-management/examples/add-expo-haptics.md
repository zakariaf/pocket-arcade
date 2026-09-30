# Worked example: adding expo-haptics for the HapticsPort adapter

A complete, realistic run of the "add a package that is in the table" procedure, in a repo with two apps (`apps/line-siege`, `apps/flock-tilt`). The task: the Shell's `HapticsPort` needs its adapter, which imports `expo-haptics`.

## 1. Plan

```sh
node ${CLAUDE_SKILL_DIR}/scripts/plan-dependency.mjs expo-haptics --root . --online
```

```text
package  expo-haptics ~57.0.3 (Expo-managed; belongs in every app) - HapticsPort adapter
present  nowhere yet
step 1   add "expo-haptics": "*" to packages/shell/package.json peerDependencies and "expo-haptics": "57.0.3" to the root package.json overrides (the Shell's "*" peer then resolves to the apps' version, not npm's newest)
step 2   (cd apps/flock-tilt && npx expo install expo-haptics@~57.0.3)
step 3   (cd apps/line-siege && npx expo install expo-haptics@~57.0.3)
step 4   npm approve-scripts --allow-scripts-pending   (read any new install script, then npm approve-scripts <pkg>)
step 5   in every app: npx expo install --check && npx expo-doctor
step 6   npm run -s knip   (the package must be imported by the code that needed it)
step 7   node ${CLAUDE_SKILL_DIR}/scripts/check-deps-policy.mjs .   (one-version and companion catch a copy that floated in)
step 8   native change: npx expo prebuild --clean and npm run build:ios:sim for every app (the ios-simulator-build skill)
note     keep the @<spec> in each npx expo install: it writes the versions table's specifier. A plain npx expo install <pkg> writes whatever Expo's online versions list names today, which can be a patch published that day; that patch stays a WARN with its due date in check-deps.ts and moves on that date through the upgrade procedure.
age      expo-haptics@57.0.3 was published 2026-09-11 (17 days before 2026-09-29)
licence  MIT
scripts  no install scripts
plan-dependency: 1 requests checked, 0 problems
RESULT: PASS
```

The plan passed: the package is in the table, old enough, MIT, without install scripts.

## 2. The Shell peer and its override, then install in every app

First add `"expo-haptics": "*"` to `packages/shell/package.json` → `peerDependencies` (the Shell imports it but the apps install it; autolinking only sees an app's own dependencies) and `"expo-haptics": "57.0.3"` to the root `package.json` → `overrides`. The override comes first on purpose: a `"*"` peer is satisfied by any release, and without the override npm may put its newest one at the root next to the apps' copy (seen with `react-native-screens` 4.28.0 beside 4.26.2).

```sh
(cd apps/flock-tilt && npx expo install expo-haptics@~57.0.3)
(cd apps/line-siege && npx expo install expo-haptics@~57.0.3)
npm ls expo-haptics          # one version: 57.0.3
```

Both app manifests now hold `"expo-haptics": "~57.0.3"`. The tilde is correct: it is what `npx expo install` writes for an Expo-managed module even with `save-exact=true`. The `@~57.0.3` keeps it on the table's spec even on a day Expo publishes a newer patch.

## 3. Approvals and Expo alignment

```sh
npm approve-scripts --allow-scripts-pending   # after the first later install: fsevents@2.3.3 (install: (install scripts present))
npm view fsevents@2.3.3 scripts               # install: node-gyp rebuild, the macOS file-watching addon of jest-haste-map
npm approve-scripts fsevents
npm approve-scripts --allow-scripts-pending   # prints: No packages with unreviewed install scripts.
(cd apps/flock-tilt && npx expo install --check && npx expo-doctor)
(cd apps/line-siege && npx expo install --check && npx expo-doctor)
```

Expected: `Dependencies are up to date` and all expo-doctor checks passing in both apps.

## 4. The code that needed it, in the same change

The adapter `packages/shell/src/services/haptics/expo-haptics-adapter.ts` (the only file that imports `expo-haptics`), its fake `fake-haptics.ts`, and the tests go into the same commit. Without them `check-deps-policy.mjs` fails with `unused-dependency` for `expo-haptics`. knip alone would stay quiet: it reports "Unused dependencies: expo-haptics" only until the Shell peer entry exists, and counts that peer as a use (both verified on 2026-09-28).

## 5. Checks

```sh
node ${CLAUDE_SKILL_DIR}/scripts/check-deps-policy.mjs .   # RESULT: PASS
npm run -s check:fast
npm run -s knip
```

`expo-haptics` is a native module, so hand off to the `ios-simulator-build` skill for a clean prebuild and a Release simulator build of each app, and run the network and privacy audits (a new native module is a new surface).

## 6. Commit

```text
feat(shell): add the expo-haptics adapter behind HapticsPort

Installs expo-haptics ~57.0.3 (Expo SDK 57 module map) in line-siege and
flock-tilt with npx expo install, lists it as a Shell peer and pins the
root override at 57.0.3. Published 2026-09-11 (17 days old), MIT, no install
scripts. expo install --check and
expo-doctor pass in both apps; Release simulator builds launch.
```

No `Gate-Change:` trailer: neither `.npmrc` nor `license-exceptions.json` changed. The versions table already had the row, so no table change either.

## 7. The line for the owner's report

"Phones now vibrate on moves when Vibration is on. This added one small, standard Expo component to every game (no network access, MIT licence); all checks and both simulator builds are green."
