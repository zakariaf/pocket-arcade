// packages/shell/src/screens/levels/use-levels-model.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { PARITY_PLANS } from '@e07/shell/app/parity/parity-plans.ts';
import { endParitySession, startParitySession } from '@e07/shell/app/parity/parity-session.ts';
import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

import { useLevelsModel } from './use-levels-model.ts';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));
jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

const ADS = createFakeAds({
  isRewardedLoaded: false,
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
});
