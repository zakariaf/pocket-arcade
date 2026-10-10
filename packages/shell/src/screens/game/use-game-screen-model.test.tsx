// packages/shell/src/screens/game/use-game-screen-model.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { useGameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';
import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';

import { useGameScreenModel } from './use-game-screen-model.ts';

import type { GameScreenNav } from './use-game-screen-model.ts';
import type { SessionCommand } from '@e07/shell/game-host/session-view.ts';
import type { RewardedStatus } from '@e07/shell/services/ads/ads-port.ts';
import type { FakeAdsScript } from '@e07/shell/services/ads/fake-ads.ts';
import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';

type TestGameExtraModule = {
  readonly testExpoConstantsWith: (game: object) => {
    readonly default: { readonly expoConfig: { readonly extra: object } };
  };
};

/** The build's ADS_MODE (expo.extra.adsMode), read whenever a hook asks: 'off' is an ads-off build. */
const mockBuild: { adsMode: 'off' | 'test' } = { adsMode: 'test' };
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
// The tally game has solver hints: its config gives one free hint a day (hints.freePerDay 1).
jest.mock('expo-constants', () => {
  const { testExpoConstantsWith } = jest.requireActual<TestGameExtraModule>(
    '@e07/shell/testing/test-game-extra.ts',
  );
  const { expoConfig } = testExpoConstantsWith({ hints: { freePerDay: 1 } }).default;
  return {
    __esModule: true,
    default: {
      get expoConfig() {
        return { ...expoConfig, extra: { ...expoConfig.extra, adsMode: mockBuild.adsMode } };
      },
    },
  };
});

type Setup = {
  readonly isPremium?: boolean;
  readonly ref?: RunRef;
  readonly hasHints?: boolean;
  readonly adsMode?: 'off' | 'test';
  /** Where the rewarded ad stands when the screen opens (AdsPort.rewardedStatus). */
  readonly rewardedStatus?: RewardedStatus;
  /** The player answered consent so that ads may be requested (spec 8.8). */
  readonly canRequestAds?: boolean;
};

/** Tally level 1: the target is 4 and par is 2; column 0 adds one, column 1 adds two. */
const LEVEL_1: RunRef = { kind: 'level', level: 1 };
/** Tally endless: the target is 10; 2 + 2 + 2 + 2 + 1 + 2 = 11 goes past it. */
const ENDLESS: RunRef = { kind: 'endless' };
const tapColumn = (col: number) =>
  ({ kind: 'tap', target: { regionId: 'board', col, row: 0 }, selected: null }) as const;

function navSpies(): GameScreenNav & Record<keyof GameScreenNav, jest.Mock> {
  return { onLevels: jest.fn(), onHome: jest.fn(), onOpenPremium: jest.fn() };
}

async function gameScreen({
  isPremium = false,
  ref = LEVEL_1,
  hasHints = true,
  adsMode = 'test',
  rewardedStatus = 'unavailable',
  canRequestAds = false,
}: Setup = {}) {
  mockBuild.adsMode = adsMode;
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
    host: { hasHints },
    services: {
      ads,
      save,
      connectivity: createFakeConnectivity(true),
      errorLog: createFakeErrorLog(),
    },
  });
  const nav = navSpies();
  /** Every command the screen model sent to the run, in order. */
  const sent: SessionCommand['type'][] = [];
  const view = await renderHook(
    () => {
      const controls = useGameSessionControls({ start: 'new', ref });
      const send = (command: SessionCommand): void => {
        sent.push(command.type);
        controls.send(command);
      };
      return { controls, model: useGameScreenModel({ ...controls, send }, nav) };
    },
    { wrapper: shell.wrapper },
  );
  const tap = async (col: number): Promise<void> => {
    await act(() => {
      view.result.current.controls.send({ type: 'intent', intent: tapColumn(col) });
    });
  };
  const tapAll = async (cols: readonly number[]): Promise<void> => {
    for (const col of cols) await tap(col);
  };
  const setStatus = async (status: RewardedStatus): Promise<void> => {
    await act(() => {
      ads.setRewardedStatus(status);
    });
  };
  const finishes = (): number => sent.filter((type) => type === 'finish').length;
  return { ...view, shell, nav, script, tap, tapAll, setStatus, finishes };
}

