// apps/toggle-drop/src/rules/create.test.ts
import fc from 'fast-check';

import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { create, drawLayout, drawPegs, drawWitness, layoutFor, pickDistinct } from './create.ts';
import { areCupsFull, cupColumns } from './cups.ts';
import { dropPath } from './drop-path.ts';
import { knobsFor } from './toggle-drop-tuning.ts';

import type { ToggleDropState } from './toggle-drop-types.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });
const PEG_TEXT = { '-1': '.', '0': '<', '1': '>' } as const;

/** Readable board for pinned goldens: one line per peg row ('<' and '>' switches), then the cups. */
function boardText(state: ToggleDropState): string {
  const lines: string[] = [];
  for (let row = 0; row < state.rows; row += 1) {
    const cells = state.pegs.slice(row * state.cols, (row + 1) * state.cols);
    lines.push(cells.map((peg) => PEG_TEXT[peg]).join(''));
  }
  lines.push(state.needs.map((need) => (need === 0 ? '_' : String(need))).join(''));
  return lines.join('\n');
}

// Classification (game-rules-engine): Toggle Drop is simulate-then-replay; its input is a tap on
// the column to drop from (panMode 'none'). create() makes the board a run starts from.
describe('create (simulate-then-replay: a tap drops a ball, its fall is simulated in the move)', () => {
  // Spec 8.1: "The same seed always makes the same level."
  it('keeps the pinned board for seed 1 at difficulty 0 (a changed board breaks saved levels)', () => {
    const state = create(1, 0);
    expect(boardText(state)).toBe(GOLDEN_SEED_1_BOARD);
    expect(state.ballsLeft).toBe(6);
  });

  it('sizes the board, its switches, its cups and its balls from the tuning row', () => {
    const knobs = knobsFor(80);
    const state = create(7, 80);
    expect([state.cols, state.rows]).toStrictEqual([knobs.cols, knobs.rows]);
    expect(state.pegs).toHaveLength(knobs.cols * knobs.rows);
    for (let row = 0; row < state.rows; row += 1) {
      const cells = state.pegs.slice(row * state.cols, (row + 1) * state.cols);
      expect(cells.filter((peg) => peg !== -1)).toHaveLength(knobs.switchesPerRow);
    }
    expect(cupColumns(state)).toHaveLength(knobs.cups);
    expect(state.ballsLeft).toBe(knobs.witnessDrops + knobs.spareBalls);
  });

  it('clamps difficulties outside 0..100', () => {
    expect(create(5, -3)).toStrictEqual(create(5, 0));
    expect(create(5, 250)).toStrictEqual(create(5, 100));
  });

  it('gives different seeds different boards', () => {
    const boards = new Set(Array.from({ length: 200 }, (_, seed) => boardText(create(seed, 50))));
    expect(boards.size).toBeGreaterThan(190);
  });

  it('keeps only the opening cup when no draw can give every cup a landing', () => {
    const layout = layoutFor(3, { ...knobsFor(0), cups: 6 });
    expect(layout.needs.filter((need) => need > 0)).toHaveLength(1);
  });

  it('gives the same state for the same seed and difficulty', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        expect(create(seed, difficulty)).toStrictEqual(create(seed, difficulty));
      }),
    );
  });

  it('starts every board unfinished, untouched and JSON-safe', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        const state = create(seed, difficulty);
        expect(areCupsFull(state)).toBe(false);
        expect(state.filled.every((count) => count === 0)).toBe(true);
        expect(state.flips.every((count) => count === 0)).toBe(true);
        expect(state.drops).toBe(0);
        expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
      }),
    );
  });

  it('needs no more balls in its cups than its winning line drops', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        const state = create(seed, difficulty);
        const needed = state.needs.reduce((sum, need) => sum + need, 0);
        expect(needed).toBeLessThanOrEqual(knobsFor(difficulty).witnessDrops);
        expect(needed).toBeLessThan(state.ballsLeft);
      }),
    );
  });

  it('puts a cup where some first drop lands (the early payoff)', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        const state = create(seed, difficulty);
        const landings = Array.from(
          { length: state.cols },
          (_, col) => dropPath(state, col).landing,
        );
        expect(landings.some((col) => (state.needs[col] ?? 0) > 0)).toBe(true);
      }),
    );
  });
});

describe('pickDistinct', () => {
  it('draws distinct values of the pool, the same for the same seed', () => {
    const picked = pickDistinct(seedRng(4), [3, 5, 7, 9], 3);
    expect(new Set(picked.values).size).toBe(3);
    expect(picked.values.every((value) => [3, 5, 7, 9].includes(value))).toBe(true);
    expect(pickDistinct(seedRng(4), [3, 5, 7, 9], 3)).toStrictEqual(picked);
  });

  it('stops when the pool runs out', () => {
    expect(pickDistinct(seedRng(4), [1, 2], 5).values).toHaveLength(2);
  });
});

describe('drawPegs', () => {
  it('puts the tuned number of switches into every peg row', () => {
    const knobs = knobsFor(60);
    const { pegs } = drawPegs(seedRng(9), knobs);
    for (let row = 0; row < knobs.rows; row += 1) {
      const cells = pegs.slice(row * knobs.cols, (row + 1) * knobs.cols);
      expect(cells.filter((peg) => peg !== -1)).toHaveLength(knobs.switchesPerRow);
    }
  });
});

describe('drawWitness', () => {
  it('lands one ball per drop, inside the board', () => {
    const knobs = knobsFor(30);
    const { pegs, rng } = drawPegs(seedRng(2), knobs);
    const witness = drawWitness(rng, { ...knobs, pegs }, 4);
    expect(witness.values).toHaveLength(4);
    expect(witness.values.every((col) => col >= 0 && col < knobs.cols)).toBe(true);
  });
});

describe('drawLayout', () => {
  it('refuses a layout whose winning line lands in fewer columns than it has cups', () => {
    expect(drawLayout(seedRng(1), { ...knobsFor(0), cups: 6 }).layout).toBeNull();
  });

  it('gives each kept layout its tuned cups, needing no more balls than the line drops', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        const knobs = knobsFor(difficulty);
        const { layout } = drawLayout(seedRng(seed), knobs);
        if (layout === null) return;
        expect(layout.needs.filter((need) => need > 0)).toHaveLength(knobs.cups);
        expect(layout.needs.reduce((sum, need) => sum + need, 0)).toBeLessThanOrEqual(
          knobs.witnessDrops,
        );
      }),
    );
  });
});

const GOLDEN_SEED_1_BOARD = ['.<<..', '..<<.', '..<>.', '11___'].join('\n');
