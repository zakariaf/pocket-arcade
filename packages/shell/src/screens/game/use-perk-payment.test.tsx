// packages/shell/src/screens/game/use-perk-payment.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { useGameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';
import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';

import { usePerkPayment } from './use-perk-payment.ts';

import type { GameExtra } from '@e07/shell/config/game-extra.ts';
import type { RewardedStatus } from '@e07/shell/services/ads/ads-port.ts';
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

type Setup = {
  readonly freePerDay?: number;
  readonly isPremium?: boolean;
  /** Where the rewarded ad stands when the screen opens (AdsPort.rewardedStatus). */
  readonly rewardedStatus?: RewardedStatus;
  /** The player answered consent so that ads may be requested (spec 8.8). */
  readonly canRequestAds?: boolean;
  readonly isOnline?: boolean;
};

async function perkPayment({
  freePerDay = 1,
  isPremium = false,
  rewardedStatus = 'unavailable',
  canRequestAds = false,
  isOnline = true,
}: Setup = {}) {
  mockHints.freePerDay = freePerDay;
  const script: FakeAdsScript = {
    rewardedStatus,
    interstitialResult: 'unavailable',
    rewardResult: 'unavailable',
    calls: [],
  };
  const { save } = createTestSave();
  save.update((doc) => ({
    ...doc,
    ads: { ...doc.ads, consent: { ...doc.ads.consent, canRequestAds } },
  }));
  const ads = createFakeAds(script);
  const shell = createHostWrapper({
    isPremium,
    services: {
      ads,
      save,
      connectivity: createFakeConnectivity(isOnline),
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
  /** Tally level 1: 1 + 2 + 1 overshoots the target 4, so the run is lost with its continue open. */
  const lose = async (): Promise<void> => {
    for (const col of [1, 0, 1]) {
      await act(() => {
        view.result.current.controls.send({ type: 'intent', intent: tapColumn(col) });
      });
    }
  };
  const setStatus = async (status: RewardedStatus): Promise<void> => {
    await act(() => {
      ads.setRewardedStatus(status);
    });
  };
  return { ...view, shell, lose, setStatus };
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
    const { result, lose } = await perkPayment({ isPremium: true });
    expect(result.current.perks.continueOffer).toBe('hidden');
    await lose();
    expect(result.current.perks.continueOffer).toBe('free');
    let isPaid = false;
    await act(async () => {
      isPaid = await result.current.perks.payForContinue();
      await flushMicrotasks();
    });
    expect(isPaid).toBe(true);
  });

  it("follows the rewarded ad's status: loading, then ready; hints never wait (L11)", async () => {
    const { result, lose, setStatus } = await perkPayment({
      freePerDay: 0,
      rewardedStatus: 'loading',
      canRequestAds: true,
    });
    expect(result.current.perks.hintOffer).toBe('hidden');
    await lose();
    expect(result.current.perks.continueOffer).toBe('loading');
    let isPaid = true;
    await act(async () => {
      isPaid = await result.current.perks.payForContinue();
    });
    expect(isPaid).toBe(false);

    await setStatus('ready');
    expect(result.current.perks.continueOffer).toBe('watch-ad');
    expect(result.current.perks.hintOffer).toBe('watch-ad');
  });

  it('hides the continue once no ad can come: a load error, ads not allowed, offline (L11)', async () => {
    const loading = await perkPayment({ rewardedStatus: 'loading', canRequestAds: true });
    await loading.lose();
    expect(loading.result.current.perks.continueOffer).toBe('loading');
    await loading.setStatus('unavailable');
    expect(loading.result.current.perks.continueOffer).toBe('hidden');

    // No consent answer that allows ads, or no network: a loading ad is no offer at all.
    for (const setup of [{ canRequestAds: false }, { canRequestAds: true, isOnline: false }]) {
      const blocked = await perkPayment({ ...setup, rewardedStatus: 'loading' });
      await blocked.lose();
      expect(blocked.result.current.perks.continueOffer).toBe('hidden');
    }
  });
});
