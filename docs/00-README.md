# 00 · The E07 engineering handbook

> **What this is.** The engineering handbook for the E07 game framework (working name "the Shell") and every game app built on it. It is the output of the spec's "research the platform" step: [`spec.txt`](../spec.txt) says *what* the Shell and its games do; these docs say *how* they are built with React Native, and every code sample in them was compiled, linted and tested on 2026-09-26.
> **Who writes the code.** Claude Code builds, tests and releases everything by itself. The owner reviews, play-tests and does the few steps that need a person. That is why most rules here are enforced by machines (lint, types, tests, hooks), not by review.
> **How a session works:** [17-claude-code-playbook.md](17-claude-code-playbook.md). **Binding decisions behind the docs:** [99-final-decisions.md](99-final-decisions.md) (2026-09-26, with its section G amendments); the docs restate them with versions and verified code; section G of that file records where verification refined them.

---

## 1. How to use this handbook

- **Start here, then read only what the task needs.** Section 2 gives three reading orders. Section 5 lists every doc in one line, and section 7 maps every spec requirement to the section that implements it.
- **Every topic has exactly one owner doc.** Section 5 names it. When two docs seem to disagree, the owner doc wins; report the disagreement to the owner and fix the other doc in the same commit ([17 §5](17-claude-code-playbook.md)).
- **Precedence.** The spec decides *what* (its non-negotiables N1 to N12 are never traded away). [99-final-decisions.md](99-final-decisions.md) and these docs decide *how*. If a doc would break the spec, stop and ask ([17 §5](17-claude-code-playbook.md)).
- **How the docs refer to each other.** `docs/07`, `doc 07` and [07-testing-and-tdd.md](07-testing-and-tdd.md) all mean the same file; "section 3.4" or "§3.4" is a numbered heading inside it. `FINAL-DECISIONS`, `FINAL` and references like "FINAL A.9" or "FINAL D.41" all point to [99-final-decisions.md](99-final-decisions.md); check its section G amendments before relying on an item. Every doc starts with a *What this doc decides* box and a *Related docs* line.
- **Every topic doc has the same parts.** Rules (imperative, each with a *Why* and usually a *Source*), details with complete code, a checklist to run before calling work done, sources, a *Verified* section (what was actually run, with versions), and *Open issues* (what is still undecided or unverified).
- **Code blocks are real files.** The first line of every block is the file's repo path. Copy them as they are; they passed `tsc`, the project's ESLint config, Prettier and Jest. Blocks marked "(excerpt)" or "(naming illustration)" are not whole files.
- **Versions age.** Everything was checked on 2026-09-26. Before trusting a version, run the doc's *Re-verify* commands; [01-stack-and-versions.md](01-stack-and-versions.md) section 3.2 is the single source of truth for versions.
- **Paths under `scratchpad/rn/…`** in the *Verified* sections point at throwaway verification workspaces. They are evidence, not part of the repo.

---

## 2. Reading orders

### 2a. Claude Code starting the Shell (and the pilot game, Line Siege)

1. [17-claude-code-playbook.md](17-claude-code-playbook.md): the session ritual, definition of done, stop-and-ask rules, and the bootstrap checklist for an empty repo (section 4.1).
2. [`spec.txt`](../spec.txt) sections 3 to 10 and 15, then this README's traceability table (section 7).
3. [01-stack-and-versions.md](01-stack-and-versions.md): what to install and at which exact version.
4. [02-architecture-and-folders.md](02-architecture-and-folders.md): the monorepo, the ports, the `GameModule` contract, `withShell`, file placement.
5. [03-naming.md](03-naming.md) and [04-code-style-and-limits.md](04-code-style-and-limits.md): names, the complete TypeScript and ESLint configuration (one `eslint.config.mjs`, with the rules other docs own merged in), limits.
6. [16-quality-gates-hooks-ci.md](16-quality-gates-hooks-ci.md): scripts, git hooks, Claude Code hooks, the guardrail. Set these up before the first feature.
7. [07-testing-and-tdd.md](07-testing-and-tdd.md): the TDD loop, Jest, Stryker and Maestro set-up.
8. Then by layer, in the build order of FINAL D.41: [06-navigation-state-persistence.md](06-navigation-state-persistence.md) (save first: N10), [10-i18n-and-rtl.md](10-i18n-and-rtl.md) (boot order and direction), [05-components-hooks-styling.md](05-components-hooks-styling.md), [08-game-engine.md](08-game-engine.md), [09-sound-haptics-art.md](09-sound-haptics-art.md), [11-ads-admob.md](11-ads-admob.md), [12-in-app-purchase.md](12-in-app-purchase.md), [15-performance-and-accessibility.md](15-performance-and-accessibility.md).
9. Before the first simulator build: [14-ios-build-and-release.md](14-ios-build-and-release.md) sections 3.1 to 3.5 and [13-privacy-network-security.md](13-privacy-network-security.md). Before the first upload: the rest of 14.

