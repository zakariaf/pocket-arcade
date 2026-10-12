# Failure playbook

Symptom, cause and action for every failure of an Android release seen or expected. A **stop** goes to the owner as one message (the step, the exact error line, the one action) and is never retried: retrying can lock an account, burn a version code or upload twice. Rows not seen on this Mac yet say so; they come from Google's and Gradle's documentation and wait for the first real release (Android step 8) to be confirmed.

## Contents

- Preflight and setup
- Build and signing
- The store-AAB gate
- Upload
- After the upload

## Preflight and setup

| Symptom | Cause | Action |
|---|---|---|
| `releases come from main, this is ...` | run on an epic branch | merge first; releases start from a clean `main` |
| `the working tree is not clean` | uncommitted work | commit or stash it; the release commits the build number |
| `npm run verify is not green on this commit` | a red gate | fix the gate's cause first |
| `owner steps pending: G3, GP5 ...` | `game.config.ts` still has the scaffold links or no Android AdMob ids | stop: ask for G3 / GP5; meanwhile the keyless rehearsal |
| `no upload key at ~/.android-keys/<game>-upload.jks (owner step GP2 ...)` | the key does not exist yet | ask for GP2's go, then generate it (signing-and-keys) |
| `... has mode 644, expected 600` | the key or JSON is readable by others | `chmod 600` it; never open it |
| `buildNumber ... is behind the tags` | a tag carries a higher number than `game.config.ts` | raise `buildNumber` to the highest tag in its own commit, then rerun |

## Build and signing

| Symptom | Cause | Action |
|---|---|---|
| `keytool -printcert` shows `CN=Android Debug` | the `E07_<GAME>_UPLOAD_*` properties are missing from `~/.gradle/gradle.properties`, or `with-upload-signing.ts` is not in `withShell` | add the plugin (architecture-and-boundaries); ask the owner to check the properties file exists (never open it yourself) |
| `app/build.gradle has no release signingConfig line` at prebuild | React Native changed its template | update `addUploadSigning` and its test to the new template, test-first |
| `Keystore was tampered with, or password was incorrect` (not seen here yet) | a wrong password in `gradle.properties` | stop: the owner checks the four properties |
| `Execution failed for task ':app:signReleaseBundle'` (not seen here yet) | the store file path is wrong | stop: the owner checks `E07_<GAME>_UPLOAD_STORE_FILE` |
| Gradle, NDK or JDK errors | the toolchain | android-emulator-build's failures reference |

## The store-AAB gate

| Rule | Cause | Action |
|---|---|---|
| `signing` | unsigned or debug-signed | see "Build and signing"; never `--unsigned` for a release |
| `version-code` | not the committed number, or not above a tag | a new run 1 takes a new number |
| `test-code` | the store bundle has `SHELL_TEST_BUILD_ONLY` | the variant was lost or Metro reused a test transform: rebuild from a clean prebuild with the variables exported once |
| `ad-app-id` | Google's sample id in a live build | `ads-config.ts` must give a live build no sample id (admob-ads); supply GP5 |
| `owner-placeholder` | G3 or GP5 values missing | stop: ask the owner; the rehearsal meanwhile |
| `permission` | a permission outside the allowlist | block it in `withShell` or remove the module; a new permission changes the Data safety answers (GP4) |
| `target-sdk` | below 36 | the Expo SDK and React Native levels; never lower them |
| `shell-slice` | a partial Shell | finish the Shell first |

## Upload

| Stop reason | Cause | Action |
|---|---|---|
| `api-not-enabled` | the Android Publisher API is off in the service account's project | stop: the owner enables it (GP3) |
| `auth` (401/403) | the service account is not invited for this app, lacks "Release apps to testing tracks", or its key was deleted | stop: the owner fixes the permission or makes a new key (GP3) |
| `app-not-found` (404) | no app in the Console, or the first upload is not done | stop: GP1, then the owner's first upload (GP7) |
| `version-code-used` | the number was used by an earlier upload | a new run 1 (never lower `buildNumber`) |
| `policy-declarations` | App content incomplete | stop: the owner completes GP4 |
| `no store-AAB gate stamp` / `sha256 differs` | the gate did not pass on these bytes | run the gate on this AAB; a changed AAB needs a new run 1 |
| network error, timeout | the Mac is offline or Google is slow | ask before one retry; a half-done edit expires by itself |

## After the upload

| Symptom | Cause | Action |
|---|---|---|
| testers do not see the build | they are not on the internal testers list, or have not opted in through the link | the owner adds them (GP7) and shares the opt-in link |
| Premium shows "store unavailable" on a tester's phone | GP6 not active yet, the app was not installed from Play, or the account is not a license tester | the owner activates GP6 and adds license testers (GP7) |
| ads never fill | a new AdMob app needs review, or ads.txt | admob-ads; nothing in the build changes |
