// packages/shell/src/screens/premium/premium-page.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { ancestorStyle } from '@e07/shell/testing/rendered-parts.ts';

import { PremiumPage } from './premium-page.tsx';

import type { PremiumModel } from './premium-model.ts';
import type { PremiumView } from '@e07/shell/stores/premium/premium-view.ts';
import type { ViewStyle } from 'react-native';

function modelWith(view: PremiumView, overrides: Partial<PremiumModel> = {}): PremiumModel {
  return {
    view,
    hasJustRestored: false,
    isRestoreToastStack: false,
    priceText: '€1.99',
    gameName: 'Line Siege',
    isReducedMotion: false,
    isConfettiHidden: false,
    onBack: jest.fn(),
    onBuy: jest.fn(),
    onRestore: jest.fn(),
    onTryAgain: jest.fn(),
    ...overrides,
  };
}

const NORMAL = [
  'premium.screen',
  'premium.top-bar.title',
  'premium.header',
  'premium.art',
  'premium.title',
  'premium.subtitle',
  'premium.benefits-list',
  'premium.benefit.no-ads.icon',
  'premium.benefit.free-perks.label',
  'premium.benefit.support.label',
  'premium.buy-button',
  'premium.restore-button',
  'premium.small-print',
];

const STATES: readonly [PremiumView, readonly string[]][] = [
  [
    'loading-price',
    ['premium.state.loading', 'premium.subtitle', 'premium.buy-button', 'premium.small-print'],
  ],
  [
    'store-unavailable',
    ['premium.state.unavailable', 'premium.unavailable-note.label', 'premium.buy-button'],
  ],
  [
    'purchase-in-progress',
    ['premium.state.purchasing', 'premium.buy-button', 'premium.small-print'],
  ],
  [
    'pending',
    [
      'premium.state.pending',
      'premium.pending-note.icon',
      'premium.pending-detail',
      'premium.restore-button',
    ],
  ],
  [
    'success',
    [
      'premium.state.success',
      'premium.confetti',
      'premium.success-title',
      'premium.success-body',
      'premium.active-sticker',
    ],
  ],
  [
    'error',
    [
      'premium.state.error',
      'premium.error-note.label',
      'premium.try-again-button',
      'premium.restore-button',
    ],
  ],
  [
    'already-owned',
    [
      'premium.state.owned',
      'premium.active-sticker',
      'premium.owned-body',
      'premium.restore-button',
    ],
  ],
  ['restoring', ['premium.restoring-toast', 'premium.buy-button']],
  ['restore-empty', ['premium.restore-empty-toast']],
  ['restore-failed', ['premium.restore-failed-toast']],
];