### 2b. Claude Code starting a new game (game 2 onwards)

1. [17-claude-code-playbook.md](17-claude-code-playbook.md) section 3 (per-game build order) and section 4.2 (new-game checklist).
2. The game's entry in [`spec.txt`](../spec.txt) section 13 and its design notes.
3. [02-architecture-and-folders.md](02-architecture-and-folders.md) section 7 (the `GameModule` contract), section 8 (wiring an app) and section 11.3 (add a game).
4. [08-game-engine.md](08-game-engine.md) sections 3 and 4: classify the game, then build it layer by layer.
5. [07-testing-and-tdd.md](07-testing-and-tdd.md) sections 3.8.1 to 3.8.4 (rules, goldens, pixels, bots).
6. [09-sound-haptics-art.md](09-sound-haptics-art.md) sections 5 and 7 (sound bank, icon, palette tokens) and [10-i18n-and-rtl.md](10-i18n-and-rtl.md) section 3.16 (four catalogs).
7. [11-ads-admob.md](11-ads-admob.md) section 3.11 and [14-ios-build-and-release.md](14-ios-build-and-release.md) section 3.11 for the owner's per-game steps (AdMob units, app record), then 14 section 3.8 to release.

### 2c. The owner

1. This README: sections 3 (the three questions), 4 (the stack), 6 (open decisions).
2. [01-stack-and-versions.md](01-stack-and-versions.md) section 3.8 and [08-game-engine.md](08-game-engine.md) "For the owner, in plain words": why there is no game engine.
3. [14-ios-build-and-release.md](14-ios-build-and-release.md) section 3.11: the complete list of human steps, and section 3.12: what the agent will stop and ask about.
4. [11-ads-admob.md](11-ads-admob.md) section 3.11 (AdMob console steps) and [12-in-app-purchase.md](12-in-app-purchase.md) section 3.11 (Premium product steps).
5. [13-privacy-network-security.md](13-privacy-network-security.md) section 3.4: the App Privacy answers and the one decision about Apple's tracking guideline.
6. [15-performance-and-accessibility.md](15-performance-and-accessibility.md) sections 3.2 and 3.10: how to record a performance report and run the VoiceOver checklist on your phone.
7. [07-testing-and-tdd.md](07-testing-and-tdd.md) section 3.17: the evidence report you will receive after each piece of work.

---

## 3. Three questions, answered plainly

### Do we use a game engine or a library?

Libraries, not an engine. A game engine (Unity, Godot, Cocos) is a whole second program with its own language, editor and runtime. Our games are small 2D boards inside a shared app, so each job goes to one proven library: **Skia** draws the boards, **Reanimated** runs the animation clock on the phone's display thread, **Gesture Handler** reads taps and swipes, **react-native-audio-api** plays sounds that are generated by code, and **Expo Haptics** vibrates. The rules of every game are plain TypeScript with no graphics, so a test bot can play thousands of games in seconds and the same seed gives the same level on every phone. A small in-house kit adds the game clock, board layout, geometry and a seeded random-number generator. No game on the list needs a physics engine. Details: [01 §3.8](01-stack-and-versions.md), [08 intro](08-game-engine.md).

### What tools does Claude use?

Everything runs on this Mac from the command line; nothing needs a person at the mouse, and there is no cloud build service.

