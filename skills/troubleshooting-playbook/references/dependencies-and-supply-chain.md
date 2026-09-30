# Dependencies and supply chain

Failures while installing, pinning or upgrading packages, and packages that must never be installed. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- Pinning
- Install scripts
- Held-back majors
- Packages
- Banned
- knip
- Overrides
- Expo

## Pinning

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `deps-release-age-etarget` | npm install fails with ETARGET for a pinned version | min-release-age=7 refuses versions younger than 7 days; the chosen stack was younger than that on 2026-09-26 | A dated min-release-age-exclude block (expires 2026-10-03, enforced by check-deps.ts); after that date delete it, never extend it | verified | `dependency-management` |
| `deps-expo-install-range` | npx expo install writes ~57.0.3 (or ^17.2.0) despite save-exact=true | expo install writes the SDK range; third-party packages get a caret | Keep Expo-managed ranges as expo install writes them; change caret pins of other packages (AdMob, expo-iap, audio-api) to exact versions | verified | `dependency-management` |
| `deps-npmrc-release-age-override` | A package younger than 7 days installs although .npmrc sets min-release-age=7 | npm keeps the last value, so a later min-release-age=0 switches the policy off; min-release-age-exclude = x (no [], spaces) is also honoured by npm 11.17 | One min-release-age line; exceptions only in the dated exclude block as min-release-age-exclude[]=<pkg>@<version>; check-deps.ts in npm run verify catches both loopholes | verified | `dependency-management` |
| `deps-typescript-eslint-two-copies` | The first npm run -s check:fast or lint crashes: ConfigError: Config "UserConfig[0][4] > typescript-eslint/base": Key "plugins": Cannot redefine plugin "@typescript-eslint". | Two copies of @typescript-eslint/eslint-plugin: a fresh install resolved eslint-config-expo's caret range (^8.59.0) to a newer release (8.71.0, one day old) while typescript-eslint 8.70.1 nested its own 8.70.1, and both register the plugin name | Root overrides pin all ten @typescript-eslint/* packages (eslint-plugin, parser, project-service, scope-manager, tsconfig-utils, type-utils, types, typescript-estree, utils, visitor-keys) at the typescript-eslint pin 8.70.1; npm install; npm ls @typescript-eslint/eslint-plugin shows one version. check-deps-policy fails while the lockfile holds two versions of a versions-table package | verified | `dependency-management` |
| `deps-expo-patch-younger-than-7-days` | verify turns red with no change in the repo: expo install --check prints "expo@57.0.25 - expected version: ~57.0.26" or expo-doctor fails "Patch version mismatches" | Expo published a patch release less than 7 days ago; the fix the tools print (install it) is refused by the release-age rule (min-release-age=7) | Use the current check-deps.ts (dependency-management): it reads the publish time with npm view <pkg> time and prints "WARN ... min-release-age=7 refuses it until <due date>" instead of failing. On the due date run npx expo install <pkg>@~<version> in every app and move its versions-table row and any root override in the same commit; from that date the mismatch fails. Never add an exclude block or skip the step | verified | `dependency-management` |

## Install scripts

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `deps-approve-scripts-exit` | npm approve-scripts --allow-scripts-pending exits 0 even with unreviewed scripts | The command reports but never fails | Fail unless its output says "No packages with unreviewed install scripts." | verified | `dependency-management` |
| `deps-skia-postinstall` | Skia 2.6.2 install needs an approved postinstall script | Skia had a postinstall until 2.6.5 (SDK 58 pins 2.11.2 without it) | Approve it on SDK 57 after reading it; drop the approval after the SDK 58 upgrade | verified | `dependency-management` |
| `deps-lefthook-postinstall` | npm flags lefthook's postinstall as an unreviewed install script | npm's allowScripts is advisory now and will block later | Use "prepare": "lefthook install" so installation is explicit | verified | `quality-gates` |
| `deps-approve-scripts-conflict` | Re-running the bootstrap scaffold reports package.json as a conflict after npm install | npm approve-scripts adds an allowScripts block to package.json | Use the current scaffold: an allowScripts-only difference counts as unchanged | verified | `monorepo-bootstrap` |
| `deps-fsevents-install-script` | fsevents@2.3.3 appears as a pending install script (npm approve-scripts / allowScripts) after an install | An optional macOS file-watcher dependency of jest-haste-map (through jest) ships a node-gyp rebuild install script; npm explain fsevents shows the path | Approve it like the other known install scripts (it is expected and never ships in the app), then rerun check-deps-policy | verified | `dependency-management` |

