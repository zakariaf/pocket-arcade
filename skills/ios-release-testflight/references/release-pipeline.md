# The release pipeline, step by step

`npm run release:ios -- --app <game> --variant test|store` runs these steps in order. Every step logs to `apps/<game>/build/logs/<step>.log`; any non-zero exit stops the run and the failure playbook decides what happens next. Read this before a release, and when a step fails and you need to run it by hand.

## Contents

- Two kinds of release
- Step 0: environment
- Step 1: preflight
- Step 2: build number
- Step 3: prebuild and native audits
- Step 4: archive
- Step 5: export (and the ExportOptions files)
- Step 6: unpack for the gate
- Step 7: the store-artifact gate
- Step 8: validate
- Step 9: upload
- Step 10: wait for processing
- Step 11: What to Test
- Step 12: tag and report
- Resuming a stopped run
- Versions, build numbers and tags
- After "ship"

## Two kinds of release

| Variant | Ads | Export options | Can reach |
|---|---|---|---|
| `test` | `test` or `off` | `export-options-test.plist` (`testFlightInternalTestingOnly: true`) | internal TestFlight testers only; "cannot be distributed via external TestFlight or the App Store" (`xcodebuild -help`) |
| `store` | `live` or `off` | `export-options-store.plist` | TestFlight (internal and external) and the App Store |

Both use the same bundle ID and app record, and share one build-number sequence.

## Step 0: environment

```sh
export DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer   # resolved from XCODE_VERSION
export EXPO_NO_TELEMETRY=1 CI=1
export APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=live      # test: test/test/test
KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"   # path only; never read it
AUTH=(-allowProvisioningUpdates -authenticationKeyPath "$KEY_PATH" \
      -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
ALTOOL_AUTH=(--api-key "$ASC_KEY_ID" --api-issuer "$ASC_ISSUER_ID")   # altool finds AuthKey_<id>.p8 itself
```

`release-ios.ts` builds this environment once (`selectXcode()` plus the three variant variables) and passes it to every step, so the variant reaches prebuild, the Constants phase and Metro identically.

## Step 1: preflight

Stop on the first failure, before anything is built, committed or uploaded:

- The working tree is clean and on `main`, and the Shell is complete: no `shell-slice.json` at the repo root (a partial Shell never ships; `check-release-setup.mjs .` rule `shell-complete` also fails a route on `NotBuiltScreen`). `npm run verify` is green. For store builds, `npm run e2e:ios` and the screenshot matrix are green on a test-variant simulator build of **this** commit (the workflow does this before the release; the script does not repeat it).
- `ASC_KEY_ID`, `ASC_ISSUER_ID` and `APPLE_TEAM_ID` are set; the key file exists with mode `-rw-------` (checked with `stat`, never read).
- The login keychain is unlocked: `security show-keychain-info ~/Library/Keychains/login.keychain-db` exits 0.
- `xcodebuild -version` prints Xcode 26.6 (from `selectXcode()`).
- The app record exists: `node packages/tooling/src/asc/print-app-record.ts <bundleId>` prints `{"id","name"}`; exit 2 means no record, which is owner step G2. The numeric `id` is the Apple ID (`APPLE_APP_ID`) for the upload.
- Store only: the `version` in `game.config.ts` is higher than the last release tag `<slug>/vX.Y.Z` (build tags contain `+` and do not count), and the fa/ckb review gate passes (`node packages/tooling/src/i18n/review-sheet.ts --release`).

The review gate is written with the first store release if the repo does not have it yet (the `i18n-strings-and-catalogs` skill owns the catalogs). Its contract: `packages/shell/src/i18n/review-state.json` stores, per language (`fa`, `ckb`) and message key, the SHA-256 of the text a native speaker reviewed and the review date. `review-sheet.ts` writes `reports/i18n/review-<lang>.csv` (key, English text, current text, the screenshot that shows it) for every fa/ckb message whose text differs from its reviewed hash; with `--release` it exits 1 when there is any such message. If the owner decides to ship without a review, record `"reviewer": "waived-by-owner"` for those keys in the same file and commit with a `Gate-Change:` trailer.

