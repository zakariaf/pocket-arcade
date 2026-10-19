// apps/trail-clear/src/rules/deal-tile.ts
// The next tile from the seeded RNG in the state. With the row's helpfulShare chance it is a tile
// that closes the most loops somewhere on the board (a double before a single); otherwise, or when
// no tile closes anything, it is drawn by the row's weights.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';

import { ALL_CELLS } from './board-cells.ts';
import { TILE_KINDS, distinctTurns, edgesOf } from './tiles.ts';
import { closedLoopsAt, fits } from './trails.ts';

import type { DifficultyKnobs } from './trail-clear-tuning.ts';
import type { PlacedTile, TileKind } from './trail-clear-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

type Cells = readonly (PlacedTile | null)[];
type Dealt = { readonly tile: TileKind; readonly rng: RngState };

/** The most loops one placement of `kind` closes on this board (0, 1 or 2). */
export function bestClosure(cells: Cells, kind: TileKind): number {
  let best = 0;
  for (const turns of distinctTurns(kind)) {
    const edges = edgesOf(kind, turns);
    for (const cell of ALL_CELLS.filter((index) => fits(cells, index, edges))) {
      const tile: PlacedTile = { kind, turns, placedAt: 0 };
      const placed = cells.map((old, index) => (index === cell ? tile : old));
      best = Math.max(best, closedLoopsAt(placed, cell).length);
    }
  }
  return best;
}

/** The dealable kinds that close the most loops, or none when no kind closes anything. */
export function helpfulKinds(cells: Cells, knobs: DifficultyKnobs): TileKind[] {
  const dealable = TILE_KINDS.filter((kind) => knobs.weights[kind] > 0);
  const closures = dealable.map((kind) => bestClosure(cells, kind));
  const most = Math.max(0, ...closures);
  return most === 0 ? [] : dealable.filter((_, index) => closures[index] === most);
}

/** A kind drawn by the row's weights. */
export function weightedKind(knobs: DifficultyKnobs, rng: RngState): Dealt {
  let total = 0;
  const uppers = TILE_KINDS.map((kind) => {
    total += knobs.weights[kind];
    return total;
  });
  const draw = nextInt(rng, total);
  const index = uppers.findIndex((upper) => draw.value < upper);
  return { tile: pickAt(TILE_KINDS, index), rng: draw.state };
}

/** The next tile for this board, and the RNG after the draws. */
export function dealTile(cells: Cells, knobs: DifficultyKnobs, rng: RngState): Dealt {
  const roll = nextInt(rng, 100);
  const helpful = roll.value < knobs.helpfulShare ? helpfulKinds(cells, knobs) : [];
  if (helpful.length === 0) return weightedKind(knobs, roll.state);
  const pick = nextInt(roll.state, helpful.length);
  return { tile: pickAt(helpful, pick.value), rng: pick.state };
}
