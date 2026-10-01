---
name: privacy-and-network-audit
description: Proves Pocket Arcade code makes no network requests (N3) - banned SDKs and pods, bundle/runtime checks, privacy manifest, App Privacy answers, key safety, release audit. Use when native code lands, a release is near, or audit:network fails. Not for installing packages (dependency-management).
---

# Privacy and network audit

Proves the privacy promise of every game: our own code makes no network requests, only the AdMob and StoreKit components can go online, the iOS privacy manifest declares what the SDKs use, no key or test artefact ever ships, and four scripts show it on the repo, the bundle, the pods and the built app.

## Rules that must hold

1. **Our code never calls `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or `sendBeacon`, and holds no `http(s)://`, `ws(s)://` or `ftp://` literal** except the OS hand-off links in `packages/shell/src/config/external-links.ts`. *Why:* spec N3; remote images, fonts and downloads make requests without `fetch`.
2. **Exactly two network-capable components:** `react-native-google-mobile-ads` and `expo-iap`, each imported only by its adapter (`packages/shell/src/services/*/*-adapter.ts`, like `expo-network`). *Why:* the allowlist stays at two, and a vendor SDK cannot leak into a screen.
3. **No first-party module may appear in the bundle's network findings;** every third-party finding needs a baseline entry with categories and a reason, committed with a `Gate-Change:` trailer and the owner's approval. *Why:* our code is exactly what N3 forbids; baselines are gate files.
4. **Only three pods may come from the CocoaPods trunk: `Google-Mobile-Ads-SDK`, `GoogleUserMessagingPlatform`, `openiap`.** *Why:* a binary SDK bypasses every source-level layer.
5. **No banned SDK anywhere** (OTA updates, dev client, NetInfo, analytics, crash reporting, attribution, purchase servers, push, web views, HTTP clients, Facebook, mediation), **`updates.enabled: false`, no `NSAllowsArbitraryLoads`, no expo-iap plugin options or Onside switches.** *Why:* each one adds a network path or a server (spec N2/N3).
6. **App Tracking Transparency, as Apple's guideline 5.1.2(i) asks (owner decision O1, 2026-09-30):** `expo-tracking-transparency` is a no-network system wrapper, imported only by `packages/shell/src/services/consent/admob-consent-adapter.ts`; with ads enabled the tracking prompt text exists once (the plugin's `userTrackingPermission` in `shell-plugins.ts`, `withShell`'s localized `NSUserTrackingUsageDescription`, the four catalogs' `consent.tracking.usage-description`), the AdMob plugin's `userTrackingUsageDescription` stays unset, and every built app carries the text in `Info.plist` and in en, de, fa and ckb. *Why:* Apple requires the prompt before tracking and kills an app that asks without the text; one source keeps every language and game on the same reviewed words.
7. **Declare every required-reason API any pod declares in `PRIVACY_MANIFESTS` (through `withShell`), with `NSPrivacyTracking: false` and no `NSPrivacyTrackingDomains`; only Google's ad pods may declare tracking.** *Why:* Apple does not reliably read static pods' manifests; our code tracks nothing, and listed domains are blocked for players who decline ATT, which would stop their ads; a tracking pod means an analytics SDK slipped in.
8. **The App Privacy answers match the aggregated SDK manifests: Device ID is collected, linked to the user and used for tracking by the third-party ads SDK (Google Mobile Ads), and the app asks ATT first.** *Why:* Apple builds its privacy report from the manifests, and Google makes the developer responsible for the match.
9. **Never open, print, copy, move, commit or log the `.p8` key or a JWT made from it;** `.gitignore` and the Claude Code deny rules cover key and signing files. *Why:* a leaked team key can publish apps.
10. **Test builds install the JS network guard; E2E asserts "network attempts: 0" and samples the app's sockets.** Store builds never contain the guard. *Why:* the runtime layer catches what static layers miss.
11. **A store build ships only after the release audit passes:** no test-only sentinel, no sample ad IDs outside the AdMob library, a live `GADApplicationIdentifier`, the right `expo.extra`, no `*.storekit`, `*.xctest` or `get-task-allow`, a `PrivacyInfo.xcprivacy`. *Why:* spec S15 and 8.8; mixed variants happen silently.
12. **Fix findings, never the audit:** never loosen a baseline, an allowlist, a lint rule or a checker to get green. Stop and ask the owner for any baseline or allowlist change.

