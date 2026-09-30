# Supply-chain gates, knip and optional CI

The dependency gates inside `verify` (step 11, `check-deps.ts`, and step 10, `audit:licenses`), the knip settings, and the optional GitHub Actions workflow. Adding or upgrading a dependency is the `dependency-management` skill's job; this page covers what the gates check.

## Contents

- Exact pins and the release-age cooldown
- Install scripts
- Licences
- App lockstep and Expo alignment
- knip
- Optional CI

## Exact pins and the release-age cooldown

- `.npmrc` holds three policy lines the guardrail checks: `min-release-age=7` (refuse any version published less than 7 days ago), `engine-strict=true`, `save-exact=true` (every install writes an exact version). Commit `package-lock.json`; CI installs with `npm ci`.
- A fix needed before it is 7 days old goes into a dated block in `.npmrc`, and nowhere else:

  ```ini
  # exclude-block expires=YYYY-MM-DD reason=<issue link or changelog line>
  min-release-age-exclude[]=<package>
  ```

  The expiry is the publish date + 7 days. `check-deps.ts` fails on an exclude outside a dated block and on a block whose expiry date has passed; the fix is to delete the whole block (never extend it). The lockfile keeps the installed versions, because locked versions are not re-resolved.
- The bootstrap block written on 2026-09-26 expires on 2026-10-03: delete it on or after that date. `verify` fails from 2026-10-04 until it is gone.
- The cooldown covers npm only; CocoaPods follow the npm packages' podspecs and are checked by the network audit's vendor-pod allowlist.

## Install scripts

npm 11.17 lists packages whose install scripts are not yet approved. Review each script, then approve it (pinned to the installed version):

```sh
npm approve-scripts --allow-scripts-pending   # read-only list; exits 0 either way
npm approve-scripts lefthook unrs-resolver @shopify/react-native-skia
```

Expected approvals on SDK 57: `lefthook` (postinstall installs its binary), `unrs-resolver` (native resolver for the ESLint import resolver), `fsevents` (macOS file watching), `@shopify/react-native-skia` (postinstall copies the iOS frameworks; an empty `libs/ios` breaks the iOS build). Re-approve after a version bump. `check-deps.ts` fails unless the pending list prints `No packages with unreviewed install scripts.`.

## Licences

- Shipped dependencies may use MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, OFL-1.1 or CC0-1.0. An SPDX `OR` needs one allowed side, `AND` needs all.
- Anything else needs an entry in `packages/tooling/license-exceptions.json` (a gated path): `{ "<package>": { "license": "<exact SPDX>", "reason": "<why it is acceptable>" } }`. An exception applies only while the package keeps that exact licence, and it needs the owner.
- `audit:licenses` reads the source maps that `audit:network` exported, so only shipped code is audited: build tools in the lockfile (for example Expo CLI's MPL-2.0 `lightningcss`) never fail it. Fonts and sounds are not npm packages; their licences are listed on the Licences screen (S11d).

## App lockstep and Expo alignment

- Every app declares the same version of every shared package (`app-lockstep.ts`); workspace links (`*`) are ignored.
- `check-deps.ts` runs `npx expo install --check` and `npx expo-doctor` in every app.
- Expo SDK upgrades move all apps together (the `expo-sdk-upgrade` skill).

## knip

- Every issue type knip 6 knows is an `error`, including `cycles` (default `warn`, which would not fail the run).
- `includeEntryExports: true` on `packages/game-kit`, `packages/shell` and `packages/tooling`: their `exports` map makes every file an entry, so without the setting an unused file there is never reported.
- `ignoreExportsUsedInFile: true` keeps knip quiet about exports their own file uses (a component's props type, an `as const` table beside its union).
- The Expo plugin evaluates `app.config.ts`, hence `APP_VARIANT=test ADS_MODE=off` in the script; it also expects `updates.enabled: false` and an `expo-system-ui` dependency in every app.
- Tool dependencies referenced only from configs must be root devDependencies (`@stryker-mutator/core`, `babel-jest`), or knip reports them. The root `ignoreDependencies` lists the native libraries the root Jest setup and the root `__mocks__/` import but the apps install (Skia, Gesture Handler, Reanimated, Worklets, `expo-iap`, `react-native-audio-api`) and `@formatjs/cli`, which `i18n:verify` runs as a command; `ignoreBinaries` lists the macOS tools the tooling scripts start by name (`footprint`, `pgrep`, `plutil`, `sqlite3`). [root-files.md](root-files.md) gives the reason for every entry; `check-gate-wiring.mjs` fails any entry that is not there (`knip-ignores`).
- Exports reached only through the test-build `require` carry `/** @public */` in their templates; exports only a later screen uses are expected while `shell-slice.json` exists, when `verify` runs knip without its export and type kinds.
- "Configuration hints" (patterns that match nothing yet, a redundant entry pattern) do not fail the run.
- `expo install --check` and `expo-doctor` mismatches: an expected Expo patch younger than 7 days is a `WARN` line with its due date in `check-deps.ts` (installing it would break `min-release-age=7`); from the due date on it fails, and the fix is `npx expo install <pkg>@~<version>` in every app in one commit (dependency-management).

## Optional CI

Local `npm run verify` is the gate. If the owner wants CI, `templates/github/verify.yml` goes to `.github/workflows/verify.yml`: the `static` job runs `npm ci` and `npm run verify` on ubuntu-latest for every push and pull request; the `ios-e2e` job runs nightly or on demand on `macos-26` (Xcode 26.6, iOS 26.5 simulators, Java 17). `LEFTHOOK: '0'` there only switches git hooks off on the runner; it is the one allowed place for it. Linux minutes cost about a tenth of macOS minutes, so only the simulator job runs on macOS. Pushing a workflow is outward-facing: ask the owner first.
