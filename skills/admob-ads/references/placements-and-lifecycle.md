# Placements, fullscreen lifecycle and offline behaviour

## Contents

- AdsPort and the AdMob adapter
- Banner: AdBannerSlot on Home, Levels, Statistics
- Interstitial: the Result-screen flow
- Rewarded perks: hint and continue
- Pausing the game around fullscreen ads
- Preloading at quiet moments
- ConnectivityPort and offline behaviour

## AdsPort and the AdMob adapter

```ts
export type AdsPort = {
  readonly initialize: () => Promise<void>; // after consent: request configuration + initialize; idempotent
  readonly preloadInterstitial: () => void;
  readonly preloadRewarded: () => void;
  readonly rewardedStatus: () => RewardedStatus; // 'loading' | 'ready' | 'unavailable' (L11)
  readonly subscribeRewardedStatus: (listener: () => void) => () => void; // useSyncExternalStore
  readonly showInterstitial: () => Promise<FullscreenResult>; // 'shown' | 'unavailable'; never rejects
  readonly showRewarded: () => Promise<RewardResult>; // 'rewarded' | 'dismissed' | 'unavailable'
  readonly renderBanner: (props: BannerSlotProps) => ReactNode;
};
```

Facts behind `admob-ads-adapter.ts` (read in the 17.2.0 source and the library's shipped `AGENTS.md`):

- It keeps the classic create/load/show API on purpose. The v17 fullscreen hooks (`useInterstitialAd`, `useRewardedAd`, ...) tie ads to component lifetime, and preload pools (`AdPools`, `AdPoolProvider`, `usePooledAd`) start preloading as soon as they are created (on Android they also initialise the SDK); display pools and multi-format requests need Ad Manager units. The Shell instead preloads at quiet moments and applies caps in pure code. The library recommends hooks, so the adapter says in a comment that this is deliberate.
- `show()` rejects when the ad is not loaded, already showing or declined, and throws synchronously on a destroyed ad. The adapter checks `loaded` first and turns rejections into `'unavailable'`, so callers never handle exceptions.
- There is no `SHOW_FAILED` event: a show failure arrives as `AdEventType.ERROR` with `phase: 'show'`, and no `CLOSED` follows. The native `show()` resolves as soon as it asks iOS to present (read in the 17.2.0 iOS source), so a presentation that fails later reaches JS only as that `ERROR`. The adapter's show promise therefore settles on `CLOSED`, on `ERROR` and on a rejected `show()`; without the `ERROR` branch the promise never settles, `runFullscreenAd` never resumes the game and the Next / Replay handler never navigates. `admob-ads-adapter.test.ts` and the behaviour check both cover it.
- A fullscreen ad object is used once; after `CLOSED` it is destroyed and the caller preloads the next one.
- **The rewarded status (L11, D64).** `RewardedStatus = 'loading' | 'ready' | 'unavailable'` replaces round 4's loaded flag (`isRewardedLoaded`, `subscribeRewardedLoaded`): `'loading'` from the start of a preload until `LOADED` or a load error, `'ready'` after `LOADED`, and `'unavailable'` after a load error until the next preload starts, once the loaded ad was shown, with ads off and before `initialize` (a preload before `initialize` starts nothing). Every change tells the `subscribeRewardedStatus` listeners. The factory's ads-off port and `fake-ads.ts` answer the same way (the fake starts at its scripted `rewardedStatus`, and `setRewardedStatus(status)` moves it and tells the subscribers). `check-ads.mjs` rule `rewarded-status` fails a port or adapter without the two members and any code that still uses the round-4 names; `check-ad-behaviour.mjs` rule `adapter-rewarded-status` runs the transitions against the SDK stand-in.
- The rewarded ad grants only on `RewardedAdEventType.EARNED_REWARD`; `CLOSED` alone resolves `'dismissed'`.
- Errors: branch on `error.phase` first, then `error.reason`; never on the legacy `error.code` (deprecated in 17.2.0, removed in v18). Load-phase `no-fill` / `mediation-no-fill` is routine inventory and is not logged; everything else goes to `onAdError` (ErrorLogPort), never to the player.
- The banner uses `BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER`; `ANCHORED_ADAPTIVE_BANNER` is deprecated in 17.2.0 (typescript-eslint `no-deprecated` flags it). It is created with `createElement` so the adapter stays one `.ts` file.
- `fake-ads.ts` (`createFakeAds(script)`) records calls in order; it is used by Jest, by `ADS_MODE=off` builds and by the debug "Never show ads" switch.

## Banner: AdBannerSlot on Home, Levels, Statistics

```tsx
<AdBannerSlot
  renderBanner={ads.renderBanner}
  isAllowed={shouldShowBanner(config, context, 'home')}
  testID="home.banner-ad"
  loadedStyle={bannerBandStyle}
/>
```

- Only three places: `home.banner-ad`, `levels.banner-ad`, `stats.banner-ad` (testIDs follow `<screen>.<element>`). The design marks these slots as dynamic pixels (geometry only).
- `isAllowed` always comes from `shouldShowBanner(config, context, '<screen>')`: inline as above, or, when the view takes a view model (the screen work's `home-view.tsx` passes `model.banner.isAllowed && !model.isPremium`), computed with `shouldShowBanner` in the model hook. `check-ads.mjs` accepts both and fails when no runtime code asks the policy for that screen.
- The Toybox banner band: in the design, the `*.banner-ad` element is a full-width band (402 x 66 on the 402 pt reference phone: `paddingBlock` 6, 2 pt dashed `adLine` rules top and bottom, `adBackground` fill, the ad centred), not the bare ad. Pass that style as `loadedStyle`: `const bannerBandStyle = useBannerBandStyle();` from the Toybox components' `ui/use-banner-band-style.ts` (its values come from the banner-slot spec). The slot applies it only after `onLoaded`, so an empty or failed slot still takes no space. Never wrap the slot in a component that renders nothing until an ad has loaded: the native banner has to be mounted to load at all.
- `ui/ad-banner-slot.tsx` is presentational and never imports `services/` (the UI boundary rule), so the screen passes `ads.renderBanner` in.
- The slot has zero height until `onLoaded` fires, and collapses again on `onFailed`: a failed or offline load leaves no empty box (spec S4) and no message.
- `isAllowed` is recomputed from the stores on every render, so buying Premium, going offline or withdrawing consent removes the banner at once.
- Place it below the screen's scroll content and above the bottom safe-area inset, never overlapping controls.
- Design parity: the Toybox design draws each banner slot as a 320 x 50 placeholder inside the band. In a parity capture (test build, `ADS_MODE=off`, the visual-parity launch argument) the test-only parity code passes a `renderBanner` that draws that placeholder and calls `onLoaded` at once, and `isAllowed` follows the frame's Premium flag, so the band's position and size can be checked (with `loadedStyle` it is the design's 402 x 66) while its pixels are masked. That code lives with the parity harness behind the test-only entry; never add a placeholder to `AdBannerSlot`, the adapter or `fake-ads.ts`, because a normal `off` build must show no box at all.
- Open item: whether a banner inside a zero-height container still receives `onAdLoaded` was not verified on a device. Confirm in the first `ADS_MODE=test` simulator smoke; if it does not load, render it off-screen with `position: 'absolute'` and `opacity: 0` until loaded, and update the template and its test.

## Interstitial: the Result-screen flow

`ad-moments.ts` holds the only two places a fullscreen ad may appear.

1. The level ends. The game session saves stars, statistics and `recordLevelEnd(history, outcome)` before the Result screen appears (spec S7): the composition root passes `extendRunEnd: recordAdLevelEnd` to the game host, so the ad history joins the one run-end update.
2. The player reads the result and taps Next / Replay / Try again.
3. That button's handler calls `showInterstitialIfDue(deps, { config, context, history, trigger: { outcome, nowMs: clock.nowMs() } })`, saves the returned history, then navigates. No ad is ever shown on top of the result, and never from a mount effect of the Result screen.
4. `showInterstitialIfDue` returns the history unchanged when the policy says no; otherwise it runs the ad inside `runFullscreenAd`, preloads the next one, and returns `recordInterstitialShown(trigger)` only when the result was `'shown'`.

## Rewarded perks: hint and continue

- The hint and continue buttons render from `perkOffer(perk, { config, context, rewardedStatus })`. `rewardedStatus` is read with `useSyncExternalStore(ads.subscribeRewardedStatus, ads.rewardedStatus)` (toybox-screens' `use-perk-payment.ts`), so the offer follows the ad: a continue whose ad is loading shows its loading state, turns ready when `LOADED` arrives, and a hint button appears only once an ad is ready.
- `'watch-ad'` shows the "Watch an ad to ..." label (continue: copy key `result.lose.continue-ad`; Premium: `result.lose.continue-premium`) and calls `earnRewardedPerk(deps)`; the perk runs only if it returns `true`.
- `'loading'` (a continue only, L11): S7 draws the same offer with the ad key busy (`LoseResult.continueOffer` `'ad-loading'`: the label kept, three hopping blocks for the icon, `accessibilityState` busy, not pressable, testID `result.continue-ad-button`); no new copy.
- `'hidden'` always means the perk cannot be had. For a lost run that means nobody can continue it, so the run ends at once and its result shows (L11, game-host-integration's `isLossStranded`): the endless result with its score and "New best!", or the lose result without the offer. The same happens when a shown offer turns hidden (offline, a load error).
- A hint during play pauses the level before the ad (the lifecycle does it) and returns to the same state.
- The reward amount and type set in the AdMob console are ignored: one ad = one hint or one continue.

## Pausing the game around fullscreen ads

On iOS a Google fullscreen ad does not background the app (AppState stays `active`), so the Shell suspends the frame loop and the `AudioContext` itself:

```ts
export async function runFullscreenAd<T>(lifecycle: GameLifecycle, show: () => Promise<T>): Promise<T> {
  lifecycle.suspend('fullscreen-ad');
  try {
    return await show();
  } finally {
    lifecycle.resume('fullscreen-ad');
  }
}
```

`suspend` stops frame callbacks and suspends audio; `resume` restarts them with a clamped `dt`. `fullscreen-ad.test.ts` proves the order (suspend, show, resume) and that the game resumes when the ad fails. Real-time games stay paused after an ad and show the Pause overlay, as after backgrounding. The game loop itself belongs to the game-host work; this skill only calls `suspend`/`resume`. The `GameLifecycle` to pass is the game host's full-screen gate (`host.lifecycle`, made by `createFullscreenGate()` in the game-host work): it flips one `isShowing` flag that `useIsFullscreenAdShowing(host.lifecycle)` hands to the board lifecycle and to the Shell's audio lifecycle. Use that same gate for the Result-screen interstitial and for rewarded perks; a second, private lifecycle object would leave the music playing under the ad.

## Preloading at quiet moments

Preloading happens only at quiet moments: in `prepareAds` (the consent moment, the first time a banner screen is open), right after each fullscreen ad, and when a level starts if nothing is loaded. Play never waits for an ad.

## ConnectivityPort and offline behaviour

```ts
export type ConnectivityPort = {
  readonly isOnline: () => boolean; // last known value; false until the first report
  readonly subscribe: (listener: (isOnline: boolean) => void) => () => void;
};
```

`expo-network-connectivity-adapter.ts` uses `expo-network` 57 (`NWPathMonitor` on iOS; no HTTP probe, unlike the banned `@react-native-community/netinfo`). Online means `isConnected === true && isInternetReachable !== false`; an unknown state counts as offline. `fake-connectivity.ts` backs Jest only. The test-only "Simulate offline" switch (S15, and the debug link's `offline=0|1`) is the e2e-maestro skill's `SimulatedConnectivity` (`packages/shell/src/screens/debug/simulated-connectivity.ts`): in test builds the composition root wraps the real adapter once, `TEST_ONLY?.createSimulatedConnectivity(real) ?? real`, and hands that one port to every service, so flipping it through `debugServices.setOffline` notifies the ad policy, the connectivity-gated store and S12 alike. `expo-network-connectivity-adapter.test.ts` drives the adapter against a factory mock of `expo-network` (read with `jest.requireMock`): offline until the first report, following later reports, an error counts as offline, and unsubscribe.

| Situation | Banner | Interstitial | Rewarded button | Consent |
|---|---|---|---|---|
| Online, consent handled, not Premium | shown when loaded | per the ad policy | shown when loaded | refreshed at launch |
| Offline | slot collapsed, no message | never | hidden | refresh fails -> cached `canRequestAds`; form deferred |
| Premium | never | never | perks free | not requested |
| `canRequestAds` false | never | never | hidden | the privacy row lets the player change it |
| `ADS_MODE=off` / `isEnabled: false` | never | never | hidden (hints: free allowance only) | never requested |

Never show an error, a spinner or a "please connect" message for ads (spec 4.1 and 8.8).
