# 16 · Open decisions and their defaults

The owner decides these. Until the owner says otherwise, use the default and say so in the report. When a default stops working (it blocks the task or contradicts a non-negotiable), stop and ask with one short message that names the decision and the default.

## Contents

- Spec decisions D1-D9
- Decisions found while planning the platform
- Lead decisions of 2026-09-30
- Spec gaps with working defaults

## Spec decisions D1-D9

### D1 · Pilot game

Default: Line Siege.

### D2 · What Premium includes

Default: removes all ads, and hints and continues become free. Levels are never sold.

### D3 · Exact price

Default: EUR 1.90 where the store allows; otherwise the nearest price point (for example EUR 1.99 on Apple). When EUR 1.90 is not an Apple price point, the product-creation step stops and asks.

### D4 · Tracking permission on iPhone

Ask iPhone players for tracking permission (more ad revenue, one extra system prompt)? Default: no, not in v1. Ads are still shown, just not personalised.

### D5 · Device backup of the save

Allow the phone's own device backup to include the save (progress follows players to a new phone)? Default: yes.

### D6 · Framework and app names

Default: decided in step 2 ("Name it"). Until then the package scope `@e07/*` and the working titles are placeholders; game ids stay as they are.

### D7 · German informal "du"

Default: yes (normal for games).

### D8 · Audience and age rating

Default: general audience, not designed for children.

### D9 · Level count per game in v1

Default: 3 packs x 30 levels, plus Daily; Endless where it fits.

## Decisions found while planning the platform

| Decision | Default until the owner decides |
|---|---|
| Apple guideline 5.1.2: declare "Data used to track you" for AdMob's device ID while showing no tracking prompt (with D4) | declare it as the ads SDK's privacy manifest says, no prompt; add the prompt only if App Review objects |
| Premium price when EUR 1.90 is not an Apple price point (D3) | the product-creation script stops and asks; the spec's example is EUR 1.99 |
| Family Sharing for Premium (irreversible once turned on) | off |
| Keep the Expo Claude Code plugin from the app template | kept, with the agent instructions forbidding EAS and over-the-air updates |
| Interpretation of spec 8.8 "never twice in a row after losses" | two consecutive interstitials may not both follow a loss |
| Letter Bugs word lists for Persian and Sorani (licences) | build Letter Bugs late |
| Native-speaker reviewer for Persian and Sorani | the release script refuses unreviewed texts unless the owner records a waiver |
| Toybox details the mockup leaves open: one dark ink for all games or a per-game tint; the hold-to-reset label at 4.43:1 contrast in light mode | as the mockup's palette data (per-game tint; the danger fill unchanged) |

## Lead decisions of 2026-09-30

The lead decided these while proving the pilot (Line Siege) against the Toybox design; they are settled, not defaults. The spec's own wording in the other references stays as written; each screen entry names the decision it follows.

| Id | Screens | Decision |
|---|---|---|
| L1 | Settings (S11), Pause menu (S6) | A game without music hides the Music on/off and Music volume rows and the Pause menu's Music key; the rows below close up and the other keys share the row. Parity uses the design's no-music variants of S11 and S6, chosen from the game's facts. |
| L3 | Result screen (S7) | A score-rated level (the stars rule is by score, as in Line Siege) shows "Score {score} – best {bestScore}" on a win instead of "{moves} moves – par {par}" (new Shell text `result.win.score-line` in all four languages; fa and ckb for native review; the moves-only line `result.win.moves-count` is retired). Parity uses the design's score-line variant of the S7 win. |
| L4 | How to play / Tutorial (S13) | Line Siege's fourth teaching step says "The monsters march closer every few blocks." (tutorial: "Careful: the monsters march closer every few blocks."), in all four languages, because the tuned game marches every few placements (the owner question in `line-siege-rules.md` is answered). |
| L6 | Game screen (S5), Pause menu (S6), Result screen (S7) | These screens have no board design reference: every game brings its own board. Parity compares the Shell's parts (top bar, frame) and the overlays (Pause, Result) and masks the board area that the game's board layout reports. |

The lead also fixed two design details that change no product rule: the Persian and Sorani level-tile numbers get a taller line (L2, so the digits are not clipped) and the About footer's "Version" label sits next to its number like every other label and value (L5).

## Spec gaps with working defaults

Found while designing the save; each needs an owner answer eventually. Until then, build the default and name the gap in the report.

| Gap | Working default |
|---|---|
| Both save copies (current and backup) are damaged; S14 only defines "a backup copy was restored" | show "Your progress couldn't be loaded." and start fresh; the bad copies are quarantined, never deleted (the text needs its own catalog key in all four languages) |
| Does "Reset statistics" also zero the Levels and Daily cards on S10? | no: levels completed, stars and daily streaks are derived from progress and daily results, so only "Reset all progress" clears them |
| Does a lost daily attempt count for the streak? | yes: the first finished attempt of the day counts, win or lose |
| A database written by a newer app version (only a downgrade, such as an older TestFlight build, can cause it) | never crash (spec 8.14): open it read-only, play in memory, and show the S14 "please update" dialog |