## Workflow

1. Read [references/n3-layers.md](references/n3-layers.md) for what each layer catches.
2. If the audit tooling is missing, copy `templates/packages/tooling/src/audit/`, `templates/packages/tooling/network-audit/`, `templates/packages/shell/src/config/privacy-manifest.ts` and `templates/packages/shell/src/screens/debug/network-guard.ts` (+ tests) into the repo, and `templates/tooling-deps/` into `packages/tooling/` where those files are missing (`banned-packages.ts`, `audit-licenses.ts`). Wire `ios.privacyManifests: PRIVACY_MANIFESTS` in `withShell`, the three `audit:*` npm scripts, and the guard: the test-only entry exports `installNetworkGuard`, and e2e-maestro's `createDebugParts` installs it first in test builds. Run their Jest tests and `npx prettier --check packages/tooling`. This tooling lands before the first simulator build: `npm run build:ios:sim` runs `audit:privacy` after every prebuild and stops before the prebuild when `packages/tooling/src/audit/audit-privacy.ts` is missing.
3. Run `node ${CLAUDE_SKILL_DIR}/scripts/audit-repo.mjs .` before every push and after any dependency, config or native change. Fix each `FAIL` (file, rule, fix) and rerun until `RESULT: PASS`.
4. After a native install or an SDK upgrade: `npx expo prebuild --platform ios --clean`, then `node ${CLAUDE_SKILL_DIR}/scripts/audit-privacy-manifest.mjs .` (and `npm run audit:privacy`). Add missing reasons to `privacy-manifest.ts`, prebuild again. Read [references/privacy-manifest-and-labels.md](references/privacy-manifest-and-labels.md) for the App Privacy input and the App Tracking Transparency decision with its sources.
5. Run `npm run audit:network` (all apps), then `node ${CLAUDE_SKILL_DIR}/scripts/audit-bundle.mjs --export dist-audit/<game-id> .`. A `NEW` finding: find why the package can connect; baseline it only when unused and unreachable, with a reason, a `Gate-Change:` trailer and the owner's approval. A crash (`ENOENT ... apps/<game>/node_modules/react-native`, or a scandir error under `ios/Pods`) means an old copy of `network-native-layer.ts`: copy the template again (layer C in the n3 reference).
6. Layer F: make sure the E2E smoke flow ends with "network attempts: 0" and the socket sampler report is empty (Release, test variant, `ADS_MODE=off`).
7. For a release, follow [references/release-audit.md](references/release-audit.md): the store export through `audit-bundle.mjs`, then the unzipped IPA through `node ${CLAUDE_SKILL_DIR}/scripts/audit-app-bundle.mjs --app <Payload/App.app> --variant store --ads-mode live --game <game-id>`. A keyless rehearsal on an archive built with `CODE_SIGNING_ALLOWED=NO` adds `--unsigned` (it prints `REHEARSAL: not a release gate` and is never release evidence).
8. Check secrets hygiene with [references/secrets-and-supply-chain.md](references/secrets-and-supply-chain.md) (key location and mode, deny rules, `.gitignore`); on any leak, stop and walk the owner through the leak response.
9. Report to the owner in plain words (model: [examples/audit-run.md](examples/audit-run.md)): what passed, any baseline change waiting for approval, and the App Privacy input.

## Definition of done

