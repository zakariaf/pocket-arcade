// apps/trail-clear/src/rules/deal-tile.test.ts
import fc from 'fast-check';

import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { ALL_CELLS } from './board-cells.ts';
import { bestClosure, dealTile, helpfulKinds, weightedKind } from './deal-tile.ts';
import { TILE_KINDS } from './tiles.ts';
import { TUNING, knobsFor } from './trail-clear-tuning.ts';

import type { DifficultyKnobs } from './trail-clear-tuning.ts';
import type { PlacedTile, TileKind } from './trail-clear-types.ts';

type Layout = Readonly<Record<number, readonly [TileKind, number]>>;

function boardOf(layout: Layout): (PlacedTile | null)[] {
  return ALL_CELLS.map((cell) => {
    const entry = layout[cell];
    return entry === undefined ? null : { kind: entry[0], turns: entry[1], placedAt: 1 };
  });
}

const EMPTY = boardOf({});
/** A road end and a river end facing the middle cell from north and south: a ford there closes both. */
const DOUBLE_SPOT = boardOf({ 7: ['road-end', 2], 17: ['river-end', 0] });
const ALWAYS_HELPFUL: DifficultyKnobs = { ...knobsFor(0), helpfulShare: 100 };
const NEVER_HELPFUL: DifficultyKnobs = { ...knobsFor(0), helpfulShare: 0 };

describe('bestClosure', () => {
  it('counts the loops the best placement of a kind closes (the double spot takes only a road-and-river tile)', () => {
    expect(bestClosure(DOUBLE_SPOT, 'ford')).toBe(2);
    expect(bestClosure(boardOf({ 7: ['road-end', 2] }), 'road-end')).toBe(1);
    expect(bestClosure(DOUBLE_SPOT, 'road-end')).toBe(0);
    expect(bestClosure(DOUBLE_SPOT, 'bridge')).toBe(0);
    expect(bestClosure(EMPTY, 'ford')).toBe(0);
  });
});

describe('helpfulKinds', () => {
  it('names the dealable kinds that close the most loops: a double before a single', () => {
    expect(helpfulKinds(DOUBLE_SPOT, knobsFor(0))).toStrictEqual(['ford']);
  });

  it('names no kind when nothing on the board can close', () => {
    expect(helpfulKinds(EMPTY, knobsFor(0))).toStrictEqual([]);
  });
});

describe('weightedKind', () => {
  it('deals only kinds the row weighs, in about their shares', () => {
    const counts = new Map<TileKind, number>();
    let rng = seedRng(5);
    for (let draw = 0; draw < 2000; draw += 1) {
      const dealt = weightedKind(knobsFor(0), rng);
      rng = dealt.rng;
      counts.set(dealt.tile, (counts.get(dealt.tile) ?? 0) + 1);
    }
    const total = TILE_KINDS.reduce((sum, kind) => sum + knobsFor(0).weights[kind], 0);
    for (const kind of TILE_KINDS) {
      const share = (counts.get(kind) ?? 0) / 2000;
      expect(Math.abs(share - knobsFor(0).weights[kind] / total)).toBeLessThan(0.04);
    }
  });
});

describe('dealTile', () => {
  it('keeps the pinned first deals of seed 3 on an empty board, row 2', () => {
    let rng = seedRng(3);
    const dealt: TileKind[] = [];
    for (let draw = 0; draw < 8; draw += 1) {
      const next = dealTile(EMPTY, knobsFor(50), rng);
      rng = next.rng;
      dealt.push(next.tile);
    }
    expect(dealt.join(' ')).toBe(GOLDEN_SEED_3_DEALS);
  });

  it('deals the double-maker when the helpful roll comes up', () => {
    expect(dealTile(DOUBLE_SPOT, ALWAYS_HELPFUL, seedRng(1)).tile).toBe('ford');
  });

  it('deals by weight, after the roll, when the helpful roll does not come up or nothing helps', () => {
    const afterRoll = nextInt(seedRng(1), 100).state;
    expect(dealTile(DOUBLE_SPOT, NEVER_HELPFUL, seedRng(1))).toStrictEqual(
      weightedKind(NEVER_HELPFUL, afterRoll),
    );
    expect(dealTile(EMPTY, ALWAYS_HELPFUL, seedRng(1))).toStrictEqual(
      weightedKind(ALWAYS_HELPFUL, afterRoll),
    );
  });

  it('is the same deal for the same board and RNG (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 100 }),
        (seed, difficulty) => {
          const knobs = knobsFor(difficulty);
          expect(dealTile(DOUBLE_SPOT, knobs, seedRng(seed))).toStrictEqual(
            dealTile(DOUBLE_SPOT, knobs, seedRng(seed)),
          );
          expect(knobs.weights[dealTile(EMPTY, knobs, seedRng(seed)).tile]).toBeGreaterThan(0);
        },
      ),
    );
  });

  it('keeps every row able to deal (no row weighs nothing)', () => {
    for (const row of [...TUNING.levelRows, TUNING.endlessRow]) {
      expect(TILE_KINDS.some((kind) => row.weights[kind] > 0)).toBe(true);
    }
  });
});

const GOLDEN_SEED_3_DEALS =
  'road-bend road-bend twin-bend river-end river-bend bridge road-bend river-bend';
