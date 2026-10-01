# Open risks and owner decisions

Known unknowns: behaviour not yet verified, and decisions only the owner can make. Each row says what to do until it is settled. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- Release
- Build
- Toolchain
- Repo setup
- Games
- Purchases
- Ads
- Git
- Art
- Copy
- Owner steps
- Design
- Gestures
- Parity
- Navigation

## Release

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `open-api-key-dev-cert` | The first API-key archive cannot create the Apple Development certificate | Unverified whether the key alone can create it on this Mac | Owner step O7: sign in once in Xcode > Settings > Accounts | open, owner | `ios-release-testflight` |
| `open-altool-unknowns` | The upload JSON has no obvious delivery ID, or build-status --wait returns early | Unverified without the owner key: the delivery-ID field name, whether --build-status --wait waits for VALID, the --beta-app-store-text folder layout, whether altool --list-apps needs --provider-public-id, and the exit code of security show-keychain-info on a locked keychain | Search the JSON for a delivery key, poll REST processingState, set What to Test through REST; record the real answers after the first release | open | `ios-release-testflight` |

## Build

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `open-store-ready-signal` | A store simulator build has nothing to wait on before the screenshot | App code cannot log and store builds have no perf log | Decided: two identical screenshots after at least 3 s (build-ios-sim.ts) | verified | `ios-simulator-build` |

## Toolchain

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `open-java-source` | A fresh Mac has no Java 17 for Maestro | This Mac uses Android Studio's JBR; mise temurin-17 is listed but not verified | mise use java@temurin-17 and point JAVA_HOME at it; verify on first use | open | `e2e-maestro` |

## Repo setup

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `open-expo-plugin-decision` | The Expo Claude plugin nudges toward EAS services | The template enables expo@claude-plugins-official | Owner decides whether to keep it; if kept, AGENTS.md forbids EAS and OTA | open, owner | `quality-gates` |
| `open-bootstrap-unscripted` | The first Shell session does not know the exact create-expo-app command and files to delete | Not fixed by any doc | Record the commands used during bootstrap | open | `monorepo-bootstrap` |

## Games

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `open-letter-bugs-dictionaries` | No licence-compatible fa/ckb word lists for Letter Bugs | Many open dictionaries are GPL, LGPL or MPL, which the licence allowlist rejects | Owner decides the source; build Letter Bugs late | open, owner | `pocket-arcade-product-spec` |
| `open-new-game-script` | npm run new-game does not exist yet | No skill shipped packages/tooling/src/scaffold/new-game.ts, although monorepo-bootstrap and quality-gates wire npm run new-game to it | Copy new-game-scaffold templates/tooling/new-game.ts to packages/tooling/src/scaffold/new-game.ts (it forwards to scaffold-game.mjs under skills/ or .claude/skills/); check-scaffold reports it missing (new-game-script) | verified | `new-game-scaffold` |

## Purchases

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `open-price-point` | An old note or the spec says the Premium price is about EUR 1.90 | Before owner decision O2 (2026-09-30) the price point was open | Decided (owner, O2): Premium is the EUR 1.99 App Store price point in the DEU base territory; create-premium-iap.ts targets exactly 1.99 and stops only if Apple no longer offers it; the app always shows the store's localised price (formatStorePrice with the displayPrice fallback) and never types it | documented | `premium-purchase` |
| `open-family-sharing` | Family Sharing for Premium: should it be on? | Turning Family Sharing on in App Store Connect cannot be undone; before owner decision O3 (2026-09-30) it was undecided | Decided (owner, O3): off. familyShareable is false in the StoreKit config and familySharable false in the App Store Connect payload; leave Family Sharing off in App Store Connect and never turn it on; check-premium enforces both wherever a StoreKit config is checked | documented | `premium-purchase` |

## Ads

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `open-ad-interpretation` | Interstitial frequency after losses may not match the owner's intent | Spec 8.8 read as: no two consecutive interstitials both after a loss | If the owner meant otherwise, change only shouldShowInterstitial and its test | open, owner | `admob-ads` |

## Git

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `open-push-policy` | Unclear whether to push | The owner has not said whether a remote or pull requests are used | Treat pushing as outward-facing: ask first | open, owner | `git-commits-and-reporting` |

