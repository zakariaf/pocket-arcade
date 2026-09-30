// packages/shell/src/screens/stats/use-stats-model.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

import { useStatsModel } from './use-stats-model.ts';

import type { DialogRequest } from '@e07/shell/screens/dialogs/dialog-request.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';

const mockNavigate = jest.fn();
const mockOpenDialog = jest.fn<undefined, [DialogRequest]>();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useIsFocused: () => true,
}));
jest.mock('@e07/shell/app/dialog-context.tsx', () => ({ useOpenDialog: () => mockOpenDialog }));
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

/** Three games on Saturday 2026-09-26, level 1 won with 3 stars, seven adds counted. */
function playedSave(): SaveService {
  const { save } = createTestSave();
  const won = {
    stars: 3,
    bestScore: 40,
    bestMoves: 2,
    completions: 1,
    firstCompletedOn: '2026-09-26',
  } as const;
  save.update((doc) => ({
    ...doc,
    progress: { ...doc.progress, levels: { '1': won } },
    stats: {
      ...doc.stats,
      gamesPlayed: 3,
      wins: 2,
      losses: 1,
      playMs: 8_040_000,
      days: { '2026-09-26': { games: 3, playMs: 8_040_000 } },
      counters: { adds: 7 },
    },
  }));
  return save;
}

async function statsModel(save: SaveService) {
  const shell = createHostWrapper({
    services: { save, ads: ADS, connectivity: createFakeConnectivity(true) },
  });
  return renderHook(() => useStatsModel(), { wrapper: shell.wrapper });
}

describe('useStatsModel', () => {
  it("fills the snapshot from the save and labels the game's counters in game order", async () => {
    const { result } = await statsModel(playedSave());
    const { snapshot } = result.current;

    expect(result.current).toMatchObject({ isEmpty: false, gameName: 'Tally' });
    expect(snapshot).toMatchObject({ gamesPlayed: 3, wins: 2, playHours: 2, playMinutes: 14 });
    expect(snapshot.bestLevelScore).toStrictEqual({ level: 1, score: 40 });
    expect(snapshot.week.at(-1)).toStrictEqual({
      letter: 'Sat',
      weekdayName: 'Saturday',
      games: 3,
    });
    expect(snapshot.gameStats).toStrictEqual([
      { key: 'adds', label: 'Adds', valueText: '7' },
      { key: 'biggest-add', label: 'Biggest add', valueText: '0' },
    ]);
  });

  it('shows the empty state to a new player, without a best level score', async () => {
    const { result } = await statsModel(createTestSave().save);
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.snapshot.bestLevelScore).toBeNull();

    result.current.onPlay();
    expect(mockNavigate).toHaveBeenCalledWith('Game', {
      start: 'new',
      ref: { kind: 'level', level: 1 },
    });
  });

  it('asks before resetting, then clears the statistics', async () => {
    const { result } = await statsModel(playedSave());
    result.current.onReset();
    const [request] = mockOpenDialog.mock.calls.at(-1) ?? [];
    if (request?.kind !== 'reset-stats')
      throw new Error('the reset-statistics dialog did not open');

    await act(() => {
      request.onConfirm();
    });
    expect(result.current.isEmpty).toBe(true);
  });
});
