// packages/shell/src/screens/home/use-home-model.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { DebugServicesProvider } from '@e07/shell/app/debug-services-context.tsx';
import { PARITY_PLANS } from '@e07/shell/app/parity/parity-plans.ts';
import { endParitySession, startParitySession } from '@e07/shell/app/parity/parity-session.ts';
import { useColdStartMark } from '@e07/shell/app/perf/use-cold-start-mark.ts';
import { useGameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';
import { stripIsolates } from '@e07/shell/i18n/bidi.ts';
import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeClock } from '@e07/shell/services/clock/fake-clock.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { applyRunEnd } from '@e07/shell/stores/run-end.ts';
import { updateAndPublish } from '@e07/shell/stores/update-and-publish.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

import { useHomeModel } from './use-home-model.ts';

import type { PerfLog } from '@e07/shell/app/perf/perf-log.ts';
import type { DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { DialogRequest } from '@e07/shell/screens/dialogs/dialog-request.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { HostWrapperOptions } from '@e07/shell/testing/create-host-wrapper.tsx';
import type { ReactNode } from 'react';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useIsFocused: () => true,
}));
const mockOpenDialog = jest.fn<undefined, [DialogRequest]>();
jest.mock('@e07/shell/app/dialog-context.tsx', () => ({ useOpenDialog: () => mockOpenDialog }));
// The mark itself (one frame after Home is drawn) is performance-budgets' own test.
jest.mock('@e07/shell/app/perf/use-cold-start-mark.ts', () => ({ useColdStartMark: jest.fn() }));
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

/** A player past the tutorial who won levels 1 and 2 and answered the consent form. */
function seasonedSave(): SaveService {
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
    progress: { levels: { '1': won, '2': won }, endlessBest: 1840 },
    ads: { ...doc.ads, consent: { ...doc.ads.consent, canRequestAds: true } },
  }));
  return save;
}

/** A seasoned player who has won levels 1 to `last` and has no saved run. */
function wonThrough(last: number): SaveService {
  const save = seasonedSave();
  const won = {
    stars: 2,
    bestScore: 30,
    bestMoves: 4,
    completions: 1,
    firstCompletedOn: '2026-09-20',
  } as const;
  const levels = Object.fromEntries(
    Array.from({ length: last }, (_unused, index) => [String(index + 1), won]),
  );
  save.update((doc) => ({ ...doc, progress: { ...doc.progress, levels } }));
  return save;
}

/** Home's model hook in a host wrapper built from `options` (the save, clock, settings...). */
async function homeHook(options: HostWrapperOptions) {
  mockNavigate.mockClear();
  const shell = createHostWrapper({
    ...options,
    services: { ads: ADS, connectivity: createFakeConnectivity(true), ...options.services },
  });
  const view = await renderHook(() => useHomeModel(), { wrapper: shell.wrapper });
  return { ...view, shell };
}

/** A test build's debug services as Home reads them: the perf log, and no ad override. */
const PERF_LOG: PerfLog = { append: jest.fn(), entries: () => [] };
const TEST_BUILD_DEBUG = { perfLog: PERF_LOG, adsOverride: () => null } as DebugServices;

async function homeModel(save: SaveService, isOnline = true, debug: DebugServices | null = null) {
  const shell = createHostWrapper({
    services: { save, ads: ADS, connectivity: createFakeConnectivity(isOnline) },
  });
  const Shell = shell.wrapper;
  const wrapper = ({ children }: { readonly children: ReactNode }): ReactNode => (
    <Shell>
      <DebugServicesProvider services={debug}>{children}</DebugServicesProvider>
    </Shell>
  );
  const { result } = await renderHook(() => useHomeModel(), { wrapper });
  return { model: result.current, shell };
}

