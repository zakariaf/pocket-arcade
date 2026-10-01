// packages/shell/src/screens/game/use-game-screen-model.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { useGameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';
import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';

import { useGameScreenModel } from './use-game-screen-model.ts';

import type { GameScreenNav } from './use-game-screen-model.ts';
import type { FakeAdsScript } from '@e07/shell/services/ads/fake-ads.ts';
import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
// The tally game has solver hints: its config gives one free hint a day (hints.freePerDay 1).
jest.mock('expo-constants', () =>
  jest
    .requireActual<{ testExpoConstantsWith: (game: object) => unknown }>(
      '@e07/shell/testing/test-game-extra.ts',
    )
    .testExpoConstantsWith({ hints: { freePerDay: 1 } }),
);

type Setup = { readonly isPremium?: boolean; readonly ref?: RunRef; readonly hasHints?: boolean };

/** Tally level 1: the target is 4 and par is 2; column 0 adds one, column 1 adds two. */
const LEVEL_1: RunRef = { kind: 'level', level: 1 };
const tapColumn = (col: number) =>
  ({ kind: 'tap', target: { regionId: 'board', col, row: 0 }, selected: null }) as const;

function navSpies(): GameScreenNav & Record<keyof GameScreenNav, jest.Mock> {
  return { onLevels: jest.fn(), onHome: jest.fn(), onOpenPremium: jest.fn() };
}

async function gameScreen({ isPremium = false, ref = LEVEL_1, hasHints = true }: Setup = {}) {
  const script: FakeAdsScript = {
    isRewardedLoaded: false,
    interstitialResult: 'unavailable',
    rewardResult: 'unavailable',
    calls: [],
  };
  const shell = createHostWrapper({
    isPremium,
    host: { hasHints },
    services: {
      ads: createFakeAds(script),
      connectivity: createFakeConnectivity(true),
      errorLog: createFakeErrorLog(),
    },
  });
  const nav = navSpies();
  const view = await renderHook(
    () => {
      const controls = useGameSessionControls({ start: 'new', ref });
      return { controls, model: useGameScreenModel(controls, nav) };
    },
    { wrapper: shell.wrapper },
  );
  const tap = async (col: number): Promise<void> => {
    await act(() => {
      view.result.current.controls.send({ type: 'intent', intent: tapColumn(col) });
    });
  };
  return { ...view, shell, nav, script, tap };
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
    const { result, tap } = await gameScreen({ isPremium: true });
    await tap(1);
    await tap(0);
    await tap(1);
    expect(result.current.model.result).toMatchObject({ kind: 'lose', continueOffer: 'premium' });
    await act(async () => {
      result.current.model.result?.actions.onContinue();
      await flushMicrotasks();
    });
    expect(result.current.controls.status).toBe('playing');
    expect(result.current.model.result).toBeNull();
  });

  it('records a declined loss and leaves to Levels', async () => {
    const { result, shell, nav, tap } = await gameScreen();
    await tap(1);
    await tap(0);
    await tap(1);
    expect(result.current.model.result).toMatchObject({ kind: 'lose', continueOffer: null });
    await act(() => {
      result.current.model.result?.actions.onLevels();
    });
    expect(nav.onLevels).toHaveBeenCalledTimes(1);
    expect(shell.save.doc().run).toBeNull();
    expect(shell.save.doc().stats.gamesPlayed).toBe(1);
  });
});
