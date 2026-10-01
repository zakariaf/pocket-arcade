# 16 · Open decisions and their defaults

The owner decides these. Until the owner says otherwise, use the default and say so in the report. When a default stops working (it blocks the task or contradicts a non-negotiable), stop and ask with one short message that names the decision and the default. A decision the owner has settled says "Decided" with the owner's decision id (O1-O6, 2026-09-30); follow it, never the old default.

## Contents

- Spec decisions D1-D9
- Decisions found while planning the platform
- Owner decisions of 2026-09-30
- Lead decisions of 2026-09-30
- Spec gaps with working defaults

## Spec decisions D1-D9

### D1 · Pilot game

Default: Line Siege.

### D2 · What Premium includes

Default: removes all ads, and hints and continues become free. Levels are never sold.

### D3 · Exact price

Decided (owner, O2, 2026-09-30): EUR 1.99, an App Store price point, in the German (DEU) base territory; Apple derives the other territories' prices from it. The app always shows the store's localised price text and never types a price anywhere (S12, spec 8.9). The product-creation step targets exactly EUR 1.99 and stops only if Apple no longer offers that price point. This replaces the spec's first default (the nearest price the store allows to a slightly lower target).

### D4 · Tracking permission on iPhone

Decided and reversed (owner, O1, 2026-09-30): ask. The owner follows Apple's rules (App Review guideline 5.1.2(i), App Tracking Transparency): on iPhone the app asks Apple's tracking question before any ad request that could use the device's advertising identifier (IDFA). The order is fixed (S3): the Shell's short consent intro (only when Google's consent form follows), then Google's consent form (only where Google requires it), then Apple's system prompt while the player has not answered it yet, then the first ad request. A player who declines (or whose phone restricts tracking) still sees ads, served without the advertising identifier. The prompt never appears with ads switched off (every E2E test build), for Premium, offline, before the tutorial is finished or during a level. Its explanation text is the Shell text `consent.tracking.usage-description` in all four languages. (The old default "no, not in v1" is retired everywhere.)

### D5 · Device backup of the save

Allow the phone's own device backup to include the save (progress follows players to a new phone)? Default: yes.

### D6 · Framework and app names

Default: decided in step 2 ("Name it"). Until then the package scope `@e07/*` and the working titles are placeholders; game ids stay as they are. The store ids are already decided (owner, O4): every app's bundle id and Android package is `io.applander.<game id without hyphens>`, all lowercase (`io.applander.linesiege`), and its Premium product is `<bundle id>.premium`.

### D7 · German informal "du"

Default: yes (normal for games).

### D8 · Audience and age rating

Default: general audience, not designed for children.

### D9 · Level count per game in v1

Default: 3 packs x 30 levels, plus Daily; Endless where it fits.

## Decisions found while planning the platform

| Decision | Default until the owner decides |
|---|---|
| Apple guideline 5.1.2: "Data used to track you" for AdMob's device ID, and the tracking prompt (with D4) | Decided (owner, O1): ask with Apple's tracking prompt after Google's consent form (D4); the App Privacy answers declare Device ID as collected, linked to the player and used for tracking by the third-party ads SDK (Google Mobile Ads) |
| Premium price (D3) | Decided (owner, O2): EUR 1.99; the app shows only the store's localised price |
| Family Sharing for Premium (irreversible once turned on) | Decided (owner, O3): off. The StoreKit configuration says `familyShareable: false`, the App Store Connect steps leave Family Sharing off, and it is never turned on |
| Keep the Expo Claude Code plugin from the app template | kept, with the agent instructions forbidding EAS and over-the-air updates |
| Interpretation of spec 8.8 "never twice in a row after losses" | two consecutive interstitials may not both follow a loss |
| Letter Bugs word lists for Persian and Sorani (licences) | build Letter Bugs late |
| Native-speaker reviewer for Persian and Sorani | Decided (owner, O6): the owner reads the fa and ckb texts personally. Claude writes all four languages, lists the texts waiting for the owner in every report under "Owner steps (not blocking)", and nothing waits for the review (no release gate, no waiver) |
| Toybox details the mockup leaves open: one dark ink for all games or a per-game tint | as the mockup's palette data (a per-game tint) |
| Toybox detail: the hold-to-reset label at 4.43:1 contrast in light mode | Decided (owner, O5): every text meets WCAG 4.5:1 in every state, the hold-to-confirm label included while its danger fill grows; the light theme's `dangerFill` becomes `#FFDCDF` (danger text on it 4.52:1), with no contrast exception anywhere |

## Owner decisions of 2026-09-30

The owner answered these directly; they are settled, not defaults, and they override any older default or text in the other references.

| Id | Decision | What it changes |
|---|---|---|
| O1 | Follow Apple's tracking rules (guideline 5.1.2(i), App Tracking Transparency) | Reverses D4: S3's intro (only when Google's form follows), then Google's consent form when required, then Apple's tracking prompt while unanswered, then ads. Declined or restricted: ads still show without the advertising identifier. Never with ads off, Premium, offline, before the tutorial or during a level. New Shell text `consent.tracking.usage-description` (the prompt's explanation, in all four languages; fa and ckb for the owner's review). App Privacy: Device ID used for tracking by the ads SDK |
| O2 | Premium costs EUR 1.99 | D3 decided: an App Store price point; the app shows only the store's localised price |
| O3 | No Family Sharing for Premium | Off in the StoreKit configuration and in App Store Connect, never turned on |
| O4 | Every app id is `io.applander.<game id without hyphens>`, all lowercase | iOS bundle id and Android package alike (Line Siege: `io.applander.linesiege`); Premium is `<bundle id>.premium` (`io.applander.linesiege.premium`). The scaffold writes the ids; the owner no longer chooses or approves a bundle id, only the app name |
| O5 | Standard contrast everywhere | Every text meets 4.5:1 in every state; light `dangerFill` `#FFDCDF` |
| O6 | The owner's personal steps never block | The native review of fa and ckb texts, the Line Siege play-test and listening to the sound previews are done by the owner personally. Claude drafts the texts, renders the previews and lists all three in every slice or release report under "Owner steps (not blocking)"; no gate waits for them |

## Lead decisions of 2026-09-30

The lead decided these while proving the pilot (Line Siege) against the Toybox design; they are settled, not defaults. The spec's own wording in the other references stays as written; each screen entry names the decision it follows.

| Id | Screens | Decision |
|---|---|---|
| L1 | Settings (S11), Pause menu (S6) | A game without music hides the Music on/off and Music volume rows and the Pause menu's Music key; the rows below close up and the other keys share the row. Parity uses the design's no-music variants of S11 and S6, chosen from the game's facts. |
| L3 | Result screen (S7) | A score-rated level (the stars rule is by score, as in Line Siege) shows "Score {score} – best {bestScore}" on a win instead of "{moves} moves – par {par}" (new Shell text `result.win.score-line` in all four languages; fa and ckb for the owner's review, O6; the moves-only line `result.win.moves-count` is retired). Parity uses the design's score-line variant of the S7 win. |
| L4 | How to play / Tutorial (S13) | Line Siege's fourth teaching step says "The monsters march closer every few blocks." (tutorial: "Careful: the monsters march closer every few blocks."), in all four languages, because the tuned game marches every few placements (the owner question in `line-siege-rules.md` is answered). |
| L6 | Game screen (S5), Pause menu (S6), Result screen (S7) | These screens have no board design reference: every game brings its own board. Parity compares the Shell's parts (top bar, frame) and the overlays (Pause, Result) and masks the board area that the game's board layout reports. |
| L7 | Home (S4), Daily challenge (S9) | Tapping the daily card on Home opens the Daily challenge screen (S9); the card's Play key starts today's challenge. When today is done, the card still opens S9. Nothing changes in the design's pixels, and no new text is added. |
| L8 | Game screen (S5), Pause menu (S6) | A game without solver hints (its rules say `hints: none`; Line Siege) has the game fact "has hints" false: its top bar shows no Hint key, and the Pause menu shows no hint entry. Parity uses the design's no-hints variants, chosen from the game's facts like L1's no-music variants. |
| L9 | Result screen (S7) | The big score number (the level, daily and endless results) in Persian and Sorani gets the same taller line as the level numbers (L2), so the digits are not clipped. |

The lead also fixed two design details that change no product rule: the Persian and Sorani level-tile numbers get a taller line (L2, so the digits are not clipped) and the About footer's "Version" label sits next to its number like every other label and value (L5).

## Spec gaps with working defaults

Found while designing the save; each needs an owner answer eventually. Until then, build the default and name the gap in the report.

| Gap | Working default |
|---|---|
| Both save copies (current and backup) are damaged; S14 only defines "a backup copy was restored" | show "Your progress couldn't be loaded." and start fresh; the bad copies are quarantined, never deleted (the text needs its own catalog key in all four languages) |
| Does "Reset statistics" also zero the Levels and Daily cards on S10? | no: levels completed, stars and daily streaks are derived from progress and daily results, so only "Reset all progress" clears them |
| Does a lost daily attempt count for the streak? | yes: the first finished attempt of the day counts, win or lose |
| Should S3's intro also show when only Apple's tracking prompt follows (outside the regions where Google's form is required)? Spec draft 2 says yes; the platform decision says no | no: the intro shows only before Google's form, because its footnote (`consent.intro.footnote`) says Google's form opens next; Apple's prompt then follows on its own, with our sentence in it. Showing it before Apple's prompt alone needs a footnote text that fits both cases and a status read on the consent port |
| A database written by a newer app version (only a downgrade, such as an older TestFlight build, can cause it) | never crash (spec 8.14): open it read-only, play in memory, and show the S14 "please update" dialog |