| Job | Tools |
|---|---|
| Write the app | Expo SDK 57 (React Native 0.86.3, React 19.2.3, Hermes), TypeScript 6.0.3, React Navigation 7, Zustand, SQLite, react-intl |
| Check the code on every change | Prettier, ESLint 9 with strict rules, the TypeScript compiler, knip (dead code), git hooks (lefthook) and Claude Code hooks that run the checks after every edit and before Claude stops |
| Test | Jest with React Native Testing Library, fast-check (property tests), pixel and data "goldens", test bots, Stryker (mutation testing), Maestro (tapping through the real app on the iOS simulator), an automatic screenshot matrix in 4 languages × light/dark × phone/tablet |
| Prove "no network from our code" | six audit layers: lint rules, a scan of the shipped JavaScript, a scan of native code, an allowlist of downloaded SDKs, config checks, and a socket monitor while the app runs |
| Build and release | Xcode 26.6 command-line tools (`xcodebuild`, `simctl`, `altool`), signed with your App Store Connect API key, plus one small script for the App Store Connect web API. No EAS, no fastlane, no Xcode clicking |

### What must a human still do?

Only what needs your identity, your money, your judgement or your phone ([14 §3.11](14-ios-build-and-release.md) has the complete list with IDs):

- **Once:** keep the Apple Developer Program active and accept its agreements, including the Paid Apps agreement with tax and banking; declare EU trader status; create a *team* App Store Connect API key with the Admin role and save it where the docs say; install and license Xcode (about once a year); install TestFlight on your iPhone; create the AdMob account; approve Claude Code's permission prompts; now and then unlock the Mac's keychain if signing asks for it.
- **Per game:** approve the app name and bundle ID; create the app record in App Store Connect (Apple offers no API for it); fill in the App Privacy questionnaire; decide the Premium price point and Family Sharing; create the game's AdMob app and three ad units and publish its consent message; play-test on TestFlight, including a sandbox purchase and restore; have a native speaker read the Persian and Sorani texts; approve the store listing.
- **Per release:** play the TestFlight build and say "ship" or "don't ship"; a 15-minute VoiceOver check; a native-speaker read of changed Persian and Sorani texts; accept any new Apple agreement; submit for review (or tell Claude "submit"); answer App Review.
- **Later:** the Google Play developer account when Android starts.

---

## 4. The stack at a glance

| Layer | Choice | Version (2026-09-26) | Owner doc |
|---|---|---|---|
| App framework | Expo SDK, New Architecture, Continuous Native Generation (`ios/` generated) | `expo` 57.0.25 → React Native 0.86.3, React 19.2.3, Hermes V1 | [01](01-stack-and-versions.md) |
| Language | TypeScript, strict flags, no build step for workspace packages | 6.0.3 | [04](04-code-style-and-limits.md) |
| Repository | one npm-workspaces monorepo: `packages/{game-kit,shell,tooling}`, `apps/<game>` | Node 26.4.0, npm 11.17.0 | [02](02-architecture-and-folders.md) |
| Navigation | React Navigation static native stack (no Expo Router) | 7.4.1 / native-stack 7.19.2 | [06](06-navigation-state-persistence.md) |
| App state | Zustand stores over pure reducers; game runs in a pure `GameSession` reducer | 5.0.15 | [06](06-navigation-state-persistence.md) |
| Saving | one versioned JSON document in SQLite (WAL, `synchronous = FULL`), valibot validation, tested migrations | `expo-sqlite` 57.0.3, valibot 1.5.0 | [06](06-navigation-state-persistence.md) |
| UI | function components, React Compiler, StyleSheet + typed theme, logical (start/end) styles | compiler bundled with Expo | [05](05-components-hooks-styling.md) |
| Boards | Skia canvas + Reanimated clock + Gesture Handler + in-house kit | Skia 2.6.2, Reanimated 4.5.1, Worklets 0.10.1, RNGH 2.32.0 | [08](08-game-engine.md) |
| Sound, haptics, art | sounds synthesised in code; Expo Haptics; icons and splash rendered by headless Skia | `react-native-audio-api` 0.13.6, `expo-haptics` 57.0.3 | [09](09-sound-haptics-art.md) |
| Languages | react-intl with forced FormatJS polyfills, catalog linter, Vazirmatn font, restart for direction | `react-intl` 12.1.3 | [10](10-i18n-and-rtl.md) |
| Ads | Google AdMob with UMP consent, pure frequency policy, no tracking prompt in v1 | `react-native-google-mobile-ads` 17.2.0 | [11](11-ads-admob.md) |
| Purchase | one non-consumable Premium through StoreKit 2, no server | `expo-iap` 5.8.0 | [12](12-in-app-purchase.md) |
| Offline and privacy | `expo-network` (no HTTP probe), six-layer network audit, aggregated privacy manifest | `expo-network` 57.0.2 | [13](13-privacy-network-security.md) |
| Tests | Jest projects `unit` + `golden`, RNTL, fast-check, Stryker, Maestro | Jest 29.7.0, jest-expo 57.0.5, RNTL 14.0.1, Maestro 2.10.0 | [07](07-testing-and-tdd.md) |
| Quality gates | ESLint flat config, Prettier, knip, lefthook, Claude Code hooks, a guardrail against weakened gates | ESLint 9.39.5, Prettier 3.9.9, knip 6.38.0 | [04](04-code-style-and-limits.md), [16](16-quality-gates-hooks-ci.md) |
| Build and release | prebuild → `xcodebuild` → `altool`, App Store Connect API key signing | Xcode 26.6, iOS 26.5 simulators | [14](14-ios-build-and-release.md) |
| Budgets and accessibility | cold start < 1 s, hitch rate ≤ 10 ms/s, save write p95 < 5 ms, 44 pt targets, 200% text, WCAG AA | measured on device by the owner | [15](15-performance-and-accessibility.md) |