## Step 2: build number

```sh
node packages/tooling/src/release/bump-build-number.ts --app line-siege    # bumpBuildNumber(): +1, writes the file
git commit -am "chore(line-siege): build 8" -m "Release-Variant: store"
```

`release-ios.ts` does this itself (`bumpAndCommit`). The build number is committed before the archive so the archive and the history agree. With `--resume build|processing` it bumps nothing and reuses the committed number instead (see "Resuming a stopped run").

## Step 3: prebuild and native audits

```sh
cd apps/line-siege && npx expo prebuild --platform ios --clean
npm run audit:privacy -- --app line-siege    # reads ios/Pods: every required-reason API declared
npm run audit:network                        # all layers; the JS layer exports the bundle under the same APP_VARIANT
```

The network audit fails a store build if Google's sample publisher ID `3940256099942544` appears in any module outside `node_modules/` (the AdMob library's own `TestIds` module is in every bundle, so the binary gate below cannot grep for it).

## Step 4: archive

```sh
xcodebuild -workspace "$WS" -scheme "$SCHEME" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "build/$SCHEME.xcarchive" \
  -derivedDataPath build/dd-device "${AUTH[@]}" archive
```

Check: `plutil -p "build/$SCHEME.xcarchive/Info.plist"` shows `CFBundleVersion` equal to the new build number. The same command with `CODE_SIGNING_ALLOWED=NO` instead of the auth flags produced a valid unsigned archive in 66 s (verified).

## Step 5: export (and the ExportOptions files)

```sh
xcodebuild -exportArchive -archivePath "build/$SCHEME.xcarchive" \
  -exportOptionsPlist "../../packages/tooling/config/export-options-$APP_VARIANT.plist" \
  -exportPath build/export "${AUTH[@]}"
IPA=$(ls build/export/*.ipa)
```

The two files (`templates/packages/tooling/config/`) differ only in `testFlightInternalTestingOnly`. Why each key (from `xcodebuild -help`, Xcode 26.6; both pass `plutil -lint`):

| Key | Value | Why |
|---|---|---|
| `method` | `app-store-connect` | `app-store` is deprecated |
| `destination` | `export` | keeps altool in charge of uploading |
| `signingStyle` | `automatic` | API-key signing with a cloud-managed certificate |
| `manageAppVersionAndBuildNumber` | `false` | defaults to YES, which would let Xcode rewrite our numbers |
| `uploadSymbols` | `true` | dSYMs go to Apple, so crash reports users choose to share appear in App Store Connect (an OS feature, not a crash SDK) |
| `stripSwiftSymbols` | `true` | smaller binary |
| `testFlightInternalTestingOnly` | `true` (test) / `false` (store) | test builds can never reach external testers or the App Store |
| `teamID` | omitted | "defaults to the team used to build the archive" (`DEVELOPMENT_TEAM`) |

## Step 6: unpack for the gate

```sh
rm -rf build/ipa-check && mkdir -p build/ipa-check && unzip -q "$IPA" -d build/ipa-check
APPDIR=$(ls -d build/ipa-check/Payload/*.app)
```

## Step 7: the store-artifact gate

All checks run for store builds; test builds run the version, build number, `extra`, AdMob app ID, `get-task-allow` and placeholder checks only. The placeholder check fails both variants when `main.jsbundle` contains `not-built.screen`, the testID of the partial Shell's `NotBuiltScreen`: testers never get a placeholder either. `release-ios.ts` runs them through `store-gate.ts`; `check-store-artifact.mjs` (this skill) checks the same `.ipa` independently. By hand:

