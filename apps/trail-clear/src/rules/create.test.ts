// apps/trail-clear/src/rules/create.test.ts
// Classification (game-rules-engine): Trail Clear is turn-based: apply the move, then animate its
// events. Spec 10 RULES: "Start state for a level (from its seed and difficulty)"; spec 8.1: "The
// same seed always makes the same level."
import fc from 'fast-check';

import pack1 from '@e07/trail-clear/levels/pack-1.json';
import pack2 from '@e07/trail-clear/levels/pack-2.json';
import pack3 from '@e07/trail-clear/levels/pack-3.json';

import { FALLBACK_SEED, create, createWithin, drawStart } from './create.ts';
import { TUNING } from './trail-clear-tuning.ts';
import { TRAIL_CLEAR_WITNESS, WITNESS_MAX_NODES } from './trail-clear-witness.ts';

import type { PlacedTile, TileKind, TrailClearState } from './trail-clear-types.ts';

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

/** True when the witness wins the board within its budget (spec 8.1: no level is impossible). */
const isProven = (state: TrailClearState): boolean =>
  TRAIL_CLEAR_WITNESS.solve(state, WITNESS_MAX_NODES).kind === 'solved';

/** The daily seed of 2026-10-03 (Trail Clear's salt): its first board is one the witness loses. */
const LOST_FIRST_SEED = 3_123_137_942;
/** A create budget whose one try the witness can never win (one node), so create falls back. */
const UNPROVABLE = { attempts: 1, maxNodes: 1 };

describe('create proves every level board it hands out (spec 8.1: no level is impossible)', () => {
  it("keeps the seed's first board when the witness wins it", () => {
    expect(isProven(drawStart(1, 0))).toBe(true);
    expect(create(1, 0)).toStrictEqual(drawStart(1, 0));
  });

  it("draws on from the seed's stream when the witness loses the first board", () => {
    expect(isProven(drawStart(LOST_FIRST_SEED, 45))).toBe(false);
    const state = create(LOST_FIRST_SEED, 45);
    expect(state).not.toStrictEqual(drawStart(LOST_FIRST_SEED, 45));
    expect(isProven(state)).toBe(true);
    expect(state).toMatchObject({ difficulty: 45, offered: 'ford', placements: 0, score: 0 });
  });

  it("hands out the fallback seed's proven board when no try is proven within the budget", () => {
    const fallback = create(FALLBACK_SEED, 45);
    expect(
      createWithin(LOST_FIRST_SEED, 45, { attempts: 1, maxNodes: WITNESS_MAX_NODES }),
    ).toStrictEqual(fallback);
    expect(isProven(fallback)).toBe(true);
  });

  it('finds a proven fallback board for every level difficulty 0..99', () => {
    const unproven = Array.from({ length: 100 }, (_, difficulty) => difficulty).filter(
      (difficulty) => !isProven(create(FALLBACK_SEED, difficulty)),
    );
    expect(unproven).toStrictEqual([]);
  });

  it('spends no witness run on the fallback board: it is the known first proven try of its row', () => {
    const solve = jest.spyOn(TRAIL_CLEAR_WITNESS, 'solve');
    // A budget of one node proves nothing, so the one try is lost and the fallback is handed out.
    createWithin(LOST_FIRST_SEED, 75, UNPROVABLE);
    expect(solve).toHaveBeenCalledTimes(1);
    solve.mockRestore();
  });

  it.each([0, 24, 25, 49, 50, 74, 75, 99])(
    "hands out the fallback seed's own first proven board at difficulty %i",
    (difficulty) => {
      const budget = { attempts: TUNING.createAttempts, maxNodes: WITNESS_MAX_NODES };
      expect(createWithin(LOST_FIRST_SEED, difficulty, UNPROVABLE)).toStrictEqual(
        createWithin(FALLBACK_SEED, difficulty, budget),
      );
    },
  );

  it('asks the witness once for a seed and difficulty that start, resume and the run end all create', () => {
    const first = create(LOST_FIRST_SEED, 30);
    const solve = jest.spyOn(TRAIL_CLEAR_WITNESS, 'solve');
    expect(create(LOST_FIRST_SEED, 30)).toStrictEqual(first);
    expect(create(LOST_FIRST_SEED, 30.4)).toStrictEqual(first);
    expect(solve).not.toHaveBeenCalled();
    solve.mockRestore();
  });

  it("keeps the endless run's first board: it is never won, so never proven", () => {
    expect(create(LOST_FIRST_SEED, 100)).toStrictEqual(drawStart(LOST_FIRST_SEED, 100));
  });

  it("tries at most the tuning's createAttempts boards of a seed (a bounded wait)", () => {
    expect(TUNING.createAttempts).toBe(GOLDEN_CREATE_ATTEMPTS);
  });
});

describe('create for a shipped level', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips the witness for every pack level: its first board was proven when the pack was made', () => {
    const solve = jest.spyOn(TRAIL_CLEAR_WITNESS, 'solve');
    const levels = [...pack1, ...pack2, ...pack3];
    const boards = levels.map((entry) => create(entry.seed, entry.difficulty));
    expect(solve).not.toHaveBeenCalled();
    expect(boards).toStrictEqual(levels.map((entry) => drawStart(entry.seed, entry.difficulty)));
  });

  it('proves a pack seed at another difficulty (only the shipped pair was proven)', () => {
    const solve = jest.spyOn(TRAIL_CLEAR_WITNESS, 'solve');
    const [first] = pack1;
    create(first?.seed ?? 0, (first?.difficulty ?? 0) + 1);
    expect(solve).toHaveBeenCalled();
  });
});

const GOLDEN_CREATE_ATTEMPTS = 12;
const GOLDEN_SEED_1_BOARD = [
  '... ... ... ... ...',
  '... ... ... ... ...',
  '... ... We1 ... Re3',
  '... ... ... ... ...',
  '... ... ... ... ...',
].join('\n');
const GOLDEN_SEED_1_RNG = [4033348495, 1188072770, 3231555014, 2041432053];
