# Runbook: moving every app to a new Expo SDK

The exact order of work for an SDK move (written for 57 to 58, valid for later moves with the numbers changed), the expected output of each command, the evidence to keep, and what to do when a step fails. Read it once before starting and follow it step by step; each step names the reference that explains it.

## Contents

- Before the branch
- On the branch: packages
- On the branch: code
- On the branch: the skill's own data
- Verification loop
- Commit, report, merge
- When a step fails
- Rolling back

## Before the branch

1. **Trigger.** `node ${CLAUDE_SKILL_DIR}/scripts/check-sdk-trigger.mjs . --online --save-facts reports/sdk-trigger.json`. `RESULT: PASS` means no move is due: a `wait [target-stable]` line (the new SDK is not npm `latest`) or an age or missing-package line, then `verdict  no upgrade due`; stop and report "not yet" with the day it prints (examples/sdk-move-report.md shows both reports). `RESULT: FAIL [upgrade-due]` means the move is due and not yet done: keep its `plan` lines; they hold this repo's app list and the exact versions. Exit 2 means it had no facts (pass `--online` or `--facts <file>`).
2. **Green start.** `npm run -s check:fast` and `npm run verify` pass on the current SDK; `git status` is clean. Never start a move on a red tree: failures would be impossible to attribute.
3. **Readiness.** `node ${CLAUDE_SKILL_DIR}/scripts/check-sdk-alignment.mjs . --target-sdk 58`. Every `FAIL` (removed React Native APIs, Xcode too old) is fixed now, on the current SDK, in its own commit (the APIs still exist there). The `todo` lines (config plugin imports, Jest config, Gesture Handler builder) are the move commit's work list; copy them into the task notes.
4. **Owner.** One message: the trigger is met, the change list in short, the default ("I will prepare the move on a branch and report the results before anything is merged").

## On the branch: packages

5. `git switch -c chore/expo-sdk-58`.
6. **Every app** (all of them, same commands):

   ```sh
   (cd apps/<id> && npx expo install expo@~58.0.N && npx expo install --fix)
   ```

   `--fix` prints the packages it moves ("Installing 7 SDK 58.0.0 compatible native modules using npm") and rewrites their specifiers. `expo@~58.0.N` keeps the tilde form in `package.json`. A "Skipping config plugin check: Cannot find module …config-plugins.js.js" line is expected until step 10.
7. **Root tools in one command** (versions from the new module map; references/sdk-58-changes.md "Root dev tools"):

   ```sh
   npm install -D jest-expo@<map> eslint-config-expo@<map> @react-native/jest-preset@<rn> \
     @react-native/eslint-plugin@<rn> @types/react@<react line> test-renderer@<react line>
   ```

   Installing `jest-expo` alone fails with `ERESOLVE` (it peers on the new `@react-native/jest-preset`).
8. **Overrides.** Set the root `overrides` to the new versions for `react`, `react-native`, `react-native-reanimated`, `react-native-worklets` and every other key already there, then `npm install`. Every native module the Shell lists as a `"*"` peer has a key (`expo`, Skia, Gesture Handler, `react-native-screens`, `react-native-safe-area-context` and the rest), and each one moves to the exact version `npx expo install --fix` installed in the apps (`npm ls <pkg>`; for example `4.26.2` for `~4.26.0`, never the range floor). The ten `@typescript-eslint/*` keys follow `typescript-eslint`, not the SDK; leave them. Without the Reanimated and Worklets keys npm keeps the old copies at the root and `expo-doctor` reports duplicate native modules.
9. **Install scripts.** `npm approve-scripts --allow-scripts-pending`; delete the `@shopify/react-native-skia@…` approval (Skia 2.6.5+ has no postinstall); read and approve anything new, one package at a time (`fsevents` may appear).

## On the branch: code

10. **Config plugins:** every `import … from 'expo/config-plugins.js'` in `packages/shell/plugins/` becomes `'expo/config-plugins'` (type imports too).
11. **Jest:** add `resolver: 'react-native-reanimated/jest/resolver'` to `SHARED` and `'^react-native/asset-registry$': '<rootDir>/node_modules/react-native/src/asset-registry.js'` as the first `WORKSPACE_MODULES` entry of `jest.config.js` (gated: `Gate-Change:` trailer).
12. **Gestures:** rewrite `use-board-gestures.ts` and the Settings `Slider` (`packages/shell/src/ui/slider.tsx`, a pan and a tap in a race, with `.runOnJS(true)`) to the Gesture Handler 3 hooks, each as a whole (the mapping table and a type-checked example are in references/sdk-58-changes.md); rerun the gesture tests.
13. **Scene support:** remove `withSceneSupport` from `withShell` and delete `packages/shell/src/config/scene-support.ts` and its test if they exist (a no-op on SDK 58).
14. **Everything else** in references/sdk-58-changes.md that applies: `useColorScheme()` null handling, Skia golden review, Reanimated frame-clock recheck. Run `npm run -s typecheck` early: React Native 0.88 and React 19.3 types surface most of the rest.