```sh
plutil -extract CFBundleVersion raw "$APPDIR/Info.plist"                # == new buildNumber
plutil -extract CFBundleShortVersionString raw "$APPDIR/Info.plist"     # == version
plutil -extract ITSAppUsesNonExemptEncryption raw "$APPDIR/Info.plist"  # false
plutil -extract GADApplicationIdentifier raw "$APPDIR/Info.plist"       # live: ^ca-app-pub-\d{16}~\d{10}$ and not the sample ID; off/test: the sample ID
plutil -extract extra.appVariant raw "$APPDIR/EXConstants.bundle/app.config"   # == $APP_VARIANT (plutil reads this JSON file)
plutil -extract extra.adsMode raw "$APPDIR/EXConstants.bundle/app.config"      # == $ADS_MODE
grep -a -c 'SHELL_TEST_BUILD_ONLY' "$APPDIR/main.jsbundle"              # store: 0 (Hermes bytecode keeps ASCII strings)
grep -a -c 'not-built.screen' "$APPDIR/main.jsbundle"                   # every variant: 0 (no NotBuiltScreen route)
find "$APPDIR" \( -name '*.storekit' -o -name '*.xctest' \) | wc -l     # store: 0
test -f "$APPDIR/PrivacyInfo.xcprivacy"
codesign -d --entitlements - --xml "$APPDIR" | plutil -p - | grep -c '"get-task-allow" => true'   # 0
plutil -extract NSAppTransportSecurity.NSAllowsArbitraryLoads raw "$APPDIR/Info.plist"   # must fail (absent) or print false
```

`grep -c` and `find | wc -l` print a count: compare the number (`grep -c` exits 1 when the count is 0; that exit code is not a failure). This gate is the only check that proves the debug menu, the StoreKit test harness and test ads are absent from what players receive, so it runs before `--validate-app`.

## Step 8: validate

```sh
xcrun altool --validate-app "$IPA" -t ios "${ALTOOL_AUTH[@]}" --output-format json
```

The man page also lists `--apple-id`, `--bundle-id`, `--bundle-version` and `--bundle-short-version-string` for `--validate-app`; if validation asks for the app, pass the same four flags as step 9.

## Step 9: upload

```sh
xcrun altool --upload-package "$IPA" -t ios --apple-id "$APPLE_APP_ID" --bundle-id "$BUNDLE_ID" \
  --bundle-version "$BUILD_NUMBER" --bundle-short-version-string "$VERSION" \
  "${ALTOOL_AUTH[@]}" --wait --output-format json > build/logs/upload.json
```

`--wait` "waits until the upload process is complete (status is PROCESSING)" (`man altool`): the build is not usable yet. The JSON holds a delivery UUID; its field name is not yet recorded, so `findDeliveryId()` searches for it. Record the real field name after the first real upload.

## Step 10: wait for processing

An upload is done only when processing reaches `VALID`. `release-ios.ts` polls the REST endpoint every 60 s for up to 60 minutes and reads `attributes.processingState`:

```text
GET /v1/builds?filter[app]=<APPLE_APP_ID>&filter[version]=<BUILD_NUMBER>&filter[preReleaseVersion.version]=<VERSION>
```

altool also offers `xcrun altool --build-status --delivery-id "$DELIVERY_ID" "${ALTOOL_AUTH[@]}" --wait --output-format json`; whether its `--wait` waits until `VALID` is unverified, which is why REST is the default. On `INVALID` or `FAILED`: stop and ask the owner for Apple's email (the agent cannot read email). If 60 minutes pass without `VALID`, the run ends; after checking the TestFlight tab, rerun with `--resume processing` (the upload is done, so nothing is uploaded again).

## Step 11: What to Test

`whatToTest()` builds the text; `setWhatsNew()` sends it through REST: `GET /v1/builds/{id}/betaBuildLocalizations`, then `PATCH /v1/betaBuildLocalizations/{id}` with `{"data":{"type":"betaBuildLocalizations","id":"...","attributes":{"whatsNew":"..."}}}`, or `POST /v1/betaBuildLocalizations` with `locale: "en-US"` and the `build` relationship when none exists. `whatsNew` holds up to 4000 characters.

altool's own route (`--beta-app-store-text <folder> --download`, edit the `en-US` file's `"whatsNew" = "...";` line, `--upload`) is documented by the README altool writes into the downloaded folder and by `ContentDelivery.framework/Resources/AppStoreText-README.md`; its exact folder layout for a build was not verified, so REST is used until the first real release records it.

The text (English, for testers only, not an in-app string):

