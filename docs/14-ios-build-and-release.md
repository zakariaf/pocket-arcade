# 14 · iOS build and release

> **What this doc decides.** How Claude Code turns `apps/<game>` into a Release simulator build and a TestFlight/App Store upload on this Mac, using only Apple's command-line tools. There is no Xcode GUI, EAS or fastlane. It fixes the build variants (`APP_VARIANT`, `ADS_MODE`), the version and build-number policy, and signing with the team App Store Connect API key. It gives the exact prebuild, `xcodebuild` and `altool` commands, the ExportOptions files, the small JWT script for App Store Connect REST, and the honest list of human steps. It ends with a failure playbook, the release checklist, and what "Android later" needs.
> **Binding source:** [99-final-decisions.md](99-final-decisions.md) A.9, A.10, C.23–C.26, E and F. Problems found while writing are under [Open issues](#open-issues).
> **Related docs:** [01-stack-and-versions.md](01-stack-and-versions.md) (toolchain versions), [02-architecture-and-folders.md](02-architecture-and-folders.md) (withShell and the app files), [04-code-style-and-limits.md](04-code-style-and-limits.md) (app-env.d.ts and lint exemptions), [10-i18n-and-rtl.md](10-i18n-and-rtl.md) (the fa/ckb review gate), [11-ads-admob.md](11-ads-admob.md) (ad IDs per variant), [12-in-app-purchase.md](12-in-app-purchase.md) (Premium product), [13-privacy-network-security.md](13-privacy-network-security.md) (release audit), [16-quality-gates-hooks-ci.md](16-quality-gates-hooks-ci.md) (verify before release). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

---

## 1. Introduction

There are two kinds of build:

| Build | Command | Signing | Used for |
|---|---|---|---|
| **Simulator build** (Release configuration, `iphonesimulator`) | `npm run build:ios:sim -- --app <game> [--variant test\|store]` | none (`CODE_SIGNING_ALLOWED=NO`) | smoke runs, `npm run e2e:ios`, `npm run screenshots:ios`, runtime network audit |
| **Device archive** (Release, `generic/platform=iOS`) | `npm run release:ios -- --app <game> --variant test\|store` | automatic, with the team API key | TestFlight (test builds: internal only) and App Store (store builds) |

Both start with a clean `npx expo prebuild --platform ios --clean`, because `ios/` is generated and gitignored (Continuous Native Generation). Both run without Metro: Release builds embed the Hermes bytecode bundle.

The CLI entry files are `packages/tooling/src/build/build-ios-sim.ts` and `packages/tooling/src/release/release-ios.ts` (the paths docs/16 wires to the npm scripts). They run on Node 26 with native type stripping. This doc specifies the exact commands those scripts must run, in order, and the pure helper modules they use. The commands were run by hand on 2026-09-26 (see [Verified](#verified)).

---

## 2. Rules

1. **Build only through `npm run build:ios:sim` and `npm run release:ios`. Never click through Xcode, and never edit `ios/`.** Every build starts with `npx expo prebuild --platform ios --clean`.
   *Why:* CNG regenerates `ios/` and silently discards hand edits. **Source:** [Expo CNG](https://docs.expo.dev/workflow/continuous-native-generation/).
2. **Select Xcode by version through `DEVELOPER_DIR`. Never run `sudo xcode-select`.** The preflight asserts that `xcodebuild -version` starts with `Xcode 26.6`.
   *Why:* this Mac has Xcode 27.0 at `/Applications/Xcode.app` next to Xcode 26.6. Building SDK 57 with Xcode 27 needs scene support first (doc 01, section 3.5).
3. **Set `APP_VARIANT`, `EXPO_PUBLIC_APP_VARIANT` (same value) and `ADS_MODE` explicitly for every build.** `app.config.ts` throws on an unknown value, a mismatch, or a forbidden pair.
   *Why:* the variant decides the debug menu, the ad IDs and the TestFlight scope (FINAL A.9, C.23).
4. **Every app's `metro.config.js` keys Metro's cache on `EXPO_PUBLIC_APP_VARIANT` (`config.cacheVersion`).**
   *Why:* verified on 2026-09-26. Without it, a store build made right after a test build reused the cached transforms: the store bundle kept `variant=test` and the debug module. **Source:** [Metro `cacheVersion`](https://metrobundler.dev/docs/configuration/#cacheversion).
5. **Test-only code (debug menu, test harness hooks, network guard, debug deep links) is reachable only through `packages/shell/src/app/test-only.ts`.** Its gate is the literal expression `process.env.EXPO_PUBLIC_APP_VARIANT === 'store'`.
   *Why:* verified. An imported `IS_TEST_BUILD` constant does **not** remove test-only modules from the store bundle. The literal comparison does.
6. **Test builds** use `APP_VARIANT=test`, `ADS_MODE=test|off` and `export-options-test.plist` (`testFlightInternalTestingOnly: true`). **Store builds** use `APP_VARIANT=store`, `ADS_MODE=live|off` and `export-options-store.plist`. Both use the same bundle ID and app record.
   *Why:* an internal-only build "cannot be distributed via external TestFlight or the App Store" (`xcodebuild -help`). A second bundle ID would need a second app record, which is a human step.
7. **`version` (SemVer) and `buildNumber` (integer) live only in `apps/<game>/game.config.ts`. `release:ios` adds 1 to `buildNumber` and commits before every archive. A build number is never reused, and test and store builds share one sequence.** Android's `versionCode` equals `buildNumber`.
   *Why:* App Store Connect rejects a duplicate build number (ITMS-90189), and Play requires `versionCode` to increase. **Source:** [CFBundleVersion](https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleversion).
8. **Sign only with the team API key:** `-allowProvisioningUpdates -authenticationKeyPath/-authenticationKeyID/-authenticationKeyIssuerID`, automatic signing, and cloud-managed distribution. Never export or import `.p12` files and never create profiles by hand.
   *Why:* no private distribution key ever touches the repo or the agent. **Source:** `xcodebuild -help` (Xcode 26.6), [cloud-managed certificates](https://developer.apple.com/help/account/certificates/cloud-managed-certificates/).
9. **Never open, print, copy, move, commit or log the `.p8` key.** Tools receive only `ASC_KEY_ID`, `ASC_ISSUER_ID` and `APPLE_TEAM_ID`. The key path is derived as `~/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8`. altool finds the key there by itself, and only `asc-credentials.ts` reads it, into memory.
   *Why:* FINAL A.10.
10. **Use `xcrun altool` for validate, upload, build status and TestFlight text. Use the App Store Connect REST script only for what altool lacks** (section 3.10).
    *Why:* FINAL A.9. altool ships with Xcode and speaks JSON (`--output-format json`).
11. **The store-artifact gate (section 3.8, step 7) must pass on the exported `.ipa` before `--validate-app`.**
    *Why:* this is the only check that proves the debug menu, the StoreKit test harness and test ads are absent from what users receive.
12. **Stop and ask the owner, and do not retry, on:** `errSecInternalComponent`, any agreement error, a missing app record, HTTP 401/403 from Apple, or a processing state `INVALID`. Never switch signing methods to "get around" an error.
    *Why:* each of these needs a human or a credential change, and retry loops can lock the account or burn build numbers.
13. **Tag every uploaded build `<slug>/v<version>+<build>` and the build sent for review `<slug>/v<version>`** (for example `line-siege/v1.0.0+8` and `line-siege/v1.0.0`).
    *Why:* FINAL A.8 (tags per app). Both forms pass `git check-ref-format`.
14. **Simulators are created by name (`e07-<purpose>`) and targeted by UDID. Shut down or delete only simulators the script created.**
    *Why:* other agents may use other simulators on the same Mac.
15. **Export `EXPO_NO_TELEMETRY=1` and `CI=1` in every tooling run.**
    *Why:* no Expo CLI telemetry, and no interactive prompts.
16. **An upload is done only when processing reaches `VALID`.** `altool --upload-package --wait` returns once the build is *processing*, so poll `--build-status` (or REST `processingState`) as well.
    *Why:* the `altool` man page says `--wait` "waits until the upload process is complete (status is PROCESSING)".

---

## 3. Details

### 3.1 Environment setup from zero

What is marked **(human)** needs the owner, because it needs a password, sudo or an Apple login. Everything else the agent does.

1. **Mac.** Apple silicon, macOS Tahoe 26.2 or later (Xcode 26.6's minimum; verified on macOS 27.0). Keep at least 60 GB free: Xcode is about 15 GB, the iOS runtime about 8 GB, and each app's DerivedData plus Pods takes several GB.
2. **Xcode 26.6 (human for the install and licence).** Install it from the Mac App Store or <https://developer.apple.com/download/all/>. When several Xcodes coexist, keep the version in the file name: `/Applications/Xcode-26.6.0.app`. Then:
   ```sh
   # human (admin password). Call this Xcode's own xcodebuild: sudo drops DEVELOPER_DIR, and on a
   # fresh Mac xcode-select does not point at a renamed Xcode.
   sudo /Applications/Xcode-26.6.0.app/Contents/Developer/usr/bin/xcodebuild -license accept
   sudo /Applications/Xcode-26.6.0.app/Contents/Developer/usr/bin/xcodebuild -runFirstLaunch
   DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer xcodebuild -downloadPlatform iOS
   DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer xcrun simctl list runtimes   # expect iOS 26.5
   ```
3. **mise, Node and Ruby.** Install mise with `curl https://mise.run | sh` (see <https://mise.jdx.dev/>). The repo root holds:
   ```toml
   # .mise.toml
   [tools]
   node = "26.4.0"
   ruby = "3.2.2"
   ```
   and `.nvmrc` containing `26.4.0`. Then run `mise trust && mise install` at the repo root. Node 26.4.0 ships npm 11.17.0.
4. **CocoaPods.** `gem install cocoapods -v 1.17.0` under the mise Ruby (1.15.2 also verified). Watchman is not needed.
5. **Java 17** (Maestro, later Gradle). On this Mac: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"` (17.0.11). On a Mac without Android Studio, add `java = "temurin-17"` to `.mise.toml` (mise lists `temurin-17.0.17+10`; not yet installed or verified end to end) and point `JAVA_HOME` at it. docs/07 section 3.11 owns the Maestro install (zip plus SHA-256 into `tools/maestro`).
6. **Dependencies.** `npm ci` at the repo root (policy in doc 01).
7. **App Store Connect key (human, once).** A **team** API key with the **Admin** role, saved as `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8` with `chmod 600`. The owner adds the IDs to `~/.zshenv` (not the repo):
   ```sh
   export ASC_KEY_ID=<Key ID>          # e.g. 2X9R4HXF34
   export ASC_ISSUER_ID=<Issuer ID>    # UUID from Users and Access > Integrations
   export APPLE_TEAM_ID=<Team ID>      # 10 characters; read by withShell -> ios.appleTeamId
   ```
   State of this Mac on 2026-09-26: one `AuthKey_*.p8` file exists in that folder with mode `-rw-------`. The name suggests a team key (altool's man page says individual keys are named `ApiKey_<id>.p8`), but only App Store Connect → Users and Access → Integrations shows the key type and role; the owner confirms it (O3). `APPLE_TEAM_ID` is set. `ASC_KEY_ID` and `ASC_ISSUER_ID` are **not** set in the agent's environment.
8. **Claude Code guard (defence in depth).** `.claude/settings.json` (owned by docs/16 section 6) denies `Read(~/.appstoreconnect/**)`, `Read(**/*.p8)`, `Read(**/AuthKey_*)` and the signing files. This does not stop a shell `cat`, so rule 9 remains the real guard.
9. **`.gitignore`** (monorepo root; docs/16 section 4 has the complete file) must contain at least `apps/*/ios/`, `apps/*/android/`, `apps/*/build/`, `*.p8`, `AuthKey_*`, `ApiKey_*`, `*.p12`, `*.mobileprovision`, `*.xcarchive`, `*.ipa`, `reports/` and `tools/`.

### 3.2 Selecting Xcode

`packages/tooling/src/ios/toolchain.ts` holds `XCODE_VERSION = '26.6'`. The scripts find the Xcode whose `Contents/Info.plist` `CFBundleShortVersionString` equals it (`/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" <app>/Contents/Info.plist`), then export `DEVELOPER_DIR=<app>/Contents/Developer` for every child process and assert:

```sh
xcodebuild -version | head -1        # must print: Xcode 26.6
xcrun altool --version               # 26.40.1 (174001) with Xcode 26.6
```

On this Mac: `/Applications/Xcode-26.6.0.app` is 26.6 (selected) and `/Applications/Xcode.app` is 27.0 (27A266a, licence not accepted). Switching to Xcode 27 is a deliberate commit: change `XCODE_VERSION`, add `ios.enableSceneSupport` while still on SDK 57 (doc 01), rerun the full suite, and have the owner accept the Xcode 27 licence.

### 3.3 Prebuild

```sh
export DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer EXPO_NO_TELEMETRY=1 CI=1
export APP_VARIANT=test EXPO_PUBLIC_APP_VARIANT=test ADS_MODE=test
cd apps/line-siege
npx expo prebuild --platform ios --clean          # regenerates ios/ and runs pod install
WS=$(ls -d ios/*.xcworkspace | head -1)           # "Line Siege" -> ios/LineSiege.xcworkspace
SCHEME=$(basename "$WS" .xcworkspace)             # LineSiege
```

- The workspace and scheme names come from `expo.name` with spaces removed, not from `package.json`. Always discover them this way.
- What prebuild writes from the config (verified): `ios.buildNumber` → `CFBundleVersion`, `version` → `CFBundleShortVersionString`, `ios.config.usesNonExemptEncryption: false` → `ITSAppUsesNonExemptEncryption = false` (so no export-compliance question per build), `ios.appleTeamId` → `DEVELOPMENT_TEAM`, `ios.deploymentTarget: '16.4'` → `IPHONEOS_DEPLOYMENT_TARGET = 16.4`, `ios.infoPlist` keys verbatim, plus `ios/<App>/PrivacyInfo.xcprivacy`.
- The `pbxproj` still shows `CURRENT_PROJECT_VERSION = 1` and `MARKETING_VERSION = 1.0`. That is harmless: the generated Info.plist holds the literal values, and those are what ship.
- Run `npm run audit:privacy` and the pod layers of `npm run audit:network` after prebuild, because they read `ios/Pods` and `ios/Podfile.lock`.
- `pod install` downloads the three trunk pods (Google-Mobile-Ads-SDK, GoogleUserMessagingPlatform, openiap), so prebuild needs the network. The app does not. With docs/09's plugin options (`disableFFmpeg`, `disableStaticExternalLibs`), `react-native-audio-api` downloads no prebuilt binaries (docs/09 section 2).

### 3.4 Simulator build, install, launch, screenshot

These are the commands `npm run build:ios:sim` runs after section 3.3 (all verified on 2026-09-26):

```sh
# one dedicated simulator per purpose, created once and reused
UDID=$(xcrun simctl create e07-smoke "iPhone 17 Pro Max" com.apple.CoreSimulator.SimRuntime.iOS-26-5)
#   (the script first looks the name up in `xcrun simctl list devices -j` and reuses it)

xcodebuild -workspace "$WS" -scheme "$SCHEME" -configuration Release -sdk iphonesimulator \
  -destination "id=$UDID" -derivedDataPath build/dd \
  ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO build

xcrun simctl bootstatus "$UDID" -b                   # boots if needed, waits until ready
xcrun simctl status_bar "$UDID" override --time 9:41 --batteryState charged \
  --batteryLevel 100 --wifiBars 3 --cellularBars 4
xcrun simctl install "$UDID" "build/dd/Build/Products/Release-iphonesimulator/$SCHEME.app"
xcrun simctl launch "$UDID" "$BUNDLE_ID"             # prints "<bundle id>: <pid>"
# wait until the app is interactive ("Waiting" below; never a fixed sleep), then:
xcrun simctl io "$UDID" screenshot ../../reports/ios/line-siege/smoke.png
```

- **Waiting.** App code cannot log (docs/04 bans `console` outside tooling), so the ready signal is data, not a log line. In test builds, poll the perf log that docs/15 writes when Home is interactive: `sqlite3 "$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)/Documents/SQLite/save.db" "SELECT payload FROM perf_log WHERE id = 1"` until it contains a `cold-start` entry, with a 30-second timeout. A store-variant simulator build has no perf log; its ready signal is open issue 10.
- **Look at the result.** The agent opens the PNG with its Read tool. A white or black screen means the build failed.
- **First boot of a new simulator.** The first screenshot after `simctl create` showed a "Ready for Apple Intelligence" system banner over the app. It was gone on later launches. Screenshot tooling must boot a new simulator once and discard that first capture.
- **Speed.** `ONLY_ACTIVE_ARCH=YES ARCHS=arm64` avoids building x86_64. Measured on 2026-09-26 on a small app: prebuild 17 s, first Release simulator build 1 min 40 s, and a rebuild after a clean prebuild 1 min 6 s. The Skia test app (research) took 3 min 24 s clean for a universal build and 41 s incrementally for arm64.
- **Disk.** Delete `apps/<game>/build/` after release runs. Run `xcrun simctl delete unavailable` monthly.
- **Other agents.** Never `xcrun simctl shutdown all` or `erase all`.

### 3.5 Build variants

#### The matrix

| `APP_VARIANT` | `ADS_MODE` | Debug menu, deep links, network guard | Ad app ID / units | Export options | Where it can go |
|---|---|---|---|---|---|
| `test` (default) | `test` (default) | compiled in | Google sample app ID `ca-app-pub-3940256099942544~1458002511` and `TestIds.*` | `export-options-test.plist` | simulator, internal TestFlight only |
| `test` | `off` | compiled in | sample app ID, ads never initialised | `export-options-test.plist` | screenshots, E2E, runtime network audit |
| `store` | `live` (default) | **compiled out** | the game's real IDs from `game.config.ts` | `export-options-store.plist` | TestFlight (internal and external) and the App Store |
| `store` | `off` | compiled out | sample app ID in Info.plist (docs/11), ads never initialised (spec 4.3 "ads off" game) | `export-options-store.plist` | same as above |
| `test` | `live` | — | **forbidden** (real ads in a debug build) | — | — |
| `store` | `test` | — | **forbidden** (test ads in a store build) | — | — |

The native side (the GMA plugin's `iosAppId`, which Info.plist needs, since a missing `GADApplicationIdentifier` crashes at launch) and the JS side (which unit IDs `admob-ads-adapter.ts` uses) both derive from `ADS_MODE`. docs/11 owns the ad details. JS reads the ads mode at runtime from `Constants.expoConfig.extra.adsMode` (`expo-constants`). It reads the variant from the inlined `process.env.EXPO_PUBLIC_APP_VARIANT`.

**Export the three variables for the whole run, not just for prebuild.** The variant reaches the binary at three moments: prebuild writes Info.plist (`GADApplicationIdentifier`), and inside `xcodebuild` the phase "Generate app.config for prebuilt Constants.manifest" re-evaluates `app.config.ts` into `EXConstants.bundle/app.config` (where `extra.adsMode` comes from), while "Bundle React Native code and images" runs Metro, which inlines `EXPO_PUBLIC_APP_VARIANT`. A shell that loses the variables between prebuild and `xcodebuild` silently mixes variants; step 7 of section 3.8 checks all three.

#### `packages/shell/package.json` exports (the subpath `app.config.ts` imports)

docs/02 section 4.2 owns the complete file. The part this doc relies on is `"type": "module"` plus `"exports": { "./*": "./src/*", "./plugins/*": "./plugins/*" }`, the export map docs/04 prescribes (no barrel `index.ts`; `@e07/shell/<path-under-src>.ts`). What this doc needs is that `@e07/shell/config/with-shell.ts` resolves under Node, and that `"type": "module"` stops Node's `MODULE_TYPELESS_PACKAGE_JSON` warning (verified: `npx expo config`, `npx expo export` and Jest all work with it).

#### `apps/<game>/app.config.ts`

The file is one statement, `export default withShell(gameConfig, process.env);`, after importing `withShell` from `@e07/shell/config/with-shell.ts` and `gameConfig` from `./game.config.ts` (docs/02 section 8.2 has the file). It is loaded by Node's type stripping, not Metro. Every file it reaches must use explicit `.ts` import extensions and erasable syntax only. Passing `process.env` in keeps `withShell` pure and testable. A `process.env['X']` read inside `packages/shell/src` trips `expo/no-dynamic-env-var` (verified).

#### `packages/shell/src/config/app-variant.ts` (verified: tsc, ESLint, Jest)

```ts
// packages/shell/src/config/app-variant.ts
// Pure: resolves the build variant from an environment snapshot. Runs in Node (app.config.ts).

export const APP_VARIANTS = ['test', 'store'] as const;
export type AppVariant = (typeof APP_VARIANTS)[number];

export const ADS_MODES = ['off', 'test', 'live'] as const;
export type AdsMode = (typeof ADS_MODES)[number];

export type BuildVariant = { readonly appVariant: AppVariant; readonly adsMode: AdsMode };
export type BuildEnv = Readonly<Record<string, string | undefined>>;

const ADS_MODES_BY_VARIANT: Readonly<Record<AppVariant, readonly AdsMode[]>> = {
  test: ['off', 'test'],
  store: ['off', 'live'],
};

type ParseOptions<T extends string> = {
  readonly name: string;
  readonly raw: string | undefined;
  readonly allowed: readonly T[];
  readonly fallback: T;
};

function parseOneOf<T extends string>(options: ParseOptions<T>): T {
  const { name, raw, allowed, fallback } = options;
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const match = allowed.find((value) => value === raw);
  if (match === undefined) {
    throw new Error(`${name}=${raw} is not one of ${allowed.join('|')}`);
  }
  return match;
}

export function resolveBuildVariant(env: BuildEnv): BuildVariant {
  const appVariant = parseOneOf({
    name: 'APP_VARIANT',
    raw: env['APP_VARIANT'],
    allowed: APP_VARIANTS,
    fallback: 'test',
  });
  const inlined = env['EXPO_PUBLIC_APP_VARIANT'] ?? 'test';
  if (inlined !== appVariant) {
    throw new Error(`EXPO_PUBLIC_APP_VARIANT=${inlined} must equal APP_VARIANT=${appVariant}`);
  }
  const adsMode = parseOneOf({
    name: 'ADS_MODE',
    raw: env['ADS_MODE'],
    allowed: ADS_MODES,
    fallback: appVariant === 'store' ? 'live' : 'test',
  });
  if (!ADS_MODES_BY_VARIANT[appVariant].includes(adsMode)) {
    throw new Error(`ADS_MODE=${adsMode} is not allowed when APP_VARIANT=${appVariant}`);
  }
  return { appVariant, adsMode };
}
```

Its tests (they pass under Jest 29 in a Node-environment project):

```ts
// packages/shell/src/config/app-variant.test.ts
import { resolveBuildVariant } from './app-variant.ts';

describe('resolveBuildVariant', () => {
  it('defaults to a test build with test ads when nothing is set', () => {
    expect(resolveBuildVariant({})).toStrictEqual({ appVariant: 'test', adsMode: 'test' });
  });

  it('defaults a store build to live ads', () => {
    const env = { APP_VARIANT: 'store', EXPO_PUBLIC_APP_VARIANT: 'store' };
    expect(resolveBuildVariant(env)).toStrictEqual({ appVariant: 'store', adsMode: 'live' });
  });

  it('rejects a store build whose inlined variant was not set', () => {
    expect(() => resolveBuildVariant({ APP_VARIANT: 'store' })).toThrow(
      'EXPO_PUBLIC_APP_VARIANT=test must equal APP_VARIANT=store',
    );
  });

  it.each([
    ['test', 'live'],
    ['store', 'test'],
  ])('rejects APP_VARIANT=%s with ADS_MODE=%s', (appVariant, adsMode) => {
    const env = { APP_VARIANT: appVariant, EXPO_PUBLIC_APP_VARIANT: appVariant, ADS_MODE: adsMode };
    expect(() => resolveBuildVariant(env)).toThrow('is not allowed');
  });

  it('rejects an unknown variant name', () => {
    expect(() => resolveBuildVariant({ APP_VARIANT: 'prod' })).toThrow('is not one of test|store');
  });
});
```

#### `withShell`: the release contract (docs/02 owns the file)

docs/02 section 9.1 owns `withShell` and has the complete file. These of its fields and checks are the release contract this doc relies on (verified through `npx expo config --json --type prebuild`):

| Field or check | Value |
|---|---|
| bundle ID check | throws unless `bundleId` matches `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$` (FINAL A.9) |
| `resolveBuildVariant(env)` | throws on an unknown value, a mismatch between `APP_VARIANT` and `EXPO_PUBLIC_APP_VARIANT`, or a forbidden pair (the matrix above) |
| `version`, `ios.buildNumber`, `android.versionCode` | from `game.config.ts` (section 3.6) |
| `ios.deploymentTarget` | `'16.4'` (the built-in key; `expo-build-properties`' `ios.deploymentTarget` has been deprecated since SDK 56) |
| `ios.appleTeamId` | from `APPLE_TEAM_ID`, only when set (writes `DEVELOPMENT_TEAM`) |
| `ios.config.usesNonExemptEncryption` | `false` |
| `ios.infoPlist.CADisableMinimumFrameDurationOnPhone` | `true` |
| `updates.enabled` | `false` |
| `extra.appVariant`, `extra.adsMode` | the resolved variant; `adsMode` is `off` when the game's ads master switch is off; `extra.adUnits` only in live builds (docs/11) |
| `experiments.reactCompiler` | `true` |

`game.config.ts` imports its type from the neutral `@e07/shell/config/game-config.ts`, never from `with-shell.ts` (docs/04).

#### Stripping test-only code from store bundles

Metro inlines `process.env.EXPO_PUBLIC_*` during the transform, folds constant conditions, and only then collects `require` dependencies. So a `require` in a branch that folds to false never enters the bundle. That happens only when the comparison is **in the same expression**. Verified with three variants of the same code: the store bundle kept the test-only module when the gate was an imported constant, and dropped it with the inline comparison.

```ts
// packages/shell/src/app/test-only.ts
// The ONLY file allowed to require() test-only code (ESLint file-level exemption).
// The gate must be this literal comparison: an imported constant does not strip code.
import type { TestOnlyApi } from './test-only-api.ts';

export const TEST_ONLY: TestOnlyApi | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'store'
    ? null
    : (require('./test-only-entry.ts') as TestOnlyApi);
```

It lives in `src/app/` (app code checked by the Shell's tsconfig), not in `src/config/`, which docs/04 reserves for Node-side config.

- `test-only-entry.ts` exports everything test-only (debug screens, the deep-link handler, the JS network guard, the StoreKit harness hooks, and docs/15's performance tools: `createPerfLog`, `sharePerfReport`, the save benchmark and the debug menu's Performance section) plus the sentinel constant `TEST_BUILD_SENTINEL = 'SHELL_TEST_BUILD_ONLY'`. The store-artifact gate greps for that sentinel.
- Callers use `TEST_ONLY?.debugScreens` and similar. `IS_TEST_BUILD`-style constants may drive *behaviour*, but never *inclusion*.
- The ESLint config needs one file-level exemption (verified: the only error), and docs/04 section 3 carries it: `@typescript-eslint/no-require-imports` for `packages/shell/src/app/test-only.ts`. docs/04 also turns `consistent-type-definitions` off for `*.d.ts`.

`packages/shell/src/app-env.d.ts` (docs/04 section 2.2 has the file) declares `NodeJS.ProcessEnv.EXPO_PUBLIC_APP_VARIANT?: 'test' | 'store'` and `declare const process: { readonly env: NodeJS.ProcessEnv }`. Without the `ProcessEnv` entry, `noPropertyAccessFromIndexSignature` rejects `process.env.EXPO_PUBLIC_APP_VARIANT` (TS4111, verified). Without the `process` line, the Shell program (docs/04: `types: ["jest"]`, no `expo-env.d.ts`) fails with TS2591 "Cannot find name 'process'" (verified). `require` is declared by React Native's global types. Use `declare const`, not `declare var`: `no-var` rejects the latter.

#### `apps/<game>/metro.config.js` (complete file; verified)

```js
// apps/line-siege/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// EXPO_PUBLIC_* values are inlined at transform time but are NOT part of Metro's cache key.
// Keying the cache on the variant stops a store build from reusing test-build transforms.
config.cacheVersion = `app-variant-${process.env.EXPO_PUBLIC_APP_VARIANT ?? 'test'}`;

module.exports = config;
```

This is JavaScript because Metro loads it directly, which makes it a tool-demanded exception like `babel.config.js`. `npx expo-doctor` still passes 21/21 with it. The Metro cache lives in `$TMPDIR/metro-cache` and is shared by every project on the Mac.

### 3.6 Version and build-number policy

| Field | Where | Format | Who changes it |
|---|---|---|---|
| `version` → `CFBundleShortVersionString` / Android `versionName` | `game.config.ts` | `MAJOR.MINOR.PATCH` | the agent, per release: PATCH = fixes, MINOR = features or new levels, MAJOR = save-format or large changes |
| `buildNumber` → `CFBundleVersion` / Android `versionCode` | `game.config.ts` | integer ≥ 1 | only `release:ios`: +1 before every archive, committed as `chore(<slug>): build <n>` |

- A version that App Store review has approved is frozen. The next store submission needs a higher `version` (otherwise ITMS-90062).
- A failed or abandoned upload still consumes its build number. Never roll the counter back.
- Simulator builds never bump the number.
- Build tags go on after a successful upload. Release tags go on when the owner says "ship".

```ts
// packages/tooling/src/release/build-number.ts
// Pure: bumps the single `buildNumber: <int>,` line in apps/<game>/game.config.ts.
const BUILD_NUMBER_LINE = /^(\s*buildNumber: )(\d+)(,)$/gm;

export type BuildNumberBump = {
  readonly text: string;
  readonly previous: number;
  readonly next: number;
};

export function bumpBuildNumber(gameConfigSource: string): BuildNumberBump {
  const found = [...gameConfigSource.matchAll(BUILD_NUMBER_LINE)];
  const digits = found[0]?.[2];
  if (found.length !== 1 || digits === undefined) {
    throw new Error(
      `expected exactly one "buildNumber: <int>," line, found ${String(found.length)}`,
    );
  }
  const previous = Number(digits);
  const next = previous + 1;
  const text = gameConfigSource.replace(BUILD_NUMBER_LINE, `$1${String(next)}$3`);
  return { text, previous, next };
}

export function buildTag(slug: string, version: string, buildNumber: number): string {
  return `${slug}/v${version}+${String(buildNumber)}`;
}

export function releaseTag(slug: string, version: string): string {
  return `${slug}/v${version}`;
}
```

```ts
// packages/tooling/src/release/build-number.test.ts
import { bumpBuildNumber, buildTag } from './build-number.ts';

const SOURCE = "export const gameConfig = {\n  version: '1.0.0',\n  buildNumber: 7,\n};\n";

describe('bumpBuildNumber', () => {
  it('increments the single buildNumber line', () => {
    const bump = bumpBuildNumber(SOURCE);
    expect(bump.next).toBe(8);
    expect(bump.text).toContain('  buildNumber: 8,\n');
  });

  it('refuses a file with no buildNumber line', () => {
    expect(() => bumpBuildNumber('export const gameConfig = {};\n')).toThrow('found 0');
  });

  it('refuses a file with two buildNumber lines', () => {
    expect(() => bumpBuildNumber(`${SOURCE}  buildNumber: 3,\n`)).toThrow('found 2');
  });
});

describe('buildTag', () => {
  it('formats the per-build git tag', () => {
    expect(buildTag('line-siege', '1.0.0', 8)).toBe('line-siege/v1.0.0+8');
  });
});
```

### 3.7 Signing with the App Store Connect API key

What happens, and what it needs:

1. **Archive** (`xcodebuild archive -allowProvisioningUpdates` plus the three `-authenticationKey*` flags). Xcode talks to the developer portal with the key. It registers the App ID for the bundle ID if needed, creates or downloads a development profile, and signs the archive with an **Apple Development** certificate whose private key is in the login keychain. It creates that certificate if the team has none usable on this Mac (unverified with a key alone; the fallback is human step O7). This Mac already has one Apple Development and two Apple Distribution identities in its keychains. Both Distribution identities carry the `APPLE_TEAM_ID` team; the Development one's name carries a personal ID, so its team is unknown (`security find-identity -v -p codesigning`).
2. **Export** (`-exportArchive`, `method app-store-connect`, `signingStyle automatic`). Xcode re-signs for distribution with a **cloud-managed** Apple Distribution certificate, whose private key stays with Apple, and an App Store profile.
3. **Requirements.** A **team** key (individual keys cannot use provisioning endpoints) with the **Admin** role (only the Account Holder or an Admin can create cloud-managed distribution certificates). **Sources:** [Creating API keys](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api), [roles](https://developer.apple.com/help/account/access/roles/).
4. **Keychain.** Step 1 runs `codesign` with a key in the login keychain, which must be unlocked. That is normal in the owner's logged-in GUI session and **not** in an SSH session. Preflight: `security show-keychain-info ~/Library/Keychains/login.keychain-db` must exit 0 (it did on 2026-09-26; its behaviour on a locked keychain was not tested).
5. **Entitlements.** Prebuild writes `ios/<App>/<App>.entitlements`. IAP needs no entitlement key on iOS (believed, not verified). The StoreKit test harness adds `get-task-allow` in **Debug only**, and the store-artifact gate proves it is absent from Release.

### 3.8 Release pipeline (`npm run release:ios -- --app <game> --variant test|store`)

Every step logs to `apps/<game>/build/logs/<step>.log`. Any non-zero exit stops the run, and the playbook (section 3.12) decides what happens next.

**Step 0: environment**
```sh
export DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer   # resolved from XCODE_VERSION
export EXPO_NO_TELEMETRY=1 CI=1
export APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=live      # test: test/test/test
KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"   # path only; never read it
AUTH=(-allowProvisioningUpdates -authenticationKeyPath "$KEY_PATH" \
      -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
ALTOOL_AUTH=(--api-key "$ASC_KEY_ID" --api-issuer "$ASC_ISSUER_ID")   # altool finds AuthKey_<id>.p8 itself
```

**Step 1: preflight** (stop on the first failure)
- The working tree is clean and on the main branch, and `npm run verify` is green. For store builds, `npm run e2e:ios` is also green on a test-variant simulator build of the same commit.
- `xcodebuild -version` prints Xcode 26.6. `ASC_KEY_ID`, `ASC_ISSUER_ID` and `APPLE_TEAM_ID` are set. `test -f "$KEY_PATH"` succeeds and `stat -f %Sp "$KEY_PATH"` is `-rw-------`, without reading the file.
- The keychain check from section 3.7 passes.
- The app record exists: `node packages/tooling/src/asc/print-app-record.ts <bundleId>` prints `{"id","name"}`. Exit 2 means there is no record, which is human step G2. Keep the `id` (the numeric Apple ID) as `APPLE_APP_ID`; `BUNDLE_ID`, `VERSION` and (after step 2) `BUILD_NUMBER` come from `game.config.ts`.
- Store variant only: the `version` in `game.config.ts` is higher than the last release tag `<slug>/vX.Y.Z` (build tags contain `+` and do not count), and the fa/ckb review gate of docs/10 (`review-sheet.ts --release`) passes.

**Step 2: build number**
```sh
node packages/tooling/src/release/bump-build-number.ts --app line-siege    # bumpBuildNumber(), writes the file
git commit -am "chore(line-siege): build 8" -m "Release-Variant: store"
```

**Step 3: prebuild and native audits**: section 3.3, then `npm run audit:privacy` and `npm run audit:network` (all layers). The JS layer runs `expo export` under the same `APP_VARIANT` and fails if `3940256099942544` appears in any module outside `node_modules/` in a store build.

**Step 4: archive**
```sh
xcodebuild -workspace "$WS" -scheme "$SCHEME" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "build/$SCHEME.xcarchive" \
  -derivedDataPath build/dd-device "${AUTH[@]}" archive
```
Check: `plutil -p "build/$SCHEME.xcarchive/Info.plist"` shows `CFBundleVersion` equal to the new build number. The same command with `CODE_SIGNING_ALLOWED=NO` instead of `"${AUTH[@]}"` was verified to produce a valid unsigned archive in 66 s.

**Step 5: export**
```sh
xcodebuild -exportArchive -archivePath "build/$SCHEME.xcarchive" \
  -exportOptionsPlist "../../packages/tooling/config/export-options-$APP_VARIANT.plist" \
  -exportPath build/export "${AUTH[@]}"
IPA=$(ls build/export/*.ipa)
```

`packages/tooling/config/export-options-store.plist` (complete; `plutil -lint` OK):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- packages/tooling/config/export-options-store.plist: APP_VARIANT=store (App Store + external TestFlight) -->
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>destination</key>
  <string>export</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key>
  <false/>
  <key>uploadSymbols</key>
  <true/>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>testFlightInternalTestingOnly</key>
  <false/>
</dict>
</plist>
```

`packages/tooling/config/export-options-test.plist` (complete):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- packages/tooling/config/export-options-test.plist: APP_VARIANT=test (internal TestFlight only, never the App Store) -->
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>destination</key>
  <string>export</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key>
  <false/>
  <key>uploadSymbols</key>
  <true/>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>testFlightInternalTestingOnly</key>
  <true/>
</dict>
</plist>
```

Why these keys (from `xcodebuild -help`, Xcode 26.6):
- `app-store` is deprecated in favour of `app-store-connect`.
- `destination export` keeps altool in charge of uploading.
- `manageAppVersionAndBuildNumber` defaults to **YES**, which would let Xcode rewrite our numbers.
- `teamID` is omitted because it "defaults to the team used to build the archive" (`DEVELOPMENT_TEAM` from `APPLE_TEAM_ID`).
- `uploadSymbols` sends dSYMs to Apple, so crash reports that users choose to share appear in App Store Connect. That is an OS feature, not a crash SDK (N2).

**Step 6: unpack for the gate**
```sh
rm -rf build/ipa-check && mkdir -p build/ipa-check && unzip -q "$IPA" -d build/ipa-check
APPDIR=$(ls -d build/ipa-check/Payload/*.app)
```

**Step 7: store-artifact gate.** All checks run for store builds. Test builds run the version, `extra` and `get-task-allow` checks only.
```sh
plutil -extract CFBundleVersion raw "$APPDIR/Info.plist"                # == new buildNumber
plutil -extract CFBundleShortVersionString raw "$APPDIR/Info.plist"     # == version
plutil -extract ITSAppUsesNonExemptEncryption raw "$APPDIR/Info.plist"  # false
plutil -extract GADApplicationIdentifier raw "$APPDIR/Info.plist"       # live: matches ^ca-app-pub-\d{16}~\d{10}$ and != ca-app-pub-3940256099942544~1458002511; off/test: the sample ID
plutil -extract extra.appVariant raw "$APPDIR/EXConstants.bundle/app.config"   # == $APP_VARIANT (plutil reads this JSON file)
plutil -extract extra.adsMode raw "$APPDIR/EXConstants.bundle/app.config"      # == $ADS_MODE
grep -a -c 'SHELL_TEST_BUILD_ONLY' "$APPDIR/main.jsbundle"              # store: 0 (Hermes bytecode keeps ASCII strings; verified)
find "$APPDIR" \( -name '*.storekit' -o -name '*.xctest' \) | wc -l     # store: 0
test -f "$APPDIR/PrivacyInfo.xcprivacy"
codesign -d --entitlements - --xml "$APPDIR" | plutil -p - | grep -c '"get-task-allow" => true'   # 0
plutil -extract NSAppTransportSecurity.NSAllowsArbitraryLoads raw "$APPDIR/Info.plist"   # must fail (key absent) or print false
```
`grep -c` and `find | wc -l` print a count: the script compares the printed number (`grep -c` exits 1 when the count is 0, so do not treat that exit code as a failure). Do not grep the bundle for the test ad publisher ID `3940256099942544`. The GMA library's own `TestIds` module is present in every bundle, so that check lives in the source-mapped JS layer of step 3, which excludes `node_modules/`.

**Step 8: validate**
```sh
xcrun altool --validate-app "$IPA" -t ios "${ALTOOL_AUTH[@]}" --output-format json
```
The man page lists `--apple-id`, `--bundle-id`, `--bundle-version` and `--bundle-short-version-string` for `--validate-app` too, while the `--help` examples omit them. If validation asks for the app, pass the same four flags as step 9.

**Step 9: upload**
```sh
xcrun altool --upload-package "$IPA" -t ios --apple-id "$APPLE_APP_ID" --bundle-id "$BUNDLE_ID" \
  --bundle-version "$BUILD_NUMBER" --bundle-short-version-string "$VERSION" \
  "${ALTOOL_AUTH[@]}" --wait --output-format json > build/logs/upload.json
```
Save the JSON. It contains the delivery UUID used in step 10 (confirm the field name on the first real upload and record it here).

**Step 10: wait for processing**
```sh
xcrun altool --build-status --delivery-id "$DELIVERY_ID" "${ALTOOL_AUTH[@]}" --wait --output-format json
```
Stop when the state is `VALID`. On `INVALID` or `FAILED`, stop and ask the owner for Apple's email (section 3.12). Fallback: poll REST `GET /v1/builds?filter[app]=<id>&filter[version]=<build>&filter[preReleaseVersion.version]=<version>` every 60 s for up to 60 minutes and read `attributes.processingState`.

**Step 11: "What to Test"**: section 3.9.

**Step 12: tag and report**
```sh
git tag "line-siege/v1.0.0+8"          # buildTag()
```
Report to the owner in one message: game, version (build), variant, "available in TestFlight", and the What-to-Test text. For a store build the owner answers "ship" or "don't ship". On "ship": `git tag line-siege/v1.0.0` (`releaseTag()`) and the per-release human steps in section 3.11.

### 3.9 TestFlight "What to Test"

altool's route (preferred, FINAL A.9): download the beta texts for this build, set `whatsNew`, upload. The folder layout is documented by the README that altool writes into the downloaded folder. The upload README shipped with Xcode (`ContentDelivery.framework/Resources/AppStoreText-README.md`) says the upload reads `<language-code>.txt` files of `"key" = "value";` lines, and lists `"whatsNew"` (up to 4000 characters) as "Beta App localizable information for a build version".

```sh
rm -rf build/beta-text
xcrun altool --beta-app-store-text build/beta-text --download --apple-id "$APPLE_APP_ID" -t ios \
  --bundle-version "$BUILD_NUMBER" --bundle-short-version-string "$VERSION" "${ALTOOL_AUTH[@]}"
# First run: read build/beta-text/**/README*, then write the exact layout into this section.
# Set "whatsNew" = "…"; in the en-US file for this build, then (upload expects the up-<appleId> folder
# naming described in the README):
xcrun altool --beta-app-store-text build/beta-text --upload --apple-id "$APPLE_APP_ID" -t ios \
  --bundle-version "$BUILD_NUMBER" --bundle-short-version-string "$VERSION" "${ALTOOL_AUTH[@]}"
```

Fallback (REST): `GET /v1/builds/{id}/betaBuildLocalizations`, then `PATCH /v1/betaBuildLocalizations/{id}` with `{"data":{"type":"betaBuildLocalizations","id":"…","attributes":{"whatsNew":"…"}}}`. If no localization exists, `POST /v1/betaBuildLocalizations` with `locale: "en-US"` and the `build` relationship instead.

Content template, generated by `release:ios`. It is English and for testers only, so it is not an in-app string:

```text
Line Siege 1.0.0 (8) · store build
What changed
- <feat/fix commit subjects since line-siege/v1.0.0+7>
Please check
- <focus items passed with --notes>
- First build of a game, or purchase code changed: buy Premium, cancel a purchase, delete the app, reinstall, Restore.
- Switch the language to فارسی and کوردیی ناوەندی once: layout mirrored, nothing cut off.
Known issues
- <from --known-issues, or "none">
```

### 3.10 App Store Connect REST: the JWT script

Use it only where altool has no command:

| Need | Endpoint | When |
|---|---|---|
| App record exists and numeric Apple ID | `GET /v1/apps?filter[bundleId]=…` | preflight, every release |
| Processing state (fallback) | `GET /v1/builds?filter[app]=…&filter[version]=…&filter[preReleaseVersion.version]=…` | step 10 fallback |
| Internal tester group | `POST /v1/betaGroups` with `isInternalGroup: true`, `hasAccessToAllBuilds: true` | once per game |
| What to Test (fallback) | `POST` / `PATCH /v1/betaBuildLocalizations` | section 3.9 fallback |
| Register the bundle ID (optional) | `POST /v1/bundleIds` | per game, before the first archive (otherwise `-allowProvisioningUpdates` registers it) |
| Premium in-app purchase | `POST /v2/inAppPurchases`, `POST /v1/inAppPurchaseLocalizations`, `POST /v1/inAppPurchasePriceSchedules`, plus the review screenshot upload | once per game (docs/12 section 3.10 owns the payloads) |
| Age rating | `PATCH /v1/ageRatingDeclarations/{id}` | once per game, and when Apple changes the questions |
| Submit for review | `POST /v1/reviewSubmissions` (+ items) | per release, **only after the owner says "ship"** |

JWT rules (Apple): header `alg ES256`, `kid <Key ID>`, `typ JWT`. Payload `iss <Issuer ID>`, `iat`, `exp`, `aud "appstoreconnect-v1"`. "Tokens that expire more than 20 minutes into the future are not valid." **Source:** [Generating tokens](https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests). `xcrun altool --generate-jwt` also exists, but it has keychain options. The Node script keeps the key in memory only.

```ts
// packages/tooling/src/asc/asc-jwt.ts
import { createPrivateKey, sign } from 'node:crypto';

export type AscCredentials = {
  readonly keyId: string;
  readonly issuerId: string;
  readonly privateKeyPem: string;
};

// Apple rejects tokens whose exp is more than 20 minutes after iat.
const TOKEN_LIFETIME_SECONDS = 15 * 60;
const AUDIENCE = 'appstoreconnect-v1';

function toBase64Url(value: string | Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

export function createAscJwt(credentials: AscCredentials, nowEpochSeconds: number): string {
  const header = { alg: 'ES256', kid: credentials.keyId, typ: 'JWT' };
  const payload = {
    iss: credentials.issuerId,
    iat: nowEpochSeconds,
    exp: nowEpochSeconds + TOKEN_LIFETIME_SECONDS,
    aud: AUDIENCE,
  };
  const signingInput = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const signature = sign('sha256', Buffer.from(signingInput), {
    key: createPrivateKey(credentials.privateKeyPem),
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${toBase64Url(signature)}`;
}
```

```ts
// packages/tooling/src/asc/asc-credentials.ts
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { AscCredentials } from './asc-jwt.ts';

export type ToolEnv = Readonly<Record<string, string | undefined>>;

export function requireEnv(env: ToolEnv, name: string): string {
  const value = env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `${name} is not set. See docs/14-ios-build-and-release.md, section "Environment".`,
    );
  }
  return value;
}

export function ascKeyPath(keyId: string): string {
  return join(homedir(), '.appstoreconnect', 'private_keys', `AuthKey_${keyId}.p8`);
}

// Loads the key into memory only. Never log, print, copy or commit its contents.
export function loadAscCredentials(env: ToolEnv): AscCredentials {
  const keyId = requireEnv(env, 'ASC_KEY_ID');
  return {
    keyId,
    issuerId: requireEnv(env, 'ASC_ISSUER_ID'),
    privateKeyPem: readFileSync(ascKeyPath(keyId), 'utf8'),
  };
}
```

```ts
// packages/tooling/src/asc/asc-client.ts
// Tooling only: packages/tooling is outside the N3 lint zone (the app never calls this).
const ASC_BASE_URL = 'https://api.appstoreconnect.apple.com';

export type AscRequest = {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly body?: unknown;
};

export type AscError = { readonly code: string; readonly detail: string };

export type AscResponse =
  | { readonly ok: true; readonly status: number; readonly json: unknown }
  | { readonly ok: false; readonly status: number; readonly errors: readonly AscError[] };

function readField(value: unknown, key: string): string {
  if (typeof value !== 'object' || value === null || !(key in value)) {
    return '';
  }
  const field: unknown = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : '';
}

function parseErrors(json: unknown): readonly AscError[] {
  const list: unknown =
    typeof json === 'object' && json !== null ? Reflect.get(json, 'errors') : undefined;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((item: unknown) => ({
    code: readField(item, 'code'),
    detail: readField(item, 'detail'),
  }));
}

export async function ascRequest(token: string, request: AscRequest): Promise<AscResponse> {
  const response = await fetch(`${ASC_BASE_URL}${request.path}`, {
    method: request.method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
  });
  const text = await response.text();
  const json: unknown = text === '' ? null : JSON.parse(text);
  if (response.ok) {
    return { ok: true, status: response.status, json };
  }
  return { ok: false, status: response.status, errors: parseErrors(json) };
}
```

```ts
// packages/tooling/src/asc/find-app.ts
import { ascRequest } from './asc-client.ts';

export type AppRecord = { readonly id: string; readonly name: string };

function readObjectField(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
}

function toAppRecord(item: unknown): AppRecord | null {
  const id = readObjectField(item, 'id');
  const name = readObjectField(readObjectField(item, 'attributes'), 'name');
  return typeof id === 'string' && typeof name === 'string' ? { id, name } : null;
}

// Returns null when App Store Connect has no app record for the bundle ID (a human step).
export async function findAppByBundleId(
  token: string,
  bundleId: string,
): Promise<AppRecord | null> {
  const path = `/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&fields[apps]=name`;
  const response = await ascRequest(token, { method: 'GET', path });
  if (!response.ok) {
    const codes = response.errors.map((error) => error.code).join(', ');
    throw new Error(`App Store Connect answered ${String(response.status)} (${codes})`);
  }
  const data = readObjectField(response.json, 'data');
  return Array.isArray(data) ? toAppRecord(data[0]) : null;
}
```

`nowEpochSeconds()` comes from `packages/tooling/src/clock/system-clock.ts`, the one tooling module that reads the wall clock (defined in docs/01 section 3.4, next to `todayIso()`).

```ts
// packages/tooling/src/asc/print-app-record.ts
// CLI: node packages/tooling/src/asc/print-app-record.ts <bundleId>   (prints {"id","name"} or exits 2)
import { loadAscCredentials } from '@e07/tooling/asc/asc-credentials.ts';
import { createAscJwt } from '@e07/tooling/asc/asc-jwt.ts';
import { findAppByBundleId } from '@e07/tooling/asc/find-app.ts';
import { nowEpochSeconds } from '@e07/tooling/clock/system-clock.ts';

const EXIT_NO_APP_RECORD = 2;
const bundleId = process.argv[2];

if (bundleId === undefined) {
  console.error('usage: print-app-record.ts <bundleId>');
  process.exitCode = 1;
} else {
  const token = createAscJwt(loadAscCredentials(process.env), nowEpochSeconds());
  const app = await findAppByBundleId(token, bundleId);
  if (app === null) {
    console.error(
      `No App Store Connect app record for ${bundleId}. Owner: create it (doc 14, human steps).`,
    );
    process.exitCode = EXIT_NO_APP_RECORD;
  } else {
    process.stdout.write(`${JSON.stringify(app)}\n`);
  }
}
```

Imports follow docs/04 rule 19: the same folder as `./x.ts`, any other folder through the package's own name, `@e07/tooling/<path-under-src>.ts` (Node ignores tsconfig `paths`, and `../` is banned). `packages/tooling/package.json` is `{"name": "@e07/tooling", "private": true, "type": "module", "exports": {"./*": "./src/*"}}`: `"type": "module"` allows top-level `await` and stops the `MODULE_TYPELESS_PACKAGE_JSON` warning, and the export map makes the self-reference resolve in Node, `tsc` and ESLint (verified). `packages/tooling/tsconfig.json` sets `types: ["node", "jest"]`, because the tests sit next to the scripts (docs/04).

Error handling follows Apple's advice to **prefix-match** `code` ([Parsing the error response code](https://developer.apple.com/documentation/appstoreconnectapi/parsing-the-error-response-code)): `NOT_AUTHORIZED` (401: wrong key, issuer or clock), `FORBIDDEN_ERROR` (403: role too low, or an agreement is missing), `NOT_FOUND`, `ENTITY_ERROR`. Error `detail` text may be shown to the owner, but never drive logic from it.

### 3.11 Human steps (the complete list)

**Once (per owner/Mac)**
- **O1.** Keep the Apple Developer Program active. Accept the current Program License Agreement (developer.apple.com). In App Store Connect → Business, accept the **Paid Apps Agreement** and complete tax and banking. Premium cannot be sold or reliably sandbox-tested without it.
- **O2.** Declare **EU Digital Services Act trader status** in App Store Connect. Apps without it are removed from the EU storefronts, which include Germany. **Source:** [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/).
- **O3.** Create (or confirm) a **team** App Store Connect API key with the **Admin** role. Save the `.p8` as described in section 3.1, step 7, and put `ASC_KEY_ID` and `ASC_ISSUER_ID` in `~/.zshenv` (`APPLE_TEAM_ID` is already set on this Mac).
- **O4.** Install Xcode and accept its licence with `sudo` (section 3.1). Already done for 26.6 on this Mac. Repeat about once a year when a new Xcode is required.
- **O5.** Install TestFlight on the owner's iPhone and sign in with the Account Holder's Apple Account, which is an internal tester.
- **O6.** Approve Claude Code's permission prompts when the agent adds project hooks or permission rules to `.claude/settings.json`.
- **O7.** *Fallback only:* if the first API-key archive cannot create the Apple Development certificate, sign in once in Xcode → Settings → Accounts.
- **O8.** *Only when it happens:* unlock the login keychain (`errSecInternalComponent`, section 3.12).
- **O9.** AdMob account and payments profile, the published GDPR/TCF message, and blocking controls (docs/11 section 3.11, steps A1, A3 and A4).
- **O10.** *Later:* the Google Play developer account (section 3.14).

**Per game**
- **G1.** Approve the app name and the bundle ID proposed by the agent. The bundle ID must match `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$` and the name must be unique on the App Store.
- **G2.** Create the **app record** in App Store Connect (My Apps → + → New App: iOS, name, primary language, the bundle ID, SKU = the game slug). The public API has no create endpoint for apps (the Apps resource offers list, read and modify only). About 2 minutes.
- **G3.** Fill in the **App Privacy** questionnaire (web; the API is believed not to cover it). Decide it together with D4: GMA's manifest declares DeviceID with tracking=true while the app never shows ATT (a guideline 5.1.2 risk; docs/11 section 3.10 and docs/13 section 3.4 lay out the options).
- **G4.** Check the **Premium** in-app purchase the agent created through the API, or create it in the web UI. The first IAP must be submitted together with an app version.
- **G5.** AdMob: create the app and 3 ad units, and give the IDs to the agent. After release, link the AdMob app to the store listing and publish `app-ads.txt` (docs/11 section 3.11, steps A2 and A5).
- **G6.** Play-test on TestFlight, including the Tier-3 purchase test: buy, cancel, restore after reinstall. The sandbox does not charge.
- **G7.** Have a native speaker read the Persian and Sorani texts.
- **G8.** Approve the store listing (texts, screenshots, age rating answers). This belongs to the store-pages step of the spec's pipeline (step 8), which this handbook does not cover yet.

**Per release**
- **R1.** Play the TestFlight build and answer "ship" or "don't ship".
- **R2.** VoiceOver spot check (FINAL D.46).
- **R3.** Native-speaker read of changed fa/ckb strings.
- **R4.** Accept any new Apple agreement the agent reports as blocking.
- **R5.** Submit for review: one click in App Store Connect, or tell the agent "submit". The agent never submits without that message.
- **R6.** Answer App Review messages (Resolution Center). Choose manual or automatic release after approval.

### 3.12 Failure playbook

| Symptom (match the text) | Cause | Action |
|---|---|---|
| `errSecInternalComponent` from `codesign` during archive | Login keychain locked (SSH or non-GUI session) | **Stop.** Ask the owner to run `security unlock-keychain ~/Library/Keychains/login.keychain-db` in Terminal on the Mac, or to start the run from the logged-in desktop. The agent never handles the password and never retries in a loop |
| A macOS dialog "codesign wants to access key …" | The key's ACL does not allow codesign yet | Owner clicks **Always Allow** once |
| Text containing `agreement` (altool/ASC), `PLA Update available` (xcodebuild), or ASC `FORBIDDEN…` whose detail mentions an agreement | New or expired Apple agreement | **Stop.** The owner accepts it at developer.apple.com and/or App Store Connect → Business (human step R4), then rerun from the failed step with the same build number if nothing was uploaded |
| `print-app-record.ts` exits 2, or the upload says no app record / cannot determine the Apple ID for the bundle ID | App record missing | **Stop.** Human step G2, then rerun |
| `ITMS-90683: Missing purpose string in Info.plist` naming `NSMicrophoneUsageDescription` | `react-native-audio-api` references record-permission APIs (expected risk, FINAL B.20) | Add a neutral `NSMicrophoneUsageDescription` through the `react-native-audio-api` plugin option `iosMicrophonePermission` (docs/09 rule 11; an `ios.infoPlist` entry is equivalent, use one of the two), translated in all four languages through `expo.locales` (docs/10 owns the texts). The app never asks, so users never see it. Rebuild with a **new** build number |
| Emails or processing errors `ITMS-91053` (Missing API declaration), `ITMS-91061` (missing privacy manifest for a listed SDK) or `ITMS-91056` (invalid manifest) | Aggregated required-reason APIs are incomplete | Run `npm run audit:privacy`, add the missing category and reason to `ios.privacyManifests`, prebuild, rebuild with a new build number. Ask the owner to paste Apple's email text; the agent cannot read email |
| `ITMS-90189: Redundant Binary Upload` | Build number reused | Never reuse. Bump (section 3.6) and rebuild. If the earlier upload really succeeded, check `--build-status` first |
| `ITMS-90062` (version must be higher than the previously approved version) | `version` not raised after an approval | Raise `version` in `game.config.ts` and rebuild |
| `NOT_AUTHORIZED` (401) from altool or REST | Wrong key or issuer ID, revoked key, or clock skew (`iat` in the future) | Check that the env IDs match the file name (without reading it) and that the Mac clock is on network time. If the key was revoked, the owner creates a new one (O3) |
| `FORBIDDEN_ERROR` (403), or "not allowed to create distribution certificates" / cloud signing permission errors | Key role below Admin, or an individual key | Owner creates a team key with the Admin role (O3) |
| "No profiles for '<bundle id>' were found" or "Automatic signing is disabled" | `-allowProvisioningUpdates` or the key flags missing, or no `DEVELOPMENT_TEAM` | Check the `AUTH` array and that `APPLE_TEAM_ID` was set **before** prebuild |
| Build status `INVALID` / `FAILED` | Apple rejected the binary during processing | **Stop.** Ask the owner to forward Apple's email. Fix, then rebuild with a new build number |
| Black screen at launch after building with Xcode 27 on SDK 57 | Missing UIScene life cycle | Set `ios.enableSceneSupport: true` (doc 01, section 3.5) or go back to Xcode 26.6 |
| Store bundle contains `SHELL_TEST_BUILD_ONLY`, `variant=test` shows in a store build, or `EXConstants.bundle/app.config` `extra` differs from the exported variables | Metro cache not keyed on the variant, an imported-constant gate, or the variables were not exported for the `xcodebuild` step | Check `metro.config.js` `cacheVersion`, that test-only code is reachable only via `test-only.ts`, and that all three variables stay exported for the whole run (section 3.5). Rebuild |
| `pod install` fails downloading a trunk pod or a pod spec | No network at build time, or a CDN problem | Retry once after 5 minutes. Pods are pinned exactly, so never loosen versions |
| `EXPO_PUBLIC_APP_VARIANT=… must equal APP_VARIANT=…` | The script exported only one of the two | Export both (section 3.8, step 0) |
| Simulator will not boot, or the disk is full | Old DerivedData, runtimes, simulators | `rm -rf apps/*/build`, `xcrun simctl delete unavailable`. Never erase simulators the script did not create |

After any "Stop": post one message to the owner with the step, the exact error line, and the one action needed. Resume from the failed step once the owner confirms.

### 3.13 Release checklist

Before `npm run release:ios -- --variant store`:
- [ ] `npm run verify` is green (includes `audit:network`, `audit:licenses`, `i18n:verify`, coverage, and `npx expo install --check` / `expo-doctor` for every app).
- [ ] `npm run e2e:ios` and `npm run screenshots:ios` are green on a test-variant simulator build of **this** commit, and the screenshot diffs have been reviewed.
- [ ] The `version` in `game.config.ts` is correct and higher than the last approved version.
- [ ] `game.config.ts` holds the real AdMob app and unit IDs and the Premium product ID (the unit test "production IDs never contain 3940256099942544" passes).
- [ ] The SKAdNetwork list was refreshed from Google's page (docs/11 section 3.3).
- [ ] The Paid Apps Agreement and the other agreements are current. The app record exists. The Premium IAP exists (first release: it is attached to the version).
- [ ] The owner play-tested the latest **test** build of this commit (R1), including the purchase test on the first release of a game.
- [ ] Changed fa/ckb strings are native-speaker reviewed (R3), so the docs/10 review gate passes.

After the upload:
- [ ] Every step-7 gate check passed, and `--validate-app` and the upload returned success.
- [ ] Processing reached `VALID`, and "What to Test" is set.
- [ ] The build tag is pushed according to the repository policy. The owner has the report message.
- [ ] On "ship": the release tag is set, the owner submits for review (or tells the agent to), and the store listing is complete.

### 3.14 Android later

**Already prepared now:**
- `android.package` equals the bundle ID, which is valid on both platforms thanks to the pattern check in `withShell`, and `android.versionCode` equals `buildNumber` (verified in `npx expo config`).
- `android/` is only ever generated by prebuild. It is gitignored.
- Safe-area insets are used everywhere (edge-to-edge). Hardware Back is handled by React Navigation (`usePreventRemove` on Game). No React Native 0.87-removed APIs are used.
- Java 17 is present (Android Studio JBR 17.0.11). SDK 57 targets Android 7+, with compileSdk and targetSdk 36. SDK 58 moves compileSdk to 37 (AGP 9).
- The AdMob Android sample app ID `ca-app-pub-3940256099942544~3347511713` is already in the variant logic for non-live builds (docs/11).

**What to do then:**
1. **Human:** create the Google Play developer account (fee plus identity verification). Complete whatever closed-testing period Google currently requires of new personal accounts (check the numbers then; they were not re-verified on 2026-09-26).
2. Install the Android SDK and NDK (Skia needs the NDK). Run a monthly `npx expo prebuild --platform android --clean && (cd android && ./gradlew bundleRelease)` smoke build. Play takes **AAB** files, so use `bundleRelease`, not `assembleRelease`.
3. The agent generates the **upload key** with `keytool` outside the repo (`~/.android-keys/<game>-upload.jks`, chmod 600). Its passwords go in `~/.gradle/gradle.properties` and never into the repo. Enrol in Play App Signing: Google holds the app-signing key and we hold only the upload key.
4. Run `npx expo install expo-system-ui` in every app: without it Android ignores `userInterfaceStyle: 'automatic'` (prebuild warns "Install expo-system-ui in your project to enable this feature"; read in `@expo/prebuild-config` 57). Add the Jest `jest-expo/android` project and run the E2E flows on an emulator. Real airplane mode is available there via Maestro `setAirplaneMode`.
5. Play Billing (openiap-google 3.6.0 on Play Billing 9.1.0, inside `expo-iap`): license testers and an internal testing track (billing works only for builds installed from Play). expo-iap asks for Kotlin 2.1.20 via `expo-build-properties` on SDK 57.
6. **Human:** the Data safety form (the counterpart of App Privacy), the content rating questionnaire, the AdMob Android app with its 3 units, and the first upload of each app in the Play Console (believed to be required before API uploads work; verify then).
7. Automate uploads with the Google Play Developer API and a service account the owner creates (a human step). Treat the service-account JSON exactly like the `.p8`.

---

## 4. Checklist

Before calling any change to the build or release tooling "done":

- [ ] `npm run build:ios:sim -- --app <game>` runs from a clean clone. The screenshot shows the Home screen, and the agent looked at it.
- [ ] A test **and** a store variant simulator build were made back to back without clearing caches. `main.jsbundle` of the store build contains no `SHELL_TEST_BUILD_ONLY`, and the test build does.
- [ ] `npx expo config --json --type prebuild` shows `extra.appVariant` / `extra.adsMode` as expected for every allowed pair, and fails for every forbidden pair.
- [ ] `app-variant.test.ts` and `build-number.test.ts` pass. The pure modules meet the coverage thresholds.
- [ ] `plutil -lint packages/tooling/config/*.plist` is OK.
- [ ] Nothing in the repo or in logs contains key material. `git grep -n "BEGIN PRIVATE KEY"` finds nothing, and `.gitignore` covers `*.p8`, `AuthKey_*` and `ApiKey_*`.
- [ ] The scripts set `DEVELOPER_DIR` from `XCODE_VERSION` and never call `xcode-select`.
- [ ] The scripts create, use and clean up only simulators named `e07-*`.
- [ ] Every "Stop" case in section 3.12 ends the run with a clear message, not a retry loop.
- [ ] For a first real upload: the altool JSON field names (delivery ID, build status) and the beta-text folder layout were recorded in this doc.

---

## 5. Sources

- `xcodebuild -help`, `man altool`, `xcrun altool --help` (Xcode 26.6, altool 26.40.1), and `ContentDelivery.framework/Resources/AppStoreText-README.md`, all read locally.
- Xcode 26.6 release notes (SDK iOS 26.5; needs macOS Tahoe 26.2+): https://developer.apple.com/documentation/xcode-release-notes/xcode-26_6-release-notes
- Apple upcoming requirements: https://developer.apple.com/news/upcoming-requirements/
- App Store Connect API, generating tokens: https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests
- Creating API keys (team vs individual): https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api
- Roles: https://developer.apple.com/help/account/access/roles/
- Cloud-managed certificates: https://developer.apple.com/help/account/certificates/cloud-managed-certificates/
- Apps resource (no create): https://developer.apple.com/documentation/appstoreconnectapi/apps
- `GET /v1/apps`: https://developer.apple.com/documentation/appstoreconnectapi/get-v1-apps
- `GET /v1/builds`: https://developer.apple.com/documentation/appstoreconnectapi/get-v1-builds
- Beta build localizations: https://developer.apple.com/documentation/appstoreconnectapi/patch-v1-betabuildlocalizations-_id_ and https://developer.apple.com/documentation/appstoreconnectapi/post-v1-betabuildlocalizations
- Beta groups: https://developer.apple.com/documentation/appstoreconnectapi/post-v1-betagroups
- Bundle IDs: https://developer.apple.com/documentation/appstoreconnectapi/post-v1-bundleids
- In-app purchases v2: https://developer.apple.com/documentation/appstoreconnectapi/post-v2-inapppurchases
- Age rating declarations: https://developer.apple.com/documentation/appstoreconnectapi/patch-v1-ageratingdeclarations-_id_
- Review submissions: https://developer.apple.com/documentation/appstoreconnectapi/post-v1-reviewsubmissions
- Parsing API error codes: https://developer.apple.com/documentation/appstoreconnectapi/parsing-the-error-response-code
- CFBundleVersion: https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleversion
- ITSAppUsesNonExemptEncryption: https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption
- Required-reason APIs: https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api
- Expo CNG: https://docs.expo.dev/workflow/continuous-native-generation/
- Expo app config (SDK 57): https://docs.expo.dev/versions/v57.0.0/config/app/
- Expo environment variables: https://docs.expo.dev/guides/environment-variables/
- Expo local production builds: https://docs.expo.dev/guides/local-app-production/
- Expo privacy manifests: https://docs.expo.dev/guides/apple-privacy/
- Expo scene life cycle / SDK 57 with Xcode 27: https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md
- Metro configuration (`cacheVersion`): https://metrobundler.dev/docs/configuration/#cacheversion
- Google Mobile Ads test IDs: https://developers.google.com/admob/ios/test-ads
- Play Billing deprecation schedule: https://developer.android.com/google/play/billing/deprecation-faq

---

## Verified

**Verified on 2026-09-26 by the writer of this doc**, on macOS 27.0 (Apple silicon), Xcode 26.6 (17F113) via `DEVELOPER_DIR`, the iOS 26.5 simulator runtime (23F77), altool 26.40.1, Node 26.4.0, npm 11.17.0, CocoaPods 1.15.2 and 1.17.0, and Expo SDK 57.0.25 / RN 0.86.3. The work used a copy of the `mono` probe (`scratchpad/rn/writer-stack-ios/mono-t`), and no probe was modified.

- `app.config.ts` → `@e07/shell/config/with-shell.ts` (package `exports` subpath) → `./app-variant.ts`, plus `./game.config.ts`, all loaded through `npx expo config` under Node type stripping. All six variant combinations behave as in the matrix: allowed pairs resolve, and forbidden or mismatched pairs throw with the messages shown. `APPLE_TEAM_ID` → `ios.appleTeamId` → `DEVELOPMENT_TEAM`. Node prints a harmless `MODULE_TYPELESS_PACKAGE_JSON` warning for the Shell's `.ts` files.
- `npx expo prebuild --platform ios --clean` (17 s, including `pod install`) generated `ios/LineSiege.xcworkspace` and scheme `LineSiege`, with `CFBundleVersion 7`, `CFBundleShortVersionString 1.0.0`, `ITSAppUsesNonExemptEncryption false`, `CADisableMinimumFrameDurationOnPhone true`, `IPHONEOS_DEPLOYMENT_TARGET 16.4` and `PrivacyInfo.xcprivacy`.
- The Release simulator build with `-destination id=<udid> ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO` succeeded (1 min 40 s first, 1 min 6 s after a clean prebuild). `simctl create` (iPhone 17 Pro Max, iOS 26.5), `bootstatus -b`, `status_bar override`, `install`, `launch` and `io screenshot` all worked, and the screenshot showed the app with the variant values (plus a first-boot system banner on the new simulator).
- Build variants: a test build, then a store build **without** the Metro `cacheVersion` fix, produced a store bundle with `variant=test` and the debug module, both with `expo export` and with `expo export:embed` (the Xcode bundling phase). With `cacheVersion` keyed on the variant, back-to-back test → store → test exports were each correct. Gating by an imported constant kept the test-only module in the store bundle, while an inline comparison removed it. The `test-only.ts` pattern removed it too. In the Xcode Release simulator builds, `grep -a` found the sentinel once in the test `main.jsbundle` (Hermes bytecode v98) and zero times in the store one.
- Unsigned device archive (`generic/platform=iOS`, `CODE_SIGNING_ALLOWED=NO`): `ARCHIVE SUCCEEDED` in 66 s, and the archive's Info.plist carried the bundle ID, version and build number.
- `ios.enableSceneSupport: true` (expo-build-properties 57.0.22): prebuild wrote the scene manifest (`EXExpoAppSceneDelegate`), and the app built with Xcode 26.6 and launched on iOS 26.5.
- Both ExportOptions plists pass `plutil -lint`. Every key used is listed by `xcodebuild -help` (Xcode 26.6), and `manageAppVersionAndBuildNumber` defaults to YES.
- The JWT signer's output verified with Node `crypto.verify` (ieee-p1363) and independently with OpenSSL, using a throwaway P-256 key. The REST client against the live API with that throwaway key returned `401 NOT_AUTHORIZED`, parsed into `errors[0].code`. `findAppByBundleId` threw `App Store Connect answered 401 (NOT_AUTHORIZED)`. The endpoints in section 3.10 exist in Apple's documentation JSON, and so do the `filter[...]` parameters used.
- Every TypeScript snippet in this doc passes `tsc` 6.0.3 with the FINAL A.3 flags, Prettier 3.9.9 and the verified ESLint config (`review-qt-b/eslint.fixed.mjs`). The only errors were the documented file-level exemption (`test-only.ts` require) plus, in tooling, `fetch`, the URL literal and `Date.now`, which docs/04's Node-code block does not lint. Both unit-test files pass under Jest 29.7 (10 tests).
- Local facts: Xcode 27.0 (27A266a) is installed at `/Applications/Xcode.app` with its licence not accepted, while `xcode-select` points at Xcode 26.6. The login keychain is unlocked (`security show-keychain-info` exits 0). The keychains hold 1 Apple Development and 2 Apple Distribution identities. One `AuthKey_*.p8` exists with mode 600; it was checked with `stat` only and never read. `APPLE_TEAM_ID` is set, and `ASC_KEY_ID` / `ASC_ISSUER_ID` are not.
- `git check-ref-format` accepts `refs/tags/line-siege/v1.0.0+8` and `refs/tags/line-siege/v1.0.0`.

**Re-verified on 2026-09-26 by the reviewer** (copies under `scratchpad/rn/verify-stack-build/`): every TypeScript snippet, placed in the docs/04 tsconfig layout (Shell `types: ["jest"]` without `expo-env.d.ts`, root `["jest", "node"]` for `src/config`, tooling `["node", "jest"]`), passes `tsc` 6.0.3, Prettier 3.9.9 and docs/04's own `eslint.config.mjs` with only the documented `test-only.ts` exemption (the previous `src/config/test-only.ts` failed there: TS4111 and the import-extension rule); both test files pass under Jest 29.7; the variant matrix behaves as documented when `app.config.ts` runs under Node 26.4; the JWT verifies with a throwaway P-256 key; `npx expo export` test → store → test with `test-only.ts` in `src/app/`, `.ts` import extensions and a `"type": "module"` Shell kept the sentinel out of the store bundle only; `plutil` reads `EXConstants.bundle/app.config`; every `xcodebuild -exportOptionsPlist` key, `altool` option and `simctl status_bar` flag used here appears in the Xcode 26.6 help or man page.

**Integration pass (2026-09-26).** The two root-level tooling CLIs moved into area folders to follow docs/02 section 10: `asc-find-app.ts` is now `asc/print-app-record.ts` (its imports were already package self-references, so only the header and usage text changed), and `release-bump.ts` is `release/bump-build-number.ts`. Not re-run after the rename.

**Not run (needs the owner's key or account; the agent must not use the key outside a real release):** a signed archive, export, `--validate-app`, `--upload-package`, `--build-status`, `--beta-app-store-text`, any REST call with the real key, and the codesign entitlement check on a distribution-signed app.

---

## Open issues

1. **Metro cache defeats the variant mechanism (FINAL A.9).** "`APP_VARIANT` → `EXPO_PUBLIC_APP_VARIANT` (inlined; debug menu … compiled out of store builds)" is not safe on its own: Metro does not key its cache on `EXPO_PUBLIC_*` values, so a store build made after a test build silently ships test code (verified). Fixed here by `config.cacheVersion` in every app's `metro.config.js` (this doc owns the file; the new-game scaffold copies it) plus the store-artifact sentinel gate.
2. **"Compiled out" only works with an inline gate.** An imported `IS_TEST_BUILD` constant keeps test-only modules in the store bundle (verified). This doc makes `packages/shell/src/app/test-only.ts` the single gate; docs/04's config carries its one file-level exemption (`@typescript-eslint/no-require-imports`), resolved.
3. **The test-ad-ID grep in FINAL A.9 cannot run on the raw bundle.** `react-native-google-mobile-ads` ships its `TestIds` module (18 occurrences of `3940256099942544`) in every bundle, store builds included. The check must run on the source-mapped `expo export` output and exclude `node_modules/` (step 3), while the binary gate checks `GADApplicationIdentifier` and the sentinel instead.
4. **Env var names.** FINAL A.10 names "KEY_ID / ISSUER_ID / TEAM_ID" generically. This doc fixes them as `ASC_KEY_ID`, `ASC_ISSUER_ID` and `APPLE_TEAM_ID` (the last already exists on this Mac). Other docs must use the same names.
5. **Unverified release mechanics** (no owner key used): whether the API key alone can create the Apple Development certificate on this Mac; the altool upload JSON field that holds the delivery ID; whether `--build-status --wait` waits until `VALID`; the exact `--beta-app-store-text` folder layout for a build's `whatsNew` (use the REST fallback if unclear); whether `altool --list-apps` needs `--provider-public-id` with API-key auth (this doc uses the REST lookup); and the locked-keychain exit code of `security show-keychain-info`. Record each on the first real release.
6. **Xcode 27 is installed but unused.** Its licence needs `sudo`, a human step. Any change of `xcode-select` would silently switch every build to the iOS 27 SDK. The tooling's explicit `DEVELOPER_DIR` guards against that. Moving to Xcode 27 while on SDK 57 needs `enableSceneSupport` (verified to be harmless with Xcode 26.6).
7. **`MODULE_TYPELESS_PACKAGE_JSON` warning: resolved.** docs/04 gives the shell, tooling and game-kit packages `"type": "module"`. Verified by the reviewer: `npx expo config --type prebuild` prints no warning, `npx expo export` (test → store → test) strips the test-only module as before, and the Jest tests pass.
8. **FINAL A.9 "APP_VARIANT → EXPO_PUBLIC_APP_VARIANT" cannot happen inside `app.config.ts`.** Metro runs later, in the Xcode build phase, with its own environment. The scripts therefore export both variables (plus `ADS_MODE`) for the whole run, and `resolveBuildVariant` throws when they differ.
9. **Resolved: docs/04's `app-env.d.ts` has the `process` declaration**, and every app tsconfig includes the file (docs/04 section 2.2).
10. **No ready signal for store-variant simulator builds.** App code cannot write to the unified log (docs/04 bans `console`), and docs/15's perf log exists only in test builds. `build:ios:sim --variant store` therefore has nothing to wait for before its screenshot. Options: poll the accessibility tree with Maestro (`extendedWaitUntil` on `home.screen`), or accept a bounded wait for that one variant. Decide when the script is written.