## Held-back majors

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `deps-eslint-10-crash` | ESLint 10: contextOrFilename.getFilename is not a function (eslint-plugin-react) | eslint-config-expo 57 pulls eslint-plugin-react 7.37.x and eslint-plugin-import 2.32 whose peers stop at ESLint 9 | Pin eslint 9.39.5; move only when eslint-config-expo ships an ESLint-10-ready eslint-plugin-react (PR #4022) | verified | `dependency-management` |
| `deps-typescript-7` | TypeScript 7 installed: typescript-eslint and tools break | TS 7.0 ships no API; typescript-eslint peers typescript <6.1.0; Expo pins ~6.0.3 | Stay on TypeScript ~6.0.3 until typescript-eslint supports TS 7 and Expo lists it | verified | `dependency-management` |
| `deps-test-renderer-1-3` | Component tests fail oddly, or check-test-setup reports test-dep-missing or test-renderer-line, after installing @testing-library/react-native alone | npm's automatic peer install picks test-renderer 1.3.0, which targets React 19.3 and SDK 58; SDK 57 is React 19.2. RNTL 14.0.1's companion is test-renderer 1.2.0 | Install both in one command: npm install --save-dev --save-exact @testing-library/react-native@14.0.1 test-renderer@1.2.0 (unit-and-component-tests' package.test-deps.json; plan-dependency prints the companion pin); npm ls test-renderer shows 1.2.0 | verified | `unit-and-component-tests` |
| `deps-jest-30` | Jest 30 breaks the jest-expo preset | jest-expo 57 depends on Jest 29 packages; SDK 57 and 58 pin jest ~29.7.0 | Stay on Jest 29.7 until jest-expo for the SDK depends on Jest 30 | documented | `dependency-management` |
| `deps-rngh-legacy-tag` | npm offers react-native-gesture-handler 2.33.0 (legacy tag) | It is outside Expo SDK 57's ~2.32.0 range | Stay on 2.32.x through npx expo install | documented | `dependency-management` |
| `deps-hand-installed-rn` | npm latest react / react-native differ from the SDK pins (react 19.3, react-native 0.87) | Only the Expo SDK decides React and React Native versions | Never install either by hand; npx expo install --fix | verified | `dependency-management` |
| `deps-rn-plugin-stale` | eslint-plugin-react-native blocks an ESLint upgrade | It has had no release since December 2024 and caps its peer range at ESLint 9 | Drop the plugin when it blocks an upgrade; its rules are nice-to-have | documented | `dependency-management` |

## Packages

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `deps-audio-api-pinning` | react-native-audio-api behaves differently after a minor bump, or npx expo install picks no version | It is pre-1.0 (0.x minors break) and not in Expo's bundledNativeModules | Pin the exact version (0.13.6), read release notes on every bump, override its plugin defaults (iosBackgroundMode false, no Android foreground service, disableFFmpeg, disableStaticExternalLibs) | verified | `game-audio-and-haptics` |
| `deps-fresh-packages` | A just-published package (hours or days old) breaks after install | expo-iap 5.8.0, openiap-apple 3.6.0 and AdMob 17.2.0 were hours to a day old when chosen | Respect the 7-day release age; pin exactly; gate risky ones on their test tiers; keep a rollback version noted (AdMob 16.5.0, expo-iap 5.6.3) | documented | `dependency-management` |
| `deps-npm-audit-fix` | npm install prints "N moderate severity vulnerabilities" (23 on 2026-09-30; the count drifts) and suggests npm audit fix | The advisories are in build tooling (uuid through Expo config plugins, qs through Stryker); none of it ships in the app, and npm audit is not a gate | Never run npm audit fix (with --force it moves expo off SDK 57); review advisories with dependency-management | verified | `dependency-management` |

## Banned

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `deps-netinfo-probe` | @react-native-community/netinfo makes an HTTP request to clients3.google.com from our bundle | Its default reachability config fetches generate_204 whenever the native layer gives no boolean | Ban NetInfo; online detection is expo-network (NWPathMonitor, no HTTP) behind ConnectivityPort | verified | `privacy-and-network-audit` |
| `deps-network-packages` | A dependency adds a server, telemetry or OTA updates (expo-updates, expo-dev-client, expo-insights, expo-observe, @sentry/*, @react-native-firebase/*, react-native-purchases, react-native-webview) | Each is one install away and breaks the no-network promise | Keep them banned (check-deps and audit:network fail on them); updates.enabled false | verified | `privacy-and-network-audit` |
| `deps-expo-iap-servers` | expo-iap config adds OnsideKit or IAPKit servers | The plugin options modules.onside / ios.onside.enabled and iapkitApiKey pull network code | Use a bare expo-iap plugin entry; never kitApi or verifyPurchaseWithProvider | verified | `premium-purchase` |
| `deps-expo-audio` | expo-audio installed for sound effects | Its plugin defaults enable Android recording and background playback, and its iOS player is AVPlayer-based (latency) | Use react-native-audio-api with synthesized buffers; do not install expo-audio | verified | `game-audio-and-haptics` |
| `deps-svg-and-flashlist` | react-native-svg or @shopify/flash-list appears in a package.json | react-native-svg adds a native pod and a fetch-based SvgUri; FlashList is not needed (benchmarked) | Icons are Skia paths and lists are ScrollView/FlatList; keep both out (the import ban already rejects them; add them to the banned-package list) | documented | `dependency-management` |

## knip

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `deps-knip-expo-updates` | knip reports "expo-updates unlisted" | knip's Expo plugin expects expo-updates unless updates.enabled is false | Set expo.updates.enabled = false (withShell does) | verified | `quality-gates` |
| `deps-knip-root-deps` | knip reports babel-jest or @stryker-mutator/core as unlisted | jest.sim.config.js and Stryker use them from the root | List them as root devDependencies; handle app-installed native libraries used by jest.setup.ts with ignoreDependencies | verified | `quality-gates` |
| `deps-knip-plugin-only` | knip reports a package as unused although the app needs it | The package is used only through an app.config.ts plugin entry or native code | Check first that the package is really used (an app.config.ts plugin entry or native code). Then add it to the app's ignoreDependencies only with the owner's agreement, a Gate-Change: trailer and its reason in quality-gates' root-files reference (knip.json cannot hold comments; check-gate-wiring fails an undocumented entry as knip-ignores) | documented | `quality-gates` |
| `deps-knip-skills-folder` | knip reports hundreds of "Unlisted dependencies" (477) in a repo that holds skills/ | knip's Jest plugin falls back to test patterns anywhere in the repo, so it reads skill templates and fixtures | Add "ignore": ["skills/**"] to knip.json and quality-gates.json (never a wider ignore); check-monorepo requires it | verified | `monorepo-bootstrap` |
| `deps-knip-peer-counts-as-use` | An unused app-wide native module is never reported by knip | The Shell's peerDependencies entry counts as a use for knip | Rely on dependency-management's unused-dependency rule (it checks imports); react-native-screens and react-native-safe-area-context count as used through React Navigation | verified | `dependency-management` |
| `deps-knip-formatjs-cli` | knip reports "Unused devDependencies: @formatjs/cli package.json" | packages/tooling/src/i18n/verify-catalogs.ts runs the formatjs verify command through npx; knip sees no import of the package | Keep the devDependency; the knip.json template lists @formatjs/cli in the root ignoreDependencies (copy knip.json from quality-gates' templates, the reason is in its root-files reference) | verified | `quality-gates` |
| `deps-knip-root-mocks` | knip reports "Unlisted dependencies: expo-iap/build/types.js __mocks__/expo-iap.ts" and "react-native-audio-api __mocks__/react-native-audio-api.ts" | The root __mocks__ (unit-and-component-tests, game-audio-and-haptics) import the real libraries' types and helpers; the apps install those libraries, the root does not | Never add them as root dependencies: the knip.json template lists expo-iap and react-native-audio-api in the root ignoreDependencies, next to Skia, Gesture Handler, Reanimated and Worklets (copy knip.json from quality-gates' templates) | verified | `quality-gates` |
| `deps-knip-unlisted-binaries` | knip reports "Unlisted binaries" pgrep, plutil, sqlite3 and footprint in packages/tooling/src/{audit,build,e2e}/*.ts | The tooling templates start macOS system tools by name (simulator helper, build script, runtime network audit, privacy manifest audit, simulator perf steps); they are not npm packages and can never be listed | The knip.json template has the top-level "ignoreBinaries": ["footprint", "pgrep", "plutil", "sqlite3"] (copy it from quality-gates' templates). Any other unlisted binary is a real finding: install the tool as a devDependency or stop calling it; a new ignore entry needs the owner and a Gate-Change: trailer (check-gate-wiring rule knip-ignores) | verified | `quality-gates` |
| `deps-knip-test-only-exports` | knip reports "Unused exports" in packages/shell/src/app/test-only-entry.ts (createDebugServices, TEST_BUILD_SENTINEL, readParityRequest ...) or in packages/shell/src/app/parity/ | Those exports are reached only through the require() in app/test-only.ts, which knip does not follow; includeEntryExports is on for the Shell, so adding the file as an entry does not help | Tag each export that only the test build reaches with /** @public */, which knip honours (ios-simulator-build's test-only-entry.ts template does; tag the parity harness exports it re-exports the same way); never add the file to knip's ignore | verified | `ios-simulator-build` |
| `deps-knip-later-screen-exports` | knip reports "Unused exports" that only a screen not built yet uses (useIsTestBuild, useStatsSummary, selectLevels, selectCanShowUpsell, DialogKind, EMPTY_FX) | A partial Shell: the templates of a layer land before the screens that read them | Declare the slice in shell-slice.json ({ "screens": [...], "why": "..." }); npm run verify then runs knip without its export and type kinds and prints SKIP shell-slice.json [knip-exports]. Build the screen or delete the export before the file is deleted; never tag such an export @public | verified | `quality-gates` |

## Overrides

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `deps-duplicate-native-peer` | npx expo-doctor prints "Found duplicates for react-native-screens" (or another native module), or check-sdk-alignment fails duplicate-native / check-deps-policy fails peer-override | The Shell declares the native module as a "*" peer, so npm put its newest release at the root next to the version the apps install (for example react-native-screens 4.28.0 beside 4.26.2) | Add a root override pinned at the version the apps install (npm ls <pkg> shows it; dependency-management's plan-dependency prints it), npm install, then npm ls <pkg> shows one copy | verified | `dependency-management` |

## Expo

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `deps-expo-same-day-patch` | check-deps-policy fails expo-spec or table-version: expo-constants is "~57.0.20" after npx expo install, while the versions table says ~57.0.19 | A bare npx expo install takes a same-day patch from Expo's online versions list | Install with the table spec: (cd apps/<id> && npx expo install <pkg>@<table spec>) (plan-dependency.mjs prints it); the newer patch stays a WARN with its due date until it is 7 days old | verified | `dependency-management` |