---

## 5. The docs (one owner per topic)

| Doc | Owns |
|---|---|
| [00-README.md](00-README.md) | This index: how to read the handbook, the stack, the traceability table |
| [01-stack-and-versions.md](01-stack-and-versions.md) | The stack as ADRs, every exact version, installs, `.npmrc` and the 7-day release-age policy, upgrade triggers, banned packages |
| [02-architecture-and-folders.md](02-architecture-and-folders.md) | The monorepo, workspace manifests, dependency boundaries, the nine port signatures, the `GameModule` contract, `game.config.ts`, `withShell`, file placement, recipes |
| [03-naming.md](03-naming.md) | Names of files, identifiers, types, actions, moves and events, testIDs, i18n keys, packages, scripts, env vars, commits, trailers and tags |
| [04-code-style-and-limits.md](04-code-style-and-limits.md) | The tsconfig files, the one complete `eslint.config.mjs`, Prettier, size and complexity limits, error, async, purity and import policies |
| [05-components-hooks-styling.md](05-components-hooks-styling.md) | Components, hooks and effects, React Compiler, store reads, theme and `makeStyles`, `AppText`, buttons, lists, icons, safe areas, reduce motion, error boundaries |
| [06-navigation-state-persistence.md](06-navigation-state-persistence.md) | Routes and the static stack, the four stores, the `GameSession` reducer, the save document, SQL, migrations, the kill test, boot hydration, daily and statistics models |
| [07-testing-and-tdd.md](07-testing-and-tdd.md) | The TDD loop, Jest/Babel/Stryker config, root mocks, `renderWithShell`, worked test examples, coverage, Maestro, the debug deep link, the screenshot matrix, the evidence report |
| [08-game-engine.md](08-game-engine.md) | Engine contract, timeline, frame clock, renderer, real-time loop, gestures, determinism, PRNG, geometry, board layout, how each catalogue game maps on it |
| [09-sound-haptics-art.md](09-sound-haptics-art.md) | Audio and haptics ports and adapters, synthesis and the WAV preview, the art pipeline (icon, splash, sprites, palette tokens), licence data for S11d |
| [10-i18n-and-rtl.md](10-i18n-and-rtl.md) | Catalogs and keys, `t()`/`<T>`, Intl polyfills, language resolution, digits, dates, bidi isolation, the direction switch and boot order, fonts, `i18n:verify`, translation workflow |
| [11-ads-admob.md](11-ads-admob.md) | AdMob setup and IDs per `ADS_MODE`, SKAdNetwork list, ads and consent ports, `adPolicy` (spec 8.8), banner/interstitial/rewarded, offline, privacy notes, AdMob console steps |
| [12-in-app-purchase.md](12-in-app-purchase.md) | Premium: `expo-iap` adapter and bans, the reducer for every S12 state, persistence and revocation, price display, the three test tiers, creating the product by API |
| [13-privacy-network-security.md](13-privacy-network-security.md) | The six-layer network audit (N3), privacy manifest aggregation, App Privacy answers, the API key as a secret, supply chain, the release audit |
| [14-ios-build-and-release.md](14-ios-build-and-release.md) | Toolchain from zero, Xcode selection, prebuild, simulator builds, build variants and test-only stripping, versions and build numbers, signing, the release pipeline, human steps, failure playbook |
| [15-performance-and-accessibility.md](15-performance-and-accessibility.md) | Budgets and how each is measured (frame recorder, cold-start log, save and draw-call tests), performance rules, accessibility rules and tests, the owner's VoiceOver checklist |
| [16-quality-gates-hooks-ci.md](16-quality-gates-hooks-ci.md) | Every npm script, `verify` and `check:fast`, lefthook, Claude Code hooks and permissions, `quality-gates.json` and the guardrail, knip, dependency and licence gates, optional CI |
| [17-claude-code-playbook.md](17-claude-code-playbook.md) | How a Claude Code session works here: session ritual, definition of done, build orders, new-game checklist, stop-and-ask rules, commits, reporting, the `AGENTS.md` template |
| [99-final-decisions.md](99-final-decisions.md) | The binding stack decisions and canonical names the docs were written from (sections A–F), plus the section G amendments made during verification |

