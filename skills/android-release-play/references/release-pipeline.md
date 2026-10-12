# The release pipeline

`npm run release:android` takes one commit of `apps/<game>` to a signed AAB on the Google Play internal testing track, in two runs with the store-AAB gate between them. This reference lists every step, what each needs, how to run one by hand, and the keyless rehearsal.

## Contents

- Before the first release
- Run 1: build
- The gate
- Run 2: upload
- Running a step by hand
- Rehearsal without the owner's key
- Build numbers, tags and resuming
- After the upload

## Before the first release

- The repo has the tooling (Android step 8): `packages/tooling/src/release-android/` (six modules with their tests), the `release:android` script, and `packages/shell/plugins/with-upload-signing.ts` listed in `withShell`'s Android block. `node ${CLAUDE_SKILL_DIR}/scripts/check-release-setup-android.mjs .` prints `RESULT: PASS`, or only `owner-placeholder` lines and `OWNER STEPS PENDING: ...` while G3 or GP5 is pending.
- The same commit already passed, on Android: the emulator builds of both variants (android-emulator-build), the E2E evidence run and the screenshot matrix (e2e-maestro), and the screens' parity sign-off (toybox-visual-parity).
- The owner's word in this session for the upload (nothing leaves the Mac without it).

## Run 1: build

`npm run release:android -- --app <game> [--notes "<what testers should check>"]`

| Step | What happens | Stops (exit 2, nothing changed) |
|---|---|---|
| 0 preflight | branch `main`, clean tree, no `shell-slice.json`, no owner step pending (G3, GP5 from `game.config.ts`), the upload key at `~/.android-keys/<game>-upload.jks` with mode 600; then `npm run verify` | any refusal of `preflightProblems` or `keystoreProblems` |
| 1 build number | `nextVersionCode`: one above `buildNumber` and every `<game>/v*+<n>` tag; `buildNumber` in `game.config.ts` raised and committed as `chore(<game>): build <n>` with `Release-Variant: store` | the config behind the tags (set it in its own commit first) |
| 2 prebuild | `npx expo prebuild --platform android --clean` with `APP_VARIANT=store`, `EXPO_PUBLIC_APP_VARIANT=store`, `ADS_MODE=live`, JDK 17 and the SDK (android-emulator-build's toolchain) | the toolchain preflight |
| 3 bundle | `android/gradlew -p android bundleRelease --console=plain`; Gradle signs it with the upload key from `~/.gradle/gradle.properties` | (exit 1, see `apps/<game>/build/logs/bundle.log`) |
| 4 hand-off | prints the AAB path, its sha256 and the gate command | |

The number is spent from step 1 on: a failed build never rolls it back.

## The gate

```sh
node ${CLAUDE_SKILL_DIR}/scripts/check-store-aab.mjs --aab apps/<game>/android/app/build/outputs/bundle/release/app-release.aab \
  --variant store --ads live --version <x.y.z> --build <n> --game <game> --stamp apps/<game>/build/release/aab-gate.json .
```

It must print `RESULT: PASS`. Only then does it write the stamp: `{ result: "PASS", sha256, versionCode, isUnsigned: false }`. A FAIL writes nothing; fix the cause (never the gate) and start a new run 1, which takes a new number.

## Run 2: upload

`npm run release:android -- --app <game> --resume upload [--notes "..."]`, with the owner's word in this session.

| Step | What happens | Stops |
|---|---|---|
| 5 stamp | `uploadProblems`: a stamp exists, says PASS, is not a rehearsal, has this AAB's sha256 and this versionCode | exit 2, nothing sent |
| 6 credentials | `loadServiceAccount`: the JSON key in `~/.android-keys/`, mode 600, read into memory once | exit 2 (owner step GP3) |
| 7 upload | `uploadToInternal`: token, `edits.insert`, `edits.bundles.upload`, `edits.tracks.update` (internal, completed, the notes), `edits.commit` | a `PlayStop`: exit 1, not retried |
| 8 tag | `git tag <game>/v<version>+<n>` locally | |

Tags are pushed only with the owner's word (git-commits-and-reporting rule 5).

## Running a step by hand

Every step is an ordinary command; run it from the repo root with the same environment:

```sh
export APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=live EXPO_NO_TELEMETRY=1 CI=1
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME=~/Library/Android/sdk
(cd apps/line-siege && npx expo prebuild --platform android --clean)
(cd apps/line-siege && android/gradlew -p android bundleRelease --console=plain)
"$JAVA_HOME/bin/keytool" -printcert -jarfile apps/line-siege/android/app/build/outputs/bundle/release/app-release.aab | head -5
```

The last line shows who signed the bundle: the owner's `CN=Applander Upload`, never `CN=Android Debug`.

## Rehearsal without the owner's key

Before GP2, GP3 and GP5 the whole build can still be proven, without the upload key and without any upload:

```sh
export APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=off EXPO_NO_TELEMETRY=1 CI=1
(cd apps/line-siege && npx expo prebuild --platform android --clean)
(cd apps/line-siege && android/gradlew -p android bundleRelease --console=plain)
node ${CLAUDE_SKILL_DIR}/scripts/check-store-aab.mjs --aab apps/line-siege/android/app/build/outputs/bundle/release/app-release.aab \
  --variant store --ads off --version 1.0.0 --build <n> --game line-siege --unsigned .
```

- Without the `E07_<GAME>_UPLOAD_*` properties the release falls back to the debug key; `--unsigned` SKIPs only the signing rule and prints `REHEARSAL: not a release gate` first. Every other rule stays strict, and it never writes a stamp.
- `--build` is the current `buildNumber` (a rehearsal commits nothing); the version-code rule still needs it above every upload tag.
- Before G3 the run ends with the two link `owner-placeholder` lines, `OWNER STEPS PENDING: G3` and `RESULT: FAIL`; GP5 shows in `check-release-setup-android.mjs` (a store/off bundle has no live ids to read). That is the expected rehearsal result; the hand-over is a slice report with the rehearsal under "Not tested or not verified" and the Play steps under "Owner steps (not blocking)".

## Build numbers, tags and resuming

- One sequence per game for iOS and Android: `buildNumber` is iOS's CFBundleVersion and Android's versionCode, and every upload is tagged `<game>/vX.Y.Z+<n>`, so a tag never repeats across platforms (decision b).
- A number is never reused or rolled back; Google refuses a used versionCode for good.
- `--resume upload` is the only resume point: after a gate PASS, or after a stop at step 6 or 7 once the owner fixed the cause. A stop during step 7 may have left an uncommitted edit on Google's side; a new run opens a new edit, and the stale one expires by itself.
- A rebuilt bundle gets a new number: a new run 1, never a second `--resume upload` on changed bytes (the stamp's sha256 refuses it).

## After the upload

- The release report (git-commits-and-reporting, release form): game, version, versionCode, the gate result, the track, the tag, and "Owner steps (not blocking)": the Android play-test with the purchase test, TalkBack, the fa and ckb review, the sound previews.
- Promotion to closed, open or production testing is the owner's, in the Play Console.
