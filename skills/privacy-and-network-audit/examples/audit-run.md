# Worked example: the N3 audit before Line Siege's first release

The order Claude follows, with the output it expects and what it does with a finding.

## 1. Static audit of the repo (any time, and before every push)

```sh
node ${CLAUDE_SKILL_DIR}/scripts/audit-repo.mjs .
```

```text
audit-repo: 214 source files checked, 0 problems
RESULT: PASS
```

A typical failure and its fix:

```text
FAIL packages/shell/src/screens/home/home-logo.tsx:12 [remote-url] remote URL https://cdn.example.com/logo.png Fix: Remote images, fonts and downloads make requests too; ...
```

The logo is drawn in code instead (no image URL), and the check is rerun.

## 2. Prebuild, then the privacy manifest

```sh
cd apps/line-siege && npx expo prebuild --platform ios --clean && cd ../..
node ${CLAUDE_SKILL_DIR}/scripts/audit-privacy-manifest.mjs .
```

```text
apps/line-siege: 31 pod manifests
  required NSPrivacyAccessedAPICategoryDiskSpace: E174.1
  required NSPrivacyAccessedAPICategoryFileTimestamp: 0A2A.1, C617.1
  required NSPrivacyAccessedAPICategorySystemBootTime: 35F9.1
  required NSPrivacyAccessedAPICategoryUserDefaults: CA92.1
  collected Google-Mobile-Ads-SDK: DeviceID linked=true tracking=true
  ...
  App Privacy: DeviceID collected, linked to the user, used for tracking by the third-party ads SDK Google-Mobile-Ads-SDK (the app asks App Tracking Transparency first)
FAIL packages/shell/src/config/privacy-manifest.ts [missing-reason] NSPrivacyAccessedAPICategoryFileTimestamp 0A2A.1 is declared by pod ExampleSqlitePod but not by the app Fix: Add it to PRIVACY_MANIFESTS ...
RESULT: FAIL (1 problems)
```

(The `0A2A.1` line is illustrative: a new native library brought a new reason.) Claude adds `'0A2A.1'` to the FileTimestamp reasons in `privacy-manifest.ts`, prebuilds again and reruns until `RESULT: PASS`. The "collected" lines and the `App Privacy:` tracking line are what the owner needs for the App Privacy questionnaire (owner step G3).

## 3. Layers B-E for every app

```sh
npm run audit:network
node ${CLAUDE_SKILL_DIR}/scripts/audit-bundle.mjs --export dist-audit/line-siege .
```

A NEW finding after adding a library. This is how the audio library's entry was made before it joined the starting baseline; a game that adds a package does the same:

```text
FAIL _expo/static/js/ios/index-....js.map [baseline-new] NEW react-native-audio-api: fetch (not in the baseline) Fix: Find out why ...
```

Claude opens the flagged module in the source map: `AudioDecoder.decodeFromRemoteUrl` fetches when `decodeAudioData` is given an http(s) URL. Our code never does that (the synth builds buffers in memory, and lint bans URL literals), so Claude adds

```json
  "react-native-audio-api": {
    "categories": ["fetch"],
    "reason": "AudioDecoder.decodeFromRemoteUrl fetches only when decodeAudioData gets an http(s) URL; our sound banks are synthesised in code and URL literals are lint-banned"
  }
```

to `packages/tooling/network-audit/js-baseline.json` (in Prettier's layout, one key per line, or `format:check` goes red), commits it with a `Gate-Change: network baseline (react-native-audio-api fetch helper, unused)` trailer, and asks the owner to approve before pushing. A first-party finding would never be baselined; the code would be removed.

## 4. The built store app

```sh
rm -rf build/ipa-check && mkdir -p build/ipa-check && unzip -q build/LineSiege.ipa -d build/ipa-check
node ${CLAUDE_SKILL_DIR}/scripts/audit-app-bundle.mjs --app build/ipa-check/Payload/LineSiege.app --variant store --ads-mode live --game line-siege
```

```text
audit-app-bundle: 4 artefacts checked, 0 problems
RESULT: PASS
```

Before the owner has given the real AdMob ids (owner step G5), the same command on a live build names the scaffold's placeholders instead (verified on the Line Siege store/live archive of 2026-09-30):

```text
FAIL EXConstants.bundle/app.config [extra-ad-units] extra.adUnits.banner is a placeholder AdMob unit id (ca-app-pub-1234567890123456/1111111111) Fix: ...
FAIL Info.plist [ad-app-id] GADApplicationIdentifier is the placeholder AdMob app id (ca-app-pub-1234567890123456~1234567890) Fix: The owner creates the AdMob app and its units (owner step G5); ...
```

## 5. Report to the owner

"The network and privacy audit passed for Line Siege 1.0 (build 3): our code makes no network requests, only the Google ads and Apple purchase components can go online, the store build has no test code or test ads, and the privacy declarations match the SDKs. One change needs your OK: the audio library can download files in theory; we never use that, and I added it to the audit's allow list with the reason. For the App Store 'App Privacy' form, here is what the ads component collects: [table]. Answer 'Device ID: used for tracking' (the Google ads component uses it; the game asks Apple's tracking permission first, and players who say no still see ads, just without that ID)."
