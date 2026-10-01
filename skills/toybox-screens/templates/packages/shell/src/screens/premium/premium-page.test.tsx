// packages/shell/src/screens/premium/premium-page.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { PremiumPage } from './premium-page.tsx';

import type { PremiumModel } from './premium-model.ts';
import type { PremiumView } from '@e07/shell/stores/premium/premium-view.ts';

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