describe('PremiumPage', () => {
  it('draws the normal S12 page with its design testIDs and buys', async () => {
    const model = modelWith('ready');
    const user = userEvent.setup();
    await renderWithShell(<PremiumPage model={model} />);

    for (const testID of NORMAL)
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    await user.press(screen.getByTestId('premium.buy-button'));

    expect(model.onBuy).toHaveBeenCalledTimes(1);

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it.each(STATES)('draws the %s state', async (view, testIDs) => {
    await renderWithShell(<PremiumPage model={modelWith(view)} />);

    for (const testID of testIDs)
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws the success confetti at rest under frozen motion, and hides it only by the setting', async () => {
    // A parity capture (and the phone's Reduce motion) holds the pieces still; the saved Reduce
    // motion setting is the one thing that removes them (spec S12).
    const view = await renderWithShell(
      <PremiumPage model={modelWith('success', { isReducedMotion: true })} />,
    );
    expect(
      screen.getByTestId('premium.confetti', { includeHiddenElements: true }),
    ).toBeOnTheScreen();

    await view.rerender(
      <PremiumPage
        model={modelWith('success', { isReducedMotion: true, isConfettiHidden: true })}
      />,
    );
    expect(screen.queryByTestId('premium.confetti', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('premium.success-title')).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('locks the keys while buying and offline', async () => {
    const view = await renderWithShell(<PremiumPage model={modelWith('purchase-in-progress')} />);

    expect(screen.getByTestId('premium.buy-button')).toBeBusy();
    expect(screen.getByTestId('premium.restore-button')).toBeDisabled();

    await view.rerender(<PremiumPage model={modelWith('store-unavailable')} />);
    expect(screen.getByTestId('premium.buy-button')).toBeDisabled();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('locks Buy while a restore runs, and offers no Buy without the store price (spec S12)', async () => {
    const view = await renderWithShell(<PremiumPage model={modelWith('restoring')} />);
    expect(screen.getByTestId('premium.buy-button')).toBeDisabled();

    await view.rerender(<PremiumPage model={modelWith('restore-empty', { priceText: null })} />);
    expect(screen.getByTestId('premium.buy-button')).toBeDisabled();
    expect(screen.getByText('Remove ads')).toBeOnTheScreen();

    await view.rerender(<PremiumPage model={modelWith('restore-empty')} />);
    expect(screen.getByTestId('premium.buy-button')).toBeEnabled();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('confirms a restore with a toast', async () => {
    await renderWithShell(
      <PremiumPage model={modelWith('already-owned', { hasJustRestored: true })} />,
    );

    expect(screen.getByTestId('premium.restore-success-toast')).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it("stacks the four restore outcomes on the design's restore card (parity frame)", async () => {
    await renderWithShell(
      <PremiumPage model={modelWith('ready', { isRestoreToastStack: true })} />,
    );

    for (const testID of [
      'premium.restoring-toast',
      'premium.restore-success-toast',
      'premium.restore-empty-toast',
      'premium.restore-failed-toast',
    ])
      expect(screen.getByTestId(testID)).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});

const ALL_VIEWS: readonly PremiumView[] = [
  'ready',
  'loading-price',
  'store-unavailable',
  'purchase-in-progress',
  'pending',
  'success',
  'error',
  'already-owned',
  'restoring',
  'restore-empty',
  'restore-failed',
];

describe('PremiumPage, spec S12 states', () => {
  it('asks for a connection, offers "Remove ads" with no price and locks both keys when the store is unavailable (spec S12)', async () => {
    await renderWithShell(<PremiumPage model={modelWith('store-unavailable')} />);

    expect(screen.getByText('Connect to the internet to buy or restore.')).toBeOnTheScreen();
    const buy = screen.getByTestId('premium.buy-button');
    expect(buy).toHaveTextContent('Remove ads');
    expect(screen.queryByText(/1\.99/)).toBeNull();
    expect(buy).toBeDisabled();
    expect(screen.getByTestId('premium.restore-button')).toBeDisabled();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('says the purchase waits for approval and keeps Restore usable while pending (spec S12)', async () => {
    await renderWithShell(<PremiumPage model={modelWith('pending')} />);

    expect(screen.getByText('Waiting for approval – you can keep playing.')).toBeOnTheScreen();
    expect(
      screen.getByText('Premium turns on by itself as soon as the purchase is approved.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('premium.restore-button')).toBeEnabled();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('says nobody was charged and buys again from Try again after an error (spec S12)', async () => {
    const model = modelWith('error');
    const user = userEvent.setup();
    await renderWithShell(<PremiumPage model={model} />);

    expect(
      screen.getByText('The purchase couldn’t be completed. You were not charged.'),
    ).toBeOnTheScreen();
    await user.press(screen.getByTestId('premium.try-again-button'));
    expect(model.onTryAgain).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('shows "Premium – active", thanks the player and offers only Restore when Premium is owned (spec S12)', async () => {
    const model = modelWith('already-owned');
    const user = userEvent.setup();
    await renderWithShell(<PremiumPage model={model} />);

    expect(screen.getByText('Premium – active')).toBeOnTheScreen();
    expect(screen.getByText(/^Thanks for supporting ⁨?Line Siege⁩?!$/)).toBeOnTheScreen();
    expect(screen.queryByTestId('premium.buy-button')).toBeNull();
    await user.press(screen.getByTestId('premium.restore-button'));
    expect(model.onRestore).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it.each(ALL_VIEWS)(
    'draws no banner slot in the %s state (spec 8.8: no banner on S12)',
    async (view) => {
      await renderWithShell(<PremiumPage model={modelWith(view)} />);

      expect(
        screen.getByTestId('premium.screen', { includeHiddenElements: true }),
      ).toBeOnTheScreen();
      expect(screen.queryAllByTestId(/banner/, { includeHiddenElements: true })).toStrictEqual([]);
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    },
  );
});

describe("PremiumPage, the design's restore card", () => {
  // allow-style-assertion: the toast stack's backdrop is the contract here; without it the Buy key and the small print showed through the 10 pt gaps of the restore card.
  const isDock = (style: ViewStyle): boolean => style.position === 'absolute';

  it('lays the four stacked toasts on the ground, so the page under them never shows between them (spec S12)', async () => {
    await renderWithShell(
      <PremiumPage model={modelWith('ready', { isRestoreToastStack: true })} />,
    );

    const ground = ancestorStyle(
      'premium.restoring-toast',
      (style) => style.flex === 1 && style.backgroundColor !== undefined,
    ).backgroundColor;
    expect(ground).toBeDefined();
    expect(ancestorStyle('premium.restoring-toast', isDock).backgroundColor).toBe(ground);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('gives a single toast no backdrop, so nothing shows while it drops in', async () => {
    await renderWithShell(<PremiumPage model={modelWith('restore-empty')} />);

    expect(ancestorStyle('premium.restore-empty-toast', isDock).backgroundColor).toBeUndefined();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
