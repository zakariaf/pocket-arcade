// packages/shell/src/screens/debug/use-debug-model.test.tsx
// S15's model through the Shell wrapper, over the real debug services and link handler: the
// switches and tools change the app exactly as the debug link does, and the rows show it.
import { act, renderHook } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';

import { createDebugLinkHandler } from '@e07/shell/app/debug-link-handler.ts';
import { DebugServicesProvider } from '@e07/shell/app/debug-services-context.tsx';
import { PARITY_PLANS } from '@e07/shell/app/parity/parity-plans.ts';
import { endParitySession, startParitySession } from '@e07/shell/app/parity/parity-session.ts';
import { stripIsolates, isolate } from '@e07/shell/i18n/bidi.ts';
import { createFakeClock } from '@e07/shell/services/clock/fake-clock.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { updateAndPublish } from '@e07/shell/stores/update-and-publish.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { createDebugServices } from './debug-services.ts';
import { createFakeDebugPerf } from './fake-debug-perf.ts';
import { createFakeDebugStore } from './fake-debug-store.ts';
import { createSimulatedClock } from './simulated-clock.ts';
import { createSimulatedConnectivity } from './simulated-connectivity.ts';
import { readDebugState, useDebugModel } from './use-debug-model.ts';

import type { DebugRoute } from '@e07/shell/app/debug-link-routes.ts';
import type { PerfEntry } from '@e07/shell/app/perf/perf-log.ts';
import type { Language } from '@e07/shell/i18n/languages.ts';
import type { FakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import type { ReactNode } from 'react';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
}));
jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);
jest.mock('react-native-google-mobile-ads');

/** Answers each action sheet with the next index (pack, then level, ...). */
function answerSheets(...answers: number[]): void {
  jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_options, done) => {
    done(answers.shift() ?? -1);
  });
}

type SetupOptions = { readonly language?: Language };

async function setup(options: SetupOptions = {}) {
  const clock = createSimulatedClock(
    createFakeClock({ nowMs: 1_790_424_000_000, today: '2026-09-26' }),
  );
  const errorLog: FakeErrorLog = createFakeErrorLog();
  const { save } = createTestSave(clock);
  const shell = createShellWrapper({
    language: options.language ?? 'en',
    services: { clock, errorLog, save },
  });
  const entries: PerfEntry[] = [
    { kind: 'cold-start', label: 'home', atEpochMs: 1, data: { totalMs: 1_049 } },
  ];
  const perfLog = { append: (entry: PerfEntry) => entries.push(entry), entries: () => entries };
  const perf = createFakeDebugPerf(perfLog);
  const debug = createDebugServices({
    connectivity: createSimulatedConnectivity(createFakeConnectivity(true)),
    clock,
    store: createFakeDebugStore(),
    resetConsent: null,
    perfLog,
    perf,
    persistPremium: jest.fn(),
    dispatchPremium: shell.stores.premium.getState().dispatch,
    nowMs: clock.nowMs,
    adsMode: 'off',
    onError: jest.fn(),
  });
  const routes: DebugRoute[] = [];
  const links = createDebugLinkHandler({
    services: debug,
    store: createFakeDebugStore(),
    readSave: save.doc,
    writeSave: (write) => {
      updateAndPublish(save, shell.stores, write);
    },
    today: clock.today,
    levelCount: 90,
    layoutDirection: 'ltr',
    restart: () => Promise.resolve(),
    openRoute: (route) => {
      routes.push(route);
    },
    onNextNavigationState: (callback) => {
      callback();
    },
    game: null,
    onError: (error) => {
      errorLog.record('boot', error);
    },
  });
  const wrapper = ({ children }: { readonly children: ReactNode }): ReactNode => (
    <shell.wrapper>
      <DebugServicesProvider services={debug} links={links}>
        {children}
      </DebugServicesProvider>
    </shell.wrapper>
  );
  const { result } = await renderHook(() => useDebugModel(), { wrapper });
  return { result, routes, errorLog, save, perf, debug, links };
}

