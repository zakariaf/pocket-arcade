// packages/shell/src/screens/premium/use-premium-model.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { PARITY_PLANS } from '@e07/shell/app/parity/parity-plans.ts';
import { createParityPurchase } from '@e07/shell/app/parity/parity-purchase.ts';
import { endParitySession, startParitySession } from '@e07/shell/app/parity/parity-session.ts';
import { PremiumScreenDepsProvider } from '@e07/shell/app/premium-screen-deps-context.tsx';
import { createFakePurchase } from '@e07/shell/services/purchase/fake-purchase.ts';
import { startPremium } from '@e07/shell/services/purchase/premium-store-flow.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { NOTICE_MS, usePremiumModel } from './use-premium-model.ts';

import type { ParityFrameKey } from '@e07/shell/app/parity/parity-plans.ts';
import type { PremiumScreenDeps } from '@e07/shell/app/premium-screen-deps-context.tsx';
import type { PurchasePort } from '@e07/shell/services/purchase/purchase-port.ts';
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

const PRODUCT_ID = 'com.example.linesiege.premium';

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
  const { result } = await renderHook(() => usePremiumModel(), { wrapper });
  return { result, stores: shell.stores, service: deps.service };
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

  it("stacks the four restore outcomes on the design's restore card, and none elsewhere", async () => {
    const restore = await parityCard('s12-restore-results-toasts');
    expect(restore.result.current).toMatchObject({ view: 'ready', isRestoreToastStack: true });
    endParitySession();
    const normal = await parityCard('s12-premium');
    expect(normal.result.current).toMatchObject({ view: 'ready', isRestoreToastStack: false });
  });
});
