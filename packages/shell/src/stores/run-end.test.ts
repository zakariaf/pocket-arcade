// packages/shell/src/stores/run-end.test.ts
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import { applyRunEnd } from './run-end.ts';

import type { RunEnd } from './run-end.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

const TODAY = '2026-09-26';
const BASE = { isWon: true, score: 400, moves: 8, playMs: 90_000, counters: {} } as const;
const LEVEL_WIN: RunEnd = { ...BASE, mode: 'level', level: 4, stars: 3 };

function withRun(doc: SaveDoc): SaveDoc {
  return {
    ...doc,
    run: {
      ref: { kind: 'level', level: 4 },
      seed: 1,
      difficulty: 1,
      stateVersion: 1,
      state: {},
      log: [],
      moveCount: 8,
      undoCount: 0,
      hintsUsed: 0,
      continuesUsed: 0,
      playMs: 90_000,
      resumeOnLaunch: true,
    },
  };
}

const START = withRun(createDefaultSaveDoc('line-siege'));

describe('applyRunEnd', () => {
  it('clears the run and records a won level and the statistics together', () => {
    const doc = applyRunEnd(START, LEVEL_WIN, TODAY);
    expect(doc.run).toBeNull();
    expect(doc.progress.levels['4']?.stars).toBe(3);
    expect(doc.stats.gamesPlayed).toBe(1);
    expect(doc.stats.bestScore.level).toBe(400);
  });

  it('records a lost level in the statistics only', () => {
    const doc = applyRunEnd(START, { ...LEVEL_WIN, isWon: false }, TODAY);
    expect(doc.progress.levels).toStrictEqual({});
    expect(doc.stats.losses).toBe(1);
  });

  it('records the daily result under the date the run started, not today', () => {
    const end: RunEnd = { ...BASE, mode: 'daily', date: '2026-09-25' };
    const doc = applyRunEnd(START, end, TODAY);
    expect(Object.keys(doc.daily.results)).toStrictEqual(['2026-09-25']);
    expect(doc.stats.bestScore.daily).toBe(400);
  });

  it('ignores a daily replay: neither the day nor the statistics change', () => {
    const end: RunEnd = { ...BASE, mode: 'daily', date: TODAY };
    const once = applyRunEnd(START, end, TODAY);
    const replay = applyRunEnd(withRun(once), { ...end, score: 9999 }, TODAY);
    expect(replay.daily).toStrictEqual(once.daily);
    expect(replay.stats).toStrictEqual(once.stats);
    expect(replay.run).toBeNull();
  });

  it('keeps the best endless score', () => {
    const end: RunEnd = { ...BASE, mode: 'endless', isWon: false, score: 4210 };
    const doc = applyRunEnd(START, end, TODAY);
    expect(doc.progress.endlessBest).toBe(4210);
    expect(doc.stats.bestScore.endless).toBe(4210);
  });

  it('does not count the tutorial as a game', () => {
    const doc = applyRunEnd(START, { ...BASE, mode: 'tutorial' }, TODAY);
    expect(doc.stats).toStrictEqual(START.stats);
    expect(doc.run).toBeNull();
  });
});