describe('useDebugModel', () => {
  it('shows the next level, the simulated day, the locale, the error log and the counter', async () => {
    const { result } = await setup();
    const { values, switches, networkAttempts } = result.current;

    expect([values.level, stripIsolates(values.date), values.errors]).toStrictEqual([
      '1',
      'Saturday, 26 Sep',
      '0',
    ]);
    expect(values.locale).toBe(isolate('en · ltr · 123'));
    expect(networkAttempts).toBe('0');
    expect(Object.values(switches)).toStrictEqual([false, false, false, false]);
  });

  it('flips the switches through the debug services and shows the new state', async () => {
    const { result } = await setup();

    await act(() => {
      result.current.onToggle('offline');
      result.current.onToggle('premium');
    });
    await act(() => {
      result.current.onToggle('ads-always-test');
    });
    await act(() => {
      result.current.onToggle('ads-never');
    });

    expect(result.current.switches).toStrictEqual({
      'ads-always-test': false,
      'ads-never': true,
      premium: true,
      offline: true,
    });
  });

  it('jumps to a level through the link handler: levels before it won, the game opened', async () => {
    const { result, routes } = await setup();
    answerSheets(0, 2);

    await act(() => {
      result.current.onAction('jump-to-level');
    });

    expect(routes).toStrictEqual([
      { name: 'Game', params: { start: 'new', ref: { kind: 'level', level: 3 } } },
    ]);
    expect(result.current.values.level).toBe('3');
  });

  it('moves the simulated day from the Set date sheet', async () => {
    const { result } = await setup();
    answerSheets(2);

    await act(() => {
      result.current.onAction('set-date');
    });

    expect(stripIsolates(result.current.values.date)).toBe('Sunday, 27 Sep');
  });

  it('counts the error log and the network guard entries in it', async () => {
    const { result, errorLog } = await setup();

    await act(() => {
      errorLog.record('network', new Error('fetch to remote-a blocked (N3)'));
      errorLog.record('ads', new Error('no fill'));
      result.current.onToggle('offline');
    });

    expect([result.current.values.errors, result.current.networkAttempts]).toStrictEqual([
      '2',
      '1',
    ]);
  });

  it('imports a pasted save from the Import save field, and shows why a bad one fails', async () => {
    const { result, save } = await setup();
    await act(() => {
      result.current.onAction('import-save');
    });
    expect(result.current.importField).toMatchObject({ isOpen: true, text: '', error: null });

    await act(() => {
      result.current.importField.onChangeText('{"hello": 1}');
    });
    await act(() => {
      result.current.importField.onSubmit();
    });
    expect(result.current.importField.error).toContain('not a saved game');
    expect(result.current.values.errors).toBe('1');

    const exported = JSON.stringify({
      ...save.doc(),
      settings: { ...save.doc().settings, theme: 'dark' },
    });
    await act(() => {
      result.current.importField.onChangeText(exported);
    });
    await act(() => {
      result.current.importField.onSubmit();
    });
    expect(save.doc().settings.theme).toBe('dark');
    expect(result.current.importField).toMatchObject({ isOpen: false, text: '', error: null });
  });

  it('opens the font test page from its row', async () => {
    const { result } = await setup();
    result.current.onAction('font-test');
    result.current.openFontTest();
    expect(mockNavigate.mock.calls).toStrictEqual([['FontTest'], ['FontTest']]);
  });

  it('goes back with Back', async () => {
    const { result } = await setup();
    result.current.onBack();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});

describe('useDebugModel: the Performance section', () => {
  it('records frame times while the switch is on and shows the perf log in numbers', async () => {
    const { result, perf } = await setup();
    expect(result.current.perf.isRecording).toBe(false);
    expect(result.current.perf.entriesCount).toBe(1);
    expect(result.current.perf.summary).toBe('cold 1 · 1049 ms · save p95 –');

    await act(() => {
      result.current.perf.onToggleRecording();
    });

    expect(result.current.perf.isRecording).toBe(true);
    expect(perf.calls).toStrictEqual(['record on']);
  });

  it('runs the save benchmark and shows its p95', async () => {
    const { result } = await setup();
    await act(() => {
      result.current.perf.onRunBenchmark();
    });
    expect(result.current.perf.entriesCount).toBe(2);
    expect(result.current.perf.summary).toBe('cold 1 · 1049 ms · save p95 0.4 ms');
  });

  it('shares the report, and a failed share only reaches the error log', async () => {
    const { result, perf, errorLog } = await setup();
    await act(() => {
      result.current.perf.onShare();
    });
    expect(perf.calls).toStrictEqual(['share']);

    jest.spyOn(perf, 'share').mockReturnValue(Promise.reject(new Error('sheet closed')));
    await act(async () => {
      result.current.perf.onShare();
      await Promise.resolve();
    });
    expect(errorLog.recorded.map((entry) => entry.source)).toStrictEqual(['boot']);
  });
});

describe('useDebugModel: the language of the numbers', () => {
  it("draws S15's numbers in Persian digits in fa, as the design does; the labels stay English", async () => {
    const { result, links } = await setup({ language: 'fa' });

    await act(() => {
      links.handleUrl('e07-line-siege://debug/setup?stars=demo');
      result.current.onToggle('offline');
    });

    expect([result.current.values.level, result.current.values.errors]).toStrictEqual(['۱۲', '۰']);
    // Machine-read by every smoke flow (assert '0'); the design draws no counter.
    expect(result.current.networkAttempts).toBe('0');
  });
});

describe('useDebugModel: the S15 parity frame (L12)', () => {
  afterEach(() => {
    endParitySession();
  });

  it("turns 'Always show test ads' on once, through its own switch, in the s15-debug-menu frame", async () => {
    startParitySession({
      frame: 's15-debug-menu',
      plan: PARITY_PLANS['s15-debug-menu'],
      theme: 'light',
      lang: 'en',
      game: 'lineSiege',
      date: '2026-09-27',
      scrollY: 0,
    });
    const { result, debug } = await setup();

    expect(result.current.switches['ads-always-test']).toBe(true);
    expect(debug.adsOverride()).toBe('always-test');
  });

  it('changes nothing on a normal launch', async () => {
    const { result, debug } = await setup();

    expect([result.current.switches['ads-always-test'], debug.adsOverride()]).toStrictEqual([
      false,
      null,
    ]);
  });
});

describe('readDebugState', () => {
  it('reads the flags, the simulated day and both logs again for every version', async () => {
    const { debug, errorLog } = await setup();
    const sources = {
      services: debug,
      errorLog,
      clock: { nowMs: () => 0, today: () => '2026-09-26', msUntilNextLocalDay: () => 1 },
    } as const;
    const first = readDebugState(sources, false, 0);
    const perfBefore = first.perfEntries.length;

    debug.setOffline(true);
    errorLog.record('ads', new Error('no fill'));
    debug.perf.runSaveBenchmark();
    const next = readDebugState(sources, false, 1);

    expect([first.switches.offline, first.errorEntries.length]).toStrictEqual([false, 0]);
    expect([
      next.switches.offline,
      next.errorEntries.length,
      next.perfEntries.length,
    ]).toStrictEqual([true, 1, perfBefore + 1]);
  });
});
