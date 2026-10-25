// apps/stepstone/src/rules/list-moves.test.ts
// Spec 13 (stepstone): "the tile the player stands on sets the next move (knight, rook,
// bishop...)". Turn-based with a tap on a reachable square: listMoves is exactly the hops the
// frog's stone allows.
import fc from 'fast-check';

import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { pondFromText } from './pond-text.ts';

import type { StepstoneState } from './stepstone-types.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });

/** A hand-built state from pond text (see pond-text.ts), par 1, nothing used yet. */
function pond(text: string): StepstoneState {
  return { ...pondFromText(text), moves: 0, par: 1, kindsUsed: [] };
}

const targets = (state: StepstoneState): number[] => listMoves(state).map((move) => move.to);
/** A check that a cell holds a live stone of this pond (not water, not sunk). */
const isLiveIn =
  (state: StepstoneState) =>
  (cell: number): boolean =>
    state.cells[cell] !== 'water' && state.cells[cell] !== 'sunk';

describe('listMoves (a turn-based game: tap a stone your hop reaches)', () => {
  it('lists every stone a rook stone reaches along its row and column, over water', () => {
    const state = pond(['KKKKK', 'KK.KK', 'B.r.F', 'KKKKK', 'KK.KK'].join('\n'));
    expect(targets(state)).toStrictEqual([2, 10, 14, 17]);
  });

  it('lists the eight neighbours of a king stone, clipped at the edge', () => {
    expect(targets(pond(['kRF', 'RRR', 'RRR'].join('\n')))).toStrictEqual([1, 3, 4]);
    expect(targets(pond(['RRR', 'RkR', 'RFR'].join('\n')))).toStrictEqual([0, 1, 2, 3, 5, 6, 7, 8]);
  });

  it('lists every stone on both diagonals of a bishop stone', () => {
    const state = pond(['KKKKK', 'KKKKK', 'KKbKK', 'KKKKK', 'FKKKK'].join('\n'));
    expect(targets(state)).toStrictEqual([0, 4, 6, 8, 16, 18, 20, 24]);
  });

  it("lists the knight's leaps from a knight stone", () => {
    const state = pond(['KKKKK', 'KKKKK', 'KKnKK', 'KKKKK', 'KKKKF'].join('\n'));
    expect(targets(state)).toStrictEqual([1, 3, 5, 9, 15, 19, 21, 23]);
  });

  it('skips water and sunk stones', () => {
    const state = pond(['.~R', '~r.', 'RF~'].join('\n'));
    expect(targets(state)).toStrictEqual([7]);
  });

  it('lists the hops as hop moves in cell order', () => {
    expect(listMoves(pond(['rF', 'K.'].join('\n')))).toStrictEqual([
      { kind: 'hop', to: 1 },
      { kind: 'hop', to: 2 },
    ]);
  });

  describe('when the run is over', () => {
    it('lists none once the frog stands on the flag', () => {
      expect(listMoves(pond(['Rf', 'RR'].join('\n')))).toStrictEqual([]);
    });

    it('lists none when no stone is in reach', () => {
      expect(listMoves(pond(['k..', '...', '..F'].join('\n')))).toStrictEqual([]);
    });
  });

  describe('properties', () => {
    it('lists no hop twice, only live stones and at least one hop at every start', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const state = create(seed, difficulty);
          const to = targets(state);
          expect(new Set(to).size).toBe(to.length);
          expect(to.length).toBeGreaterThan(0);
          expect(to.every(isLiveIn(state))).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });

  it('keeps the pinned first hops of seed 1 at difficulty 0', () => {
    expect(targets(create(1, 0))).toStrictEqual(GOLDEN_SEED_1_TARGETS);
  });
});

const GOLDEN_SEED_1_TARGETS: readonly number[] = [12, 17];
