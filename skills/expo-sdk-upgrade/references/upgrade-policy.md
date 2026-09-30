# Upgrade policy: when an Expo SDK or Xcode move is allowed

Why the repo stays on its SDK, the exact trigger for the next one, what always moves together, and what never moves with it. Read this first in any upgrade task, and at every session start after mid-October 2026 (the SDK 58 window).

## Contents

- The current line and the next one
- The trigger (all three conditions)
- What moves together, in one commit
- What never moves with an SDK
- Xcode policy
- Node is not part of an SDK move
- Human steps and stop-and-ask points
- Checking the facts yourself

## The current line and the next one

| | SDK 57 (current) | SDK 58 (next) |
|---|---|---|
| Status on 2026-09-30 | npm `latest` = `sdk-57` = 57.0.26 (published 2026-09-29; the table's 57.0.25 was published 2026-09-24) | `next` = 58.0.0 (published 2026-09-29 15:17 UTC; preview.8 on 2026-09-28); not `latest` yet, so no move is due |
| React Native / React | 0.86.3 / 19.2.3 | 0.88.0-rc.2 / 19.3.0 (preview) |
| Xcode | 26.6 (any Xcode 26 builds it) | 26.4 or newer; not Xcode 27 |
| iOS deployment target | 16.4 | 16.4 |
| Support | critical fixes for about one year from 2026-06-30 | expected stable mid or late October 2026 |

Expo shipped three majors a year for years; SDK 57 (2026-06-30) was a lighter "React Native bump" SDK. Each SDK gets critical fixes for about a year, so there is no rush: the project moves when the new SDK is proven, not when it appears.

## The trigger (all three conditions)

Move to the next SDK only when every condition holds:

1. `npm view expo dist-tags` shows `latest` on the new major, and that exact version is at least 7 days old.
2. Every package the repo uses from the new SDK's module map (`bundledNativeModules.json`), plus `@react-native/jest-preset` and `@react-native/eslint-plugin` at the new React Native version, is published and at least 7 days old.
3. On a branch, every app moves together and passes: `npm run verify`, `npm run build:ios:sim` for every app, `npm run e2e:ios`, and the screenshot matrix with every diff reviewed.

`check-sdk-trigger.mjs` judges conditions 1 and 2 (with `--online`, or a saved facts file; with neither it exits 2). Its result answers "is a move due?": `RESULT: PASS` means no, and each `wait` line names the unmet condition and the first day it can hold; `RESULT: FAIL [upgrade-due]` means conditions 1 and 2 hold while the apps are still on the older SDK, so the move is due and not yet done, and its `plan` lines are this repo's move. After the move the same command prints `RESULT: PASS` again. Condition 3 is the runbook. If npm `latest` has already moved two majors ahead, the check judges the next major on its own `sdk-<n>` dist-tag: SDKs move one at a time, as Expo recommends. A preview, beta or release candidate is never adopted, and the 7-day wait is never bypassed with a `min-release-age-exclude` for an SDK move: an SDK is not an urgent fix.

Why the wait: `.npmrc` refuses versions younger than 7 days anyway, and a new SDK's first patch releases routinely fix what the `.0` broke.

## What moves together, in one commit

All 26 apps, never one app first: Expo does not support two React Native versions in one monorepo, and one Shell serves every game. The commit holds:

- every `apps/*/package.json` (`expo` and every Expo-managed package, rewritten by `npx expo install expo@~<version>` and `npx expo install --fix` in each app);
- the root `overrides` (`react`, `react-native`, and every other key already there, plus `react-native-reanimated` and `react-native-worklets` so no stale copy survives);
- the root dev tools that follow the SDK: `jest-expo` and `eslint-config-expo` (the module map's version), `@react-native/jest-preset` and `@react-native/eslint-plugin` (= the React Native version), `@types/react` and `test-renderer` (the new React line);
- `package-lock.json`, `allowScripts` changes, the code migrations of the SDK's change list, re-accepted goldens and screenshot baselines;
- this skill's `assets/sdk-lines.json` entry and module map for the new SDK, and the versions table of the `dependency-management` skill (its `assets/versions.json` and `references/versions.md`).

## What never moves with an SDK

Expo's "related packages" for SDKs 57 and 58 keep `typescript ~6.0.3`, `jest ~29.7.0` and `@types/jest 29.5.14`. So TypeScript 7, Jest 30, ESLint 10, React Navigation 8, Prettier 4 and `react-native-audio-api` 1.0 stay held back; each has its own trigger in the `dependency-management` skill. `check-sdk-alignment.mjs` fails (`held-back`) if one rode along.

## Xcode policy

- Build with Xcode 26.6, selected by version through `DEVELOPER_DIR` (never `sudo xcode-select`); `packages/tooling/src/ios/toolchain.ts` holds `XCODE_VERSION = '26.6'`.
- Apple has required "built with Xcode 26 or later" since 2026-04-28 and announced no Xcode 27 requirement as of 2026-09-26. Stay on 26.6 while Apple accepts it.
- SDK 58 needs Xcode 26.4 or newer, not Xcode 27: do not wait for Xcode 27 to move SDKs.
- Xcode 27.0 (27A266a) is installed at `/Applications/Xcode.app` on the build Mac but not selected, and its licence is not accepted. A tool that picks "Xcode.app" would silently build with the iOS 27 SDK.
- Building SDK 57 with Xcode 27 needs `ios.enableSceneSupport` first: apps built with the iOS 27 SDK that still use the application life cycle do not launch correctly on iOS 27. The procedure is in `references/xcode-and-scene-support.md`. On SDK 58 the option is a no-op and is removed.

## Node is not part of an SDK move

Node 26.4.0 stays pinned (`.nvmrc`, `.mise.toml`) until Node 26 becomes LTS on 2026-10-28; then the `dependency-management` skill moves it to the newest 26.x LTS that is at least 7 days old, in its own commit. Never combine a Node move with an SDK move: two changes in one commit make a failure impossible to attribute.

## Human steps and stop-and-ask points

- Before the branch: tell the owner the trigger is met and what will change (one message; the default is to proceed on the branch).
- Installing or updating Xcode, accepting a licence, `sudo`: the owner's.
- Merging the branch, pushing, and any upload: only with the owner's go.
- A gate that fails for a reason the change list does not explain, or a screenshot diff that changes what a player sees: stop and report with the evidence; never loosen a gate or re-accept a baseline to get green.

## Checking the facts yourself

```sh
npm view expo dist-tags                       # latest / sdk-57 / next
npm view expo time --json                     # publish date of each version
node -e "fetch('https://api.expo.dev/v2/versions/latest').then((r) => r.json()).then((j) => {
  for (const sdk of ['57.0.0', '58.0.0']) { const x = j.data.sdkVersions[sdk] ?? {};
    console.log(sdk, x.facebookReactNativeVersion, x.facebookReactVersion, JSON.stringify(x.relatedPackages)); } })"
node ${CLAUDE_SKILL_DIR}/scripts/check-sdk-trigger.mjs . --online --save-facts reports/sdk-trigger.json
```

On 2026-09-28 the versions API listed SDK 57 with React Native 0.86.3 / React 19.2.3 and SDK 58 with 0.88.0-rc.1 / 19.3.0; related packages for 58: `typescript ~6.0.3`, `jest ~29.7.0`, `@types/jest 29.5.14`, `@types/react ~19.3.0`, `babel-preset-expo ~58.0.0`. On 2026-09-30 `check-sdk-trigger.mjs . --online` printed `wait     [target-stable] SDK 58 is not stable yet: expo "latest" is 57.0.26 (next: 58.0.0)` and `verdict  no upgrade due: stay on SDK 57`, then `RESULT: PASS` (exit 0): not yet.
