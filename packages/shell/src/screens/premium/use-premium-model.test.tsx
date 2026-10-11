// packages/shell/src/screens/premium/use-premium-model.test.tsx
import { act, render, renderHook, screen, userEvent } from '@testing-library/react-native';

import { PARITY_FIXTURE } from '@e07/shell/app/parity/parity-fixture.ts';
import { PARITY_PLANS } from '@e07/shell/app/parity/parity-plans.ts';
import { createParityPurchase } from '@e07/shell/app/parity/parity-purchase.ts';
import { endParitySession, startParitySession } from '@e07/shell/app/parity/parity-session.ts';
import { PremiumScreenDepsProvider } from '@e07/shell/app/premium-screen-deps-context.tsx';
import { useBannerSlot } from '@e07/shell/app/use-ad-context.ts';
import { localeTagFor } from '@e07/shell/i18n/digits.ts';
import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { withConnectivity } from '@e07/shell/services/purchase/connectivity-gated-purchase.ts';
import { createFakePurchase } from '@e07/shell/services/purchase/fake-purchase.ts';
import { formatStorePrice } from '@e07/shell/services/purchase/format-store-price.ts';
import { startPremium } from '@e07/shell/services/purchase/premium-store-flow.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { PremiumPage } from './premium-page.tsx';
import { NOTICE_MS, usePremiumModel } from './use-premium-model.ts';

import type { ParityFrameKey } from '@e07/shell/app/parity/parity-plans.ts';
import type { PremiumScreenDeps } from '@e07/shell/app/premium-screen-deps-context.tsx';
import type { FakePurchaseScript } from '@e07/shell/services/purchase/fake-purchase.ts';
import type { PremiumServiceDeps } from '@e07/shell/services/purchase/premium-service.ts';
import type { PurchasePort, StoreProduct } from '@e07/shell/services/purchase/purchase-port.ts';
import type { RenderWithShellOptions } from '@e07/shell/testing/render-with-shell.tsx';
import type { ReactNode } from 'react';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));
// renderWithShell carries no game catalogs; the game's name message is the game module's business.
jest.mock('@e07/shell/i18n/game-message-text.ts', () => ({
  gameMessageText: () => 'Line Siege',
}));
// useBannerSlot reads the build's game config (the ads policy numbers) through expo-constants.
jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

const PRODUCT_ID = 'io.applander.linesiege.premium';

async function setup(options: RenderWithShellOptions = {}, port: PurchasePort | null = null) {
  const shell = createShellWrapper(options);
  const deps: PremiumScreenDeps = {
    service: {
      port:
        port ??
        createFakePurchase({
          isConnected: true,
          product: null,
          restoreResult: 'synced',
          transactions: [],
          calls: [],
        }),
      productId: PRODUCT_ID,
      dispatch: shell.stores.premium.getState().dispatch,
      persistPremium: jest.fn(),
      formatPrice: () => '€1.99',
      onError: jest.fn(),
    },
    gameName: { id: 'line-siege.name' },
  };
  const Shell = shell.wrapper;
  const wrapper = ({ children }: { readonly children: ReactNode }): ReactNode => (
    <Shell>
      <PremiumScreenDepsProvider deps={deps}>{children}</PremiumScreenDepsProvider>
    </Shell>
  );
  const { result, unmount } = await renderHook(() => usePremiumModel(), { wrapper });
  return { result, unmount, stores: shell.stores, service: deps.service, wrapper };
}