## On the branch: the skill's own data

15. **This skill:** replace the SDK 58 entry of `assets/sdk-lines.json` with the stable values (status, `expo`, React Native, lines) and save the installed map once, as the skill library's shared `expo-sdk-58-module-map.json` (next to `expo-sdk-57-module-map.json`); declare it in this skill's and the dependency-management skill's `assets/shared.json` with `"to": "assets/expo-sdk-58-module-map.json"` and run `node skills/_library/sync-shared.mjs`, so both skills read the same bytes. Then delete the preview map, so the checks compare against what shipped. Add an entry for the SDK after that one as soon as its beta is out.
16. **Hand-off:** the versions table of the `dependency-management` skill changes in the same commit: `assets/versions.json` (`"sdk": 58`, every moved row, and the held-back entries for React Native, Reanimated, Worklets, Skia and Gesture Handler, which now describe the SDK after 58), its module map asset `assets/expo-sdk-58-module-map.json` (synced in step 15), and `references/versions.md`. Until then its `check-deps-policy.mjs` reports `table-sdk` and `held-back` (seen in the rehearsal).

## Verification loop

Run, fix the cause, rerun, until all pass; keep the outputs for the report:

```sh
node ${CLAUDE_SKILL_DIR}/scripts/check-sdk-alignment.mjs .        # RESULT: PASS
node ${CLAUDE_SKILL_DIR}/scripts/check-sdk-trigger.mjs . --online  # RESULT: PASS again: no move due (the next SDK is not out)
for app in apps/*/; do (cd "$app" && npx expo install --check && npx expo-doctor); done
npm ls react react-native react-native-reanimated react-native-worklets    # one version each
npm run -s check:fast
npm run verify
```

Then, for every app, the device-side checks (the `ios-simulator-build` and `e2e-maestro` skills own the commands): `npx expo prebuild --platform ios --clean`, `npm run build:ios:sim -- --app <id>` and a launch, `npm run e2e:ios -- --app <id>`, `npm run screenshots:ios -- --app <id>`. Open every screenshot and golden diff with the Read tool; a diff is accepted only when the change list explains it, with a `Gate-Change:` trailer.

## Commit, report, merge

- One commit for the whole move, for example:

  ```text
  build(deps): move every app to Expo SDK 58

  expo ~58.0.N, react-native 0.88.x, react 19.3.0, Reanimated 4.7.0,
  Worklets 0.13.0, Gesture Handler ~3.2.1, Skia 2.11.2 in all apps; root
  tools and overrides follow. Board gestures use the Gesture Handler 3
  hooks; config plugins import expo/config-plugins; Jest uses the
  Reanimated resolver. verify, simulator builds, E2E and the screenshot
  matrix pass for every app; N golden diffs reviewed (Skia 2.11).

  Gate-Change: Jest resolver and re-accepted goldens for Expo SDK 58
  ```

- Report to the owner in the shape of examples/sdk-move-report.md. Merging, pushing and any upload wait for the owner's go.

## When a step fails

| Symptom | Cause | Fix |
|---|---|---|
| `ERESOLVE … peer @react-native/jest-preset@"^0.88…" from jest-expo` | root tools installed one by one | step 7 in one command |
| `expo-doctor`: "Found duplicates for react-native-reanimated" | stale root copies for the Shell's `"*"` peers | step 8 overrides, `npm install` |
| `check-sdk-alignment` `duplicate-native` outside a move (`react-native-screens is installed as 4.26.2 and 4.28.0`) | a first install: a Shell `"*"` peer added without its root override, so npm put its newest release at the root | add the override the fix line prints (the version the apps install), `npm install`; nothing about the SDK changed |
| `Cannot find module …/expo/config-plugins.js.js`, `TS2307 'expo/config-plugins.js'` | expo 58's exports map | step 10 |
| Jest: "`setCSSEventHandler` is not available in JSReanimated" | native Reanimated initializers loaded under Jest | step 11 resolver |
| Jest: "Could not locate module react-native/asset-registry mapped as react-native/src/asset-registry" | resolver plus React Native's exports map | step 11 mapping |
| `npm error notarget … with a date before …` | a version younger than 7 days | the trigger was not met: stop, never add an exclude for an SDK move |
| `check-deps-policy` `table-sdk` | versions table still on 57 | step 16 |
| `check-sdk-alignment` `sdk-unknown` | no `sdk-lines.json` entry for the new SDK | step 15 |
| a gate fails for a reason the change list does not explain | new breaking change | read the versioned release notes, fix, add the item to references/sdk-58-changes.md; if the gate itself looks wrong, stop and ask |

## Rolling back

Nothing leaves the branch until the owner agrees, so a failed move is abandoned, not reverted: `git switch main`, then `npm ci` (the lockfile on main still pins the old SDK), and report what blocked the move with its evidence. Never mix a half-moved app into main.