---

## 6. Open decisions for the owner

These need an answer from the owner; everything else in the docs' *Open issues* sections is technical and tracked there.

| Decision | Default until you decide | Where |
|---|---|---|
| Apple guideline 5.1.2: declare "Data used to track you" for AdMob's device ID while showing no tracking prompt (D4) | declare it as the SDK's manifest says, no prompt; add the prompt only if App Review objects | [13 §3.4](13-privacy-network-security.md), [11 §3.10](11-ads-admob.md) |
| Premium price when €1.90 is not an Apple price point (D3) | the script stops and asks; the spec's example is €1.99 | [12 §3.7](12-in-app-purchase.md) |
| Family Sharing for Premium (irreversible once on) | off | [12 §3.7](12-in-app-purchase.md) |
| Keep the Expo Claude Code plugin from the template | kept, with `AGENTS.md` forbidding EAS and OTA updates | [16 open issue 4](16-quality-gates-hooks-ci.md) |
| Spec gaps found while designing the save: text when both save slots are damaged; whether "Reset statistics" also zeroes the level and daily cards; whether a lost daily attempt counts for the streak | the defaults written in [06 open issues 4 to 6](06-navigation-state-persistence.md) | [06](06-navigation-state-persistence.md) |
| Interpretation of spec 8.8 "never twice in a row after losses" | two consecutive interstitials may not both follow a loss | [11 open issue 3](11-ads-admob.md) |
| Letter Bugs word lists for Persian and Sorani (licences) | build Letter Bugs late | [08 open issue 6](08-game-engine.md) |
| Native-speaker reviewer for Persian and Sorani | `release:ios` refuses unreviewed texts unless you record a waiver | [10 §3.16](10-i18n-and-rtl.md) |

---

## 7. Traceability: spec requirement → where it is implemented

Section numbers refer to the linked doc. "Rule n" is a numbered rule in that doc's *Rules* section.

### 7.1 Non-negotiables