describe('usePremiumModel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads the premium store and leaves through Back', async () => {
    const { result } = await setup();
    expect(result.current).toMatchObject({ view: 'loading-price', gameName: 'Line Siege' });
    result.current.onBack();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it("hides the success confetti by the saved Reduce motion setting, not the phone's switch alone", async () => {
    const saved = await setup({ settings: { reduceMotion: 'on' } });
    expect(saved.result.current).toMatchObject({ isReducedMotion: true, isConfettiHidden: true });
    const normal = await setup({ settings: { reduceMotion: 'off' } });
    expect(normal.result.current).toMatchObject({
      isReducedMotion: false,
      isConfettiHidden: false,
    });
  });

  it('shows the thank-you page for NOTICE_MS, then the owner page', async () => {
    const { result, stores } = await setup();
    await act(() => {
      const { dispatch } = stores.premium.getState();
      dispatch({ type: 'price-loaded', price: '€1.99' });
      dispatch({ type: 'buy-tapped' });
      dispatch({ type: 'premium-granted' });
    });
    expect(result.current.view).toBe('success');

    await act(() => {
      jest.advanceTimersByTime(NOTICE_MS);
    });

    expect(result.current.view).toBe('already-owned');
  });

  it('uses up the thank-you and the restored toast when the player leaves before NOTICE_MS', async () => {
    // A notice seen once never shows again on a later visit (spec S12: one thank-you animation).
    const bought = await setup();
    await act(() => {
      const { dispatch } = bought.stores.premium.getState();
      dispatch({ type: 'price-loaded', price: '€1.99' });
      dispatch({ type: 'buy-tapped' });
      dispatch({ type: 'premium-granted' });
    });
    expect(bought.result.current.view).toBe('success');
    await bought.unmount();
    expect(bought.stores.premium.getState().didJustPurchase).toBe(false);

    const restored = await setup();
    await act(() => {
      const { dispatch } = restored.stores.premium.getState();
      dispatch({ type: 'restore-tapped' });
      dispatch({ type: 'restore-finished', evidence: 'owned' });
    });
    expect(restored.result.current.hasJustRestored).toBe(true);
    await restored.unmount();
    expect(restored.stores.premium.getState().didJustRestore).toBe(false);
  });

  it('opens without the toast of a restore that ended while it was closed (spec S12)', async () => {
    const first = await setup();
    await first.unmount();
    await act(() => {
      const { dispatch } = first.stores.premium.getState();
      dispatch({ type: 'restore-tapped' });
      dispatch({ type: 'restore-finished', evidence: 'owned' });
    });
    const { result } = await renderHook(() => usePremiumModel(), { wrapper: first.wrapper });
    expect(result.current.hasJustRestored).toBe(false);
  });
});

/** A parity launch of one S12 card: its store port, then the price arriving as at app start. */
async function parityCard(frame: ParityFrameKey) {
  const plan = PARITY_PLANS[frame];
  startParitySession({
    frame,
    plan,
    theme: 'light',
    lang: 'en',
    game: 'lineSiege',
    date: '2026-09-27',
    scrollY: 0,
  });
  const card = await setup({}, createParityPurchase({ productId: PRODUCT_ID, plan }));
  await act(async () => {
    await startPremium(card.service);
    await flushMicrotasks();
  });
  return card;
}

