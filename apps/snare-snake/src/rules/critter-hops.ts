// apps/snare-snake/src/rules/critter-hops.ts
// The critters' turn (design notes, rule 6): after the snake moves, on a hop turn, each critter
// that is not next to the snake draws one of four directions from the run's seeded RNG and hops
// there when that cell is on the board, empty and not next to the snake; otherwise it stays. A
// critter next to the snake freezes (the design fix: critters no longer slip out of a loop).
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';

import { DIRECTIONS, stepFrom, touchingCells } from './board-grid.ts';

import type { Critter, CritterHop, SnareSnakeState } from './snare-snake-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

export type HopResult = {
  readonly critters: readonly Critter[];
  readonly hops: readonly CritterHop[];
  readonly rng: RngState;
};

/** Every critter's hop, in id order, from the state after the snake moved. */
export function hopCritters(state: SnareSnakeState): HopResult {
  const body = new Set(state.snake);
  const near = touchingCells(state, state.snake);
  const occupied = new Set(state.critters.map((critter) => critter.cell));
  const hops: CritterHop[] = [];
  let rng = state.rng;
  const critters = state.critters.map((critter) => {
    if (near.has(critter.cell)) return critter;
    const draw = nextInt(rng, DIRECTIONS.length);
    rng = draw.state;
    const to = stepFrom(state, critter.cell, pickAt(DIRECTIONS, draw.value));
    if (to === null || body.has(to) || near.has(to) || occupied.has(to)) return critter;
    occupied.delete(critter.cell);
    occupied.add(to);
    hops.push({ critterId: critter.id, from: critter.cell, to });
    return { ...critter, cell: to };
  });
  return { critters, hops, rng };
}