| Spec | Requirement | Implemented in |
|---|---|---|
| N1 | Offline first | [13](13-privacy-network-security.md) §1–3.2; [11](11-ads-admob.md) §3.9; [12](12-in-app-purchase.md) §3.9; [06](06-navigation-state-persistence.md) §6 (all data local); [07](07-testing-and-tdd.md) §3.11 (offline journey flow) |
| N2 | No accounts, server, cloud, analytics, crash service | [01](01-stack-and-versions.md) §3.6 (banned packages); [13](13-privacy-network-security.md) §3.6 (banned SDKs and pods); [04](04-code-style-and-limits.md) §6.2 (local error log only) |
| N3 | Our code makes no network requests | [13](13-privacy-network-security.md) §3.2 (six layers) and §3.7; [04](04-code-style-and-limits.md) §7 (layer A lint); [07](07-testing-and-tdd.md) §3.11 (runtime socket check) |
| N4 | One game = one app | [02](02-architecture-and-folders.md) §1, §8; [14](14-ios-build-and-release.md) §3.5–3.8; [12](12-in-app-purchase.md) rule 4 |
| N5 | One Shell | [02](02-architecture-and-folders.md) §1–5 (monorepo, boundaries); [01](01-stack-and-versions.md) ADR-08 |
| N6 | Four languages, both directions | [10](10-i18n-and-rtl.md) (whole doc); [05](05-components-hooks-styling.md) rules 26–34; [07](07-testing-and-tdd.md) §3.13 (screenshot matrix) |
| N7 | One purchase | [12](12-in-app-purchase.md) (whole doc) |
| N8 | Ads never interrupt play | [11](11-ads-admob.md) §3.6–3.8 |
| N9 | Everything made by Claude Code | [09](09-sound-haptics-art.md) §5 (synthesised sound), §7 (art from code); [05](05-components-hooks-styling.md) §3.10 (icons as paths) |
| N10 | Saved progress survives every update | [06](06-navigation-state-persistence.md) §6.2, §6.7, §6.11, §6.13 |
| N11 | No layout code says left or right | [05](05-components-hooks-styling.md) rules 30–34; [10](10-i18n-and-rtl.md) §3.11; [04](04-code-style-and-limits.md) §7 (`physicalStyleKeys`) |
| N12 | Every sentence is one translatable message | [10](10-i18n-and-rtl.md) §3.2, §3.6–3.8, §3.14; [04](04-code-style-and-limits.md) §7 (no JSX literals) |

### 7.2 Screens

| Spec | Screen | Implemented in |
|---|---|---|
| S1 | Splash | [06](06-navigation-state-persistence.md) §7 (hydration); [10](10-i18n-and-rtl.md) §3.10 (direction check); [09](09-sound-haptics-art.md) §3 (splash art); [15](15-performance-and-accessibility.md) §3.3 (cold start) |
| S2 | First-run language choice | [06](06-navigation-state-persistence.md) §3.1, §3.6; [10](10-i18n-and-rtl.md) §3.4, §3.10, §3.16 |
| S3 | Ad consent | [11](11-ads-admob.md) §3.5 |
| S4 | Home | [06](06-navigation-state-persistence.md) §3.1; [11](11-ads-admob.md) §3.7 (banner); [05](05-components-hooks-styling.md) §3.5 (Premium entry) |
| S5 | Game screen | [06](06-navigation-state-persistence.md) §3.5, §5; [08](08-game-engine.md) §2; [15](15-performance-and-accessibility.md) rule 29 (spoken board summary) |
| S6 | Pause menu | [06](06-navigation-state-persistence.md) §3.5, §5.2 |
| S7 | Result screen | [06](06-navigation-state-persistence.md) §5.2 (saved before it appears); [11](11-ads-admob.md) §3.8 (ad only after the tap) |
| S8 | Levels | [05](05-components-hooks-styling.md) §3.9; [02](02-architecture-and-folders.md) §7.2 (`levels.ts`: packs, stars) |
| S9 | Daily challenge | [06](06-navigation-state-persistence.md) §8.1–8.2; [07](07-testing-and-tdd.md) §3.8.2 (daily goldens) |
| S10 | Statistics | [06](06-navigation-state-persistence.md) §8.3; [02](02-architecture-and-folders.md) §7.2 (`stats.ts` counters) |
| S11 | Settings | [06](06-navigation-state-persistence.md) §4 (settings store); [10](10-i18n-and-rtl.md) §3.5, §3.10; [09](09-sound-haptics-art.md) rules 7–8, 13; [05](05-components-hooks-styling.md) §3.6, §3.13; [11](11-ads-admob.md) rule 8; [12](12-in-app-purchase.md) §3.7 |
| S11a | Language | [10](10-i18n-and-rtl.md) §3.10, §3.16 |
| S11b | About and credits | [02](02-architecture-and-folders.md) §8.1 (`links`, support email) |
| S11c | Privacy policy | [13](13-privacy-network-security.md) §3.4; [11](11-ads-admob.md) §3.10 |
| S11d | Licences | [09](09-sound-haptics-art.md) §9; [16](16-quality-gates-hooks-ci.md) §9.3 |
| S12 | Premium | [12](12-in-app-purchase.md) §3.4–3.6 |
| S13 | How to play / tutorial | [02](02-architecture-and-folders.md) §7.2 (`teaching.ts`); [06](06-navigation-state-persistence.md) §3.1 (Tutorial route, replay) |
| S14 | Dialogs | [06](06-navigation-state-persistence.md) §6.7 (damaged and newer saves); [10](10-i18n-and-rtl.md) §3.10 (restart dialog); [12](12-in-app-purchase.md) §3.4 (store states) |
| S15 | Debug menu | [14](14-ios-build-and-release.md) §3.5 (compiled out of store builds); [07](07-testing-and-tdd.md) §3.12 (debug deep link); [13](13-privacy-network-security.md) layer F (network counter); [15](15-performance-and-accessibility.md) §3.2 |

