// packages/shell/src/screens/game/use-result-extras.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

import { useResultExtras } from './use-result-extras.ts';

// useToday() re-reads the day when the screen regains focus.
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));

/** A daily streak of 4 up to yesterday (TEST_CLOCK is 2026-09-26) and an endless best of 1840. */
async function resultExtras({ isPremium = false } = {}) {
  const { save } = createTestSave();
  save.update((doc) => ({
    ...doc,
    daily: { ...doc.daily, streak: { lastDate: '2026-09-25', length: 4 } },
    progress: { ...doc.progress, endlessBest: 1840 },
  }));
  const shell = createHostWrapper({ isPremium, services: { save } });
  shell.stores.premium.getState().dispatch({ type: 'price-loaded', price: '€2.99' });
  const view = await renderHook(() => useResultExtras(), { wrapper: shell.wrapper });
  return { ...view, save };
}

describe('useResultExtras', () => {
  it('gives the streak, the endless best and the Premium nudge price (spec S7)', async () => {
    const { result } = await resultExtras();
    expect(result.current).toMatchObject({
      streakDays: 4,
      endlessBest: 1840,
      nudgePriceText: '€2.99',
    });
  });

  it('uses up the nudge for today once the player leaves the result that showed it', async () => {
    const { result, save } = await resultExtras();
    await act(() => {
      result.current.markNudgeSeen();
    });
    expect(save.doc().upsell.lastShownOn).toBe('2026-09-26');
    expect(result.current.nudgePriceText).toBeNull();
  });

  it('shows no nudge to a Premium owner and records nothing for them', async () => {
    const { result, save } = await resultExtras({ isPremium: true });
    expect(result.current.nudgePriceText).toBeNull();
    await act(() => {
      result.current.markNudgeSeen();
    });
    expect(save.doc().upsell.lastShownOn).toBeNull();
  });
});
