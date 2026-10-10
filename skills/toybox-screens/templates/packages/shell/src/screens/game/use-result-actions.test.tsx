// packages/shell/src/screens/game/use-result-actions.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { useGameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';
import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';

import { useResultActions } from './use-result-actions.ts';

import type { FakeAdsScript } from '@e07/shell/services/ads/fake-ads.ts';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

const tapColumn = (col: number) =>
  ({ kind: 'tap', target: { regionId: 'board', col, row: 0 }, selected: null }) as const;

/** Past the tutorial, three levels won, consent answered: an interstitial may be due (spec 8.8). */
function seasonedSave() {
  const { save } = createTestSave();
  const won = {
    stars: 3,
    bestScore: 40,
    bestMoves: 2,
    completions: 1,
    firstCompletedOn: '2026-09-25',
  } as const;
  save.update((doc) => ({
    ...doc,
    firstRun: { languageChosen: true, tutorialDone: true },
    progress: { ...doc.progress, levels: { '1': won, '2': won, '3': won } },
    ads: { ...doc.ads, consent: { ...doc.ads.consent, canRequestAds: true } },
  }));
  return save;
}

async function resultActions({ level = 1, isContinuePaid = false } = {}) {
  const script: FakeAdsScript = {
    rewardedStatus: 'unavailable',
    interstitialResult: 'shown',
    rewardResult: 'unavailable',
    calls: [],
  };
  const save = seasonedSave();
  const shell = createHostWrapper({
    services: {
      save,
      ads: createFakeAds(script),
      connectivity: createFakeConnectivity(true),
      errorLog: createFakeErrorLog(),
    },
  });
  const nav = { onLevels: jest.fn(), onHome: jest.fn(), onOpenPremium: jest.fn() };
  const onLeaveResult = jest.fn();
  const payForContinue = jest.fn(() => Promise.resolve(isContinuePaid));
  const view = await renderHook(
    () => {
      const controls = useGameSessionControls({ start: 'new', ref: { kind: 'level', level } });
      const actions = useResultActions({ controls, nav, payForContinue, onLeaveResult });
      return { controls, actions };
    },
    { wrapper: shell.wrapper },
  );
  const play = async (cols: readonly number[]): Promise<void> => {
    for (const col of cols) {
      await act(() => {
        view.result.current.controls.send({ type: 'intent', intent: tapColumn(col) });
      });
    }
  };
  return { ...view, save, script, nav, onLeaveResult, payForContinue, play };
}

describe('useResultActions', () => {
  it('shows a due interstitial only after Replay, saves the ad history, then replays', async () => {
    const { result, save, script, onLeaveResult, play } = await resultActions();
    await play([1, 1]);
    expect(script.calls).not.toContain('showInterstitial');
    await act(async () => {
      result.current.actions.onReplay();
      await flushMicrotasks();
    });
    expect(script.calls).toContain('showInterstitial');
    expect(save.doc().ads.history.lastInterstitialAtMs).toBe(TEST_CLOCK.nowMs());
    expect(onLeaveResult).toHaveBeenCalledTimes(1);
    expect(result.current.controls.status).toBe('playing');
    expect(result.current.controls.view?.ref).toStrictEqual({ kind: 'level', level: 1 });
  });

  it('starts one run for a double tap on Replay while the interstitial is awaited (8.8)', async () => {
    const { result, script, onLeaveResult, play } = await resultActions();
    await play([1, 1]);
    await act(async () => {
      // Two taps before the screen re-renders: both reach the same handler.
      const { onReplay } = result.current.actions;
      onReplay();
      onReplay();
      await flushMicrotasks();
    });
    expect(script.calls.filter((call) => call === 'showInterstitial')).toHaveLength(1);
    expect(onLeaveResult).toHaveBeenCalledTimes(1);
    expect(result.current.controls.status).toBe('playing');
  });

  it('takes no other key while the continue is being paid for: the loss stays open (N10)', async () => {
    const { result, save, nav, play, payForContinue } = await resultActions();
    await play([1, 0, 1]);
    let payOut: (isPaid: boolean) => void = () => undefined;
    payForContinue.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          payOut = resolve;
        }),
    );
    await act(() => {
      result.current.actions.onContinue();
    });
    // Home, Levels and Try again tapped before the rewarded ad covers the screen.
    await act(async () => {
      result.current.actions.onHome();
      result.current.actions.onLevels();
      result.current.actions.onTryAgain();
      await flushMicrotasks();
    });
    expect([nav.onHome.mock.calls.length, nav.onLevels.mock.calls.length]).toStrictEqual([0, 0]);
    expect(save.doc().stats.losses).toBe(0);

    await act(async () => {
      payOut(true);
      await flushMicrotasks();
    });
    expect(result.current.controls.status).toBe('playing');
  });

  it('leaves to Levels from Next level after the last level, recording the run first', async () => {
    const { result, nav, play } = await resultActions({ level: 3 });
    await play([1, 1, 1]);
    await act(() => {
      result.current.actions.onNext();
    });
    expect(nav.onLevels).toHaveBeenCalledTimes(1);
  });

  it('records a declined loss before Home leaves (finish, then popTo)', async () => {
    const { result, save, nav, play } = await resultActions();
    await play([1, 0, 1]);
    expect(save.doc().run).not.toBeNull();
    await act(() => {
      result.current.actions.onHome();
    });
    expect(nav.onHome).toHaveBeenCalledTimes(1);
    expect(save.doc().run).toBeNull();
    expect(save.doc().stats.losses).toBe(1);
  });

  it('sends the continue only once it is paid for (spec 8.10)', async () => {
    const unpaid = await resultActions();
    await unpaid.play([1, 0, 1]);
    await act(async () => {
      unpaid.result.current.actions.onContinue();
      await flushMicrotasks();
    });
    expect(unpaid.payForContinue).toHaveBeenCalledTimes(1);
    expect(unpaid.result.current.controls.status).toBe('lost');

    const paid = await resultActions({ isContinuePaid: true });
    await paid.play([1, 0, 1]);
    await act(async () => {
      paid.result.current.actions.onContinue();
      await flushMicrotasks();
    });
    expect(paid.result.current.controls.status).toBe('playing');
  });
});
