// apps/merge-siege/src/rules/slide-tiles.ts
// The player's half of a turn (spec 13: "Swipe to slide and merge every tile ... a tile that meets
// a smaller enemy smashes it"). Every tile slides the swiped way, nearest the far wall first, as in
// 2048; two equal tiles merge once per swipe. The design fix (design notes): a tile smashes an
// enemy with the same number or a smaller one and ploughs on through it; a tile that runs into a
// bigger enemy is lost and the enemy stays.
import { STEP, neighbourOf, slideOrder } from './board-cells.ts';
import { TUNING } from './merge-siege-tuning.ts';

import type { Cell, Loss, Merge, Piece, Smash, Step } from './merge-siege-types.ts';
import type { SwipeDirection } from '@e07/game-kit/geom/classify-swipe.ts';

export type SlideResult = {
  readonly cells: readonly Cell[];
  readonly steps: readonly Step[];
  readonly merges: readonly Merge[];
  readonly smashes: readonly Smash[];
  readonly losses: readonly Loss[];
  /** Points scored: smashPoints per smashed number, and each merge's new number. */
  readonly points: number;
};

/** True when a tile with this number smashes an enemy with that one (ties go to the tile). */
export const beats = (tile: number, enemy: number): boolean => tile >= enemy;

/** The board during a swipe, and the ids that already merged in it. */
type Board = { readonly cells: readonly Cell[]; readonly merged: ReadonlySet<number> };

/** Where one tile's walk ends and what it met on the way. */
type Walk = {
  readonly tileId: number;
  readonly start: number;
  readonly end: number;
  readonly smashes: readonly Smash[];
  readonly loss: Loss | null;
  readonly merge: Merge | null;
};

/** True when the tile may merge into this neighbour: equal numbers, neither merged this swipe. */
function canMerge(board: Board, tile: Piece, other: Piece): boolean {
  return other.value === tile.value && !board.merged.has(other.id) && !board.merged.has(tile.id);
}

/** One tile's walk, read from the board as it stands (pure): through empty cells and beaten enemies. */
function walkOf(
  board: Board,
  tile: Piece,
  route: { readonly start: number; readonly direction: SwipeDirection },
): Walk {
  const smashes: Smash[] = [];
  let at = route.start;
  for (
    let target = neighbourOf(at, STEP[route.direction]);
    target !== null;
    target = neighbourOf(target, STEP[route.direction])
  ) {
    const other = board.cells[target] ?? null;
    if (other?.kind === 'tile') {
      const merge = canMerge(board, tile, other)
        ? { id: tile.id, intoId: other.id, cell: target, value: other.value * 2 }
        : null;
      return {
        tileId: tile.id,
        start: route.start,
        end: merge === null ? at : target,
        smashes,
        loss: null,
        merge,
      };
    }
    if (other !== null && !beats(tile.value, other.value)) {
      const loss = { id: tile.id, enemyId: other.id, cell: at, value: tile.value };
      return { tileId: tile.id, start: route.start, end: at, smashes, loss, merge: null };
    }
    if (other !== null)
      smashes.push({ id: other.id, tileId: tile.id, cell: target, value: other.value });
    at = target;
  }
  return { tileId: tile.id, start: route.start, end: at, smashes, loss: null, merge: null };
}

/** The board after a walk: the tile left its start, smashed enemies are gone, the tile stands at its end. */
function applyWalk(cells: readonly Cell[], tile: Piece, walk: Walk): Cell[] {
  const next = [...cells];
  next[walk.start] = null;
  for (const smash of walk.smashes) next[smash.cell] = null;
  if (walk.loss !== null) return next;
  next[walk.end] =
    walk.merge === null ? tile : { id: walk.merge.intoId, kind: 'tile', value: walk.merge.value };
  return next;
}

/** The points of one walk: smashPoints per smashed number, plus a merge's new number. */
const pointsOf = (walk: Walk): number =>
  walk.smashes.reduce((sum, smash) => sum + smash.value * TUNING.smashPoints, 0) +
  (walk.merge?.value ?? 0);

/** Slides every tile one way. Pure: the input cells are never changed. */
export function slideTiles(input: readonly Cell[], direction: SwipeDirection): SlideResult {
  let cells: readonly Cell[] = input;
  const merged = new Set<number>();
  const walks: Walk[] = [];
  for (const start of slideOrder(direction)) {
    const tile = cells[start] ?? null;
    if (tile?.kind !== 'tile') continue;
    const walk = walkOf({ cells, merged }, tile, { start, direction });
    if (walk.merge !== null) merged.add(walk.merge.intoId);
    cells = applyWalk(cells, tile, walk);
    walks.push(walk);
  }
  return {
    cells,
    steps: walks.flatMap((walk) =>
      walk.end === walk.start ? [] : [{ id: walk.tileId, from: walk.start, to: walk.end }],
    ),
    merges: walks.flatMap((walk) => (walk.merge === null ? [] : [walk.merge])),
    smashes: walks.flatMap((walk) => walk.smashes),
    losses: walks.flatMap((walk) => (walk.loss === null ? [] : [walk.loss])),
    points: walks.reduce((sum, walk) => sum + pointsOf(walk), 0),
  };
}

/** True when the swipe changes anything: a tile moves, merges, smashes or is lost. */
export function hasSlideEffect(result: SlideResult): boolean {
  return result.steps.length > 0 || result.losses.length > 0;
}
