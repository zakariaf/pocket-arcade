import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';

describe('applyMove', () => {
  it('replays identically for the same seed and move choices', () => {
    fc.assert(
      fc.property(fc.nat(), fc.array(fc.nat()), (seed, choices) => {
        const rules = { listMoves, applyMove };
        expect(playChoices(rules, create(seed, 0), choices)).toStrictEqual(playChoices(rules, create(seed, 0), choices));
      }),
    );
  });
});
