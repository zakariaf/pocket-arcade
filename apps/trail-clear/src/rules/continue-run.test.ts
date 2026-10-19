// apps/trail-clear/src/rules/continue-run.test.ts
// Spec 8.10: "Games may allow one continue per level or run". Trail Clear's: the oldest row of
// tiles is cleared (and the next oldest while the offered tile still fits nowhere).
import fc from 'fast-check';

import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { applyMove } from './apply-move.ts';
import { ALL_CELLS } from './board-cells.ts';
import { continueAfterLoss, rowsByAge } from './continue-run.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type {
  PlacedTile,
  TileKind,
  TrailClearEvent,
  TrailClearState,
} from './trail-clear-types.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });

/** Seeded random play until the run ends (cap 400 placements); null when it never lost. */
function playToLoss(seed: number, difficulty: number): TrailClearState | null {
  let state = create(seed, difficulty);
  let rng = seedRng(seed);
  for (let placed = 0; placed < 400 && outcome(state).kind === 'playing'; placed += 1) {
    const moves = listMoves(state);
    const pick = nextInt(rng, moves.length);
    rng = pick.state;
    state = applyMove(
      state,
      moves[pick.value] ?? { kind: 'place-tile', turns: 0, col: 0, row: 0 },
    ).state;
  }
  return outcome(state).kind === 'lost' ? state : null;
}

/** A lost board: river ends pointing north everywhere but the middle; ages by row (row 3 oldest). */
function lostState(offered: TileKind): TrailClearState {
  const ages = [5, 4, 3, 1, 2];
  const cells = ALL_CELLS.map((cell): PlacedTile | null =>
    cell === 12 ? null : { kind: 'river-end', turns: 0, placedAt: ages[Math.floor(cell / 5)] ?? 0 },
  );
  return { ...create(1, 0), cells, offered, placements: 24 };
}

function kindsOf(events: readonly TrailClearEvent[]): string[] {
  return events.map((event) => event.kind);
}

describe('rowsByAge', () => {
  it('orders the rows that hold tiles by their oldest tile, upper row first on a tie', () => {
    expect(rowsByAge(lostState('bridge').cells)).toStrictEqual([3, 4, 2, 1, 0]);
    const tie = ALL_CELLS.map((cell): PlacedTile | null =>
      cell % 6 === 0 ? { kind: 'road-end', turns: 2, placedAt: 1 } : null,
    );
    expect(rowsByAge(tie)).toStrictEqual([0, 1, 2, 3, 4]);
  });

  it('skips the rows without a tile', () => {
    expect(rowsByAge(ALL_CELLS.map(() => null))).toStrictEqual([]);
  });
});

describe('continueAfterLoss', () => {
  it('clears the oldest row and plays on (spec 8.10)', () => {
    const lost = lostState('bridge');
    expect(outcome(lost).kind).toBe('lost');
    const { state, events } = continueAfterLoss(lost);
    expect(events).toStrictEqual([
      { kind: 'rows-cleared', rows: [3], cells: [15, 16, 17, 18, 19] },
    ]);
    expect(state.cells.slice(15, 20)).toStrictEqual([null, null, null, null, null]);
    expect(state.hasContinued).toBe(true);
    expect(outcome(state).kind).toBe('playing');
  });

  it('keeps the score, the placements and the offered tile', () => {
    const lost = { ...lostState('bridge'), score: 340 };
    const { state } = continueAfterLoss(lost);
    expect([state.score, state.placements, state.offered]).toStrictEqual([340, 24, 'bridge']);
  });

  it('refuses a second continue in the same run', () => {
    const once = continueAfterLoss(lostState('bridge')).state;
    expect(() => continueAfterLoss({ ...once, cells: lostState('bridge').cells })).toThrow(
      RangeError,
    );
  });

  it('refuses a run that is not lost', () => {
    expect(() => continueAfterLoss(create(1, 0))).toThrow(RangeError);
    expect(() => continueAfterLoss({ ...create(1, 0), offered: null })).toThrow(RangeError);
  });

  describe('properties', () => {
    it('makes every lost run playable again, whatever the seed and the row', () => {
      fc.assert(
        fc.property(seedArb, fc.integer({ min: 0, max: 100 }), (seed, difficulty) => {
          const lost = playToLoss(seed, difficulty);
          fc.pre(lost !== null);
          const { state, events } = continueAfterLoss(lost);
          expect(outcome(state).kind).toBe('playing');
          expect(kindsOf(events)).toStrictEqual(['rows-cleared']);
        }),
        { numRuns: 60 },
      );
    });
  });
});
