// packages/shell/src/app/debug-link-handler.test.ts
// The debug link over the real debug services and the in-memory key-value store. A "reload" is a
// second set of services and a second handler over the same store, as after reloadAppAsync. The
// navigator is a route log plus the callbacks waiting for its next state (a group switch).
import { createDebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import { createFakeDebugPerf } from '@e07/shell/screens/debug/fake-debug-perf.ts';
import { createFakeDebugStore } from '@e07/shell/screens/debug/fake-debug-store.ts';
import { createSimulatedClock } from '@e07/shell/screens/debug/simulated-clock.ts';
import { createSimulatedConnectivity } from '@e07/shell/screens/debug/simulated-connectivity.ts';
import { createFakeClock } from '@e07/shell/services/clock/fake-clock.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';

import { createDebugLinkHandler } from './debug-link-handler.ts';

import type { DebugLinkHandler, DebugLinkOutcome, LinkSource } from './debug-link-handler.ts';
import type { DebugGameControls, DebugRoute } from './debug-link-routes.ts';
import type { Direction } from '@e07/shell/i18n/languages.ts';
import type { DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { FakeDebugStore } from '@e07/shell/screens/debug/fake-debug-store.ts';
import type { SimulatedClock } from '@e07/shell/screens/debug/simulated-clock.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

jest.mock('react-native-google-mobile-ads');

const LINK = 'e07-line-siege://debug/setup';
const NOW_MS = 1_790_424_000_000;

type Run = {
  readonly handler: DebugLinkHandler;
  readonly services: DebugServices;
  readonly clock: SimulatedClock;
  readonly routes: DebugRoute[];
  readonly restarts: Direction[];
  readonly errors: unknown[];
  readonly doc: () => SaveDoc;
  /** The navigator's next state change: runs what waited for it (a group switch). */
  readonly nextState: () => void;
  readonly backups: () => number;
};

type RunOptions = {
  readonly store?: FakeDebugStore;
  readonly layout?: Direction;
  readonly game?: DebugGameControls | null;
  /** The save before the run (default: a finished first run, the Main group mounted). */
  readonly doc?: SaveDoc;
};

const FRESH = createDefaultSaveDoc('line-siege');
const PLAYED: SaveDoc = { ...FRESH, firstRun: { languageChosen: true, tutorialDone: true } };

/** One JS run of a test build: its services, save and handler (a new run = a reload). */
function startRun(options: RunOptions = {}): Run & { readonly store: FakeDebugStore } {
  const store = options.store ?? createFakeDebugStore();
  const clock = createSimulatedClock(createFakeClock({ nowMs: NOW_MS, today: '2026-09-28' }));
  const services = createDebugServices({
    connectivity: createSimulatedConnectivity(createFakeConnectivity(true)),
    clock,
    store,
    perfLog: { append: jest.fn(), entries: () => [] },
    perf: createFakeDebugPerf(),
    persistPremium: jest.fn(),
    dispatchPremium: jest.fn(),
    nowMs: () => NOW_MS,
    adsMode: 'off',
    onError: jest.fn(),
  });
  let doc = options.doc ?? PLAYED;
  let backups = 0;
  const routes: DebugRoute[] = [];
  const restarts: Direction[] = [];
  const errors: unknown[] = [];
  const waiting: (() => void)[] = [];
  const handler = createDebugLinkHandler({
    services,
    store,
    readSave: () => doc,
    writeSave: (write) => {
      doc = write.recipe(doc);
      if (write.refreshBackup) backups += 1;
    },
    today: clock.today,
    levelCount: 90,
    layoutDirection: options.layout ?? 'ltr',
    restart: (direction) => {
      restarts.push(direction);
      return Promise.resolve();
    },
    openRoute: (route) => {
      routes.push(route);
    },
    onNextNavigationState: (callback) => {
      waiting.push(callback);
    },
    game: options.game ?? null,
    onError: (error) => {
      errors.push(error);
    },
  });
  const nextState = (): void => {
    waiting.splice(0).forEach((callback) => {
      callback();
    });
  };
  const view = { routes, restarts, errors, doc: () => doc, nextState, backups: () => backups };
  return { handler, services, clock, store, ...view };
}

/** Test doubles of GameHost.debugControls(): playTo answers whether a run was active. */
function gameControls(hasRun = true) {
  return { playTo: jest.fn(() => hasRun), openExample: jest.fn() };
}

type FakeLinks = LinkSource & {
  readonly open: (url: string) => void;
  readonly listeners: () => number;
};

function fakeLinks(initialUrl: string | null): FakeLinks {
  const listeners = new Set<(event: { readonly url: string }) => void>();
  return {
    getInitialURL: () => Promise.resolve(initialUrl),
    addEventListener: (_type, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    open: (url) => {
      listeners.forEach((listener) => {
        listener({ url });
      });
    },
    listeners: () => listeners.size,
  };
}

describe('createDebugLinkHandler', () => {
  it('applies the services, then the save, then opens the screen', () => {
    const run = startRun();
    const outcome = run.handler.handleUrl(
      `${LINK}?lang=en&theme=light&date=2026-09-26&offline=1&boardLayout=1&screen=home`,
    );
    expect(outcome).toStrictEqual({ kind: 'applied' });
    expect(run.clock.today()).toBe('2026-09-26');
    expect([run.services.isOffline(), run.services.isBoardLayoutOn()]).toStrictEqual([true, true]);
    expect(run.doc().settings.theme).toBe('light');
    expect(run.routes).toStrictEqual([{ name: 'Home' }]);
  });

  it('opens screen= after the group switch when one link ends the first run', () => {
    const run = startRun({ doc: FRESH });
    const outcome = run.handler.handleUrl(`${LINK}?lang=en&firstRun=0&level=1&screen=game`);
    expect(outcome).toStrictEqual({ kind: 'applied' });
    expect(run.doc().firstRun).toStrictEqual({ languageChosen: true, tutorialDone: true });
    // The write re-renders the navigator into the Main group; Game exists only after that.
    expect(run.routes).toStrictEqual([]);
    run.nextState();
    expect(run.routes).toStrictEqual([
      { name: 'Game', params: { start: 'new', ref: { kind: 'level', level: 1 } } },
    ]);
  });

  it('applies a link sent before the navigator is ready once it is (launchApp, then openLink)', async () => {
    const run = startRun({ doc: FRESH });
    const links = fakeLinks(null);
    run.handler.listen(links);
    links.open(`${LINK}?firstRun=0&level=1&screen=game`);
    await flushMicrotasks();
    expect([run.routes, run.doc().firstRun.tutorialDone]).toStrictEqual([[], false]);

    run.handler.start(links);
    run.nextState();

    expect(run.doc().firstRun.tutorialDone).toBe(true);
    expect(run.routes).toStrictEqual([
      { name: 'Game', params: { start: 'new', ref: { kind: 'level', level: 1 } } },
    ]);
    expect(links.listeners()).toBe(1);
  });

  it('refuses a link whose parts need two links', () => {
    const run = startRun({ doc: FRESH, game: gameControls() });
    const refused = (query: string): DebugLinkOutcome => run.handler.handleUrl(`${LINK}?${query}`);
    expect(refused('firstRun=0&action=win-level').kind).toBe('error');
    expect(startRun().handler.handleUrl(`${LINK}?firstRun=1&screen=levels`)).toStrictEqual({
      kind: 'error',
      message: 'screen=levels is not in the first-run screens that firstRun=1 opens',
    });
    expect(run.doc()).toStrictEqual(FRESH);
  });

  it('opens the game on the link level, or on the next level', () => {
    const run = startRun();
    run.handler.handleUrl(`${LINK}?level=1&screen=game`);
    run.handler.handleUrl(`${LINK}?stars=demo&screen=game`);
    expect(run.routes).toStrictEqual([
      { name: 'Game', params: { start: 'new', ref: { kind: 'level', level: 1 } } },
      { name: 'Game', params: { start: 'new', ref: { kind: 'level', level: 12 } } },
    ]);
  });

  it('keeps the date, the flags and the screen across the direction reload', async () => {
    const before = startRun();
    const url = `${LINK}?lang=fa&date=2026-09-26&offline=1&stars=1:3&screen=levels`;
    expect(before.handler.handleUrl(url)).toStrictEqual({ kind: 'restarting', direction: 'rtl' });
    expect([before.restarts, before.routes]).toStrictEqual([['rtl'], []]);

    const after = startRun({ store: before.store, layout: 'rtl' });
    after.handler.start(fakeLinks(url));
    await flushMicrotasks();

    expect(after.clock.today()).toBe('2026-09-26');
    expect(after.services.isOffline()).toBe(true);
    expect(after.routes).toStrictEqual([{ name: 'Levels' }]);
    expect(after.restarts).toStrictEqual([]);
    expect(after.store.entries()['debug.pending-screen']).toBeUndefined();
  });

  it('applies the launch link and every later link until stopped', async () => {
    const run = startRun();
    const links = fakeLinks(`${LINK}?screen=settings`);
    const stop = run.handler.start(links);
    await flushMicrotasks();
    links.open(`${LINK}?screen=premium`);
    links.open('e07-line-siege://somewhere-else');
    stop();
    links.open(`${LINK}?screen=stats`);
    expect(run.routes).toStrictEqual([{ name: 'Settings' }, { name: 'Premium' }]);
    expect(links.listeners()).toBe(0);
  });

  it('refuses a bad link: nothing applied, the error logged, S15 opened', () => {
    const run = startRun();
    const outcome = run.handler.handleUrl(`${LINK}?offline=1&colour=red`);
    expect(outcome).toStrictEqual({ kind: 'error', message: 'unknown debug parameter "colour"' });
    expect(run.services.isOffline()).toBe(false);
    expect(run.errors).toHaveLength(1);
    expect(run.routes).toStrictEqual([{ name: 'Debug' }]);
  });

  it('refuses action= and the example screens until the game host passes its controls', () => {
    const run = startRun();
    expect(run.handler.handleUrl(`${LINK}?action=win-level`).kind).toBe('error');
    expect(run.handler.handleUrl(`${LINK}?screen=result-win`).kind).toBe('error');
  });

  it('hands action= and the example screens to the game host', () => {
    const game = gameControls();
    const run = startRun({ game });
    run.handler.handleUrl(`${LINK}?screen=game-middle`);
    expect(run.handler.handleUrl(`${LINK}?action=lose-level`)).toStrictEqual({ kind: 'applied' });
    expect(game.openExample).toHaveBeenCalledWith('game-middle');
    expect(game.playTo).toHaveBeenCalledWith('lost');
  });

  it('ends the level on screen with action=win-level, as a real win would', () => {
    const game = gameControls();
    const run = startRun({ game });
    expect(run.handler.handleUrl(`${LINK}?action=win-level`)).toStrictEqual({ kind: 'applied' });
    expect(game.playTo).toHaveBeenCalledWith('won');
    expect([run.errors, run.routes]).toStrictEqual([[], []]);
  });

  it('reports action=win-level without a run on screen, and opens S15', () => {
    const run = startRun({ game: gameControls(false) });
    expect(run.handler.handleUrl(`${LINK}?action=win-level`)).toStrictEqual({
      kind: 'error',
      message: 'action=win-level needs a level on screen: open it first',
    });
    expect(run.routes).toStrictEqual([{ name: 'Debug' }]);
    expect(run.errors).toHaveLength(1);
  });

  it("imports an exported save in one write that refreshes the backup, and refuses another game's", () => {
    const run = startRun({ doc: FRESH });
    const exported = JSON.stringify({ ...PLAYED, settings: { ...PLAYED.settings, theme: 'dark' } });
    expect(run.handler.importSave(exported)).toStrictEqual({ kind: 'imported' });
    expect([run.doc().settings.theme, run.backups()]).toStrictEqual(['dark', 1]);

    const other = JSON.stringify(createDefaultSaveDoc('flock-tilt'));
    expect(run.handler.importSave(other)).toStrictEqual({
      kind: 'error',
      message: 'This save belongs to another game, not line-siege.',
    });
    expect([run.doc().settings.theme, run.backups(), run.errors]).toStrictEqual([
      'dark',
      1,
      [new Error('debug menu: import save: This save belongs to another game, not line-siege.')],
    ]);
  });

  it('refuses a level the game does not ship, in level= and in stars=', () => {
    const run = startRun();
    expect(run.handler.handleUrl(`${LINK}?level=91&screen=game`)).toStrictEqual({
      kind: 'error',
      message: 'level 91 is past the last level (90)',
    });
    expect(run.handler.handleUrl(`${LINK}?stars=1:3,95:2`).kind).toBe('error');
    expect(run.doc().progress.levels).toStrictEqual({});
  });

  it("applies S15's typed requests like a link, and reloads back to S15", async () => {
    const before = startRun();
    expect(before.handler.apply({ level: 3, screen: 'game' })).toStrictEqual({ kind: 'applied' });
    expect(Object.keys(before.doc().progress.levels)).toStrictEqual(['1', '2']);
    expect(before.handler.apply({ lang: 'ckb', screen: 'debug' }).kind).toBe('restarting');

    const after = startRun({ store: before.store, layout: 'rtl' });
    after.handler.start(fakeLinks(null));
    await flushMicrotasks();

    expect(after.routes).toStrictEqual([{ name: 'Debug' }]);
    expect(before.handler.apply({ level: 200 }).kind).toBe('error');
    expect(before.errors).toStrictEqual([
      new Error('debug menu: level 200 is past the last level (90)'),
    ]);
  });

  it('refuses an action that would be lost in a direction reload', () => {
    const run = startRun({ game: gameControls() });
    const outcome = run.handler.handleUrl(`${LINK}?lang=ckb&action=win-level`);
    expect(outcome.kind).toBe('error');
    expect(run.restarts).toStrictEqual([]);
  });
});
