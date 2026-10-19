// apps/swap-guard/src/rules/create.test.ts
// Classification (new-game step 2): Swap Guard is turn-based: the swap applies, then its events
// animate. It is played with a tap on the square to swap with (engine.panMode 'none').
import fc from 'fast-check';

import { create, joinersOf, openingsOf, startFor } from './create.ts';
import { outcome } from './outcome.ts';
import { strikesOf, struckSquares } from './strikes.ts';
import { knobsFor } from './swap-guard-tuning.ts';

import type { DifficultyKnobs } from './swap-guard-tuning.ts';
import type { Enemy, SwapGuardState } from './swap-guard-types.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });

/** Fixed knobs for the pinned board, so a later tuning change never moves this golden. */
const GOLDEN_KNOBS: DifficultyKnobs = {
  size: 5,
  enemies: 4,
  kinds: ['spear', 'archer'],
  maxSwaps: 12,
};

const LETTERS = { spear: 's', archer: 'a', brute: 'b' } as const;
const ARROWS = { up: '^', right: '>', down: 'v', left: '<' } as const;

function squareText(state: SwapGuardState, cell: number): string {
  if (cell === state.guard) return 'G.';
  const enemy = state.enemies.find((e) => e.cell === cell);
  if (enemy === undefined) return '..';
  return `${LETTERS[enemy.kind]}${enemy.kind === 'brute' ? '+' : ARROWS[enemy.facing]}`;
}

/** Readable board text for pinned goldens: G the guard, s/a/b an enemy and its facing. */
function boardText(state: SwapGuardState): string {
  const rows: string[] = [];
  for (let row = 0; row < state.size; row += 1) {
    const cells = Array.from({ length: state.size }, (_, col) =>
      squareText(state, row * state.size + col),
    );
    rows.push(cells.join(' '));
  }
  return rows.join('\n');
}

/** Every square a piece stands on: the guard first, then the enemies. */
function squaresOf(state: SwapGuardState): number[] {
  return [state.guard, ...state.enemies.map((e) => e.cell)];
}

/** The ids of the enemies standing on a struck square. */
function struckIdsOf(state: SwapGuardState): number[] {
  const struck = struckSquares(strikesOf(state));
  return state.enemies.filter((e) => struck.has(e.cell)).map((e) => e.id);
}

describe('create (turn-based: the swap applies, then its events animate)', () => {
  it('keeps the pinned board for seed 1 (a changed board breaks saved levels)', () => {
    expect(boardText(startFor(1, GOLDEN_KNOBS))).toBe(GOLDEN_SEED_1_BOARD);
  });

  it('starts every run on its row of the tuning table, with no swap made', () => {
    const state = create(7, 60);
    expect(state.size).toBe(knobsFor(60).size);
    expect(state.enemies).toHaveLength(knobsFor(60).enemies);
    expect(state.enemyCount).toBe(knobsFor(60).enemies);
    expect(state).toMatchObject({ swaps: 0, maxSwaps: knobsFor(60).maxSwaps, score: 0 });
    expect(state).toMatchObject({ isHit: false, lastSwap: null, hasContinued: false });
  });

  it('clamps difficulties outside 0..100', () => {
    expect(create(5, -3)).toStrictEqual(create(5, 0));
    expect(create(5, 250)).toStrictEqual(create(5, 100));
  });

  describe('openingsOf', () => {
    it('puts the guard in a spear strike, with a second enemy diagonal to it striking the spear', () => {
      expect(openingsOf(5, 'spear')[0]).toStrictEqual({
        guard: 0,
        threat: { id: 0, kind: 'spear', facing: 'left', cell: 1 },
        partner: { id: 1, kind: 'spear', facing: 'up', cell: 6 },
      });
    });

    it('turns a brute partner to face up, as every brute does', () => {
      const openings = openingsOf(5, 'brute');
      expect(openings.length).toBeGreaterThan(0);
      expect(openings.every((opening) => opening.partner.facing === 'up')).toBe(true);
    });
  });

  describe('joinersOf', () => {
    it('offers no joiner on a board without a free square', () => {
      const crowd: Enemy[] = Array.from({ length: 24 }, (_, index) => ({
        id: index,
        kind: 'spear',
        facing: 'up',
        cell: index + 1,
      }));
      expect(joinersOf({ size: 5, guard: 0, enemies: crowd }, ['spear'])).toStrictEqual([]);
    });
  });

  describe('properties', () => {
    it('gives the same state for the same seed and difficulty', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expect(create(seed, difficulty)).toStrictEqual(create(seed, difficulty));
        }),
      );
    });

    it('gives different layouts for different seeds', () => {
      const layouts = new Set(Array.from({ length: 60 }, (_, seed) => boardText(create(seed, 30))));
      expect(layouts.size).toBeGreaterThan(55);
    });

    it('starts every game unfinished, every piece on its own square, kinds from its row', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const state = create(seed, difficulty);
          expect(outcome(state).kind).toBe('playing');
          expect(new Set(squaresOf(state)).size).toBe(state.enemies.length + 1);
          for (const e of state.enemies) expect(knobsFor(difficulty).kinds).toContain(e.kind);
        }),
      );
    });

    it('opens with the guard in a strike and only the threatening spear struck', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const state = create(seed, difficulty);
          expect(struckSquares(strikesOf(state)).has(state.guard)).toBe(true);
          expect(struckIdsOf(state)).toStrictEqual([0]);
        }),
      );
    });
  });
});

const GOLDEN_SEED_1_BOARD = [
  '.. a^ .. .. ..',
  '.. .. .. sv a<',
  '.. .. .. G. s<',
  '.. .. .. .. ..',
  '.. .. .. .. ..',
].join('\n');
