// packages/shell/src/screens/game/use-perk-payment.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { useGameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';
import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';

import { usePerkPayment } from './use-perk-payment.ts';

import type { GameExtra } from '@e07/shell/config/game-extra.ts';
import type { FakeAdsScript } from '@e07/shell/services/ads/fake-ads.ts';

type TestGameExtraModule = {
  readonly testExpoConstantsWith: (game: Partial<GameExtra>) => {
    readonly default: { readonly expoConfig: object };
  };
};

/** game.config.ts hints.freePerDay as this build embeds it (read when a hook mounts). */
const mockHints = { freePerDay: 1 };
jest.mock('expo-constants', () => {
  const { testExpoConstantsWith } = jest.requireActual<TestGameExtraModule>(
    '@e07/shell/testing/test-game-extra.ts',
  );
  return {
    __esModule: true,
    default: {
      get expoConfig() {
        return testExpoConstantsWith({ hints: mockHints }).default.expoConfig;
      },
    },
  };
});
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));

const tapColumn = (col: number) =>
  ({ kind: 'tap', target: { regionId: 'board', col, row: 0 }, selected: null }) as const;

async function perkPayment({ freePerDay = 1, isPremium = false } = {}) {
  mockHints.freePerDay = freePerDay;
  const script: FakeAdsScript = {
    isRewardedLoaded: false,
    interstitialResult: 'unavailable',
    rewardResult: 'unavailable',
    calls: [],
  };
  const shell = createHostWrapper({
    isPremium,
    services: {
      ads: createFakeAds(script),
      connectivity: createFakeConnectivity(true),
      errorLog: createFakeErrorLog(),
    },
  });
  const view = await renderHook(
    () => {
      const controls = useGameSessionControls({ start: 'new', ref: { kind: 'level', level: 1 } });
      return { controls, perks: usePerkPayment(controls.view) };
    },
    { wrapper: shell.wrapper },
  );
  return { ...view, shell };
}

describe('usePerkPayment', () => {
  it("spends the game's free daily hint before the hint is sent (hints.freePerDay 1)", async () => {
    const { result, shell } = await perkPayment();
    expect(result.current.perks.hintOffer).toBe('free');
    let isPaid = false;
    await act(async () => {
      isPaid = await result.current.perks.payForHint();
    });
    expect(isPaid).toBe(true);
    expect(shell.save.doc().hints).toStrictEqual({ freeDate: '2026-09-26', freeUsed: 1 });
    // The day's allowance is used and no rewarded ad is loaded: the hint key hides (spec 8.8).
    expect(result.current.perks.hintOffer).toBe('hidden');
  });

  it('gives no free hint in a game whose config says 0', async () => {
    const { result, shell } = await perkPayment({ freePerDay: 0 });
    expect(result.current.perks.hintOffer).toBe('hidden');
    let isPaid = true;
    await act(async () => {
      isPaid = await result.current.perks.payForHint();
    });
    expect(isPaid).toBe(false);
    expect(shell.save.doc().hints.freeUsed).toBe(0);
  });

  it("gives Premium owners hints without touching the day's allowance", async () => {
    const { result, shell } = await perkPayment({ freePerDay: 0, isPremium: true });
    expect(result.current.perks.hintOffer).toBe('free');
    await act(async () => {
      await result.current.perks.payForHint();
    });
    expect(shell.save.doc().hints.freeUsed).toBe(0);
  });

  it('offers the continue only while the lost run waits for it (spec 8.10)', async () => {
    const { result } = await perkPayment({ isPremium: true });
    expect(result.current.perks.continueOffer).toBe('hidden');
    for (const col of [1, 0, 1]) {
      await act(() => {
        result.current.controls.send({ type: 'intent', intent: tapColumn(col) });
      });
    }
    expect(result.current.perks.continueOffer).toBe('free');
    let isPaid = false;
    await act(async () => {
      isPaid = await result.current.perks.payForContinue();
      await flushMicrotasks();
    });
    expect(isPaid).toBe(true);
  });
});
