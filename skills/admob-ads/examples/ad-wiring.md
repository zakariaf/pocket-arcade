# Worked example: wiring ads into the Shell for Line Siege

A complete pass for the pilot game, in the order Claude does it. File names are the Shell's; the stores and screens around them belong to their own skills and are shown only where an ad call sits.

## 1. Install and config (every app)

```sh
cd apps/line-siege
npm install -E react-native-google-mobile-ads@17.2.0
npx expo install expo-network expo-constants
```

Copy from `templates/`: `packages/shell/src/config/{ads-config.ts,ads-config.test.ts,skadnetwork-ids.ts}` (and `app-variant.ts` if the repo lacks it), `packages/tooling/src/ads/refresh-skadnetwork.ts`, `__mocks__/react-native-google-mobile-ads.ts`. Then add one line to the plugin list in `packages/shell/src/config/with-shell.ts`:

```ts
['react-native-google-mobile-ads', admobPluginOptions(adsMode, game.ads.ids, SKADNETWORK_IDS)],
```

`apps/line-siege/game.config.ts` gets the `ads` section with `policy` 3 / 180_000 / 2 and the owner's IDs (step A2). Until they arrive, the documented-format placeholders stay and only test builds are made.

## 2. Services (copy, do not rewrite)

Copy `packages/shell/src/services/{ads,consent,connectivity}/*` and `packages/shell/src/ui/ad-banner-slot.tsx` with their tests. When the Shell app is created, build the ports once and put them into the services context:

```ts
const errorLog = createSqliteErrorLogAdapter(driver, clock);
const adsExtra = readAdsExtra(); // { adsMode, adUnits } embedded at build time
const ads = createAdsPort(adsExtra, (error) => {
  errorLog.record('ads', error);
});
// ADS_MODE=off (screenshots, E2E, ads-off games): a consent port that never calls Google UMP and
// never shows Apple's tracking prompt (requestTracking answers 'unavailable').
const consent = createConsentPort(adsExtra.adsMode, {
  onError: (error) => {
    errorLog.record('ads', error);
  },
});
// In test builds the real port is wrapped once, so the debug "Simulate offline" switch reaches every subscriber.
const realConnectivity = createExpoNetworkConnectivityAdapter();
const connectivity = TEST_ONLY?.createSimulatedConnectivity(realConnectivity) ?? realConnectivity;
// Screens start async ad work from synchronous handlers and end it with .catch(reportError).
const reportError = (error: unknown): void => {
  errorLog.record('ads', error);
};
```

