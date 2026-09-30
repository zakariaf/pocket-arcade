---
name: expo-sdk-upgrade
description: Moves every Pocket Arcade app to a new Expo SDK (57 to 58) or Xcode major together - trigger check, expo install --fix, root tools, overrides, Gesture Handler 3, Reanimated Jest resolver, enableSceneSupport. Use when an SDK or Xcode upgrade is due. Not for single packages (dependency-management).
---

# Expo SDK upgrade

Moves all apps of the monorepo to the next Expo SDK (or the build Mac to another Xcode) in one proven step: only when the new SDK is stable and old enough, with every package, tool, override and code migration in one commit, and a checker that proves the repo sits on one SDK line.

## Rules that must hold

1. **Move only when the trigger holds:** `latest` on npm is the new SDK and at least 7 days old, every package the repo takes from its module map is published and at least 7 days old (`check-sdk-trigger.mjs` reports `upgrade-due`), and on a branch every app passes verify, simulator builds, E2E and the screenshot matrix. `RESULT: PASS` from the trigger check means no move is due (stay); `RESULT: FAIL [upgrade-due]` means the move is due and not yet done. *Why:* previews break things, and the first patch releases fix what `.0` broke; an SDK is never urgent enough for a release-age exception.
2. **Move all apps together, in one commit, on a branch.** *Why:* Expo does not support two React Native versions in one monorepo, and one Shell serves every game.
3. **Move Expo-managed packages only with `npx expo install expo@~<version>` then `npx expo install --fix` in every app.** Never hand-edit an Expo-managed specifier or install `react-native`, React, Reanimated, Worklets, Skia or Gesture Handler by hand. *Why:* Expo tests one coherent native set per SDK.
4. **Everything that follows the SDK moves in the same commit:** the root tools in one `npm install -D` (`jest-expo`, `eslint-config-expo`, `@react-native/jest-preset`, `@react-native/eslint-plugin`, `@types/react`, `test-renderer`), the root `overrides` (`react`, `react-native`, `react-native-reanimated`, `react-native-worklets`, and every existing Shell-peer key at the exact version the apps install), `allowScripts`, the code migrations, this skill's `assets/sdk-lines.json` and module map, and the `dependency-management` versions table. *Why:* each one alone breaks the install (`ERESOLVE`), the tree (duplicate native modules) or a gate.
5. **Held-back tools stay:** TypeScript 6.0, Jest 29.7, `@types/jest` 29.5.14, ESLint 9 (Expo's related packages keep them for SDK 58). *Why:* each has its own trigger; two moves in one commit cannot be debugged.
6. **Select Xcode by version through `DEVELOPER_DIR`, never `xcode-select`.** SDK 58 needs Xcode 26.4 or newer, not Xcode 27; building SDK 57 with Xcode 27 needs `ios.enableSceneSupport` first (expo 57.0.23+), and the move to SDK 58 removes it. *Why:* an iOS 27 SDK build on the application life cycle does not launch correctly on iOS 27.
7. **Migrate every gesture to Gesture Handler 3 hooks as a whole** (`use-board-gestures.ts`, and the Settings `Slider` in `packages/shell/src/ui/slider.tsx`) in the move commit. *Why:* hook and builder gestures cannot be related.
8. **Never loosen a gate or re-accept a golden or screenshot to get green.** Every diff must be explained by the change list and committed with a `Gate-Change:` trailer. *Why:* a silent visual regression ships to 26 games at once.
9. **Read the new versions' release notes and versioned docs, never memory,** and add every new finding to `references/sdk-58-changes.md` (or the next SDK's file) in the move commit.
10. **Stop and ask before the branch (one message with a default) and before merging or pushing.** Installing Xcode, licences and `sudo` are the owner's.

## Workflow

