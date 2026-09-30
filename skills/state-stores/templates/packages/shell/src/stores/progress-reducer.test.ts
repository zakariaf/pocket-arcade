// packages/shell/src/stores/progress-reducer.test.ts
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';
import { progressReducer, recordLevelResult } from '@e07/shell/stores/progress-reducer.ts';
import { progressSliceOf } from '@e07/shell/stores/progress-store.ts';

import type { LevelWin } from '@e07/shell/stores/progress-reducer.ts';

const START = progressSliceOf(createDefaultSaveDoc('shell-test'));
const WIN: LevelWin = { level: 3, stars: 2, score: 900, moves: 9, date: '2026-09-26' };

describe('progressReducer', () => {
  it('records a first win', () => {
    const progress = recordLevelResult(START.progress, WIN);
    expect(progress.levels['3']).toStrictEqual({
      stars: 2,
      bestScore: 900,
      bestMoves: 9,
      completions: 1,
      firstCompletedOn: '2026-09-26',
    });
  });

  it('keeps the best stars, score and moves and the first completion date', () => {
    const first = recordLevelResult(START.progress, WIN);
    const worse = { ...WIN, stars: 1, score: 100, moves: 20, date: '2026-09-28' } as const;
    const better = { ...WIN, stars: 3, score: 1200, moves: 7, date: '2026-09-29' } as const;
    const progress = recordLevelResult(recordLevelResult(first, worse), better);
    expect(progress.levels['3']).toStrictEqual({
      stars: 3,
      bestScore: 1200,
      bestMoves: 7,
      completions: 3,
      firstCompletedOn: '2026-09-26',
    });
  });

  it('treats moves null as "not counted"', () => {
    const first = recordLevelResult(START.progress, { ...WIN, moves: null });
    expect(recordLevelResult(first, WIN).levels['3']?.bestMoves).toBe(9);
  });

  it('keeps only the best endless score', () => {
    const best = progressReducer(START, { type: 'record-endless-score', score: 4210 });
    expect(best.progress.endlessBest).toBe(4210);
    expect(progressReducer(best, { type: 'record-endless-score', score: 10 })).toBe(best);
  });

  it("allows the game's free hints per local day (game.config hints.freePerDay)", () => {
    const today = '2026-09-26';
    const used = progressReducer(START, { type: 'use-free-hint', today, freePerDay: 1 });
    expect(used.hints).toStrictEqual({ freeDate: today, freeUsed: 1 });
    expect(progressReducer(used, { type: 'use-free-hint', today, freePerDay: 1 })).toBe(used);
    const tomorrow = progressReducer(used, {
      type: 'use-free-hint',
      today: '2026-09-27',
      freePerDay: 1,
    });
    expect(tomorrow.hints).toStrictEqual({ freeDate: '2026-09-27', freeUsed: 1 });
  });

  it('spends no free hint in a game that gives none (freePerDay 0)', () => {
    const action = { type: 'use-free-hint', today: '2026-09-26', freePerDay: 0 } as const;
    expect(progressReducer(START, action)).toBe(START);
  });

  it('records the upsell line once per day', () => {
    const shown = progressReducer(START, { type: 'record-upsell-shown', today: '2026-09-26' });
    expect(shown.upsell.lastShownOn).toBe('2026-09-26');
    expect(progressReducer(shown, { type: 'record-upsell-shown', today: '2026-09-26' })).toBe(
      shown,
    );
  });
});