- [ ] The audit tooling, baselines, `privacy-manifest.ts` and the network guard are in place (before the first simulator build), wired, Prettier-clean, and their Jest tests pass.
- [ ] Lint is clean with the N3 rules; `npm run audit:network` passes for every app (no first-party hit, no unexplained NEW finding, the three trunk pods only, no config problem, no banned package).
- [ ] After the latest prebuild the privacy manifest declares every pod reason, the app's own manifest declares no tracking and no tracking domains, only Google's pods declare tracking, and the App Privacy answers match (Device ID used for tracking by the ads SDK, ATT asked first).
- [ ] With ads enabled, the ATT plugin, the localized text and the four catalog strings are in place (`audit-repo` rule `att-config`), and the built app carries the text in every language (`audit-app-bundle` rule `att-string`).
- [ ] E2E shows "network attempts: 0" and no non-loopback socket.
- [ ] Store build: `audit-bundle.mjs` and `audit-app-bundle.mjs --variant store --ads-mode live --game <game-id>` pass (no `com.example.*` id, no placeholder AdMob id or unit, no example.com link); test build: `--variant test --ads-mode test` passes.
- [ ] No key material in the repo, logs or reports; every baseline or allowlist change has a `Gate-Change:` trailer and the owner's approval.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/audit-repo.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **Baselining a first-party finding or adding a pod to the allowlist "to unblock the release".** Remove the code or the SDK; allowlist changes are the owner's call.
- **Grepping the raw bundle for the sample ad ID.** The AdMob library's `TestIds` is in every bundle; use the source-mapped export (`audit-bundle.mjs`).
- **Installing `@react-native-community/netinfo` for online detection.** Its reachability probe fetches Google; use `expo-network` behind ConnectivityPort.
- **Loading a remote image, font or JSON "just once".** Draw it in code or bundle it.
- **Editing `ios/` (PrivacyInfo, Info.plist) by hand.** Prebuild overwrites it; change `privacy-manifest.ts` or the config plugin.
- **Answering App Privacy with "no data collected", or Device ID "not used for tracking".** The ads SDK collects data and uses Device ID for tracking; take the table from the audit output, and keep the app's own `NSPrivacyTracking: false` (Google's pods declare their tracking).
- **Listing Google's domains in `NSPrivacyTrackingDomains` "to be safe".** iOS then blocks those requests for every player who declines ATT, and their ads stop; the app's own manifest lists none.
- **Asking ATT from a screen, a hook or a second plugin.** Only the consent adapter asks (after Google's form, never with ads off), and only `expo-tracking-transparency`'s plugin sets the text.
- **Printing the JWT or a request with its headers while debugging the App Store Connect client.** Log the error body only.
- **Running layer F on a Debug build.** Metro's WebSocket makes it fail; use a Release build.
- **Checking only the variables at prebuild.** Export `APP_VARIANT`, `EXPO_PUBLIC_APP_VARIANT` and `ADS_MODE` for the whole build, and let `audit-app-bundle.mjs` confirm what shipped.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/n3-layers.md](references/n3-layers.md) | The promise, the six layers, lint entries, bundle/native/pods/config layers, the runner, the runtime guard and sampler, baselines | Workflow step 1, and on any NEW or STALE finding |
| [references/privacy-manifest-and-labels.md](references/privacy-manifest-and-labels.md) | Why and how the manifest is aggregated, `PRIVACY_MANIFESTS`, the App Privacy table, the App Tracking Transparency decision (O1) with Apple's and Google's sources | Workflow step 4, and at the store step |
| [references/secrets-and-supply-chain.md](references/secrets-and-supply-chain.md) | The `.p8` key rules, deny rules, leak response, supply-chain guards, banned SDKs and pods | Workflow step 8, and before adding any package |
| [references/release-audit.md](references/release-audit.md) | The two halves of the release audit, what is checked where, commands, test builds, checklist | Workflow step 7 |
| [examples/audit-run.md](examples/audit-run.md) | A complete audit run with outputs, a NEW finding handled, and the owner report | Workflow step 9, as the model |
| `templates/packages/tooling/src/audit/` | `audit-network.ts` and its layers (bundle modules, JS with the one external-links exemption, native with hoisting-aware roots and no symlink walk, pods, config, baseline), release bundle checks, runtime layer and sampler (these three synced from the library, identical to e2e-maestro's copies; do not edit them here), `audit-privacy.ts` + `privacy-manifest.ts`, with tests | Workflow step 2 |
| `templates/packages/tooling/network-audit/` | Starting `js-baseline.json` (12 packages) and `native-baseline.json` with reasons, Prettier-formatted | Workflow step 2 |
| `templates/packages/shell/src/config/privacy-manifest.ts` | `PRIVACY_MANIFESTS` (four verified reasons, `NSPrivacyTracking: false`, no tracking domains) | Workflow steps 2 and 4 |
| `templates/packages/shell/src/screens/debug/` | The test-only JS network guard and its test (synced from the library, identical to e2e-maestro's copy; do not edit here) | Workflow step 2 |
| `templates/tooling-deps/` | `banned-packages.ts`, `audit-licenses.ts`, licence policy, clock and deps checks with tests (synced from the library; do not edit here) | Workflow step 2, when they are missing |
| `assets/privacy-facts.json` | Allowed components, adapter pattern, pod allowlist, banned imports/packages/pods, required reasons, secrets patterns, deny rules, npm scripts, release facts | Read by the scripts; change only with the owner |
| `scripts/audit-repo.mjs` | Static audit: layer A (calls, aliased network globals, URLs, imports; `expo-tracking-transparency` only in the consent adapter), banned packages, layer E, the ATT config (`att-config`), layer D, privacy-manifest config, tooling wiring, secrets | Workflow step 3, before every push |
| `scripts/audit-bundle.mjs` | Layer B + JS release checks on an `expo export` with its source map | Workflow steps 5 and 7 |
| `scripts/audit-privacy-manifest.mjs` | Pod manifests vs `privacy-manifest.ts`, the app's own tracking and tracking domains, tracking pods, prebuilt manifest, App Privacy input with the tracking answer | Workflow step 4 |
| `scripts/audit-app-bundle.mjs` | Binary release checks on a built `.app`: ad app id and units (never a placeholder), expo.extra, app id, links, the tracking text in every language, test code, artefacts, `get-task-allow` (`--unsigned`: a rehearsal SKIP), privacy manifest, ATS; exports `PLACEHOLDERS` | Workflow step 7 |
| `scripts/check-template-format.mjs` | Every `.ts`/`.tsx`/`.json` template is in the repo's Prettier format (pinned Prettier, `assets/prettierrc.json`) | Run by the self-test; after editing a template |
| `scripts/package.json` | The pinned Prettier (3.9.9, the repo's pin) for `check-template-format.mjs` | Once per machine: `npm ci --prefix ${CLAUDE_SKILL_DIR}/scripts` |
| `scripts/package-lock.json` | Lockfile for that `npm ci` | Never by hand |
| `scripts/.gitignore` | Keeps `scripts/node_modules/` out of git | Never by hand |
| `scripts/lib/repo-scan.mjs` | File listing and import parsing helpers | Read only to change a script |
| `scripts/lib/plist.mjs` | XML plist parser (binary plists through `plutil`) | Read only to change a script |
| `scripts/lib/assemble-fixtures.mjs` | Builds each self-test case (`good`, `bad-*`, `pass-*`, `error-*`) from its base + `mutation.json` | Read only to add a self-test case |
| `scripts/lib/ship-placeholders.mjs` | The scaffold placeholders the ship gates refuse by name and the io.applander app id rule (synced from the library; do not edit here) | Read only to change a script |
| `scripts/lib/tracking-text.mjs` | Reads `NSUserTrackingUsageDescription` from `Info.plist` and each `.lproj/InfoPlist.strings` (synced from the library; do not edit here) | Read only to change a script |
| `scripts/selftest.mjs` | Pins `PLACEHOLDERS`, then proves the five scripts on clean bases, pass cases and planted problems, and that every template is Prettier-formatted (needs the `npm ci` above) | After changing a script, a template or a fixture |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/prettierrc.json` | The repo's `.prettierrc.json` (synced from the library; do not edit here) | Read by `check-template-format.mjs` |
| `assets/shared.json` | Declares the shared files copied into this skill | When adding a shared file |
| `tests/fixtures/` | Bases (`base-repo/`, `base-bundle/`, `base-pods/`, `base-app/`) and one `mutation.json` + `EXPECT.txt` (+ `ARGS.txt`) per case; `check-template-format/` mutates the real templates | When adding a rule |

## Related skills

- `admob-ads` - the ads SDK, its adapter and its privacy facts.
- `premium-purchase` - expo-iap, its banned server APIs and the StoreKit harness.
- `dependency-management` - pins, release age, install scripts and licences.
- `typescript-and-lint-rules` - the lint config that holds layer A.
- `e2e-maestro` - the smoke flow and socket sampler run of layer F.
- `ios-release-testflight` - archive, export, the store-artifact gate and the App Privacy human step.
- `quality-gates` - where `audit:network` and `audit:privacy` run in verify and release.
- `git-commits-and-reporting` - the `Gate-Change:` trailer and the owner report.