1. Read [references/upgrade-policy.md](references/upgrade-policy.md): the current line, the trigger, what moves together, the Xcode policy.
2. Check the trigger: `node ${CLAUDE_SKILL_DIR}/scripts/check-sdk-trigger.mjs . --online --save-facts reports/sdk-trigger.json` (without network: `--facts <saved file>`; with neither it exits 2). `RESULT: PASS` means no move is due: its `wait` lines (`target-stable`, `target-age`, `package-age`, `package-missing`) say why and from which day it can change; stop and, if asked, report "not yet" with that day ([examples/sdk-move-report.md](examples/sdk-move-report.md), message 1). `RESULT: FAIL [upgrade-due]` means the move is due and not yet done: keep its `plan` lines and continue.
3. Start green (`npm run -s check:fast`, `npm run verify`, clean `git status`), then scan readiness: `node ${CLAUDE_SKILL_DIR}/scripts/check-sdk-alignment.mjs . --target-sdk 58`. Fix every `FAIL` on the current SDK in its own commit; the `todo` lines are the move commit's work list.
4. Tell the owner (message 2 of the example) and continue unless told to wait.
5. Read [references/sdk-58-changes.md](references/sdk-58-changes.md) in full, then follow [references/runbook.md](references/runbook.md) steps 5 to 16: branch, `npx expo install` in every app, root tools in one command, overrides, approvals, code migrations (config plugin imports, Jest resolver and asset-registry mapping, Gesture Handler 3, scene-support removal), then this skill's data and the versions-table hand-off.
6. For an Xcode-only change (for example Xcode 27 while still on SDK 57) read [references/xcode-and-scene-support.md](references/xcode-and-scene-support.md) and copy `templates/shell-config/scene-support.ts` and its test into `packages/shell/src/config/`; run the verification loop below with `--xcode <version>` if `toolchain.ts` has not changed yet.
7. Verification loop (runbook "Verification loop"): `node ${CLAUDE_SKILL_DIR}/scripts/check-sdk-alignment.mjs .` until `RESULT: PASS` (each `FAIL` names the file, the rule and the fix), `npx expo install --check` and `npx expo-doctor` in every app, `npm ls react react-native react-native-reanimated react-native-worklets`, `npm run verify`, then per app the clean prebuild, Release simulator build and launch, E2E and screenshots (hand-off to `ios-simulator-build` and `e2e-maestro`); open every diff.
8. Commit the move as one commit with its `Gate-Change:` trailer (runbook "Commit, report, merge"), report with message 3 of the example, and merge or push only on the owner's go.

## Definition of done

