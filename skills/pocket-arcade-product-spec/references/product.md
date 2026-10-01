# The product: Pocket Arcade and its Shell

What is being built, for whom, the one real conflict (ads versus "nothing online") and how it was resolved, the offline behaviour, what is not in version 1, the definition of done for the Shell and the pilot game, and where each owner requirement is covered. The working name of the framework is "the Shell"; the final names come from decision D6.

## Contents

- 0 · In one paragraph
- 1 · What we are building (1.1 The pieces, 1.2 Build order, 1.3 Why a framework first)
- 2 · Who it is for (2.1 Players, 2.2 The owner)
- 4 · The one real conflict: ads versus "nothing online" (4.1-4.3)
- 9 · Offline behaviour quick table
- 14 · Not in version 1
- 15 · Definition of done (the Shell + pilot game): 15.1-15.8
- 17 · The owner's requirements and where they are covered
- Questions the platform step answered
- Who does what

## 0 · In one paragraph

We are building one reusable game framework, the Shell, and then many small 2D single-player games on top of it, one at a time. Every game ships as its own separate app in the App Store and Google Play. The Shell contains everything a game app needs apart from the game itself: home page, levels, daily challenge, statistics, settings, the purchase page, ads, languages, saving, sound, tutorials, pause and results screens. A new game only has to provide its rules, its board, its levels and its texts. It plugs into the Shell and becomes a complete, shippable app. Everything works offline, there are no user accounts, and we run no server. The app speaks English and German (left-to-right) and Persian and Kurdish Sorani (right-to-left) from day one.

Platforms: iOS first, then Android. Both come from the same React Native code; Android follows once the iOS version of a game has shipped.

Internet use (confirmed 2026-09-26): there is no server of ours. No user accounts, no cloud backups, nothing that users connect to. The internet is used only by AdMob (ads) and by the App Store / Google Play purchase system. The game itself works fully offline.

## 1 · What we are building

### 1.1 · The pieces

- **The Shell:** every screen and service that is the same in every game (spec 6-9). Built once, improved over time, reused by every game.
- **A game module:** the part that is different for each game: its rules, its board and controls, its level generator, its tutorial, its extra statistics and its texts in four languages (spec 10).
- **A game app:** the Shell + one game module + that game's configuration (name, icon, colours, ad IDs, purchase ID). One game = one app = one store listing. Games never share an app.

### 1.2 · Build order

1. The Shell, together with one pilot game. A framework cannot be judged without a real game inside it. Default pilot: Line Siege (decision D1).
2. Ship the pilot app.
3. Every later game: add a new game module and config inside the same monorepo, ship (spec 12).

### 1.3 · Why a framework first

- About 26 games are planned. If each rebuilt settings, languages, ads and purchases, the same things would be built 26 times and every bug fixed 26 times.
- Right-to-left support, four languages, ads consent and purchases are the hardest parts to get right. They are solved once, carefully.
- It keeps every game consistent for players, and makes each new game mostly about the game itself.

## 2 · Who it is for

### 2.1 · Players

Casual phone players who want a short, clever game for 2-15 minutes: on a bus, in a queue, before sleep. They may be offline. They may read English, German, Persian or Sorani. They will not create an account, read a manual or tolerate ads in the middle of a move.

What this means for the design:

- Play starts in one tap from the home page.
- Every game teaches itself in the first level.
- Progress is saved after every move, so closing the app never loses anything.
- Ads appear only at natural breaks (between levels), never during play.

### 2.2 · The owner

The owner reviews and play-tests; Claude Code builds and tests everything, and the owner never reads code. So:

- Every game's rules must be testable automatically (spec 8.13).
- A hidden debug menu in test builds jumps to any level or state in seconds (S15).
- Each game's configuration lives in one place, so a new game is mostly filling in values (spec 11).

## 4 · The one real conflict: ads versus "nothing online"

The owner asked for (a) an offline app with no requests to the internet, and (b) Google AdMob ads and a paid purchase. Both cannot be fully true at once, because ads are downloaded from Google when they are shown, and a purchase is confirmed by Apple or Google.

### 4.1 · The resolution

