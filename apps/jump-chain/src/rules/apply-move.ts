// apps/jump-chain/src/rules/apply-move.ts
// Pure: your move, then the ranks' advance when it is due, with the events that explain both. A
// jump chain captures every enemy it jumps, in order; its n-th jump is worth n x jumpPoints, and
// the last enemy of a rank adds rankPoints. A move that empties a level wins at once (no march).
// An illegal move throws instead of returning a corrupted state.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { isSameSquare } from './board-squares.ts';
import { chainPoints, TUNING } from './jump-chain-tuning.ts';
import { listMoves } from './list-moves.ts';
import { advanceRanks } from './march.ts';
import { isLevelCleared } from './outcome.ts';

import type {
  Enemy,
  JumpChainEvent,
  JumpChainMove,
  JumpChainResult,
  JumpChainState,
  Square,
} from './jump-chain-types.ts';

/** The squares a move names: the step's target, or the chain's landing squares in order. */
function squaresOf(move: JumpChainMove): readonly Square[] {
  return move.kind === 'step' ? [move.to] : move.path;
}

/** Two moves are the same when they are of one kind and name the same squares in the same order. */
export function isSameMove(a: JumpChainMove, b: JumpChainMove): boolean {
  const squares = squaresOf(b);
  return (
    a.kind === b.kind &&
    squaresOf(a).length === squares.length &&
    squaresOf(a).every((square, index) => isSameSquare(square, pickAt(squares, index)))
  );
}

function stepTo(state: JumpChainState, to: Square): JumpChainResult {
  return {
    state: { ...state, piece: { col: to.col, row: to.row } },
    events: [{ kind: 'piece-stepped', from: state.piece, to }],
  };
}

/** The enemy on the square between two landing squares of a chain (listed, so it is there). */
function jumpedEnemy(enemies: readonly Enemy[], from: Square, to: Square): Enemy {
  const col = (from.col + to.col) / 2;
  const row = (from.row + to.row) / 2;
  return pickAt(
    enemies.filter((enemy) => enemy.col === col && enemy.row === row),
    0,
  );
}

function jumpAlong(state: JumpChainState, path: readonly Square[]): JumpChainResult {
  const events: JumpChainEvent[] = [];
  let enemies = state.enemies;
  let from = state.piece;
  const taken: Enemy[] = [];
  path.forEach((to, index) => {
    const over = jumpedEnemy(enemies, from, to);
    enemies = enemies.filter((enemy) => enemy.id !== over.id);
    taken.push(over);
    events.push({ kind: 'piece-jumped', from, to, enemyId: over.id, jump: index + 1 });
    from = to;
  });
  const points = chainPoints(taken.length);
  events.push({
    kind: 'enemies-captured',
    enemyIds: taken.map((enemy) => enemy.id),
    chain: taken.length,
    points,
  });
  const ranks = [...new Set(taken.map((enemy) => enemy.rank))];
  const cleared = ranks.filter((rank) => !enemies.some((enemy) => enemy.rank === rank));
  for (const rank of cleared)
    events.push({ kind: 'rank-cleared', rank, points: TUNING.rankPoints });
  return {
    state: {
      ...state,
      piece: { col: from.col, row: from.row },
      enemies,
      captured: state.captured + taken.length,
      ranksCleared: state.ranksCleared + cleared.length,
      score: state.score + points + cleared.length * TUNING.rankPoints,
    },
    events,
  };
}

export function applyMove(state: JumpChainState, move: JumpChainMove): JumpChainResult {
  if (!listMoves(state).some((listed) => isSameMove(listed, move))) {
    throw new RangeError(`illegal move ${JSON.stringify(move)}`);
  }
  const played = move.kind === 'step' ? stepTo(state, move.to) : jumpAlong(state, move.path);
  const moved = { ...played.state, moves: state.moves + 1, marchIn: state.marchIn - 1 };
  if (isLevelCleared(moved)) return { state: moved, events: played.events };
  const advanced = advanceRanks(moved);
  return { state: advanced.state, events: [...played.events, ...advanced.events] };
}