In the test variant only, the debug menu receives `createAdmobConsentDebugAdapter()` from the test-only entry, and when the tester picks a geography it asks `debugServices.createConsent(geography)` (e2e-maestro's `debug-services.ts`, from `TEST_ONLY?.createDebugServices(...)`), which builds the port with `createConsentPort(adsExtra.adsMode, { debugGeography, onError })`, so an `ADS_MODE=off` build still never calls Google UMP.

## 3. Launch and Home: the consent moment

Nothing calls the ad gate by hand. `ShellFeatures` (game-host-integration's composition root) mounts the consent moment around the navigator:

```tsx
// shell-features.tsx
<ConsentMoment isHeld={props.isConsentMomentHeld} debug={props.debug.services}>
  <ShellNavigator debug={props.debug} initialState={props.initialState} />
</ConsentMoment>
```

`useConsentMoment` (in `app/use-consent-moment.ts`) creates one `ConsentMomentFlow` (`services/ads/consent-moment-flow.ts`) and feeds it the gate's facts: `isPremium` (Premium store), `isAdsEnabled` (the game's `extra.game.adPolicy.isAdsEnabled && adsExtra.adsMode !== 'off'`, and false while the debug "Never show ads" switch is on), `isTutorialDone` (settings) and `isOnline` (`useIsOnline`). Once per launch it runs `refreshConsentAtLaunch`. Home, Levels and Statistics ask for their ad moment through `useBannerSlot('<screen>')`, which calls `requestAdMoment()` while the screen is open; the flow then runs `prepareAds` once per session:

```ts
// consent-moment-flow.ts: the intro step is the Shell's S3 screen, shown over the open banner screen
prepareAds({ ads, consent, onConsent, showIntro }, input);
// refresh -> (form required) intro -> Continue -> showFormIfRequired
//   -> (canRequestAds) consent.requestTracking() (Apple's ATT prompt, only while not-determined)
//   -> initialize -> preload: ads serve whatever the ATT answer, without the IDFA unless authorized
```

The flow holds the ATT request until a banner screen is open, like the intro, so Apple's prompt never covers a level. `onConsent` saves `canRequestAds` and `isPrivacyOptionsRequired` in the save's ads section (for the next launch and the Settings row) and updates the flow's live answer, which `useAdContext` reads, so the Home banner appears as soon as the form allows it.

Home, Levels and Statistics end with the slot. The screen views (from the screen work) take it from their view model, so the model hook computes the flag with the policy:

```ts
// use-home-model.ts (and the same for 'levels' and 'stats')
banner: { renderBanner: ads.renderBanner, isAllowed: shouldShowBanner(adConfig, adContext, 'home') },
```

```tsx
// home-view.tsx: const bannerBandStyle = useBannerBandStyle(); (the Toybox band from ui/use-banner-band-style.ts:
// paddingBlock 6, 2 pt dashed rules, ad fill)
<AdBannerSlot
  testID="home.banner-ad"
  renderBanner={model.banner.renderBanner}
  isAllowed={model.banner.isAllowed && !model.isPremium}
  loadedStyle={bannerBandStyle}
/>
```

## 4. Result screen: the only interstitial moment

```ts
async function goToNextLevel(): Promise<void> {
  const history = await showInterstitialIfDue(
    { ads, lifecycle: gameLifecycle },
    { config: adConfig, context: adContext, history: savedAdHistory, trigger: { outcome, nowMs: clock.nowMs() } },
  );
  saveAdHistory(history); // the save's ads section, so the caps survive a kill
  navigation.navigate('Game', { levelId: nextLevelId });
}

// Event handlers stay synchronous (the lint rule asyncHandler): start the async work and report errors.
const handleNextPress = (): void => {
  goToNextLevel().catch(reportError);
};
```

`gameLifecycle` is the game host's full-screen gate (`host.lifecycle`); the board and the audio lifecycle read the same gate through `useIsFullscreenAdShowing(host.lifecycle)`. `recordLevelEnd(history, outcome)` already ran when the level ended, before the Result screen appeared. Replay and Try again use the same pattern. `showInterstitialIfDue` always settles (the adapter resolves on `CLOSED`, `ERROR` or a rejected `show()`), so the player is never stuck on the Result screen.

## 5. Hint and continue

```ts
const rewardedStatus = useSyncExternalStore(ads.subscribeRewardedStatus, ads.rewardedStatus);
const offer = perkOffer({ kind: 'continue', isAllowedByGame, isUsedThisLevel }, { config: adConfig, context: adContext, rewardedStatus });
// 'free'     -> continue now
// 'watch-ad' -> button "Continue – watch an ad" (result.lose.continue-ad)
// 'loading'  -> the same button, busy and not pressable, until the ad is ready (L11)
// 'hidden'   -> no button at all, and the lost run ends at once (L11)

async function continueWithAd(): Promise<void> {
  if (await earnRewardedPerk({ ads, lifecycle: gameLifecycle })) grantContinue();
}

const handleWatchAdPress = (): void => {
  continueWithAd().catch(reportError);
};
```

`rewardedStatus` follows the ad on its own: `'loading'` draws the continue offer busy (`'ad-loading'` in the result model), `'ready'` makes it pressable, and an offer that is `'hidden'` ends the lost run at once (L11: the Game screen model sends `finish` when `isLossStranded`), so the player always sees a result.

## 6. Settings row

Show "Ad privacy choices" only while `isPrivacyOptionsRequired` is true; its press handler runs `consent.showPrivacyOptions()` and passes the result to `saveConsentFacts`.

## 7. Prove it

```sh
npx jest packages/shell/src/services/ads packages/shell/src/services/consent packages/shell/src/config packages/shell/src/ui/ad-banner-slot.test.tsx
node ${CLAUDE_SKILL_DIR}/scripts/check-ads.mjs .
node ${CLAUDE_SKILL_DIR}/scripts/check-ad-behaviour.mjs .
```

Then the simulator smoke test (test variant) from the troubleshooting reference, and tell the owner which console steps (A1-A5) are still open.
