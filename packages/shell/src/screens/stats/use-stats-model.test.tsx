// packages/shell/src/screens/stats/use-stats-model.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { useBannerSlot } from '@e07/shell/app/use-ad-context.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { useLevelPlay } from '@e07/shell/screens/home/use-level-play.ts';
import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

import { overviewCells } from './stats-cells.ts';
import { useStatsModel } from './use-stats-model.ts';

import type { DialogRequest } from '@e07/shell/screens/dialogs/dialog-request.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { HostWrapperOptions } from '@e07/shell/testing/create-host-wrapper.tsx';

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
  rewardedStatus: 'unavailable',
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
      counters: { adds: 7, 'biggest-add': 4 },
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
      { key: 'biggest-add', label: 'Biggest add', valueText: '×4' },
    ]);
  });

  it('shows a best-of counter nobody reached yet as 0, never ×0 (spec S10)', async () => {
    const save = playedSave();
    save.update((doc) => ({ ...doc, stats: { ...doc.stats, counters: { adds: 7 } } }));
    const { result } = await statsModel(save);

    expect(result.current.snapshot.gameStats.map((stat) => stat.valueText)).toStrictEqual([
      '7',
      '0',
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

  describe("with the design's numbers (58 games, 36 wins, 2 h 14 min)", () => {
    /** playedSave() with the design's games and wins, consent given and the tutorial done. */
    function designSave(): SaveService {
      const save = playedSave();
      save.update((doc) => ({
        ...doc,
        firstRun: { languageChosen: true, tutorialDone: true },
        ads: { ...doc.ads, consent: { ...doc.ads.consent, canRequestAds: true } },
        stats: { ...doc.stats, gamesPlayed: 58, wins: 36, losses: 22 },
      }));
      return save;
    }

    async function designHook(save: SaveService, options: HostWrapperOptions = {}) {
      mockNavigate.mockClear();
      const shell = createHostWrapper({
        ...options,
        services: { save, ads: ADS, connectivity: createFakeConnectivity(true) },
      });
      return renderHook(
        () => ({
          model: useStatsModel(),
          t: useT(),
          slot: useBannerSlot('stats'),
          levelPlay: useLevelPlay(),
        }),
        { wrapper: shell.wrapper },
      );
    }

    it('asks in S14 first, then clears only the statistics in one write (spec S10)', async () => {
      const save = designSave();
      const update = jest.spyOn(save, 'update');
      const { result } = await designHook(save);
      update.mockClear();

      result.current.model.onReset();
      const [request] = mockOpenDialog.mock.calls.at(-1) ?? [];
      expect(request?.kind).toBe('reset-stats');
      expect(update).not.toHaveBeenCalled();
      expect(result.current.model.isEmpty).toBe(false);
      if (request?.kind !== 'reset-stats') throw new Error('no reset-statistics dialog');

      await act(() => {
        request.onConfirm();
      });

      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0]?.[1]).toStrictEqual({ refreshBackup: true });
      expect(save.doc().stats.gamesPlayed).toBe(0);
      expect(save.doc().progress.levels['1']?.stars).toBe(3);
      expect(result.current.model.isEmpty).toBe(true);
    });

    it('writes the play time from the fa catalog in Persian digits (spec 7.3)', async () => {
      const { result } = await designHook(designSave(), { language: 'fa' });
      const { model, t } = result.current;
      const playTime = overviewCells(model, t).find((cell) => cell.id === 'play-time')?.value;

      expect(playTime).toBe(t('stats.duration', { hours: 2, minutes: 14 }));
      expect(playTime).toMatch(/[۰-۹]/);
      expect(playTime).not.toMatch(/[0-9]/);
    });

    it('shows the win rate as 62% in en, and in Persian digits with ٪ in fa', async () => {
      const { result: en } = await designHook(designSave());
      const { result: fa } = await designHook(designSave(), { language: 'fa' });
      const rateOf = (model: typeof en.current.model): string =>
        model.formatPercent(model.snapshot.winRate);

      expect(rateOf(en.current.model)).toBe('62%');
      expect(rateOf(fa.current.model)).toContain('۶۲');
      expect(rateOf(fa.current.model)).toContain('٪');
      expect(rateOf(fa.current.model)).not.toMatch(/[0-9]/);
    });

    it("takes the banner from useBannerSlot('stats'), never for a Premium owner (8.8)", async () => {
      const { result: free } = await designHook(designSave());
      const { result: premium } = await designHook(designSave(), { isPremium: true });

      expect(free.current.model.banner).toStrictEqual(free.current.slot);
      expect(free.current.slot.isAllowed).toBe(true);
      expect(premium.current.model.banner.isAllowed).toBe(false);
    });

    it("plays from the empty state as Home's Play key does (useLevelPlay)", async () => {
      const { result } = await designHook(createTestSave().save);

      result.current.model.onPlay();
      result.current.levelPlay.onPlay();

      expect(mockNavigate.mock.calls).toHaveLength(2);
      expect(mockNavigate.mock.calls[0]).toStrictEqual(mockNavigate.mock.calls[1]);
      expect(mockNavigate.mock.calls[0]).toStrictEqual([
        'Game',
        { start: 'new', ref: { kind: 'level', level: 1 } },
      ]);
    });
  });
});