describe('usePremiumModel in a parity capture', () => {
  afterEach(() => {
    endParitySession();
  });

  it.each([
    ['s12-purchase-in-progress', 'purchase-in-progress'],
    ['s12-pending-approval', 'pending'],
    ['s12-error', 'error'],
  ] as const)('presses Buy once for %s, as a player would', async (frame, view) => {
    const { result } = await parityCard(frame);
    expect(result.current.view).toBe(view);
  });

  it('holds the thank-you page for the capture instead of clearing it after NOTICE_MS', async () => {
    // Only the notice timer is faked: the parity store answers through setImmediate.
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
    try {
      const { result } = await parityCard('s12-success');
      expect(result.current.view).toBe('success');
      await act(() => {
        jest.advanceTimersByTime(NOTICE_MS);
      });
      expect(result.current.view).toBe('success');
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the confetti while the capture freezes motion: the saved setting stays off', async () => {
    const { result } = await parityCard('s12-success');
    expect(result.current).toMatchObject({
      view: 'success',
      isReducedMotion: true,
      isConfettiHidden: false,
    });
  });

  it("stacks the four restore outcomes on the design's restore card, and none elsewhere", async () => {
    const restore = await parityCard('s12-restore-results-toasts');
    expect(restore.result.current).toMatchObject({ view: 'ready', isRestoreToastStack: true });
    endParitySession();
    const normal = await parityCard('s12-premium');
    expect(normal.result.current).toMatchObject({ view: 'ready', isRestoreToastStack: false });
  });
});

/** The store product of the parity fixture: its price and currency, never typed here. */
const FIXTURE_PRODUCT: StoreProduct = {
  productId: PRODUCT_ID,
  displayPrice: '',
  price: PARITY_FIXTURE.store.price,
  currency: PARITY_FIXTURE.store.currency,
};

type PageScript = {
  readonly options?: RenderWithShellOptions;
  readonly isOnline?: boolean;
  readonly restoreResult?: FakePurchaseScript['restoreResult'];
};

/** S12 as the route draws it (model hook + page), over a fake store and a fake connection. */
async function openPremiumPage(script: PageScript = {}) {
  const calls: string[] = [];
  const store = createFakePurchase({
    isConnected: true,
    product: FIXTURE_PRODUCT,
    restoreResult: script.restoreResult ?? 'synced',
    transactions: [],
    calls,
  });
  const connectivity = createFakeConnectivity(script.isOnline ?? true);
  const shell = createShellWrapper(script.options);
  const language = script.options?.language ?? 'en';
  const service: PremiumServiceDeps = {
    port: withConnectivity(store, connectivity.isOnline),
    productId: PRODUCT_ID,
    dispatch: shell.stores.premium.getState().dispatch,
    persistPremium: () => true,
    formatPrice: (product) =>
      formatStorePrice(
        product,
        localeTagFor(language, script.options?.settings?.digits ?? 'automatic'),
      ),
    onError: jest.fn(),
  };
  const Shell = shell.wrapper;
  const wrapper = ({ children }: { readonly children: ReactNode }): ReactNode => (
    <Shell>
      <PremiumScreenDepsProvider deps={{ service, gameName: { id: 'line-siege.name' } }}>
        {children}
      </PremiumScreenDepsProvider>
    </Shell>
  );
  function Route(): ReactNode {
    return <PremiumPage model={usePremiumModel()} />;
  }
  await render(<Route />, { wrapper });
  await act(async () => {
    await startPremium(service);
    await flushMicrotasks();
  });
  return { store, calls, service, stores: shell.stores };
}

describe('usePremiumModel on the S12 page', () => {
  it('returns quietly to the normal page when the player cancels the purchase (spec S12 "Cancelled by player")', async () => {
    const page = await openPremiumPage();
    const user = userEvent.setup();
    await user.press(screen.getByTestId('premium.buy-button'));
    expect(screen.getByTestId('premium.state.purchasing')).toBeOnTheScreen();

    await act(() => {
      page.store.emit({ type: 'failure', failure: 'cancelled', code: 'user-cancelled' });
    });

    expect(screen.getByTestId('premium.buy-button')).toBeEnabled();
    expect(screen.queryByTestId('premium.state.error')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('says it could not restore when the sync fails, never that nothing was found (spec S12, premium-purchase rule 5)', async () => {
    await openPremiumPage({ restoreResult: 'sync-failed' });
    const user = userEvent.setup();
    await user.press(screen.getByTestId('premium.restore-button'));
    await act(() => flushMicrotasks());

    expect(
      screen.getByText('Couldn’t restore right now. Please try again later.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('No earlier purchase was found.')).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('says no earlier purchase was found only after a sync that succeeded (spec S12, premium-purchase rule 5)', async () => {
    await openPremiumPage({ restoreResult: 'synced' });
    const user = userEvent.setup();
    await user.press(screen.getByTestId('premium.restore-button'));
    await act(() => flushMicrotasks());

    expect(screen.getByText('No earlier purchase was found.')).toBeOnTheScreen();
    expect(screen.queryByText('Couldn’t restore right now. Please try again later.')).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('shows the store unavailable offline without asking the store (spec S12 "Store unavailable / offline")', async () => {
    const page = await openPremiumPage({ isOnline: false });

    expect(screen.getByTestId('premium.state.unavailable')).toBeOnTheScreen();
    expect(screen.getByTestId('premium.buy-button')).toBeDisabled();
    expect(page.calls).toStrictEqual([]);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('shows the store price in Persian digits in fa, formatted by the Shell (spec S12, premium-purchase rule 9)', async () => {
    await openPremiumPage({ options: { language: 'fa' } });
    const priceText = formatStorePrice(FIXTURE_PRODUCT, localeTagFor('fa', 'automatic'));

    expect(priceText).toMatch(/[۰-۹]/);
    expect(screen.getByTestId('premium.buy-button')).toHaveTextContent(priceText, {
      exact: false,
    });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});

describe('usePremiumModel after a purchase', () => {
  it('turns Premium on before the thank-you page draws, and hides the Home banner in that same update (spec S12 Success, 15.4)', async () => {
    const calls: string[] = [];
    const store = createFakePurchase({
      isConnected: true,
      product: FIXTURE_PRODUCT,
      restoreResult: 'synced',
      transactions: [],
      calls,
    });
    const { save } = createTestSave();
    save.update((doc) => ({
      ...doc,
      firstRun: { ...doc.firstRun, languageChosen: true, tutorialDone: true },
      ads: { ...doc.ads, consent: { ...doc.ads.consent, canRequestAds: true } },
    }));
    const ads = createFakeAds({
      rewardedStatus: 'unavailable',
      interstitialResult: 'unavailable',
      rewardResult: 'unavailable',
      calls: [],
    });
    const shell = createShellWrapper({
      services: { save, ads, connectivity: createFakeConnectivity(true) },
    });
    const premiumAtPersist: boolean[] = [];
    const service: PremiumServiceDeps = {
      port: store,
      productId: PRODUCT_ID,
      dispatch: shell.stores.premium.getState().dispatch,
      persistPremium: () => {
        premiumAtPersist.push(shell.stores.premium.getState().isPremium);
        return true;
      },
      formatPrice: (product) => formatStorePrice(product, localeTagFor('en', 'automatic')),
      onError: jest.fn(),
    };
    const renders: { readonly view: string; readonly isBannerAllowed: boolean }[] = [];
    const Shell = shell.wrapper;
    const wrapper = ({ children }: { readonly children: ReactNode }): ReactNode => (
      <Shell>
        <PremiumScreenDepsProvider deps={{ service, gameName: { id: 'line-siege.name' } }}>
          {children}
        </PremiumScreenDepsProvider>
      </Shell>
    );
    const { result } = await renderHook(
      () => {
        const model = usePremiumModel();
        const banner = useBannerSlot('home');
        renders.push({ view: model.view, isBannerAllowed: banner.isAllowed });
        return model;
      },
      { wrapper },
    );
    await act(async () => {
      await startPremium(service);
      await flushMicrotasks();
    });
    expect(renders.at(-1)).toStrictEqual({ view: 'ready', isBannerAllowed: true });

    await act(async () => {
      result.current.onBuy();
      await flushMicrotasks();
    });
    await act(() => {
      store.emit({
        type: 'transaction',
        transaction: {
          productId: PRODUCT_ID,
          transactionId: 't-1',
          state: 'purchased',
          revocationDateMs: null,
          handle: null,
        },
      });
    });

    expect(premiumAtPersist).toStrictEqual([false]);
    expect(shell.stores.premium.getState().isPremium).toBe(true);
    const thanked = renders.filter((render) => render.view === 'success');
    expect(thanked.length).toBeGreaterThan(0);
    expect(thanked.every((render) => !render.isBannerAllowed)).toBe(true);
  });
});
