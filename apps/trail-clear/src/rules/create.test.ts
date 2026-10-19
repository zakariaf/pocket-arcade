// apps/trail-clear/src/rules/create.test.ts
// Classification (game-rules-engine): Trail Clear is turn-based: apply the move, then animate its
// events. Spec 10 RULES: "Start state for a level (from its seed and difficulty)"; spec 8.1: "The
// same seed always makes the same level."
import fc from 'fast-check';

import { create } from './create.ts';
import { TUNING } from './trail-clear-tuning.ts';

import type { PlacedTile, TileKind } from './trail-clear-types.ts';

const SIZE = TUNING.boardSize;
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });

const SHORT: Readonly<Record<TileKind, string>> = {
  'road-end': 'Re',
  'road-straight': 'Rs',
  'road-bend': 'Rb',
  'river-end': 'We',
  'river-straight': 'Ws',
  'river-bend': 'Wb',
  ford: 'Fd',
  bridge: 'Br',
  'twin-bend': 'Tb',
  'road-fork': 'Rf',
};

/** Readable board text for pinned goldens: a tile as kind code + turns, '...' empty. */
function boardText(cells: readonly (PlacedTile | null)[]): string {
  const rows: string[] = [];
  for (let start = 0; start < cells.length; start += SIZE) {
    const row = cells.slice(start, start + SIZE);
    rows.push(
      row
        .map((tile) => (tile === null ? '...' : `${SHORT[tile.kind]}${String(tile.turns)}`))
        .join(' '),
    );
  }
  return rows.join('\n');
}

describe('create (turn-based: apply the move, then animate its events)', () => {
  it('keeps the pinned board for seed 1 at difficulty 0 (a changed board breaks saved levels)', () => {
    const state = create(1, 0);
    expect(boardText(state.cells)).toBe(GOLDEN_SEED_1_BOARD);
    expect(state.rng).toStrictEqual(GOLDEN_SEED_1_RNG);
  });

  it('starts a 5 x 5 board with the ford offered and nothing placed or scored (spec 13)', () => {
    const state = create(1, 0);
    expect(state.cells).toHaveLength(SIZE * SIZE);
    expect(state).toMatchObject({
      offered: 'ford',
      placements: 0,
      score: 0,
      loopsClosed: 0,
      hasContinued: false,
    });
  });

  it('stores the difficulty whole and inside 0..100 (the save schema range)', () => {
    expect([-4, 37.9, 180].map((difficulty) => create(1, difficulty).difficulty)).toStrictEqual([
      0, 37, 100,
    ]);
  });

  it('gives different seeds different starts', () => {
    const boards = Array.from({ length: 20 }, (_, seed) => JSON.stringify(create(seed, 0)));
    expect(new Set(boards).size).toBe(20);
  });

  describe('properties', () => {
    it('gives the same state for the same seed and difficulty', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expect(create(seed, difficulty)).toStrictEqual(create(seed, difficulty));
        }),
      );
    });

    it('keeps the state plain JSON (it is saved after every move)', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const state = create(seed, difficulty);
          expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
        }),
      );
    });
  });
});

const GOLDEN_SEED_1_BOARD = [
  '... ... ... ... ...',
  '... ... ... ... ...',
  '... ... We1 ... Re3',
  '... ... ... ... ...',
  '... ... ... ... ...',
].join('\n');
const GOLDEN_SEED_1_RNG = [4033348495, 1188072770, 3231555014, 2041432053];
