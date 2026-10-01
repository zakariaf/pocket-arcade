// packages/shell/src/screens/debug/debug-actions.test.ts
// Each S15 tool over fakes: a sheet fake that answers with scripted choices, a link handler that
// records the requests it was asked to apply, and the real debug services.
import { createFakeClock } from '@e07/shell/services/clock/fake-clock.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import { runDebugAction } from './debug-actions.ts';
import { createDebugServices } from './debug-services.ts';
import { createFakeDebugPerf } from './fake-debug-perf.ts';
import { createFakeDebugStore } from './fake-debug-store.ts';
import { createSimulatedClock } from './simulated-clock.ts';
import { createSimulatedConnectivity } from './simulated-connectivity.ts';

import type { DebugToolDeps } from './debug-actions.ts';
import type { DebugLinkRequest } from './debug-link.ts';
import type { DebugSheets } from './debug-sheets.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

jest.mock('react-native-google-mobile-ads');

type Sheet = { readonly title: string; readonly text: string };

type Setup = {
  readonly deps: DebugToolDeps;
  readonly applied: DebugLinkRequest[];
  readonly shown: Sheet[];
  readonly shared: string[];
  readonly changes: () => number;
  readonly opened: string[];
};

const WON = {
  stars: 1,
  bestScore: 0,
  bestMoves: null,
  completions: 1,
  firstCompletedOn: '2026-09-26',
} as const;

type Options = {
  /** The index each choose() gets, in order (pack, then level, ...); none = Cancel. */
  readonly answers?: number[];
  readonly doc?: SaveDoc;
  readonly isShareFailing?: boolean;
};

function setup(options: Options = {}): Setup {
  const { answers = [], doc = createDefaultSaveDoc('line-siege') } = options;
  const applied: DebugLinkRequest[] = [];
  const shown: Sheet[] = [];
  const shared: string[] = [];
  const opened: string[] = [];
  let changes = 0;
  const sheets: DebugSheets = {
    choose: (title, labels, onChoice) => {
      shown.push({ title, text: labels.join(' | ') });
      const answer = answers.shift();
      if (answer !== undefined) onChoice(answer);
    },
    show: (title, message) => {
      shown.push({ title, text: message });
    },
    share: (text) => {
      shared.push(text);
      return options.isShareFailing === true
        ? Promise.reject(new Error('share failed'))
        : Promise.resolve();
    },
  };
  const clock = createSimulatedClock(createFakeClock({ nowMs: 0, today: '2026-09-28' }));
  const services = createDebugServices({
    connectivity: createSimulatedConnectivity(createFakeConnectivity(true)),
    clock,
    store: createFakeDebugStore(),
    perfLog: { append: jest.fn(), entries: () => [] },
    perf: createFakeDebugPerf(),
    persistPremium: jest.fn(),
    dispatchPremium: jest.fn(),
    nowMs: () => 0,
    adsMode: 'off',
    onError: jest.fn(),
  });
  const deps: DebugToolDeps = {
    services,
    links: {
      apply: (request) => {
        applied.push(request);
        return { kind: 'applied' };
      },
    },
    sheets,
    save: { doc: () => doc },
    errorLog: createFakeErrorLog(),
    today: clock.today,
    levels: { packCount: 3, levelsPerPack: 30 },
    onChanged: () => {
      changes += 1;
    },
    openImport: () => {
      opened.push('import field');
    },
    openFontTest: () => {
      opened.push('FontTest');
    },
  };
  return { deps, applied, shown, shared, changes: () => changes, opened };
}

describe('runDebugAction', () => {
  it('jumps to the level picked from a pack, through the link handler', () => {
    const { deps, applied, shown } = setup({ answers: [1, 4] });
    runDebugAction(deps, 'jump-to-level');
    expect(shown.map((sheet) => sheet.text.split(' | ')[0])).toStrictEqual([
      'Levels 1-30',
      'Level 31',
    ]);
    expect(applied).toStrictEqual([{ level: 35, screen: 'game' }]);
  });

  it('unlocks every level and gives stars through the link handler', () => {
    const doc = createDefaultSaveDoc('line-siege');
    const { deps, applied, changes } = setup({
      doc: { ...doc, progress: { ...doc.progress, levels: { '2': WON } } },
    });
    runDebugAction(deps, 'unlock-all');
    runDebugAction(deps, 'give-stars');
    expect(applied[0]?.stars).toHaveLength(89);
    expect(applied[1]).toStrictEqual({ stars: [{ level: 2, stars: 3 }] });
    expect(changes()).toBe(2);
  });

  it('sets the simulated day from the date sheet, and goes back to the real calendar', () => {
    const { deps, changes } = setup({ answers: [2, 0] });
    runDebugAction(deps, 'set-date');
    expect(deps.today()).toBe('2026-09-29');
    runDebugAction(deps, 'set-date');
    expect(deps.today()).toBe('2026-09-28');
    expect(changes()).toBe(2);
  });

  it('forces a language through the link handler, which reloads back to S15', () => {
    const { deps, applied } = setup({ answers: [2] });
    runDebugAction(deps, 'force-locale');
    expect(applied).toStrictEqual([{ lang: 'fa', screen: 'debug' }]);
  });

  it('changes nothing when a sheet is cancelled', () => {
    const { deps, applied, changes } = setup();
    runDebugAction(deps, 'jump-to-level');
    runDebugAction(deps, 'force-locale');
    expect([applied, changes()]).toStrictEqual([[], 0]);
  });

  it('shows the state and the error log', () => {
    const { deps, shown } = setup();
    deps.services.setSeed(42);
    runDebugAction(deps, 'show-state');
    runDebugAction(deps, 'error-log');
    expect(shown).toStrictEqual([
      { title: 'Level seed and game state', text: '{\n "seedOverride": 42,\n "run": null\n}' },
      { title: 'Error log', text: 'No errors recorded.' },
    ]);
  });

  it('opens the paste field for Import save and the font test page for Font test', () => {
    const { deps, opened, shown } = setup();
    runDebugAction(deps, 'import-save');
    runDebugAction(deps, 'font-test');
    expect([opened, shown]).toStrictEqual([['import field', 'FontTest'], []]);
  });

  it('shares the whole save as text, and records a failed share', async () => {
    const { deps, shared } = setup();
    runDebugAction(deps, 'export-save');
    expect(JSON.parse(shared[0] ?? '')).toStrictEqual(deps.save.doc());

    const failing = setup({ isShareFailing: true });
    runDebugAction(failing.deps, 'export-save');
    await Promise.resolve();
    expect(failing.deps.errorLog.entries().map((entry) => entry.source)).toStrictEqual(['save']);
  });
});
