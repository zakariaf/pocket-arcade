// apps/jump-chain/src/rules/jump-chains.ts
// The piece's moves. A jump goes over a diagonal neighbour onto the free dark square right behind
// it and captures that enemy; from the landing square the chain may go on in any diagonal, as a
// checkers king does, and it may stop after any jump. A step goes one square diagonally onto a free
// square. Listing order: up-left, up-right, down-left, down-right, each chain before its longer
// versions.
import { DIAGONALS, enemyAt, isOnBoard } from './board-squares.ts';

import type { Enemy, JumpChainMove, JumpChainState, Square } from './jump-chain-types.ts';

/** Where a chain stands: its last square, the enemies still on the board, its landing squares. */
type ChainSoFar = {
  readonly from: Square;
  readonly enemies: readonly Enemy[];
  readonly path: readonly Square[];
};

/** Every chain that continues one so far, in listing order. */
function chainsFrom(soFar: ChainSoFar, out: JumpChainMove[]): void {
  const { from, enemies, path } = soFar;
  for (const { dc, dr } of DIAGONALS) {
    const over = enemyAt(enemies, { col: from.col + dc, row: from.row + dr });
    const land = { col: from.col + 2 * dc, row: from.row + 2 * dr };
    if (over === undefined || !isOnBoard(land) || enemyAt(enemies, land) !== undefined) continue;
    const longer = [...path, land];
    out.push({ kind: 'jump', path: longer });
    chainsFrom(
      { from: land, enemies: enemies.filter((enemy) => enemy.id !== over.id), path: longer },
      out,
    );
  }
}

/** Every jump chain from the piece. */
export function jumpChains(state: JumpChainState): JumpChainMove[] {
  const out: JumpChainMove[] = [];
  chainsFrom({ from: state.piece, enemies: state.enemies, path: [] }, out);
  return out;
}

/** Every step onto a free diagonal neighbour on the board. */
export function steps(state: JumpChainState): JumpChainMove[] {
  return DIAGONALS.map(({ dc, dr }) => ({ col: state.piece.col + dc, row: state.piece.row + dr }))
    .filter((to) => isOnBoard(to) && enemyAt(state.enemies, to) === undefined)
    .map((to): JumpChainMove => ({ kind: 'step', to }));
}