describe('useHomeModel', () => {
  it('shows the game, the next unfinished level, the daily card and the endless best', async () => {
    const { model } = await homeModel(seasonedSave());

    expect([model.gameName, model.tagline]).toStrictEqual(['Tally', 'Count to the target.']);
    expect(model.play).toStrictEqual({ isContinue: false, level: 3 });
    expect(stripIsolates(model.daily.dateText)).toBe('Saturday, 26 Sep');
    expect(model).toMatchObject({ hasEndless: true, isPremium: false, bestEndlessScore: 1840 });
    expect(model.banner).toStrictEqual({ renderBanner: ADS.renderBanner, isAllowed: true });
  });

  it('offers Continue for a saved level run and resumes it', async () => {
    const save = seasonedSave();
    const first = await homeModel(save);
    first.shell.host.openSession({ start: 'new', ref: { kind: 'level', level: 2 } });
    const { model } = await homeModel(save);

    expect(model.play).toStrictEqual({ isContinue: true, level: 2 });
    model.actions.onPlay();
    expect(mockNavigate).toHaveBeenLastCalledWith('Game', { start: 'resume' });
  });

  it("resumes a saved run from its own key: today's daily from the card, endless from its row", async () => {
    // N10, 8.6: the save holds one run; opening a new one over it would throw that run away.
    const save = seasonedSave();
    const first = await homeModel(save);
    first.shell.host.openSession({ start: 'new', ref: { kind: 'daily', date: '2026-09-26' } });
    (await homeModel(save)).model.actions.onPlayDaily();
    expect(mockNavigate).toHaveBeenLastCalledWith('Game', { start: 'resume' });

    first.shell.host.openSession({ start: 'new', ref: { kind: 'endless' } });
    (await homeModel(save)).model.actions.onPlayEndless();
    expect(mockNavigate).toHaveBeenLastCalledWith('Game', { start: 'resume' });
    // The saved endless run is not today's daily: the card's key starts the daily.
    (await homeModel(save)).model.actions.onPlayDaily();
    expect(mockNavigate).toHaveBeenLastCalledWith('Game', {
      start: 'new',
      ref: { kind: 'daily', date: '2026-09-26' },
    });
  });

  it("plays the day's daily the clock says when the key is pressed, past midnight on an open Home", async () => {
    // Spec S9: the day changes at local midnight; Home may stay open across it without re-rendering.
    const clock = createFakeClock({ nowMs: 1_790_510_400_000, today: '2026-09-26' });
    const shell = createHostWrapper({
      services: {
        clock,
        save: createTestSave(clock).save,
        ads: ADS,
        connectivity: createFakeConnectivity(true),
      },
    });
    const { result } = await renderHook(() => useHomeModel(), { wrapper: shell.wrapper });
    clock.setToday('2026-09-27');
    result.current.actions.onPlayDaily();
    expect(mockNavigate).toHaveBeenLastCalledWith('Game', {
      start: 'new',
      ref: { kind: 'daily', date: '2026-09-27' },
    });
  });

  it('keeps the banner closed offline', async () => {
    const { model } = await homeModel(seasonedSave(), false);
    expect(model.banner.isAllowed).toBe(false);
  });

  it('navigates from every key exactly as the route table says', async () => {
    mockNavigate.mockClear();
    const { model } = await homeModel(seasonedSave());
    const { actions } = model;
    for (const press of [
      actions.onPlay,
      actions.onOpenDaily,
      actions.onPlayDaily,
      actions.onPlayEndless,
      actions.onOpenSettings,
      actions.onOpenLevels,
      actions.onOpenStats,
      actions.onOpenHowToPlay,
      actions.onOpenPremium,
    ])
      press();

    expect(mockNavigate.mock.calls).toStrictEqual([
      ['Game', { start: 'new', ref: { kind: 'level', level: 3 } }],
      ['Daily'],
      ['Game', { start: 'new', ref: { kind: 'daily', date: '2026-09-26' } }],
      ['Game', { start: 'new', ref: { kind: 'endless' } }],
      ['Settings'],
      ['Levels'],
      ['Stats'],
      ['HowToPlay'],
      ['Premium'],
    ]);
  });

  it("marks the cold start into the test build's perf log, and passes null in a store build", async () => {
    await homeModel(seasonedSave(), true, TEST_BUILD_DEBUG);
    expect(jest.mocked(useColdStartMark)).toHaveBeenLastCalledWith(PERF_LOG);
    await homeModel(seasonedSave());
    expect(jest.mocked(useColdStartMark)).toHaveBeenLastCalledWith(null);
  });

  it('opens the progress-restored dialog in its parity frame, and never on a normal launch', async () => {
    mockOpenDialog.mockClear();
    await homeModel(seasonedSave());
    expect(mockOpenDialog).not.toHaveBeenCalled();
    startParitySession({
      frame: 's14-progress-restored',
      plan: PARITY_PLANS['s14-progress-restored'],
      theme: 'light',
      lang: 'en',
      game: 'lineSiege',
      date: '2026-09-27',
      scrollY: 0,
    });
    try {
      await homeModel(seasonedSave());
      expect(mockOpenDialog.mock.calls).toStrictEqual([[{ kind: 'save-restored' }]]);
    } finally {
      endParitySession();
    }
  });
  it('offers "Play – Level 13" with no saved level run and opens a new run of it (spec S4)', async () => {
    const { result } = await homeHook({ services: { save: wonThrough(12) } });

    expect(result.current.play).toStrictEqual({ isContinue: false, level: 13 });
    result.current.actions.onPlay();
    expect(mockNavigate.mock.calls).toStrictEqual([
      ['Game', { start: 'new', ref: { kind: 'level', level: 13 } }],
    ]);
  });

  it("plays today's daily from the card's Play key and opens S9 from its body (L7)", async () => {
    const clock = createFakeClock({ nowMs: 1_790_510_400_000, today: '2026-09-27' });
    const { result } = await homeHook({ services: { clock, save: createTestSave(clock).save } });

    result.current.actions.onPlayDaily();
    result.current.actions.onOpenDaily();
    expect(mockNavigate.mock.calls).toStrictEqual([
      ['Game', { start: 'new', ref: { kind: 'daily', date: '2026-09-27' } }],
      ['Daily'],
    ]);
  });

  it('gives a Premium owner no banner (spec 8.8)', async () => {
    const { result } = await homeHook({ services: { save: seasonedSave() }, isPremium: true });

    expect(result.current.isPremium).toBe(true);
    expect(result.current.banner.isAllowed).toBe(false);
  });

  it('holds every moving part still while Reduce motion is on', async () => {
    const off = await homeHook({ services: { save: seasonedSave() } });
    expect(off.result.current.isReducedMotion).toBe(false);

    const on = await homeHook({
      services: { save: seasonedSave() },
      settings: { reduceMotion: 'on' },
    });
    expect(on.result.current.isReducedMotion).toBe(true);
  });

  it('shows the new Play level and streak after a run end is published to the stores', async () => {
    const save = seasonedSave();
    const { result, rerender, shell } = await homeHook({ services: { save } });
    expect(result.current.play.level).toBe(3);
    expect(result.current.daily.streakDays).toBe(0);

    const common = { isWon: true, score: 60, moves: 5, playMs: 30_000, counters: {} } as const;
    // The run-end writes happen outside React (the game host), like in the app.
    await act(() => {
      for (const end of [
        { ...common, mode: 'level', level: 3, stars: 3 },
        { ...common, mode: 'daily', date: '2026-09-26' },
      ] as const)
        updateAndPublish(save, shell.stores, {
          recipe: (doc) => applyRunEnd(doc, end, '2026-09-26'),
          refreshBackup: true,
        });
    });
    await rerender({});

    expect(result.current.play).toStrictEqual({ isContinue: false, level: 4 });
    expect(result.current.daily).toMatchObject({ streakDays: 1, isDoneToday: true });
  });
  it('formats the daily date in Persian digits for a Persian player', async () => {
    const { result } = await homeHook({ services: { save: seasonedSave() }, language: 'fa' });

    expect(stripIsolates(result.current.daily.dateText)).toBe('شنبه، ۲۶ سپتامبر');
  });
  it('offers Continue for a level run paused and left through Pause Home (spec S6)', async () => {
    const save = seasonedSave();
    const { shell } = await homeHook({ services: { save } });
    const { result: controls } = await renderHook(
      () => useGameSessionControls({ start: 'new', ref: { kind: 'level', level: 2 } }),
      { wrapper: shell.wrapper },
    );
    await act(() => {
      controls.current.pause();
    });
    await act(() => {
      controls.current.leaveToHome();
    });
    const { result } = await homeHook({ services: { save } });

    expect(save.doc().run?.ref).toStrictEqual({ kind: 'level', level: 2 });
    expect(result.current.play).toStrictEqual({ isContinue: true, level: 2 });
  });
});
