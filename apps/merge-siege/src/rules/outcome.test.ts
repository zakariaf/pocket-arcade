// apps/merge-siege/src/rules/outcome.test.ts
// Spec 10 RULES "Is it over?: win, lose (with a reason), or still playing." Merge Siege's one way of
// losing (design notes) is merge-siege.lose.overrun: an enemy reached the bottom row, or the board
// jammed so no swipe changes anything. A level is won once its whole wave has entered and every
// enemy is smashed; the endless run (difficulty 100) is never won.
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { parseBoard } from './board-text.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { OVERRUN_KEY, outcome } from './outcome.ts';

import type { MergeSiegeState } from './merge-siege-types.ts';

const EMPTY = ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .'];

function stateWith(
  rows: readonly string[],
  overrides: Partial<MergeSiegeState> = {},
): MergeSiegeState {
  return { ...create(1, 0), cells: parseBoard(rows), ...overrides };
}

describe('outcome', () => {
  it('names the catalog key of the one way of losing', () => {
    expect(OVERRUN_KEY).toBe('merge-siege.lose.overrun');
  });

  it('is playing while enemies are on the board above the bottom row', () => {
    expect(outcome(stateWith(['e4 . . . .', ...EMPTY.slice(1), '2 . . . .']))).toStrictEqual({
      kind: 'playing',
    });
  });

  it('is lost (overrun) once an enemy stands on the bottom row', () => {
    expect(
      outcome(stateWith([...EMPTY.slice(0, 2), '. 8 . . .', ...EMPTY.slice(3), '. . . e2 .'])),
    ).toStrictEqual({
      kind: 'lost',
      reasonKey: OVERRUN_KEY,
    });
  });

  it('is lost (overrun) on a jammed board where no swipe changes anything', () => {
    const jammed = ['2 4 2 4 2', '4 2 4 2 4', '2 4 2 4 2', '4 2 4 2 4', '2 4 2 4 2', '4 2 4 2 4'];
    expect(outcome(stateWith(jammed))).toStrictEqual({ kind: 'lost', reasonKey: OVERRUN_KEY });
  });

  it('is lost (overrun) when no tile is left to swipe', () => {
    expect(outcome(stateWith(['e2 . . . .', ...EMPTY]))).toStrictEqual({
      kind: 'lost',
      reasonKey: OVERRUN_KEY,
    });
  });

  it('is won with the score once the wave has entered and no enemy is left', () => {
    const cleared = stateWith([...EMPTY, '8 . . . .'], { next: null, score: 230 });
    expect(outcome(cleared)).toStrictEqual({ kind: 'won', score: 230 });
  });

  it('is still playing while an enemy of the wave waits to enter', () => {
    expect(outcome(stateWith([...EMPTY, '8 . . . .']))).toStrictEqual({ kind: 'playing' });
  });

  it('keeps the endless run playing, never won, even with the board clear', () => {
    const endless = stateWith([...EMPTY, '8 . . . .'], {
      next: null,
      difficulty: ENDLESS_DIFFICULTY,
    });
    expect(outcome(endless)).toStrictEqual({ kind: 'playing' });
  });

  it('puts an overrun before a win', () => {
    const both = stateWith([...EMPTY.slice(0, 4), '8 . . . .', '. e2 . . .'], { next: null });
    expect(outcome(both).kind).toBe('lost');
  });

  describe('properties', () => {
    it('keeps an endless run unwon, ending it only with the catalog lose key', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4_294_967_295 }),
          fc.array(fc.nat(), { maxLength: 80 }),
          (seed, choices) => {
            const { states } = playChoices(
              { listMoves, applyMove },
              create(seed, ENDLESS_DIFFICULTY),
              choices,
            );
            for (const state of states) expect(['playing', OVERRUN_KEY]).toContain(reasonOf(state));
          },
        ),
      );
    });
  });
});

/** 'playing', or the lose key of a lost run (a won run would print 'won' and fail). */
function reasonOf(state: MergeSiegeState): string {
  const result = outcome(state);
  if (result.kind === 'lost') return result.reasonKey;
  return result.kind;
}
