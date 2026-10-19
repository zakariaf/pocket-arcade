// apps/trail-clear/src/rules/apply-move.ts
// Spec 13 (trail-clear) core loop, one placement: place the offered tile, close every loop it
// completes (road first, then river), score them (a double counts both twice), wipe their tiles,
// then deal the next tile, or none once a level's bag is empty.
// Pure: the same state and move always give the same result; the input is never changed.
import { isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';

import { cellAt } from './board-cells.ts';
import { dealTile } from './deal-tile.ts';
import { outcome } from './outcome.ts';
import { distinctTurns, edgesOf } from './tiles.ts';
import { TUNING, knobsFor, loopPoints } from './trail-clear-tuning.ts';
import { closedLoopsAt, fits } from './trails.ts';

import type {
  PlacedTile,
  TileKind,
  TrailClearEvent,
  TrailClearMove,
  TrailClearResult,
  TrailClearState,
} from './trail-clear-types.ts';
import type { ClosedLoop } from './trails.ts';

type Placement = { readonly cell: number; readonly tile: TileKind };

/** An illegal move is a bug in the caller (the Shell passes only listed moves): fail loudly. */
function refuse(move: TrailClearMove): never {
  throw new RangeError(`illegal move ${JSON.stringify(move)}`);
}

/** The cell the move names and the tile it places, after checking the placement is legal. */
function legalPlacement(state: TrailClearState, move: TrailClearMove): Placement {
  const tile = outcome(state).kind === 'playing' ? state.offered : null;
  if (tile === null) refuse(move);
  const cell = cellAt(move.col, move.row);
  if (cell < 0 || !distinctTurns(tile).includes(move.turns)) refuse(move);
  if (!fits(state.cells, cell, edgesOf(tile, move.turns))) refuse(move);
  return { cell, tile };
}

/** The points of the loops one placement closed: each loop's, times the double's multiplier. */
export function pointsFor(loops: readonly ClosedLoop[]): number {
  const base = loops.reduce((sum, loop) => sum + loopPoints(loop.cells.length), 0);
  return loops.length === 2 ? base * TUNING.doubleMultiplier : base;
}

/** Every cell of the closed loops, once each, ascending (a two-terrain tile can sit in both). */
export function wipedCells(loops: readonly ClosedLoop[]): number[] {
  const all = loops.flatMap((loop) => loop.cells);
  return all.filter((cell, index) => all.indexOf(cell) === index).sort((a, b) => a - b);
}

function scoreEvents(loops: readonly ClosedLoop[], total: number): TrailClearEvent[] {
  const events: TrailClearEvent[] = loops.map((loop) => ({
    kind: 'loop-closed',
    terrain: loop.terrain,
    cells: loop.cells,
    points: loopPoints(loop.cells.length),
  }));
  const points = pointsFor(loops);
  if (loops.length === 2) {
    const single = loops.reduce((sum, loop) => sum + loopPoints(loop.cells.length), 0);
    events.push({ kind: 'double-closed', bonus: points - single });
  }
  const wiped = wipedCells(loops);
  if (wiped.length > 0) events.push({ kind: 'tiles-wiped', cells: wiped });
  if (points > 0) events.push({ kind: 'score-added', points, total });
  return events;
}

export function applyMove(state: TrailClearState, move: TrailClearMove): TrailClearResult {
  const { cell, tile } = legalPlacement(state, move);
  const placements = state.placements + 1;
  const placed: PlacedTile = { kind: tile, turns: move.turns, placedAt: placements };
  const filled = state.cells.map((old, index) => (index === cell ? placed : old));
  const loops = closedLoopsAt(filled, cell);
  const wiped = wipedCells(loops);
  const cells = filled.map((old, index) => (wiped.includes(index) ? null : old));
  const score = state.score + pointsFor(loops);
  const knobs = knobsFor(state.difficulty);
  const isBagEmpty = !isEndlessDifficulty(state.difficulty) && placements >= knobs.bag;
  const dealt = isBagEmpty ? null : dealTile(cells, knobs, state.rng);
  const events: TrailClearEvent[] = [
    { kind: 'tile-placed', tile, turns: move.turns, cell },
    ...scoreEvents(loops, score),
    ...(dealt === null ? [] : [{ kind: 'tile-dealt' as const, tile: dealt.tile }]),
  ];
  const next: TrailClearState = {
    ...state,
    cells,
    offered: dealt === null ? null : dealt.tile,
    placements,
    score,
    loopsClosed: state.loopsClosed + loops.length,
    rng: dealt === null ? state.rng : dealt.rng,
  };
  return { state: next, events };
}
