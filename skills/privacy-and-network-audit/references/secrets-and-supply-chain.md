# Secrets and supply chain

## Contents

- The App Store Connect key
- Rules for tokens and scripts
- Leak response (human)
- Supply-chain guards
- Banned SDKs and pods

## The App Store Connect key

| Item | Rule | Where it is enforced |
|---|---|---|
| Location | `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8`, mode `600`, outside the repo | the release preflight checks the mode with `stat -f %Sp` only, never reads the file |
| Identity | a team key with the Admin role, created by the owner | a human step |
| What tools receive | `ASC_KEY_ID`, `ASC_ISSUER_ID`, `APPLE_TEAM_ID` (in `~/.zshenv`, not the repo) | the release scripts |
| Who reads the key | only `packages/tooling/src/asc/asc-credentials.ts`, into memory, to sign a 15-minute ES256 JWT; `altool` reads it itself | code review + `audit-repo.mjs` |
| Agent file access | `permissions.deny` in `.claude/settings.json`: `Read(~/.appstoreconnect/**)`, `Read(**/*.p8)`, `Read(**/AuthKey_*)`, `Read(**/*.p12)`, `Read(**/*.mobileprovision)` | `audit-repo.mjs` (`deny-rules`) |
| Commits | `.gitignore` lists `*.p8`, `AuthKey_*`, `ApiKey_*`, `*.p12`, `*.mobileprovision`, `*.xcarchive`, `*.ipa`; the pre-commit `no-secrets` job refuses staged key or signing files even with `git add -f` | `audit-repo.mjs` (`gitignore-secrets`, `secret-file`, `private-key`) |

Never open, print, copy, move, commit or log the `.p8` key, and never print a JWT made from it. A leaked team key can publish apps.

`private-key` looks for PEM armour (five dashes, `BEGIN`, an optional `EC`/`RSA`/`ENCRYPTED`, `PRIVATE KEY`, five dashes) in every repo file, `skills/` included, so a key pasted anywhere is found; prose that only names the marker (a release checklist's `git grep`, a skill reference) is not reported.

## Rules for tokens and scripts

- Tokens are secrets too: never print the JWT, the `Authorization` header or a full request with headers; error messages from the App Store Connect client contain the API's error body only.
- Scripts that read the key never pass it on a command line or through an environment variable, and never write it to a temporary file.
- Claude Code's deny rules cover its own file tools and recognised shell file commands, not arbitrary child processes. That is intended (the release script must read the key), and it is why "only `asc-credentials.ts` reads the key" is the real guard.
- Real AdMob IDs are not secrets (they ship in every store build), but they live only in `game.config.ts` and reach the runtime only in live builds.

## Leak response (human)

Explain to the owner in plain words and wait for each step:

1. Revoke the key in App Store Connect -> Users and Access -> Integrations.
2. Create a new team key, replace the file (mode 600), update `ASC_KEY_ID` / `ASC_ISSUER_ID`.
3. Check history and reports: `git log -p -S "PRIVATE KEY-----"` and the `reports/` folder.

## Supply-chain guards

| Guard | Decision |
|---|---|
| Exact pins | every package exact, except the specifiers `npx expo install` writes for Expo-managed native modules |
| Lockfile | `package-lock.json` committed; `npm ci` in CI and for fresh clones |
| Release-age cooldown | `.npmrc` `min-release-age=7`, dated exclude blocks with an expiry |
| Install scripts | approved one package at a time (`npm approve-scripts`); the check passes only when `npm approve-scripts --allow-scripts-pending` prints "No packages with unreviewed install scripts." |
| Licences | `npm run audit:licenses` checks exactly the npm packages that ship in the release bundles (MIT, BSD, Apache-2.0, ISC, 0BSD, OFL, CC0; for `OR` one allowed side is enough) |
| Banned npm packages | `banned-packages.ts` (template in `templates/tooling-deps/src/deps/`), run inside `audit:network` and by this skill's `audit-repo.mjs` |
| Vendor pods | the trunk allowlist of exactly three pods (layer D) |
| Freshness | `npx expo install --check` and `npx expo-doctor` in verify; a monthly dependency pass |

Why the licence audit reads the bundle, not the lockfile: in the SDK 57 test app the 27 shipped npm packages were all MIT, Apache-2.0 or ISC, while the lockfile's production closure also held build-time packages under MPL-2.0, Unlicense, Python-2.0, CC-BY-4.0 and GPL-dual licences (`lightningcss`, `big-integer`, `argparse`, `caniuse-lite`, `node-forge`) that never ship. Pinning, cooldowns and install scripts are owned by the dependency work; this skill only checks that nothing banned or network-capable slips in.

## Banned SDKs and pods

None may appear in `Podfile.lock`, `package-lock.json` or a config plugin list. Layer D fails on any trunk pod outside the allowlist anyway; this table names the usual suspects so a failure is recognised at once:

| SDK family | Example pods / packages | Why |
|---|---|---|
| Firebase / Google Analytics | `Firebase*`, `GoogleAppMeasurement`, `@react-native-firebase/*` | backend + analytics (N2); AdMob does not need Firebase |
| Crash reporting | `Sentry`, `Bugsnag`, `Crashlytics`, `@sentry/*` | N2 |
| Attribution / analytics | `Adjust`, `AppsFlyerFramework`, `Branch`, `Amplitude`, `Mixpanel`, `Segment` | N2 |
| Purchase servers | `RevenueCat` / `PurchasesHybridCommon`, `react-native-purchases` | N2 (receipts on their servers) |
| Push | `OneSignal`, `expo-notifications` | spec 14 (no push) |
| Alternative billing | `OnsideKit` (from expo-iap's Onside switches) | N2/N3 |
| Facebook | `FBSDKCoreKit`, `FBAudienceNetwork` | N2/N3 |
| Mediation adapters | `GoogleMobileAdsMediation*` | each adds another ad network's SDK; needs an owner decision first |
| OTA and dev tools | `expo-updates`, `expo-dev-client` | network components |
| Online detection | `@react-native-community/netinfo` | its default reachability probe fetches `clients3.google.com` from our bundle; use `expo-network` (NWPathMonitor, no HTTP probe) behind ConnectivityPort |
| Web views | `react-native-webview`, `expo-web-browser` | network surfaces |
| HTTP clients (direct) | `axios`, `ky`, `got`, `node-fetch`, `cross-fetch` | N3 |

The machine-readable list is `assets/privacy-facts.json` (`bannedPackages`, `bannedPodFamilies`, `bannedImports`). Not banned since owner decision O1 (2026-09-30): `expo-tracking-transparency`, Apple's App Tracking Transparency prompt, a system wrapper with no network code (`systemWrappers`), which only `packages/shell/src/services/consent/admob-consent-adapter.ts` may import (`restrictedImports`; the lint config says the same). It is pinned like every Expo package (the SDK 57 version from `npx expo install`, 57.0.2 on 2026-09-30).