- The game is 100% offline. Nothing about playing, saving, levels, statistics, settings or languages ever needs the internet.
- Our code never makes a network request (N3).
- Only two built-in components go online, and only when the phone already has a connection:
  - The ads component loads an ad. Offline, no ad appears, and the player never sees an error, a wait or a "please connect" message.
  - The store component buys or restores Premium. Offline, the Premium page says "Connect to the internet to buy or restore." Premium already bought keeps working offline (spec 8.9).

### 4.2 · What this changes compared with a fully private app

1. **Privacy labels.** Apple's "App Privacy" details and Google Play's "Data safety" form must declare what the ads component collects (usually device identifiers, approximate location from the network, and ad interaction data). The device ID is declared as "used for tracking" by the third-party ads component (see point 3). So the app cannot claim "collects no data". It can claim no accounts, no personal data collected by us, and fully playable offline.
2. **Consent in Europe.** Google requires a consent message for players in the European Economic Area, the UK and Switzerland before it serves personalised ads. Germany is in the EEA. The Shell therefore includes Google's consent step (S3) and a permanent "Ad privacy choices" entry in Settings (resolved: the consent status is refreshed every launch, the form appears after the tutorial and before the first ad, and the privacy row shows only where it is required).
3. **iPhone tracking permission (decided 2026-09-30: follow Apple's rules, decision D4; owner decision O1).** Apple's App Review guideline 5.1.2(i) requires Apple's App Tracking Transparency permission before an app, or an ads component inside it, tracks the player. The ads component can use the iPhone's advertising ID (IDFA) for tracking. So on iPhone the Shell asks Apple's "Allow tracking?" system prompt before any ad request that could use the advertising ID, in this order: (a) the Shell's own short consent intro (S3), shown only when Google's consent message follows; (b) Google's consent message, only where it is required (point 2); (c) Apple's tracking prompt, only while the player has not answered it yet. If the player declines, or tracking is restricted on the phone, ads are still shown, just without the advertising ID (not personalised by it; lower revenue). The prompt's sentence is ours, in all four languages (the Shell text `consent.tracking.usage-description`); the dialog is Apple's. The player can change the answer later in the phone's Settings (Privacy & Security > Tracking). Builds with ads switched off (every E2E test build) never ask.
4. **A privacy policy web page.** Both stores require a privacy-policy link, and ads make one mandatory anyway. AdMob also expects an `app-ads.txt` file on the developer's website. That is a static web page, not a server, and it is built in the store-pages step. The app shows the same privacy text offline inside Settings (S11c).

### 4.3 · If the owner ever wants truly zero network

Drop AdMob and sell each game as a paid app, or make it free with no ads. The Shell is designed so ads can be switched off entirely with one configuration value. Every ad slot then simply stays empty, with no empty boxes or gaps.

## 9 · Offline behaviour quick table

| Feature | Online | Offline |
|---|---|---|
| Play levels, daily, endless | works | works |
| Save / statistics / settings / languages | works | works |
| Banner / interstitial ads | shown per rules | not shown, no message |
| Rewarded ad buttons | shown | hidden |
| Buy Premium | works | "Connect to buy" |
| Restore Premium | works | "Connect to restore" |
| Premium already owned | works | works |
| Consent step | shown where required | deferred until online |
| Tracking prompt (iPhone) | asked before the first ad | deferred until online |
| Rate / contact | opens store / email app | the OS handles it |

## 14 · Not in version 1

Do not build these unless the owner changes the spec:

- Accounts, cloud saves, online leaderboards, multiplayer, chat.
- Analytics, crash reporting services, remote config, push notifications.
- Subscriptions, coins, gems, lives that refill over time, loot boxes, any second purchase.
- Achievements and badges (possible later; they touch every system and are a common source of bugs).
- Daily archive (replaying past days).
- Sharing results (possible later as a text share through the phone's share sheet, which needs no network from us).
- Level editor, user-made levels.
- Tablet-specific layouts beyond a centred board.
- More languages (the system is built so adding one is only translation work).

## 15 · Definition of done (the Shell + pilot game)

The exit test for the Shell and the pilot. Every item needs its evidence in the release report. Items are cited as "spec 15.2" or "spec 15 item 2".

### 15.1 · Every screen in four languages

Every screen in spec 6 exists and works in en, de, fa, ckb. Screenshots in LTR and RTL, light and dark, phone and tablet show nothing cut off, overlapping or wrongly mirrored.

### 15.2 · A full airplane-mode run

A full airplane-mode run passes: first launch -> tutorial -> 10 levels -> daily -> stats -> settings -> all language switches.

### 15.3 · The network audit

The network audit passes: only the ads and store components can go online.

### 15.4 · Ads

Test ads appear only where spec 8.8 allows; the frequency rules pass their tests; Premium removes them instantly; consent appears before the first ad in a simulated EU region. On iPhone, Apple's tracking prompt appears after the consent step and before the first ad request, and declining it still shows ads.

### 15.5 · Premium

Buy, cancel, pending, error, restore and offline states are all tested with the stores' test tools. Premium works offline after purchase.

### 15.6 · Saving

Killing the app at any moment loses at most the move in progress; an upgrade from the previous save version is tested; a damaged save recovers from its backup.

### 15.7 · The pilot game

Every shipped level is proven winnable; bots show a sensible difficulty curve; the owner has play-tested it and signed off.

Owner decision O6 (2026-09-30): the play-test is the owner's personal step. Every report lists it under "Owner steps (not blocking)" until the owner has done it, and no gate or release waits for it.

### 15.8 · The next game can start

Spec 12's steps are written down, so game 2 can start from the Shell without guesswork.

## 17 · The owner's requirements and where they are covered

| Requirement | Covered by |
|---|---|
| "One framework with all pages; reuse it for every game" | 1, N5, 10, 12 |
| "Each game is its own application" | N4, 1.1, 8.9 |
| "Homepage" | S4 |
| "Statistics" | S10 |
| "Settings" | S11 |
| "Levels" | S8, 8.1 |
| "Google AdMob" | 8.8, 4 |
| "Purchase section, EUR 1.99" (decided 2026-09-30, owner O2) | S12, 8.9, D3 |
| "Multi-language, LTR and RTL: English, German, Persian, Kurdish Sorani" | N6, S2, 7 |
| "Offline, no user account, no internet requests" | N1-N3, 4, 9 |
| "Build all the games from the research, one by one" | 13, 12 |

## Questions the platform step answered

| The spec asked | Answer |
|---|---|
| The exact consent requirements (4.2) | Google's consent SDK: refresh the consent status every launch, show the form after the tutorial and before the first ad, show the "Ad privacy choices" row only where it is required |
| iPhone tracking permission (4.2 point 3, D4) | decided 2026-09-30 (owner, O1): after the S3 intro and Google's form, Apple's tracking prompt while not yet answered, then the first ad request; declining still shows ads |
| Can direction switch live, or is a restart needed (S11)? | a direction change needs one restart ("Restart to apply", one tap) |
| How does "copy back" work between games (1.2, 12)? | there is no copying: one monorepo, and every game app consumes the same Shell package |
| Where does the game contract live (10)? | the `GameModule` type in the pure game kit |
| Where does per-game configuration live (11)? | one `game.config.ts` per app |
| Device backup includes the save (D5) | yes; the save file is made self-contained when the app goes to the background |

## Who does what

- Claude Code builds, tests and releases everything, and reports in plain language with evidence.
- The owner reviews, play-tests and does only what needs a person: their identity, money, judgement or phone. For example: Apple and AdMob accounts and agreements, the app name and the App Store Connect app record for each game (created with the fixed bundle id), the real AdMob ids, the App Privacy questionnaire, the TestFlight play-test and purchase test, and "ship" / "submit" for each release. Already decided by the owner (2026-09-30), so never asked again: tracking follows Apple's rules (O1), Premium costs EUR 1.99 (O2), Family Sharing for Premium stays off (O3), and every app id is `io.applander.<game id without hyphens>` (O4; Line Siege `io.applander.linesiege`): the owner no longer chooses or approves a bundle id.
- The owner's personal steps never block (O6, 2026-09-30): the native review of the Persian and Sorani texts, the Line Siege play-test, and listening to the sound previews. Claude drafts the texts in all four languages and renders the previews; every slice or release report lists the three under "Owner steps (not blocking)" with what is waiting, and no gate waits for them.
- The stack in one line: Expo SDK 57 (React Native 0.86.3, React 19.2.3), TypeScript 6.0.3, React Navigation 7, Zustand 5, SQLite, react-intl, Skia with Reanimated and Gesture Handler for boards (no game engine), AdMob, expo-iap, Jest and Maestro, built locally with Xcode 26.6.
