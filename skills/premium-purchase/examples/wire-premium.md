# Worked example: Premium for Line Siege, end to end

The order Claude follows for the pilot game. Only the Premium calls are shown; screens and stores around them belong to their own skills.

## 1. Install and copy

```sh
cd apps/line-siege && npm install -E expo-iap@5.8.0
```

Copy from `templates/`: `packages/shell/src/services/purchase/*`, `packages/shell/src/stores/premium/*`, `__mocks__/expo-iap.ts`, and later the Tier 2 and App Store Connect tooling. The bare string `'expo-iap'` is a line of `shellPlugins` in `packages/shell/src/config/shell-plugins.ts` (architecture-and-boundaries' one plugin list). `apps/line-siege/game.config.ts` already has `premium: { productId: 'com.example.linesiege.premium' }` (bundle ID + `.premium`).

The composition root that runs the code below is game-host-integration's template set in `packages/shell/src/app/` (copy it verbatim): `device-adapters.ts` creates the gated port, `create-premium-deps.ts` builds `premiumDeps`, `create-shell-parts.ts` calls `startPremium` and then `connectPremiumReloads`, and `shell-features.tsx` provides the S12 dependencies. The snippets show what those files do.

## 2. Build the dependencies once, when the Shell app starts

```ts
const premiumDeps: PremiumServiceDeps = {
  // Gated where the adapter is created (device-adapters.ts): offline, or with the debug
  // "Simulate offline" switch, the store reports itself unavailable without asking StoreKit.
  port: withConnectivity(createExpoIapPurchaseAdapter(), connectivity.isOnline),
  productId: gameConfig.premium.productId,
  dispatch: stores.premium.getState().dispatch,
  persistPremium: (change) => {
    // One synchronous, validated write of the premium section, backup refreshed (a Premium change).
    const atMs = clock.nowMs();
    save.update(
      (doc) => ({
        ...doc,
        premium: change.isPremium
          ? { ...doc.premium, owned: true, ownedSinceMs: doc.premium.ownedSinceMs ?? atMs }
          : { ...doc.premium, owned: false, revokedAtMs: change.revokedAtMs },
      }),
      { refreshBackup: true },
    );
  },
  formatPrice: (product) => formatStorePrice(product, localeTagFor(language, digits)),
  onError: (error) => {
    errorLog.record('purchase', error);
  },
};

// after the splash; never awaited by it. The lint config rejects `void promise`: always .catch().
startPremium(premiumDeps).catch(premiumDeps.onError); // subscribe -> connect -> price -> silent re-check
```

`persistPremium` is the only writer of the save's `premium` section: synchronous, with `refreshBackup: true`, and never touched by "Reset all progress". A revoke carries `revokedAtMs`, or the save service's premium guard undoes it.

## 3. Keep it fresh

`startPremium` runs before expo-network reports its first state (the adapter starts offline), so its first `connect` finds the store unavailable. The template `packages/shell/src/app/connect-premium-reloads.ts` (game-host-integration) is called right after `startPremium` and reloads it (`check-premium-behaviour.mjs` fails `store-reloads` without both call sites):

```ts
// connectPremiumReloads(connectivity, stores, premiumDeps)
connectivity.subscribe((isOnline) => {
  // back online on an "unavailable" page, or gone offline from a quiet page; never mid-purchase
  if (shouldReloadStore(stores.premium.getState().flow.kind, isOnline)) {
    loadStore(premiumDeps).catch(premiumDeps.onError);
  }
});
AppState.addEventListener('change', (next) => {
  if (next === 'active' && connectivity.isOnline()) recheckPremium(premiumDeps).catch(premiumDeps.onError);
});
```

In test builds only, the debug menu's "Premium on (no purchase)" switch and the debug link `premium=0|1` go through the same order, save first, then the reducer (never StoreKit). That code is e2e-maestro's `debug-services.ts`; the composition root builds it once from `premiumDeps`, and the debug screen and the link handler call `debugServices.setPremium(isPremium)`:

```ts
// reachable only through the test-only entry; null in store builds
const debugServices = TEST_ONLY?.createDebugServices({
  connectivity: simulatedConnectivity, // the SimulatedConnectivity every service was built with
  clock: simulatedClock, // the SimulatedClock every service was built with (date=YYYY-MM-DD)
  persistPremium: premiumDeps.persistPremium, // 1. the save's premium section (a revoke carries revokedAtMs)
  dispatchPremium: (action) => {
    stores.premium.getState().dispatch(action); // 2. then { type: 'debug-premium-set', isPremium }
  },
  nowMs: clock.nowMs,
  adsMode: readAdsExtra().adsMode,
  onError: (error) => {
    errorLog.record('ads', error); // consent errors are ad errors (ErrorSource has no 'consent')
  },
}) ?? null;
```

The complete wiring (the clock and connectivity wrappers, `premiumDeps`, `startPremium`, the reloads, the debug services and their provider) is game-host-integration's composition-root template; its `connect-premium-reloads.test.ts` proves the price loads after an offline start and that nothing reloads while the store is loading.

## 4. The S12 page reads two pure functions

```ts
const view = usePremiumStore(premiumView);     // one of the 11 PremiumView values
const notice = usePremiumStore(premiumNotice); // restoring / restore-success / restore-empty / restore-failed / null

const handleBuyPress = (): void => {
  buyPremium(premiumDeps).catch(premiumDeps.onError);
};
const handleRestorePress = (): void => {
  restorePremium(premiumDeps).catch(premiumDeps.onError);
};
```

The page renders the S12 table in `references/premium-states.md`: the container test ID per view (`premium.state.loading`, ...), `premium.buy-button` with `{priceText}` from the flow's price, `premium.restore-button` on every state, and the toast for `notice`. After the thank-you animation it dispatches `thanks-shown`; after announcing the restored toast, `restore-notice-shown`.

The Toybox S12 screen (the screen work's `premium-screen.tsx`) reads a `PremiumModel` from `use-premium-model.ts`. The toybox-screens skill ships that hook whole (with `premium-model-of.ts`, `premium-toasts.ts` and `app/premium-screen-deps-context.tsx`): it reads the store through `useShallow`, and the service dependencies from `usePremiumScreenDeps()`, which the composition root provides once with this `premiumDeps`:

```tsx
// ShellApp, around the navigator (the same object startPremium got)
<PremiumScreenDepsProvider deps={{ service: premiumDeps, gameName: { id: host.nameId } }}>
```

What the hook builds from this skill's parts: `view: premiumView(state)`, `priceText: priceOf(state.flow)` (the formatted store price, or null while loading or unavailable), `onBuy` and `onTryAgain` (`buyPremium(deps.service)`; "Try again" after an error is a new purchase request) and `onRestore` (`restorePremium(deps.service)`). It also dispatches `thanks-shown` and `restore-notice-shown` after about 3 s and announces each restore toast to VoiceOver, so none of that is wired by hand.

## 5. Everything else reads `isPremium`

```ts
const isPremium = usePremiumStore((state) => state.isPremium);
```

Ads (`canServeAds`), the Home Premium button (hidden when owned), the Settings row ("Remove ads – {priceText}" or "Premium – active") and the perks all read this one value, so a purchase removes every ad at once.

The Result screen's quiet line gets its price from `premiumNudgePrice({ isPremium, priceText: priceOf(flow), lastShownOn: save.upsell.lastShownOn, today })` (the result model's `nudgePriceText`); when the line was shown, the save records `upsell.lastShownOn = today`, so it appears at most once a day.

## 6. Prove it

```sh
npx jest packages/shell/src/stores/premium packages/shell/src/services/purchase packages/tooling/src/asc packages/shell/src/app/connect-premium-reloads.test.ts --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/{stores/premium,services/purchase}/**/*.ts' --coverageThreshold='{}'
node ${CLAUDE_SKILL_DIR}/scripts/check-premium.mjs .
node ${CLAUDE_SKILL_DIR}/scripts/check-premium-behaviour.mjs .
```

Before the release: the Tier 2 harness (`node packages/tooling/src/storekit/storekit-harness.ts --app line-siege --udid <udid>`), then ask the owner for the App Store Connect steps and the Tier 3 TestFlight run.
