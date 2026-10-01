# The ad policy (spec 8.8 as pure functions)

## Contents

- Spec 8.8, N8 and 8.10 (the source rules)
- ad-policy.ts: canServeAds, shouldShowBanner, shouldShowInterstitial
- ad-history.ts: what is saved and when
- perk-offer.ts: free, watch-ad or hidden
- Interpretations the tests pin
- Tests and mutation boundaries

## Spec 8.8, N8 and 8.10 (the source rules)

N8, ads never interrupt play: no ad during a level, during the tutorial, or on app start; full-screen ads only between levels, with frequency limits; banners only on menu screens.

Spec 8.8 formats:

- **Banner.** Bottom of Home, Levels, Statistics only. Never on the Game, Pause, Result, Premium, tutorial or dialog screens. Shown only if not Premium and online and consent handled; when no banner loads, the space collapses (no empty box, spec S4).
- **Interstitial** (full-screen). Only after the player taps Next / Replay / Try again on the Result screen, and only when all of these hold: not Premium, online, consent handled; the tutorial is finished and the player has completed at least 3 levels in total; at least 3 minutes since the last interstitial; at least 2 completed levels since the last one; never twice in a row after losses (a losing player gets a break).
- **Rewarded.** Always the player's choice, with a clear "Watch an ad to ..." label: get a hint (when out of free hints); continue once after losing (games that allow it). The reward is given only when the ad completes. If no ad is available (offline), the button is hidden, not broken.

Consent and tracking come before every format: the Shell's S3 moment and Google's form where required, then Apple's App Tracking Transparency prompt while not-determined (owner decision O1, guideline 5.1.2(i)), and only then does the SDK initialize (references/consent-flow.md). The ATT answer never changes this policy: a declined, restricted or unavailable answer serves the same ads without the IDFA, and no feature, perk or Premium depends on it.

General rules: all frequency numbers are per-game configuration values, not hard-coded; ad slots never overlap game controls (accidental taps must be impossible); development and test builds use only Google's test ads; ads load in the background at quiet moments and play never waits for an ad; a failed load is silent; Premium removes banners and interstitials immediately and turns rewarded perks into free perks; content filters (no gambling or other sensitive categories) are set in the AdMob console; the audience is general, not designed for children (decision D8), so child-directed ad rules do not apply.

Spec 8.10, continue after losing: games may allow one continue per level or run; the cost is a rewarded ad, or free with Premium; offline and not Premium means no continue. Decision D2: Premium removes all ads, and hints and continues become free; levels are never sold.

## ad-policy.ts: canServeAds, shouldShowBanner, shouldShowInterstitial

`templates/packages/shell/src/services/ads/ad-policy.ts` has no SDK, no clock and no storage: everything is an input.

- `AdPolicyConfig` (from `game.config.ts`, embedded as `extra.game.adPolicy`): `isAdsEnabled`, `minLevelsCompletedBeforeFirst` (3), `minMsBetweenInterstitials` (180 000), `minLevelsCompletedBetween` (2). Pass `isAdsEnabled` as the game's master switch AND `adsMode !== 'off'` (and false under the debug "Never show ads" switch), the same value the consent gate gets. `useAdPolicyConfig` (`app/use-ad-context.ts`) applies the test build's debug switches through `debugAdPolicy(config, useOptionalDebugServices()?.adsOverride() ?? null)`: `never` turns ads off, `always-test` sets the three pacing numbers to 0 so a tester sees an ad at every chance; neither turns on an `ADS_MODE=off` build or reaches a Premium player. Store builds have no debug services, so the policy is unchanged there.
- `AdContext` (live facts at decision time): `isPremium`, `isOnline` (ConnectivityPort), `canRequestAds` (ConsentPort), `isTutorialDone`, `levelsCompletedTotal` (levels won, all time).
- `AdHistory` (persisted): `lastInterstitialAtMs`, `levelsCompletedSinceInterstitial`, `didLastInterstitialFollowLoss`.
- `canServeAds(config, context)` = ads enabled and not Premium and online and consent handled. Every format uses it.
- `shouldShowBanner(config, context, screen)` = `canServeAds` and tutorial done and `screen` is one of `BANNER_SCREENS` (`home`, `levels`, `stats`).
- `shouldShowInterstitial({ config, context, history, trigger })`, where `trigger = { outcome: 'win' | 'lose', nowMs }`:
  1. false unless `canServeAds` and tutorial done;
  2. false while `levelsCompletedTotal < minLevelsCompletedBeforeFirst`;
  3. false when the outcome is `lose` and the last interstitial also followed a loss;
  4. true when no interstitial was shown yet (or the stored time lies in the future: the clock moved back);
  5. otherwise true only when both `elapsed >= minMsBetweenInterstitials` and `levelsCompletedSinceInterstitial >= minLevelsCompletedBetween`.