- [ ] Before the branch, `check-sdk-trigger.mjs` reported `upgrade-due` and its facts are saved in `reports/`; after the move `node ${CLAUDE_SKILL_DIR}/scripts/check-sdk-trigger.mjs . --online` prints `RESULT: PASS` again (no move due).
- [ ] Every app declares the same `expo` specifier and exactly the new module map's specifiers; `npx expo install --check` and `npx expo-doctor` pass in every app; `npm ls` shows one version of `react`, `react-native`, `react-native-reanimated` and `react-native-worklets`.
- [ ] Root tools, overrides and `allowScripts` moved in the same commit; TypeScript, Jest and ESLint did not.
- [ ] Config plugin imports, the Jest config, the board gestures and scene support match the new SDK; `npm run verify` is green.
- [ ] Every app's Release simulator build launched, E2E and the screenshot matrix passed, and every golden or screenshot diff was looked at and explained.
- [ ] `assets/sdk-lines.json`, the module map and the `dependency-management` versions table describe the new SDK.
- [ ] The owner got the report; nothing was merged or pushed without the go.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-sdk-alignment.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **Adopting a preview, beta or release candidate,** or adding a `min-release-age-exclude` to get an SDK early: wait for the trigger.
- **Moving one app first "to try it"**, or merging a half-moved repo: the whole move lives on one branch until it is green.
- **Installing `jest-expo` alone**, then `--legacy-peer-deps` to silence `ERESOLVE`: install the root tools in one command.
- **`npm dedupe` or deleting `node_modules` against duplicate native modules:** set the overrides and `npm install`; expo-doctor must show no duplicates.
- **Switching config plugins to `expo/config-plugins` before the move** (SDK 57 cannot resolve it) or keeping `expo/config-plugins.js` after it (SDK 58 resolves it to `config-plugins.js.js`).
- **Mocking Reanimated to quiet Jest:** the mock loads the native initializers too; use the Reanimated resolver plus the asset-registry mapping.
- **Mixing builder and hook gestures** during the move: migrate `use-board-gestures.ts` completely.
- **`jest -u` over every golden, or a new screenshot baseline without looking:** open each diff; accept only what the change list explains.
- **Selecting Xcode 27 on SDK 57 without scene support, or with `sudo xcode-select`.**
- **Taking TypeScript 7, Jest 30, ESLint 10 or a Node LTS move along with the SDK.**

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/upgrade-policy.md](references/upgrade-policy.md) | Current and next SDK line, the three-part trigger, what moves together and what never does, Xcode policy, human steps, fact-check commands | Workflow step 1, and at session starts in an SDK window |
| [references/sdk-58-changes.md](references/sdk-58-changes.md) | Every verified 57 to 58 change with its error text and fix: packages, root tools, overrides, config plugins, Jest, Gesture Handler 3, Reanimated, Skia, React 19.3, React Native 0.88 | Workflow step 5, and for each failing gate during the move |
| [references/runbook.md](references/runbook.md) | The ordered steps with commands, expected output, the verification loop, commit, failure table, rollback | Workflow steps 5, 7 and 8 |
| [references/xcode-and-scene-support.md](references/xcode-and-scene-support.md) | Xcode selection, Xcode moves, scene support for SDK 57 with Xcode 27, its verification and removal | Workflow step 6, and on a `scene-support` or `xcode` failure |
| [examples/sdk-move-report.md](examples/sdk-move-report.md) | The three owner messages (not yet, ready, done), the evidence list and the move commit | Workflow steps 2, 4 and 8 |
| `templates/shell-config/scene-support.ts` | `withSceneSupport(plugins)`: merges `ios.enableSceneSupport` into the `expo-build-properties` entry (tested) | Workflow step 6 (SDK 57 with Xcode 27) |
| `templates/shell-config/scene-support.test.ts` | Its Jest tests (4 cases) | Copied with the template |
| `assets/sdk-lines.json` | Per-SDK expectations: React, test-renderer and @types/react lines, held-back tools, Gesture Handler major, config-plugin import, Jest config lines, Xcode, removed React Native APIs | Read by the scripts; update in the move commit |
| `assets/expo-sdk-57-module-map.json` | Expo 57.0.25's `bundledNativeModules.json` (synced from the library, the same file in dependency-management and expo-sdk-upgrade; do not edit here) | Read by the scripts when `node_modules` is absent |
| `assets/expo-sdk-58-preview-module-map.json` | Expo 58.0.0-preview.7's `bundledNativeModules.json` (replace with the stable map at the move) | Read by the scripts when `node_modules` is absent |
| `scripts/check-sdk-trigger.mjs` | Is an SDK move due? From npm facts (`--online` or `--facts`): `RESULT: PASS` = no move due, with `wait` reasons and dates; `FAIL [upgrade-due]` = due and not yet done, with this repo's plan; exit 2 without facts | Workflow step 2, at session starts in an SDK window, and after the move |
| `scripts/check-sdk-alignment.mjs` | Proves the repo sits on one SDK line (18 rules); `--target-sdk` adds the readiness scan | Workflow steps 3 and 7, and after any SDK-related change |
| `scripts/lib/sdk.mjs` | Shared helpers: repo manifests, module maps, version comparison, dates | Read only to change a script |
| `scripts/lib/assemble-fixtures.mjs` | Builds each self-test case from a base repo plus its `mutation.json` | Read only to add a self-test case |
| `scripts/selftest.mjs` | Proves both scripts on SDK 57, readiness, SDK 58 and trigger cases: 30 planted alignment problems, 3 "move due" cases (due, overdue with and without its dist-tag), 6 "no move due" cases whose printed reason and date are pinned, and two exit-2 cases (no facts, no "latest" tag) | After changing a script, an asset or a fixture |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files copied into this skill | When adding a shared file |
| `tests/fixtures/` | Base repos for SDK 57 and 58, trigger facts, one `mutation.json` and `EXPECT.txt` per case (`good`, `bad-*`, and the trigger's `pass-*` and `error-*` outcome cases, with an optional `ARGS.txt`) | When adding a rule |

## Related skills

- `dependency-management` - single-package changes, the versions table the move updates, the Node LTS move.
- `board-gestures-and-input` - the `use-board-gestures.ts` contract the Gesture Handler 3 migration keeps.
- `unit-and-component-tests` - the Jest projects, setup file and mocks the move touches.
- `golden-tests` - reviewing and re-accepting board goldens after a Skia change.
- `ios-simulator-build` - clean prebuild, Release simulator builds, Xcode selection.
- `e2e-maestro` - E2E flows and the screenshot matrix on the branch.
- `quality-gates` - `npm run verify` and the `Gate-Change:` rules.
- `git-commits-and-reporting` - the move commit and the owner report.