```text
Line Siege 1.0.0 (8) · store build
What changed
- <feat/fix commit subjects since line-siege/v1.0.0+7>
Please check
- <focus items passed with --notes>
- Buy Premium, cancel a purchase, delete the app, reinstall, then Restore.   (first build, or purchase code changed)
- Switch the language to فارسی and کوردیی ناوەندی once: layout mirrored, nothing cut off.
Known issues
- <from --known-issue, or "none">
```

## Step 12: tag and report

```sh
git tag "line-siege/v1.0.0+8"          # buildTag(): after a successful upload that reached VALID
```

Report to the owner in one message: game, version (build), variant, "available in TestFlight", and the What-to-Test text. For a store build the owner answers "ship" or "don't ship" (owner step R1). Push tags only when the owner has said so in this session.

## Resuming a stopped run

Every failure message ends with a `Resume:` line that says which of these to use. The rule behind it: a build number is spent once an upload was attempted, and a code fix is a new commit, which always gets a new number.

| Where it stopped | Rerun with | What happens |
|---|---|---|
| Preflight (`verify`, `expo-config`, `i18n-review`, key, keychain, app record) | the same command | nothing was bumped yet |
| After the bump, before the upload (`prebuild`, audits, `archive`, `export`, the gate, `validate`), and the owner fixed it (keychain, agreement, licence) | the same command plus `--resume build` | reuses the committed build number and starts again at the prebuild |
| The cause was in the code (a gate failure, a lint or audit finding) | the same command, after committing the fix | the fix commit means a new build number; `--resume` refuses because HEAD is no longer the bump commit |
| `upload` failed and the TestFlight tab does not list the build | the same command | a new build number |
| The build is uploaded (processing timeout, a What to Test or tag failure) | the same command plus `--resume processing` | waits for `VALID`, sets What to Test, tags; builds and uploads nothing |

`--resume` checks before it reuses anything: HEAD must still be `chore(<slug>): build <n>` for the number in `game.config.ts`, and no `<slug>/v*+<n>` tag may exist. Otherwise it stops with "cannot resume" and a plain run is right (gaps in build numbers are harmless; Apple rejects only duplicates).

## Versions, build numbers and tags

| Field | Where | Format | Who changes it |
|---|---|---|---|
| `version` -> `CFBundleShortVersionString` | `game.config.ts` only | `MAJOR.MINOR.PATCH` | the agent, per release: PATCH = fixes, MINOR = features or new levels, MAJOR = save-format or large changes |
| `buildNumber` -> `CFBundleVersion` (and Android `versionCode`) | `game.config.ts` only, one `buildNumber: <int>,` line | integer, 1 or more | only `release:ios`: +1 before every archive, committed as `chore(<slug>): build <n>` |

- A build number is never reused, and test and store builds share one sequence (App Store Connect rejects a duplicate with ITMS-90189).
- A failed or abandoned upload still consumes its build number; never roll the counter back.
- A version that App Store review approved is frozen; the next store submission needs a higher version (ITMS-90062).
- Simulator builds never bump the number.
- Build tag `<slug>/v<version>+<build>` after each upload; release tag `<slug>/v<version>` when the owner says "ship". Both pass `git check-ref-format` (verified).

## After "ship"

1. `git tag line-siege/v1.0.0` (`releaseTag()`), pushed only with the owner's word.
2. The owner completes the per-release human steps (store listing, submit for review) or tells the agent "submit"; the agent never submits without that message.
3. Submitting through the API (only after "submit"; not yet run with the real key): the App Store version must already exist with this build selected and its listing complete (G8, and on a game's first release the Premium in-app purchase attached). Then `POST /v1/reviewSubmissions` with `{"data":{"type":"reviewSubmissions","attributes":{"platform":"IOS"},"relationships":{"app":{"data":{"type":"apps","id":"<APPLE_APP_ID>"}}}}}`, `POST /v1/reviewSubmissionItems` relating that submission to the `appStoreVersions` id, and `PATCH /v1/reviewSubmissions/{id}` with `"attributes":{"submitted":true}`. On any error answer, stop and ask the owner to click Submit for Review in App Store Connect instead (R5).
