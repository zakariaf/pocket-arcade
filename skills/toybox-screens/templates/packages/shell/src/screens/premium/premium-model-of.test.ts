// packages/shell/src/screens/premium/premium-model-of.test.ts
import { createFakePurchase } from '@e07/shell/services/purchase/fake-purchase.ts';
import { initialPremiumState } from '@e07/shell/stores/premium/premium-state.ts';

import { premiumModelOf } from './premium-model-of.ts';

import type { PremiumServiceDeps } from '@e07/shell/services/purchase/premium-service.ts';
import type { PremiumAction, PremiumState } from '@e07/shell/stores/premium/premium-state.ts';

type Setup = {
  readonly deps: PremiumServiceDeps;
  readonly sent: PremiumAction[];
  readonly calls: string[];
  readonly errors: unknown[];
};

function setup(overrides: Partial<PremiumServiceDeps> = {}): Setup {
  const sent: PremiumAction[] = [];
  const errors: unknown[] = [];
  const script = {
    isConnected: true,
    product: null,
    restoreResult: 'synced' as const,
    transactions: [],
    calls: [],
  };
  const deps: PremiumServiceDeps = {
    port: createFakePurchase(script),
    productId: 'io.applander.linesiege.premium',
    dispatch: (action) => sent.push(action),
    persistPremium: jest.fn(),
    formatPrice: () => '€1.99',
    onError: (error) => errors.push(error),
    ...overrides,
  };
  return { deps, sent, calls: script.calls, errors };
}

const READY: PremiumState = {
  ...initialPremiumState(false),
  flow: { kind: 'ready', price: '€1.99' },
};

function modelOf(state: PremiumState, deps: PremiumServiceDeps) {
  return premiumModelOf({
    state,
    service: deps,
    gameName: 'Line Siege',
    isReducedMotion: false,
    isConfettiHidden: false,
    onBack: jest.fn(),
  });
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('premiumModelOf', () => {
  it('shows the store price on the ready page and nothing while loading', () => {
    const { deps } = setup();
    expect(modelOf(READY, deps)).toMatchObject({ view: 'ready', priceText: '€1.99' });
    expect(modelOf(initialPremiumState(false), deps)).toMatchObject({
      view: 'loading-price',
      priceText: null,
    });
  });

  it('thanks a fresh purchase once, then shows the owner page', () => {
    const { deps } = setup();
    const owned = initialPremiumState(true);
    expect(modelOf({ ...owned, didJustPurchase: true }, deps).view).toBe('success');
    expect(modelOf(owned, deps).view).toBe('already-owned');
  });

  it('buys through the service: buy-tapped first, then the store request', async () => {
    const { deps, sent, calls } = setup();
    modelOf(READY, deps).onBuy();
    await settle();
    expect(sent).toStrictEqual([{ type: 'buy-tapped' }]);
    expect(calls).toStrictEqual(['requestPurchase']);
  });

  it('treats Try again as a new purchase request', async () => {
    const { deps, sent } = setup();
    modelOf({ ...READY, flow: { kind: 'failed', price: '€1.99' } }, deps).onTryAgain();
    await settle();
    expect(sent).toStrictEqual([{ type: 'buy-tapped' }]);
  });

  it('restores through the service and reports what it found', async () => {
    const { deps, sent } = setup();
    modelOf(READY, deps).onRestore();
    await settle();
    await settle();
    expect(sent.map((action) => action.type)).toStrictEqual(['restore-tapped', 'restore-finished']);
  });

  it('sends a failed store request to the service error sink, never to the screen', async () => {
    const failure = new Error('StoreKit unavailable');
    const { deps, errors } = setup();
    const broken = {
      ...deps,
      port: { ...deps.port, requestPurchase: () => Promise.reject(failure) },
    };
    modelOf(READY, broken).onBuy();
    await settle();
    expect(errors).toStrictEqual([failure]);
  });
});