describe('useGameScreenModel', () => {
  it('draws the top bar from the run: mode line, goal, score and undo (spec S5)', async () => {
    const { result, tap } = await gameScreen();
    expect(result.current.model.topBar).toMatchObject({
      modeText: 'Level 1',
      progressText: 'Moves 0 / Par 2',
      scoreText: '0',
      undo: { label: 'Undo', isAvailable: false },
    });
    expect(result.current.model.result).toBeNull();
    await tap(0);
    expect(result.current.model.topBar?.undo?.isAvailable).toBe(true);
    await act(() => {
      result.current.model.topBar?.undo?.onPress();
    });
    expect(result.current.controls.view?.moveCount).toBe(0);
  });

  it('spends the free daily hint before the host shows it (spec 8.5, D2)', async () => {
    const { result, shell } = await gameScreen();
    expect(result.current.model.topBar?.hint).toMatchObject({ label: 'Hint', isAvailable: true });
    await act(async () => {
      result.current.model.topBar?.hint?.onPress();
      await flushMicrotasks();
    });
    expect(result.current.controls.view?.isHintShown).toBe(true);
    expect(shell.save.doc().hints).toStrictEqual({ freeDate: '2026-09-26', freeUsed: 1 });
    // Spent, offline for ads (no rewarded ad loaded): hidden, never a broken button (spec 8.8).
    expect(result.current.model.topBar?.hint).toBeNull();
  });

  it('draws no hint key for a game without solver hints, even with a free hint left (L8)', async () => {
    // The tally run supports hints and the config gives a free one, so only the fact hides the key.
    const { result } = await gameScreen({ hasHints: false });
    expect(result.current.model.topBar).toMatchObject({ hasHints: false, hint: null });
    expect(result.current.model.topBar?.undo).toMatchObject({ label: 'Undo' });
  });

  it('shows the win with its stars only after they are saved (spec S7, 8.1)', async () => {
    const { result, shell, tap } = await gameScreen();
    await tap(1);
    await tap(1);
    expect(shell.save.doc().progress.levels['1']?.stars).toBe(3);
    expect(result.current.model.result).toMatchObject({
      kind: 'win',
      stars: 3,
      modeText: 'Level 1',
      movesCount: 2,
      par: 2,
    });
  });

  it('starts the next level in the same screen from Next level', async () => {
    const { result, script, tap } = await gameScreen();
    await tap(1);
    await tap(1);
    await act(async () => {
      if (result.current.model.result?.kind !== 'win') throw new Error('no win');
      result.current.model.result.actions.onNext();
      await flushMicrotasks();
    });
    expect(result.current.controls.view?.ref).toStrictEqual({ kind: 'level', level: 2 });
    expect(result.current.model.result).toBeNull();
    // ADS_MODE test, but no consent answer: the interstitial is never due (spec 8.8).
    expect(script.calls).not.toContain('showInterstitial');
  });

  it('offers a free continue to Premium owners and plays on after it (spec 8.10)', async () => {
    const { result, tap, finishes } = await gameScreen({ isPremium: true });
    await tap(1);
    await tap(0);
    await tap(1);
    expect(result.current.model.result).toMatchObject({ kind: 'lose', continueOffer: 'premium' });
    expect(finishes()).toBe(0);
    await act(async () => {
      result.current.model.result?.actions.onContinue();
      await flushMicrotasks();
    });
    expect(result.current.controls.status).toBe('playing');
    expect(result.current.model.result).toBeNull();
  });

  it('records a declined loss and leaves to Levels', async () => {
    const { result, shell, nav, tapAll } = await gameScreen({
      rewardedStatus: 'ready',
      canRequestAds: true,
    });
    await tapAll([1, 0, 1]);
    expect(result.current.model.result).toMatchObject({ kind: 'lose', continueOffer: 'ad' });
    expect(shell.save.doc().stats.gamesPlayed).toBe(0);
    await act(() => {
      result.current.model.result?.actions.onLevels();
    });
    expect(nav.onLevels).toHaveBeenCalledTimes(1);
    expect(shell.save.doc().run).toBeNull();
    expect(shell.save.doc().stats.gamesPlayed).toBe(1);
  });

  it('shows the endless result at once in an ads-off build without Premium (L11)', async () => {
    const { result, shell, tapAll, finishes, rerender } = await gameScreen({
      ref: ENDLESS,
      adsMode: 'off',
    });
    await tapAll([1, 1, 1, 1, 0, 1]);

    expect(finishes()).toBe(1);
    const best = shell.save.doc().progress.endlessBest;
    expect(best).toBeGreaterThan(0);
    expect(result.current.model.result).toMatchObject({
      kind: 'endless',
      isNewBest: true,
      scoreText: String(best),
      bestScore: best,
    });
    expect(shell.save.doc().run).toBeNull();
    await rerender({});
    expect(finishes()).toBe(1);
  });

  it('keeps the offer while the rewarded ad loads and lets the player take it once ready', async () => {
    const { result, shell, tapAll, setStatus, finishes } = await gameScreen({
      rewardedStatus: 'loading',
      canRequestAds: true,
    });
    await tapAll([1, 0, 1]);
    expect(result.current.model.result).toMatchObject({
      kind: 'lose',
      continueOffer: 'ad-loading',
    });

    await setStatus('ready');
    expect(result.current.model.result).toMatchObject({ kind: 'lose', continueOffer: 'ad' });
    expect(finishes()).toBe(0);
    expect(shell.save.doc().stats.gamesPlayed).toBe(0);
  });

  it('records the loss once the loading ad fails, then shows the lose result without the offer', async () => {
    const { result, shell, tapAll, setStatus, finishes } = await gameScreen({
      rewardedStatus: 'loading',
      canRequestAds: true,
    });
    await tapAll([1, 0, 1]);
    expect(finishes()).toBe(0);

    await setStatus('unavailable');
    expect(finishes()).toBe(1);
    expect(result.current.model.result).toMatchObject({ kind: 'lose', continueOffer: null });
    expect(shell.save.doc().stats).toMatchObject({ gamesPlayed: 1, losses: 1 });
    // A later status change never records the run again.
    await setStatus('loading');
    expect(finishes()).toBe(1);
    expect(shell.save.doc().stats.gamesPlayed).toBe(1);
  });
});
