// apps/__GAME_ID__/src/rules/outcome.test.ts
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { TUNING } from './__GAME_ID__-tuning.ts';

describe('outcome', () => {
  it('reports playing while lit cells and moves remain', () => {
    expect(outcome(create(1, 0))).toStrictEqual({ kind: 'playing' });
  });

  it('reports a win with the spare moves as score when the board is dark', () => {
    const dark = { ...create(1, 0), cells: create(1, 0).cells.map(() => 0 as const), moves: 2 };
    expect(outcome(dark)).toStrictEqual({ kind: 'won', score: 4 * TUNING.pointsPerSpareMove });
  });

  it('reports a loss with a catalog reason key when the moves run out', () => {
    const spent = { ...create(1, 0), moves: create(1, 0).maxMoves };
    expect(outcome(spent)).toStrictEqual({
      kind: 'lost',
      reasonKey: '__GAME_ID__.lose.out-of-moves',
    });
  });

  it('lists no moves exactly when the game is over', () => {
    fc.assert(
      fc.property(fc.nat(), fc.array(fc.nat(), { maxLength: 40 }), (seed, choices) => {
        const { states } = playChoices({ listMoves, applyMove }, create(seed, 30), choices);
        for (const state of states) {
          expect(listMoves(state).length === 0).toBe(outcome(state).kind !== 'playing');
        }
      }),
    );
  });
});
