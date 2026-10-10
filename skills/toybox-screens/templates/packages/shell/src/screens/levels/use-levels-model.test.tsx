// packages/shell/src/screens/levels/use-levels-model.test.tsx
import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { PARITY_PLANS } from '@e07/shell/app/parity/parity-plans.ts';
import { endParitySession, startParitySession } from '@e07/shell/app/parity/parity-session.ts';
import { systemA11yStore } from '@e07/shell/app/system-a11y-store.ts';
import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

import { useLevelsModel } from './use-levels-model.ts';

import type { LevelPack } from '@e07/game-kit/contract/levels.ts';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
/** Levels is focused unless a test covers it with the Game screen. */
const mockFocus = { isFocused: true };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useIsFocused: () => mockFocus.isFocused,
}));
jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

const ADS = createFakeAds({
  rewardedStatus: 'unavailable',
  interstitialResult: 'unavailable',
  rewardResult: 'unavailable',
  calls: [],
});

async function levelsModel() {
  const { save } = createTestSave();
  const won = {
    stars: 2,
    bestScore: 30,
    bestMoves: 2,
    completions: 1,
    firstCompletedOn: '2026-09-25',
  } as const;
  save.update((doc) => ({ ...doc, progress: { ...doc.progress, levels: { '1': won } } }));
  const shell = createHostWrapper({
    services: { save, ads: ADS, connectivity: createFakeConnectivity(false) },
  });
  return renderHook(() => useLevelsModel(), { wrapper: shell.wrapper });
}

describe('useLevelsModel', () => {
  it("draws the game's packs with the saved stars and the pack names from its catalogs", async () => {
    const { result } = await levelsModel();
    const [pack] = result.current.packs;

    expect(pack).toMatchObject({ number: 1, name: 'First steps', earnedStars: 2, totalStars: 9 });
    expect(pack?.tiles.map((tile) => tile.state.kind)).toStrictEqual([
      'completed',
      'current',
      'locked',
    ]);
    expect(result.current.banner.isAllowed).toBe(false);
  });

  it('focuses a tapped locked tile, and plays an open one', async () => {
    const { result } = await levelsModel();
    await act(() => {
      result.current.onTapLockedLevel(3);
    });
    expect(result.current.focusedLevel).toBe(3);

    await act(() => {
      result.current.onPlayLevel(2);
    });
    expect(result.current.focusedLevel).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('Game', {
      start: 'new',
      ref: { kind: 'level', level: 2 },
    });
    result.current.onBack();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('resumes the saved level from its tile instead of starting it over (N10, spec 8.6)', async () => {
    mockNavigate.mockClear();
    const { save } = createTestSave();
    const shell = createHostWrapper({
      services: { save, ads: ADS, connectivity: createFakeConnectivity(false) },
    });
    shell.host.openSession({ start: 'new', ref: { kind: 'level', level: 1 } });
    const { result } = await renderHook(() => useLevelsModel(), { wrapper: shell.wrapper });

    await act(() => {
      result.current.onPlayLevel(1);
    });
    await act(() => {
      result.current.onPlayLevel(2);
    });

    expect(mockNavigate.mock.calls).toStrictEqual([
      ['Game', { start: 'resume' }],
      ['Game', { start: 'new', ref: { kind: 'level', level: 2 } }],
    ]);
  });

  it("holds the current tile's flag still while the Game screen covers Levels", async () => {
    const { result: focused } = await levelsModel();
    mockFocus.isFocused = false;
    try {
      const { result: covered } = await levelsModel();

      expect(focused.current.isReducedMotion).toBe(false);
      expect(covered.current.isReducedMotion).toBe(true);
    } finally {
      mockFocus.isFocused = true;
    }
  });

  it('opens with the first locked tile tapped in the parity frame that shows it', async () => {
    startParitySession({
      frame: 's8-levels',
      plan: PARITY_PLANS['s8-levels'],
      theme: 'light',
      lang: 'en',
      game: 'lineSiege',
      date: '2026-09-27',
      scrollY: 0,
    });
    try {
      const { result } = await levelsModel();
      expect(result.current.focusedLevel).toBe(3);
      expect(result.current.isReducedMotion).toBe(true);
    } finally {
      endParitySession();
    }
  });

  it('announces how to open a tapped locked tile, again when another tap changes it (iOS)', async () => {
    // Two open packs: 1 won, 2 current, 3 locked; then 4 current, 5 and 6 locked.
    const twoPacks: readonly LevelPack[] = [
      { id: 'first', nameId: 'tally.pack.first', firstLevel: 1, levelCount: 3, starsToUnlock: 0 },
      { id: 'second', nameId: 'tally.pack.first', firstLevel: 4, levelCount: 3, starsToUnlock: 0 },
    ];
    const won = {
      stars: 3,
      bestScore: 30,
      bestMoves: 2,
      completions: 1,
      firstCompletedOn: '2026-09-25',
    } as const;
    const { save } = createTestSave();
    save.update((doc) => ({ ...doc, progress: { ...doc.progress, levels: { '1': won } } }));
    const shell = createHostWrapper({
      host: { packs: twoPacks },
      services: { save, ads: ADS, connectivity: createFakeConnectivity(false) },
    });
    const speak = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      const { result } = await renderHook(() => useLevelsModel(), { wrapper: shell.wrapper });
      await act(() => {
        systemA11yStore.setState({ isScreenReaderOn: true });
      });
      await act(() => {
        result.current.onTapLockedLevel(3);
      });
      await act(() => {
        result.current.onTapLockedLevel(6);
      });

      expect(speak.mock.calls).toStrictEqual([
        ['Unlock this one by finishing level 2.'],
        ['Unlock this one by finishing level 4.'],
      ]);
    } finally {
      systemA11yStore.setState({ isScreenReaderOn: false });
      speak.mockRestore();
    }
  });
});
