// packages/shell/src/screens/home/use-home-model.test.tsx
import { renderHook } from '@testing-library/react-native';

import { DebugServicesProvider } from '@e07/shell/app/debug-services-context.tsx';
import { PARITY_PLANS } from '@e07/shell/app/parity/parity-plans.ts';
import { endParitySession, startParitySession } from '@e07/shell/app/parity/parity-session.ts';
import { useColdStartMark } from '@e07/shell/app/perf/use-cold-start-mark.ts';
import { stripIsolates } from '@e07/shell/i18n/bidi.ts';
import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

import { useHomeModel } from './use-home-model.ts';

import type { PerfLog } from '@e07/shell/app/perf/perf-log.ts';
import type { DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { DialogRequest } from '@e07/shell/screens/dialogs/dialog-request.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
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
});
