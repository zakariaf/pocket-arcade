// apps/line-siege/src/rules/outcome.test.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { create } from './create.ts';
import { knobsFor } from './line-siege-tuning.ts';
import { outcome } from './outcome.ts';

import type { Cell, LineSiegeState } from './line-siege-types.ts';

/** A board where only the listed cells are free. */
function onlyFree(state: LineSiegeState, free: readonly number[]): LineSiegeState {
  const cells = state.cells.map((_, index): Cell => (free.includes(index) ? 0 : 1));
  return { ...state, cells };
}

describe('outcome', () => {
  it('reports playing while hearts remain, the wave lasts and a block fits', () => {
    expect(outcome(create(1, 0))).toStrictEqual({ kind: 'playing' });
  });

  it('reports a loss when the last heart is gone (spec 13: a breakthrough costs a heart)', () => {
    expect(outcome({ ...create(1, 0), hearts: 0 })).toStrictEqual({
      kind: 'lost',
      reasonKey: 'line-siege.lose.broke-through',
    });
  });

  it('reports the breach of the last heart as a loss even when the wave is over', () => {
    const lastBreach = { ...create(1, 0), hearts: 0, monsters: [], spawned: knobsFor(0).goal };
    expect(outcome(lastBreach)).toStrictEqual({
      kind: 'lost',
      reasonKey: 'line-siege.lose.broke-through',
    });
  });

  it('reports a win with the score once the whole wave of the level is gone', () => {
    const cleared = { ...create(1, 0), monsters: [], spawned: knobsFor(0).goal, score: 140 };
    expect(outcome(cleared)).toStrictEqual({ kind: 'won', score: 140 });
  });

  it('keeps playing while monsters of the wave are still to come', () => {
    const lull = { ...create(1, 0), monsters: [], spawned: knobsFor(0).goal - 1 };
    expect(outcome(lull)).toStrictEqual({ kind: 'playing' });
  });

  it('keeps the endless run playing even when the lanes are empty', () => {
    const endless = { ...create(1, ENDLESS_DIFFICULTY), monsters: [], spawned: 99 };
    expect(outcome(endless)).toStrictEqual({ kind: 'playing' });
  });

  it('reports a loss when no offered block fits on the board', () => {
    const start = create(1, 0);
    const locked = onlyFree({ ...start, tray: [5, null, null] }, [0, 9, 18]);
    expect(outcome(locked)).toStrictEqual({
      kind: 'lost',
      reasonKey: 'line-siege.lose.board-full',
    });
  });

  it('lets a win beat a full board: the last clear counts', () => {
    const start = create(1, 0);
    const won = { ...onlyFree({ ...start, tray: [5, null, null] }, []), monsters: [], spawned: 9 };
    expect(outcome(won).kind).toBe('won');
  });
});
