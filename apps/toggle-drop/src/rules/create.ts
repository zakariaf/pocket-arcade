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

/** The cups a winning line picks (null: the line offers too few) and the advanced RNG. */
type CupPick = { readonly cups: readonly number[] | null; readonly rng: RngState };

/**
 * The cups among a winning line's landings: the first drop's landing (an early payoff), then one
 * landing that no first drop reaches (the twist: only a switch an earlier ball flipped sends a ball
 * there), then the rest drawn among the line's other landings.
 */
export function pickCups(
  rng: RngState,
  line: { readonly landings: readonly number[]; readonly reachable: ReadonlySet<number> },
  count: number,
): CupPick {
  const opening = line.landings.slice(0, 1);
  if (count <= 1) return { cups: opening, rng };
  const others = [...new Set(line.landings.slice(1))]
    .filter((col) => !opening.includes(col))
    .sort((a, b) => a - b);
  const flipOnly = others.filter((col) => !line.reachable.has(col));
  if (flipOnly.length === 0 || others.length < count - 1) return { cups: null, rng };
  const twist = pickDistinct(rng, flipOnly, 1);
  const rest = others.filter((col) => !twist.values.includes(col));
  const picked = pickDistinct(twist.rng, rest, count - 2);
  return { cups: [...opening, ...twist.values, ...picked.values], rng: picked.rng };
}

/**
 * One seeded layout: pegs, a winning line of `witnessDrops` drops, and cups where that line lands
 * (pickCups). Each cup needs exactly the balls of the line that land in it, so the line wins the
 * board. null when the line lands in too few columns, or never where a first drop cannot reach.
 */
export function drawLayout(rng: RngState, knobs: DifficultyKnobs): LayoutDraw {
  const drawn = drawPegs(rng, knobs);
  const board = { ...knobs, pegs: drawn.pegs };
  const witness = drawWitness(drawn.rng, board, knobs.witnessDrops);
  const reachable = new Set(
    Array.from({ length: knobs.cols }, (_, col) => dropPath(board, col).landing),
  );
  const pick = pickCups(witness.rng, { landings: witness.values, reachable }, knobs.cups);
  if (pick.cups === null) return { layout: null, rng: pick.rng };
  const cups = new Set(pick.cups);
  const needs = Array.from({ length: knobs.cols }, (_, col) =>
    cups.has(col) ? witness.values.filter((landing) => landing === col).length : 0,
  );
  return { layout: { pegs: drawn.pegs, needs }, rng: pick.rng };
}

/**
 * The seeded layout of a board: up to `layoutAttempts` draws until one places every cup; after
 * that a draw keeps only the opening cup, which always succeeds (never reached by the tuned rows,
 * whose lines place their cups long before).
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
 * in them), so every board can be won; one cup is out of reach of every first drop, so winning
 * always takes a switch an earlier ball flipped; the player gets the line's balls plus spare ones.
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
