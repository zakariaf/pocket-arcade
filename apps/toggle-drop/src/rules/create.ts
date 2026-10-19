// apps/toggle-drop/src/rules/create.ts
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { dropPath, flipPath } from './drop-path.ts';
import { TUNING, knobsFor } from './toggle-drop-tuning.ts';

import type { DifficultyKnobs } from './toggle-drop-tuning.ts';
import type { PegCell, ToggleDropState } from './toggle-drop-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

// Every random draw of Toggle Drop happens here, while the board is made: nothing is drawn after
// create(), so the state keeps no RNG.

/** A drawn board: its pegs and, per column, how many balls its cup needs (0 = the gutter). */
export type Layout = { readonly pegs: readonly PegCell[]; readonly needs: readonly number[] };

/** One draw: the layout (null when the winning line found too few cups) and the advanced RNG. */
export type LayoutDraw = { readonly layout: Layout | null; readonly rng: RngState };

type Picked = { readonly values: readonly number[]; readonly rng: RngState };

/** `count` distinct values of `pool` in seeded order (a partial Fisher-Yates shuffle). */
export function pickDistinct(rng: RngState, pool: readonly number[], count: number): Picked {
  const rest = [...pool];
  const values: number[] = [];
  let state = rng;
  while (values.length < count && rest.length > 0) {
    const draw = nextInt(state, rest.length);
    state = draw.state;
    values.push(...rest.splice(draw.value, 1));
  }
  return { values, rng: state };
}

/** Every peg row gets `switchesPerRow` switches in seeded columns, each pointing a seeded way. */
export function drawPegs(
  rng: RngState,
  knobs: DifficultyKnobs,
): { pegs: PegCell[]; rng: RngState } {
  const columns = Array.from({ length: knobs.cols }, (_, col) => col);
  const pegs: PegCell[] = Array.from({ length: knobs.rows * knobs.cols }, (): PegCell => -1);
  let state = rng;
  for (let row = 0; row < knobs.rows; row += 1) {
    const picked = pickDistinct(state, columns, knobs.switchesPerRow);
    state = picked.rng;
    for (const col of picked.values) {
      const side = nextInt(state, 2);
      state = side.state;
      pegs[row * knobs.cols + col] = side.value === 0 ? 0 : 1;
    }
  }
  return { pegs, rng: state };
}

/** The landing columns of `drops` seeded drops played one after another from `pegs`. */
export function drawWitness(
  rng: RngState,
  board: { readonly cols: number; readonly rows: number; readonly pegs: readonly PegCell[] },
  drops: number,
): Picked {
  let pegs = board.pegs;
  let state = rng;
  const landings: number[] = [];
  for (let drop = 0; drop < drops; drop += 1) {
    const col = nextInt(state, board.cols);
    state = col.state;
    const path = dropPath({ ...board, pegs }, col.value);
    landings.push(path.landing);
    pegs = flipPath({ ...board, pegs }, path);
  }
  return { values: landings, rng: state };
}

/**
 * One seeded layout: pegs, a winning line of `witnessDrops` drops, and cups where that line lands.
 * The first drop's landing is always a cup (an early payoff); the other cups are drawn among the
 * line's other landings, and each cup needs exactly the balls of the line that land in it, so the
 * line wins the board. null when the line lands in fewer columns than the board has cups.
 */
export function drawLayout(rng: RngState, knobs: DifficultyKnobs): LayoutDraw {
  const drawn = drawPegs(rng, knobs);
  const witness = drawWitness(drawn.rng, { ...knobs, pegs: drawn.pegs }, knobs.witnessDrops);
  const opening = witness.values.slice(0, 1);
  const others = [...new Set(witness.values.slice(1))]
    .filter((col) => !opening.includes(col))
    .sort((a, b) => a - b);
  if (others.length < knobs.cups - 1) return { layout: null, rng: witness.rng };
  const picked = pickDistinct(witness.rng, others, knobs.cups - 1);
  const cups = new Set([...opening, ...picked.values]);
  const needs = Array.from({ length: knobs.cols }, (_, col) =>
    cups.has(col) ? witness.values.filter((landing) => landing === col).length : 0,
  );
  return { layout: { pegs: drawn.pegs, needs }, rng: picked.rng };
}

/**
 * The seeded layout of a board: up to `layoutAttempts` draws until one gives every cup a landing;
 * after that a draw keeps only the opening cup, which always succeeds (never reached by the tuned
 * rows, whose lines land in enough columns long before).
 */
export function layoutFor(seed: number, knobs: DifficultyKnobs): Layout {
  let rng = seedRng(seed);
  for (let attempt = 0; ; attempt += 1) {
    const cups = attempt < TUNING.layoutAttempts ? knobs.cups : 1;
    const drawn = drawLayout(rng, { ...knobs, cups });
    if (drawn.layout !== null) return drawn.layout;
    rng = drawn.rng;
  }
}

/**
 * Start state from (seed, difficulty): the same pair gives the same board on every phone. The
 * board is built around a hidden winning line (its cups need exactly the balls that line lands
 * in them), so every board can be won, and the player gets that line's balls plus spare ones.
 */
export function create(seed: number, difficulty: number): ToggleDropState {
  const knobs = knobsFor(difficulty);
  const layout = layoutFor(seed, knobs);
  return {
    cols: knobs.cols,
    rows: knobs.rows,
    pegs: layout.pegs,
    flips: layout.pegs.map(() => 0),
    needs: layout.needs,
    filled: layout.needs.map(() => 0),
    ballsLeft: knobs.witnessDrops + knobs.spareBalls,
    drops: 0,
  };
}
