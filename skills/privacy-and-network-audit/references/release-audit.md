# The release audit

## Contents

- Two halves
- What is checked, where
- The JS half: store bundle checks
- The binary half: the built app
- Commands in order
- Test builds
- The keyless rehearsal (no signing key, no upload)
- Checklist

## Two halves

A store build is released only when the release audit passes: no test-only module (sentinel `SHELL_TEST_BUILD_ONLY`), no Google sample publisher ID outside the AdMob library, a live `GADApplicationIdentifier` that is not the scaffold's placeholder, the game's own id `io.applander.<game id without hyphens>`, the App Tracking Transparency text in every language, no scaffold link placeholder, no `*.storekit`, no `*.xctest`, no `get-task-allow`, no StoreKit test code. A test build contains none of the game's real ad IDs.

- The JS half runs on the source-mapped store export (`npm run audit:network`, which calls `release-bundle-checks.ts`; and this skill's `audit-bundle.mjs`).
- The binary half runs on the exported IPA (`unzip` it, then this skill's `audit-app-bundle.mjs`; the iOS release work's store-artifact gate runs the same checks as shell commands).

## What is checked, where

| Check | Build | Half | How |
|---|---|---|---|
| Debug menu / deep links / network guard / StoreKit hooks absent | store | JS + binary | sentinel `SHELL_TEST_BUILD_ONLY` and `/screens/debug/` modules absent from the export; `main.jsbundle` in the IPA has no sentinel (Hermes bytecode keeps ASCII strings, verified) |
| Google sample ad IDs absent from our code | store | JS | `3940256099942544` only inside `node_modules/react-native-google-mobile-ads/` (its `src/TestIds.ts` and `src/types/RequestOptions.ts` are in every bundle) |
| Live AdMob app ID | store + live | binary | `GADApplicationIdentifier` matches `^ca-app-pub-\d{16}~\d{10}$`, is not the sample ID, and is not the scaffold's placeholder `ca-app-pub-1234567890123456~1234567890` (which fits the pattern: refused by name until owner step G5 gives the real id); `extra.adUnits` holds none of the placeholder units `ca-app-pub-1234567890123456/1111111111`, `/2222222222`, `/3333333333` |
| The game's own id | store (all with `--game`) | binary | `CFBundleIdentifier` is `io.applander.<game id without hyphens>` (owner decision O4), never `com.example.*` |
| No placeholder links | store | binary | `extra.game.links` holds neither the privacy host `example.com` nor `support@example.com` (owner step G3) |
| App Tracking Transparency text | all | binary | `NSUserTrackingUsageDescription` in `Info.plist` and in `en`, `de`, `fa` and `ckb.lproj/InfoPlist.strings` (owner decision O1; iOS kills an app that asks without it) |
| Real ad IDs absent | test | config + binary | `ads-config.test.ts` (sample app ID and no `adUnits` for test/off); `GADApplicationIdentifier` is the sample ID in test builds; `extra.adUnits` only in live builds |
| Variant embedded correctly | all | binary | `EXConstants.bundle/app.config` `extra.appVariant` and `extra.adsMode` equal the exported variables |
| StoreKit test artefacts absent | store | binary | no `*.storekit`, no `*.xctest`; `codesign -d --entitlements - --xml` has no `get-task-allow` |
| StoreKit test code absent | store | JS | no `StoreKitTest` / `SKTestSession` strings in shipped modules |
| No OTA / ATS exceptions / banned plugin options | store | config | layer E; `NSAllowsArbitraryLoads` absent or false in `Info.plist` |
| Privacy manifest complete | all | native | `npm run audit:privacy` / `audit-privacy-manifest.mjs`; `PrivacyInfo.xcprivacy` exists in the app |
| SKAdNetwork list current | store | config | `refresh-skadnetwork.ts --check` (ads work) |

Never grep the raw bundle for the sample publisher ID: the AdMob library's `TestIds` module is in every bundle, store builds included. That check lives in the source-mapped JS layer, which attributes each string to its module.

## The JS half: store bundle checks

```sh
APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=off \
  npx expo export --platform ios --no-bytecode --source-maps true --output-dir dist-audit/<game-id>
node ${CLAUDE_SKILL_DIR}/scripts/audit-bundle.mjs --export dist-audit/<game-id> .
```

`ADS_MODE=off` is a valid store pair and ships the same JS. `npm run audit:network` performs the same export for every app.

## The binary half: the built app

After the release archive and export (the iOS release work owns signing, archive and export):

```sh
rm -rf build/ipa-check && mkdir -p build/ipa-check && unzip -q "$IPA" -d build/ipa-check
APPDIR=$(ls -d build/ipa-check/Payload/*.app)
node ${CLAUDE_SKILL_DIR}/scripts/audit-app-bundle.mjs --app "$APPDIR" --variant store --ads-mode live --game <game-id>
```

`--entitlements auto` (the default) runs `codesign -d --entitlements - --xml` on the app; pass `--entitlements <file>` to use saved output instead. Binary `Info.plist` files are read through `plutil` (macOS).

The equivalent shell checks, as the store-artifact gate runs them:

```sh
plutil -extract GADApplicationIdentifier raw "$APPDIR/Info.plist"       # live: ^ca-app-pub-\d{16}~\d{10}$, not the sample, not ca-app-pub-1234567890123456~1234567890; off/test: the sample ID
plutil -extract CFBundleIdentifier raw "$APPDIR/Info.plist"             # io.applander.<game id without hyphens>, never com.example.*
plutil -extract NSUserTrackingUsageDescription raw "$APPDIR/Info.plist" # present; the same key in each <lang>.lproj/InfoPlist.strings
plutil -extract extra.appVariant raw "$APPDIR/EXConstants.bundle/app.config"   # == $APP_VARIANT
plutil -extract extra.adsMode raw "$APPDIR/EXConstants.bundle/app.config"      # == $ADS_MODE
grep -a -c 'SHELL_TEST_BUILD_ONLY' "$APPDIR/main.jsbundle"              # store: 0
find "$APPDIR" \( -name '*.storekit' -o -name '*.xctest' \) | wc -l     # store: 0
test -f "$APPDIR/PrivacyInfo.xcprivacy"
codesign -d --entitlements - --xml "$APPDIR" | plutil -p - | grep -c '"get-task-allow" => true'   # 0
plutil -extract NSAppTransportSecurity.NSAllowsArbitraryLoads raw "$APPDIR/Info.plist"   # absent or false
```

`grep -c` and `find | wc -l` print a count (`grep -c` exits 1 when the count is 0; do not treat that exit code as a failure).

Why the variables matter: the variant reaches the binary at three moments (prebuild writes `GADApplicationIdentifier`; an Xcode phase re-evaluates `app.config.ts` into `EXConstants.bundle/app.config`; Metro inlines `EXPO_PUBLIC_APP_VARIANT`). A shell that loses the variables between prebuild and `xcodebuild` silently mixes variants, and Metro does not key its cache on `EXPO_PUBLIC_*` values unless `metro.config.js` sets `cacheVersion` from the variant. The binary checks catch both.

## Test builds

Test builds run the variant, `extra` and `get-task-allow` checks only:

```sh
node ${CLAUDE_SKILL_DIR}/scripts/audit-app-bundle.mjs --app "$APPDIR" --variant test --ads-mode test
```

A test build must carry Google's sample app ID and no `extra.adUnits`. The test-only code (debug menu, network guard) is expected in test builds.

A Release simulator build made the standard way (`CODE_SIGNING_ALLOWED=NO`) is only linker-signed ad hoc and carries no entitlements at all, so `get-task-allow` passes there (verified 2026-09-29 on two Release-iphonesimulator builds from Xcode 26.6: `codesign -d --entitlements - --xml` prints nothing, and `audit-app-bundle.mjs --variant test` reports no `get-task-allow`). If it ever fires on a test build, the build was signed with a development profile: rebuild with the simulator build plan.

## The keyless rehearsal (no signing key, no upload)

Before the owner's key exists (owner step O3), the store build can still be rehearsed end to end on an archive built with `CODE_SIGNING_ALLOWED=NO` (ios-release-testflight's release pipeline reference, "Rehearsal without the owner's key", has the commands). Such an app has no signature at all (`codesign -d` answers "code object is not signed at all", verified on the Line Siege archive from Xcode 26.6), so the audit runs with `--unsigned`:

