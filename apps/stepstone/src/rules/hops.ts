// apps/stepstone/src/rules/hops.ts
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import type { Cell, MoveKind, StepstoneState } from './stepstone-types.ts';

type Offset = readonly [number, number];

/** One square any way. */
const KING_STEPS: readonly Offset[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];
/** The chess knight's leap: two squares one way, one square across. */
const KNIGHT_STEPS: readonly Offset[] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];
const ROOK_LINES: readonly Offset[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const BISHOP_LINES: readonly Offset[] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export const MOVE_KINDS: readonly MoveKind[] = ['king', 'rook', 'bishop', 'knight'];

export function isMoveKind(cell: Cell): cell is MoveKind {
  return cell === 'king' || cell === 'rook' || cell === 'bishop' || cell === 'knight';
}

/** A stone the frog can land on: any stone, the flag included; never water or a sunk stone. */
export function isLive(cell: Cell): boolean {
  return cell !== 'water' && cell !== 'sunk';
}

function isInside(side: number, row: number, col: number): boolean {
  return row >= 0 && row < side && col >= 0 && col < side;
}

/** Cells one offset away (king, knight). */
function jumps(side: number, cell: number, offsets: readonly Offset[]): number[] {
  const row = Math.floor(cell / side);
  const col = cell % side;
  return offsets
    .filter(([dr, dc]) => isInside(side, row + dr, col + dc))
    .map(([dr, dc]) => (row + dr) * side + col + dc);
}

/** Every cell along each line (rook, bishop): any distance, over water and stones alike. */
function lines(side: number, cell: number, directions: readonly Offset[]): number[] {
  const row = Math.floor(cell / side);
  const col = cell % side;
  const out: number[] = [];
  for (const [dr, dc] of directions) {
    for (let step = 1; isInside(side, row + dr * step, col + dc * step); step += 1) {
      out.push((row + dr * step) * side + col + dc * step);
    }
  }
  return out;
}

/** Every pond cell a hop of this kind reaches from `cell`, in index order (water included). */
export function reachOf(side: number, cell: number, kind: MoveKind): number[] {
  const cells = {
    king: () => jumps(side, cell, KING_STEPS),
    knight: () => jumps(side, cell, KNIGHT_STEPS),
    rook: () => lines(side, cell, ROOK_LINES),
    bishop: () => lines(side, cell, BISHOP_LINES),
  }[kind]();
  return cells.sort((a, b) => a - b);
}

type Pond = Pick<StepstoneState, 'side' | 'cells' | 'frog'>;

/** The hop of the stone the frog stands on, or null on the flag. */
export function hopKindOf(pond: Pond): MoveKind | null {
  const here = pickAt(pond.cells, pond.frog);
  return isMoveKind(here) ? here : null;
}

/** The live stones the frog's hop reaches, in index order; none once it stands on the flag. */
export function targetsOf(pond: Pond): number[] {
  const kind = hopKindOf(pond);
  if (kind === null) return [];
  return reachOf(pond.side, pond.frog, kind).filter((cell) => isLive(pickAt(pond.cells, cell)));
}
