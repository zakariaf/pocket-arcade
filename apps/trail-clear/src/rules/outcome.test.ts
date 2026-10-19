// apps/trail-clear/src/rules/outcome.test.ts
// Spec 10 RULES: "Is it over?": win, lose (with a reason), or still playing. Trail Clear: a level is
// won when the last tile of its bag is placed; the run is lost when the offered tile fits nowhere.
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { ALL_CELLS } from './board-cells.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { NO_ROOM_KEY, outcome } from './outcome.ts';

import type { PlacedTile, TrailClearState } from './trail-clear-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });

/** Every cell but the middle one holds a river end pointing north. */
function boardWithOneHole(): (PlacedTile | null)[] {
  return ALL_CELLS.map((cell) =>
    cell === 12 ? null : { kind: 'river-end', turns: 0, placedAt: 1 },
  );
}

/** The outcome kind of every state of a run. */
function outcomesOf(states: readonly TrailClearState[]): string[] {
  return states.map((state) => outcome(state).kind);
}

describe('outcome', () => {
  it('says playing while the offered tile fits somewhere', () => {
    expect(outcome(create(1, 0))).toStrictEqual({ kind: 'playing' });
  });

  it('says won, with the score, once the bag is empty', () => {
    const state: TrailClearState = { ...create(1, 0), offered: null, score: 480 };
    expect(outcome(state)).toStrictEqual({ kind: 'won', score: 480 });
  });

  it('says lost with the no-room reason when the offered tile fits nowhere', () => {
    // The hole needs grass on three sides and a river to the south; a bridge has no grass edge.
    const state: TrailClearState = {
      ...create(1, 0),
      cells: boardWithOneHole(),
      offered: 'bridge',
    };
    expect(outcome(state)).toStrictEqual({ kind: 'lost', reasonKey: NO_ROOM_KEY });
    expect(NO_ROOM_KEY).toBe('trail-clear.lose.no-room');
  });

  describe('properties', () => {
    it('lists no move exactly when the run is over', () => {
      fc.assert(
        fc.property(
          seedArb,
          fc.integer({ min: 0, max: 100 }),
          fc.array(fc.nat(), { maxLength: 60 }),
          (seed, difficulty, choices) => {
            const { states } = playChoices(RULES, create(seed, difficulty), choices);
            for (const state of states)
              expect(listMoves(state).length === 0).toBe(outcome(state).kind !== 'playing');
          },
        ),
        { numRuns: 60 },
      );
    });

    it('wins no endless run', () => {
      fc.assert(
        fc.property(seedArb, fc.array(fc.nat(), { maxLength: 80 }), (seed, choices) => {
          const { states } = playChoices(RULES, create(seed, ENDLESS_DIFFICULTY), choices);
          expect(outcomesOf(states)).not.toContain('won');
        }),
        { numRuns: 40 },
      );
    });
  });
});