```sh
node ${CLAUDE_SKILL_DIR}/scripts/audit-app-bundle.mjs --app apps/<game>/build/<Scheme>.xcarchive/Products/Applications/<Scheme>.app --variant store --ads-mode off --game <game-id> --unsigned
```

It prints `REHEARSAL: not a release gate` first, reports only `get-task-allow` as a `SKIP` line when the app has no signature (a signed app with `get-task-allow` still fails), and keeps every other rule strict. Without `--unsigned` the same app fails `get-task-allow` ("the app is not signed"). A rehearsal is never release evidence: the release audit runs on the signed export, and git-commits-and-reporting's report check refuses a `REHEARSAL` result.

## Checklist

- [ ] `npm run lint` is clean with the N3 rules, and `audit-repo.mjs` passes.
- [ ] `npm run audit:network` passes for every app: no first-party hits, no NEW JS or native finding without a reasoned baseline entry, trunk pods exactly `Google-Mobile-Ads-SDK`, `GoogleUserMessagingPlatform`, `openiap`, no config problem, no banned package.
- [ ] `npm run audit:privacy` passes after the latest prebuild; the App Privacy answers match its "collected" output (Device ID used for tracking by the third-party ads SDK; the app asks App Tracking Transparency first).
- [ ] `npm run audit:licenses` passes.
- [ ] The E2E smoke flow shows "network attempts: 0" and the socket sampler found no non-loopback connection (Release, test variant, `ADS_MODE=off`).
- [ ] Store build: `audit-bundle.mjs` and `audit-app-bundle.mjs --game <game-id>` pass (the tracking text in every language, `io.applander.<game>`, no placeholder AdMob id, unit or link).
- [ ] Test build: none of the game's real ad IDs present.
- [ ] No key material or tokens in the repo, logs or reports; the `.p8` is still mode 600.
- [ ] Every baseline or allowlist change carries a `Gate-Change:` trailer and the owner's approval.
