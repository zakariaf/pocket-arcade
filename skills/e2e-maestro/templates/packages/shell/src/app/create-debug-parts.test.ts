// packages/shell/src/app/create-debug-parts.test.ts
// The glue between the debug services, the link handler and the app: the flags survive a reload
// through the key-value store, save writes reach the stores, routes reach the navigator ref (after
// the group switch a first-run link starts), links sent while the app starts wait for the
// navigator, the perf log lives in the save database, a direction flip stops the audio before the
// reload, a bad link reaches the error log.
import { restartForDirection } from '@e07/shell/i18n/direction.ts';
import { createFakeDebugStore } from '@e07/shell/screens/debug/fake-debug-store.ts';
import { createSimulatedClock } from '@e07/shell/screens/debug/simulated-clock.ts';
import { createSimulatedConnectivity } from '@e07/shell/screens/debug/simulated-connectivity.ts';
import { createFakeClock } from '@e07/shell/services/clock/fake-clock.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createFakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';
import { planLoad } from '@e07/shell/services/save/load-plan.ts';
import { createSaveService } from '@e07/shell/services/save/save-service.ts';
import { createShellStores } from '@e07/shell/stores/create-shell-stores.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';

import { createDebugParts } from './create-debug-parts.ts';

import type { DebugParts, DebugPartsInput } from './create-debug-parts.ts';
import type { LinkSource } from './debug-link-handler.ts';
import type { FakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import type { SqlDriver, SqlValue } from '@e07/shell/services/save/sql-driver.ts';

// One in-memory key-value store stands in for expo-sqlite/kv-store across "reloads".
const mockStore = createFakeDebugStore();
const mockGuard = { readPending: () => null, writePending: jest.fn() };
jest.mock('@e07/shell/services/save/sqlite-kv-debug-store-adapter.ts', () => ({
  createSqliteKvDebugStoreAdapter: () => mockStore,
}));
jest.mock('@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts', () => ({
  createSqliteKvDirectionGuardAdapter: () => mockGuard,
}));
jest.mock('@e07/shell/i18n/direction.ts', () => ({
  readLayoutDirection: () => 'ltr',
  restartForDirection: jest.fn(() => Promise.resolve()),
}));
jest.mock('react-native-google-mobile-ads');

const LINK = 'e07-line-siege://debug/setup';

/** The save database's one perf_log row, in memory. */
function createRowDriver(): SqlDriver & { readonly tables: string[] } {
  const tables: string[] = [];
  let payload: SqlValue | undefined;
  return {
    tables,
    exec: (sql) => {
      tables.push(sql);
    },
    run: (_sql, params) => {
      [payload] = params;
    },
    get: () => (payload === undefined ? null : { payload }),
    transaction: (work) => {
      work();
    },
  };
}

type FakeLinks = LinkSource & { readonly open: (url: string) => void };

function fakeLinks(): FakeLinks {
  const listeners: ((event: { readonly url: string }) => void)[] = [];
  return {
    getInitialURL: () => Promise.resolve(null),
    addEventListener: (_type, listener) => {
      listeners.push(listener);
      return { remove: () => undefined };
    },
    open: (url) => {
      listeners.forEach((listener) => {
        listener({ url });
      });
    },
  };
}

function createSave() {
  const plan = planLoad({ current: null, backup: null, gameId: 'line-siege' });
  const deps = {
    store: createFakeSaveStore(),
    clock: { nowMs: () => 0 },
    errorLog: createFakeErrorLog(),
    appVersion: '1.0.0',
    isStrict: true,
  };
  const save = createSaveService(deps, plan, 0);
  save.applyLoadWrites();
  return save;
}

type Setup = {
  readonly parts: DebugParts;
  readonly clock: ReturnType<typeof createSimulatedClock>;
  readonly navigate: jest.SpyInstance;
  /** The navigator's next state change (what a group switch produces). */
  readonly nextState: () => void;
  readonly links: FakeLinks;
  readonly driver: ReturnType<typeof createRowDriver>;
  readonly order: string[];
  readonly errorLog: FakeErrorLog;
} & Pick<DebugPartsInput, 'save' | 'stores'>;

function setup(isTestBuild = true): Setup {
  const save = createSave();
  const stores = createShellStores(save);
  const errorLog = createFakeErrorLog();
  const order: string[] = [];
  const clock = createSimulatedClock(createFakeClock({ nowMs: 0, today: '2026-09-28' }));
  const connectivity = createSimulatedConnectivity(createFakeConnectivity(true));
  const links = fakeLinks();
  const driver = createRowDriver();
  const parts = createDebugParts({
    network: { simulated: isTestBuild ? connectivity : null },
    clocks: { simulated: isTestBuild ? clock : null },
    premiumDeps: { persistPremium: jest.fn(), dispatch: jest.fn() },
    save,
    saveDriver: driver,
    stores,
    audio: {
      dispose: () => {
        order.push('audio stopped');
        return Promise.resolve();
      },
    },
    errorLog,
    extra: { levels: { packCount: 3, levelsPerPack: 30 } },
    linking: links,
  });
  // The ref has no navigator in a unit test; watch what the link asks it to do.
  const navigate = jest.spyOn(parts.navigationRef, 'navigate').mockImplementation(() => undefined);
  const stateListeners: (() => void)[] = [];
  jest.spyOn(parts.navigationRef, 'addListener').mockImplementation((_event, listener) => {
    stateListeners.push(listener as () => void);
    return () => stateListeners.splice(stateListeners.indexOf(listener as () => void), 1);
  });
  const nextState = (): void => {
    [...stateListeners].forEach((listener) => {
      listener();
    });
  };
  return { parts, clock, navigate, nextState, links, driver, order, save, stores, errorLog };
}

describe('createDebugParts', () => {
  beforeEach(() => {
    mockStore.set('debug.overrides', null);
    mockStore.set('debug.pending-screen', null);
  });

  it('builds no debug code without the test-build wrappers (a store build)', () => {
    const { parts } = setup(false);
    expect([parts.services, parts.links]).toStrictEqual([null, null]);
  });

  it('keeps the date and the offline flag for the next run of the app', () => {
    setup().parts.links?.handleUrl(`${LINK}?date=2026-09-26&offline=1`);

    const next = setup();

    expect(next.clock.today()).toBe('2026-09-26');
    expect(next.parts.services?.isOffline()).toBe(true);
  });

  it('writes the save through the stores, then opens the route once the Main group is there', () => {
    const { parts, navigate, nextState, save, stores } = setup();
    parts.links?.handleUrl(`${LINK}?theme=dark&firstRun=0&level=3&screen=game`);
    expect(save.doc().settings.theme).toBe('dark');
    expect(stores.settings.getState().settings.theme).toBe('dark');
    // A fresh save shows the first-run group: Game exists after the switch the write started.
    expect(navigate).not.toHaveBeenCalled();
    nextState();
    expect(navigate).toHaveBeenCalledWith('Game', {
      start: 'new',
      ref: { kind: 'level', level: 3 },
    });
    nextState();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('listens to Linking at once: a link sent while the app starts is applied when ready', () => {
    const { parts, navigate, links, save } = setup();
    links.open(`${LINK}?firstRun=0&screen=home`);
    expect(save.doc().firstRun.tutorialDone).toBe(false);

    parts.links?.start(links);

    expect(save.doc().firstRun.tutorialDone).toBe(true);
    links.open(`${LINK}?screen=settings`);
    expect(navigate).toHaveBeenCalledWith('Settings');
  });

  it('keeps the perf log in the save database, for Home and the e2e cold-start step', () => {
    const { parts, driver } = setup();
    parts.services?.perfLog.append({ kind: 'cold-start', label: 'home', atEpochMs: 1, data: {} });
    expect(parts.services?.perfLog.entries()).toHaveLength(1);
    expect(driver.tables.join(' ')).toContain('perf_log');
  });

  it('stops the audio, then reloads for a direction flip', async () => {
    const { parts, order } = setup();
    parts.links?.handleUrl(`${LINK}?lang=fa&screen=levels`);
    await flushMicrotasks();
    expect(order).toStrictEqual(['audio stopped']);
    expect(restartForDirection).toHaveBeenCalledWith('rtl', mockGuard);
  });

  it('blocks and records every JS network attempt of a test build (debug.network-attempts)', async () => {
    const { errorLog } = setup();
    // Read through Reflect: lint bans fetch and URL literals in app code, tests included.
    const guarded = Reflect.get(globalThis, 'fetch') as (target: string) => Promise<unknown>;
    await expect(guarded('remote-a')).rejects.toThrow('fetch to remote-a blocked');
    expect(errorLog.recorded.map((entry) => entry.source)).toStrictEqual(['network']);
  });

  it('logs a bad link as a boot error and opens S15', () => {
    const { parts, navigate, errorLog } = setup();
    parts.links?.handleUrl(`${LINK}?screen=nowhere`);
    expect(errorLog.recorded.map((entry) => entry.source)).toStrictEqual(['boot']);
    expect(navigate).toHaveBeenCalledWith('Debug');
  });
});