## Art

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `open-icon-format` | Flat PNG icons do not get per-layer Liquid Glass depth | The Icon Composer .icon format has no documented schema | Ship flat light, dark and tinted PNGs; revisit if the owner wants layers | open | `code-drawn-art-and-icons` |

## Copy

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `open-copy-deck-draft` | fa and ckb strings may wrap differently after review | The copy deck is a draft awaiting native review | Re-check S2, S4 keys and stickers after the owner's review (R3); the review is listed under "Owner steps (not blocking)" and never waited for | open | `toybox-screens` |

## Owner steps

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `open-owner-personal-checks` | A report, a gate or a plan waits for the native review of fa and ckb texts, the play-test or listening to the sound previews ("fa and ckb need the native review before a release") | Before owner decision O6 (2026-09-30) these were treated as release gates; the owner now does all three personally | List them under "Owner steps (not blocking)" in every slice and release report (check-report rule owner-steps-listed) and keep working: Claude drafts the texts, renders the WAV previews (reports/sfx/<game-id>/) and names the play-test; no gate waits for them, and check-balance --release prints unapproved bands as an owner-step line | documented | `git-commits-and-reporting` |

## Design

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `open-dark-ink-per-game` | Dark mode ink, outline and shadow are tinted per game | The palette data tints them although the design notes say one ink | Follow the data (per-game tint) until the owner decides; change tokens and palettes together | open, owner | `toybox-design-system` |
| `open-type-scale-switch` | Display text uses the platform font at the old sizes; t.test.tsx expects heading line height 30 | TYPE_SCALE and LATIN_SCRIPT still use the pre-Toybox sizes and fonts | Switch TYPE_SCALE, fonts.ts and useLocalizedTextStyle together and change the one expectation (30 -> 32) | open | `toybox-design-system` |

## Gestures

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `open-rngh-rtl-android` | Gestures in RTL on Android are unverified | Only iOS was probed; gesture coordinates are physical | Re-run the gesture tests and a play-test in RTL when Android starts | open | `board-gestures-and-input` |

## Parity

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `open-parity-hint-key-no-hints` | S6 Pause parity (and the S5 top bar under it) fails [missing] on game.hint-button for a game without solver hints (Line Siege) | The design's game top bar always draws a hint key, while the app leaves the key out for a game whose hints are none (a hidden key, never a broken one); no game fact selects a reference without it yet | Decided (lead, L8): the game facts gain hasHints (true only when the module's rules.hints.kind is 'solver'; Line Siege false). parity/game-facts.json sets it, and captures compose the variants in frames.json order with no-music before no-hints (Line Siege: s6-pause--no-music--no-hints); the S5 top bar has no hint key when it is false. A missing fact is exit 2, never a guess | documented | `toybox-visual-parity` |
| `open-parity-score-value-persian-clip` | S7 Result win in fa or ckb fails [text-ink] on result.score-card.value (ink height about 29 vs 38 pt): the tops of the Persian digits of the 44 pt score are cut off | The scoreValue type role keeps a Persian line height of 1.0, which clips Vazirmatn's tall digits on iOS (the same clip the level numbers had before they moved to 1.45) | Decided (lead, L9): typeRoles.scoreValue.arabicLineHeight is 1.45, with the mockup rule .ar .sc-v{line-height:1.45}, and the references were re-rendered (reference change L9). Copy the current type roles from toybox-design-system (scoreValue display(44, [1, 1.45])) and rerun; never waive clipped digits | documented | `toybox-design-system` |

## Navigation

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `open-home-opens-daily` | The Shell journey 02-core-journey-offline fails "Assertion is false: id: daily.screen is visible" after tapping home.daily-card: nothing on Home opens S9 Daily challenge | navigation-and-routing's table says the daily card title opens S9 (navigate('Daily')), but the Toybox design draws the daily panel flat, with only the Play today's challenge button (the testID map's note asks which element opens S9), so the Home view has no control for it and a player cannot reach S9 | Decided (lead, L7): the daily card's body is an accessible button (testID home.daily-card, its label joins the title, date and streak) that opens S9, and its Play key (home.daily-card.play-button) is a separate accessible sibling that starts today's run; the pixels do not change, and a finished day still opens S9. Copy toybox-screens' current Home daily card and the Shell journey 02, which taps home.daily-card | documented | `toybox-screens` |