### 7.3 Features (spec section 8)

| Spec | Feature | Implemented in |
|---|---|---|
| 8.1 | Levels and stars (generated, solver, par) | [02](02-architecture-and-folders.md) §7.2, §7.5; [08](08-game-engine.md) §3; [07](07-testing-and-tdd.md) §3.8.2 |
| 8.2 | Modes (levels, daily, endless) | [02](02-architecture-and-folders.md) §7.2, §8.1 (`modes`) |
| 8.3 | Daily challenge generation | [06](06-navigation-state-persistence.md) §8.1; [07](07-testing-and-tdd.md) §3.8.2 |
| 8.4 | Scoring | [02](02-architecture-and-folders.md) §7.2 (`rules.hud`); [06](06-navigation-state-persistence.md) §8.3 |
| 8.5 | Undo and hints | [06](06-navigation-state-persistence.md) §5; [11](11-ads-admob.md) §3.8 (rewarded hint) |
| 8.6 | Saving | [06](06-navigation-state-persistence.md) §6 (whole section) |
| 8.7 | Sound, music and vibration | [09](09-sound-haptics-art.md) §4–6 |
| 8.8 | Ads | [11](11-ads-admob.md) (whole doc) |
| 8.9 | Premium purchase | [12](12-in-app-purchase.md) (whole doc) |
| 8.10 | Continue after losing | [06](06-navigation-state-persistence.md) §5; [11](11-ads-admob.md) §3.6 (`perkOffer`); [02](02-architecture-and-folders.md) §7.2 (`continueRun`) |
| 8.11 | Accessibility | [15](15-performance-and-accessibility.md) §2, §3.8–3.10; [05](05-components-hooks-styling.md) rules 29, 35–40 |
| 8.12 | Themes and look | [05](05-components-hooks-styling.md) §3.6–3.7; [09](09-sound-haptics-art.md) §7.2 |
| 8.13 | Testing hooks (headless rules, bots, seeds, screenshots, airplane-mode run, network audit) | [07](07-testing-and-tdd.md) (whole doc); [08](08-game-engine.md) §5; [13](13-privacy-network-security.md) §3.2 |
| 8.14 | Errors and stability | [04](04-code-style-and-limits.md) §6.2; [05](05-components-hooks-styling.md) §3.14; [06](06-navigation-state-persistence.md) §6.7 |

### 7.4 Other spec sections and the questions it left to this step

| Spec | Topic | Answer and place |
|---|---|---|
| 4.2 (2) | "Confirm the exact consent requirements in the platform step" | Google UMP: refresh every launch, form after the tutorial and before the first ad, privacy row only where required: [11](11-ads-admob.md) §3.5 |
| S11 | "Which case applies [live mirroring or restart] is found out in the platform step" | a direction change needs one restart (`forceRTL` + `reloadAppAsync`): [10](10-i18n-and-rtl.md) §3.10 |
| 1.2, 12 | "How the copy back works technically is decided in the platform step" | no copying: one monorepo, every game app consumes the same Shell package: [01](01-stack-and-versions.md) ADR-08, [02](02-architecture-and-folders.md) §1 |
| 10 | The game contract | [02](02-architecture-and-folders.md) §7 |
| 11 | Per-game configuration file | [02](02-architecture-and-folders.md) §8.1 |
| 12 | Making the next game | [02](02-architecture-and-folders.md) §11.3; [17](17-claude-code-playbook.md) §3–4 |
| 13 | The catalogue | [08](08-game-engine.md) §4 |
| 15 | Definition of done (Shell + pilot) | [17](17-claude-code-playbook.md) §2; [07](07-testing-and-tdd.md) §4; [14](14-ios-build-and-release.md) §3.13 |
| D5 | Device backup includes the save | [06](06-navigation-state-persistence.md) rule 19 (WAL checkpoint on background) |