`nowMs` comes from the ClockPort (wall time); the policy never reads a clock itself.

## ad-history.ts: what is saved and when

- `EMPTY_AD_HISTORY`: nothing shown yet.
- `recordLevelEnd(history, outcome)`: every finished level, before the Result screen appears (saved with the stars). A win adds one to `levelsCompletedSinceInterstitial`; a loss changes nothing. The call site is the composition root (game-host-integration's `create-shell-parts.ts`): it passes `extendRunEnd: recordAdLevelEnd` to `createGameHost`, and `recordAdLevelEnd(doc, summary)` returns the doc with `ads.history = recordLevelEnd(doc.ads.history, summary.isWon ? 'win' : 'lose')` for level runs only (daily, endless and tutorial runs change nothing). It joins the host's ONE run-end update, so the history and the stars are saved together. Without it `levelsCompletedSinceInterstitial` never rises and, after the first interstitial, no second one is ever due (`minLevelsCompletedBetween` is never reached); `check-ads.mjs` fails `level-end-recorded` when the root passes no `extendRunEnd` or the function it passes does not call `recordLevelEnd`.
- `recordInterstitialShown({ nowMs, outcome })`: only when the interstitial was actually shown; resets the counter and remembers whether it followed a loss.
- The history lives in the save document's ads section and is written after every level end and every shown interstitial, so killing the app does not reset the caps. (The save document itself belongs to the save-persistence work; this skill only defines the three fields.)

## perk-offer.ts: free, watch-ad or hidden

`perkOffer(perk, { config, context, isRewardedLoaded })` returns how a hint or a continue is offered:

| Situation | Result |
|---|---|
| Continue not allowed by the game, or already used this level | `hidden` |
| Premium (online or offline) | `free` |
| Hint with free hints left today | `free` |
| Ads may be served and a rewarded ad is loaded | `watch-ad` |
| Anything else (offline, no consent, ads off, nothing loaded) | `hidden` (never a broken button) |

`free` runs the perk directly. `watch-ad` shows "Watch an ad to ..." and calls `earnRewardedPerk`; the perk runs only when that returns `true`. A dismissed ad changes nothing and says nothing.

## Interpretations the tests pin

- "Completed levels" means levels won; the tutorial level does not count.
- "At least 3 minutes and 2 completed levels since the last one" applies only once an interstitial has been shown; before that only the "3 levels in total" rule gates.
- "Never twice in a row after losses" means two consecutive interstitials may not both follow a lost level. With the default numbers it almost never triggers (losses add no completed levels), but the numbers are configurable. If the owner meant "no interstitial after two consecutive lost levels", only `shouldShowInterstitial` and its test change.
- A stored last-shown time in the future (clock moved backwards) is ignored; the level-count rule still applies.

## Tests and mutation boundaries

`ad-policy.test.ts` (template) covers: first interstitial at 3 completed levels (and not at 2); blocked when Premium, offline, consent not handled, tutorial running; 3 minutes AND 2 levels since the last one (179 999 ms fails, 180 000 passes; one win fails); a second interstitial after losses is blocked but a win is not; exactly 3 levels passes; the same millisecond as the last one fails; a future last-shown time is ignored; a fast-check property that a Premium player never gets an interstitial or a banner; banners only on the three screens and never with `isAdsEnabled: false`.

The two boundary cases ("exactly 3 completed levels" and "the same millisecond as the last one") exist because a mutation run (Stryker) left two survivors without them. Keep them.

`perk-offer.test.ts`: watch-ad only when loaded and servable; free for Premium and for the daily free hint; a forbidden or used continue is hidden even for Premium. The free hint count is the game's own: `useHintPerk(today)` (`app/use-ad-context.ts`) builds `{ kind: 'hint', freeHintsLeft: selectFreeHintsLeft(progress, today, extra.hints.freePerDay) }`, so a game whose `game.config.ts` gives `hints.freePerDay: 0` (no solver hints, Line Siege) never offers a free hint (`use-ad-context.test.tsx`); `check-ads.mjs` fails `free-hints-config` for a `selectFreeHintsLeft` call without the config's count or a hand-built hint perk. `ad-history.test.ts`: wins count, losses do not, a shown interstitial resets the counters.

The skill's `check-ad-behaviour.mjs` runs the same decision table against the repo's real `ad-policy.ts`, `ad-history.ts`, `perk-offer.ts`, `ad-gate.ts` and `ad-moments.ts` (through Node type stripping), so a weakened test cannot hide a broken rule.
