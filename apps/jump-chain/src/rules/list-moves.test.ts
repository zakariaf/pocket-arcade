// apps/jump-chain/src/rules/list-moves.test.ts
// Spec 10, RULES: "The list of moves allowed in a state." Jump Chain is turn-based, played with a
// drag along the jump path: a capture must be taken (every jump chain and each shorter version of
// it), single steps only when no jump exists, and nothing once the run is over.
import fc from 'fast-check';

import { create } from './create.ts';
import { jumpChains, steps } from './jump-chains.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { JumpChainState, Square } from './jump-chain-types.ts';

/** A level-0 state with your piece and the enemies on the given squares. */
function position(
  piece: Square,
  enemySquares: readonly (readonly [number, number])[],
): JumpChainState {
  const enemies = enemySquares.map(([col, row], id) => ({ id, rank: 0, col, row }));
  return { ...create(1, 0), piece, enemies, total: enemies.length, nextId: enemies.length };
}

describe('listMoves', () => {
  it('lists only the jump chains while a capture is possible (a capture must be taken)', () => {
    const state = position({ col: 2, row: 6 }, [
      [3, 5],
      [5, 3],
    ]);
    expect(listMoves(state)).toStrictEqual([
      { kind: 'jump', path: [{ col: 4, row: 4 }] },
      {
        kind: 'jump',
        path: [
          { col: 4, row: 4 },
          { col: 6, row: 2 },
        ],
      },
    ]);
  });

  it('lists the four diagonal steps when no jump exists', () => {
    const state = position({ col: 3, row: 7 }, [[3, 3]]);
    expect(listMoves(state)).toStrictEqual(GOLDEN_START_STEPS);
  });

  it('lists nothing once the run is lost or won', () => {
    const lost = position({ col: 3, row: 7 }, [[1, 9]]);
    const won = position({ col: 3, row: 7 }, []);
    expect(listMoves(lost)).toStrictEqual([]);
    expect(listMoves(won)).toStrictEqual([]);
  });

  describe('properties', () => {
    it('lists moves exactly while the run is playing, jumps before any step', () => {
      fc.assert(
        fc.property(fc.nat(), fc.integer({ min: 0, max: 100 }), (seed, difficulty) => {
          const state = create(seed, difficulty);
          const moves = listMoves(state);
          expect(moves.length > 0).toBe(outcome(state).kind === 'playing');
          const jumps = jumpChains(state);
          expect(moves).toStrictEqual(jumps.length > 0 ? jumps : steps(state));
        }),
      );
    });

    it('gives the same list for the same state', () => {
      fc.assert(
        fc.property(fc.nat(), (seed) => {
          expect(listMoves(create(seed, 40))).toStrictEqual(listMoves(create(seed, 40)));
        }),
      );
    });
  });
});

const GOLDEN_START_STEPS = [
  { kind: 'step', to: { col: 2, row: 6 } },
  { kind: 'step', to: { col: 4, row: 6 } },
  { kind: 'step', to: { col: 2, row: 8 } },
  { kind: 'step', to: { col: 4, row: 8 } },
];
