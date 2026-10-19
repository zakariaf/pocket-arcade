// apps/jump-chain/src/rules/march.ts
// The ranks advance: every marchEvery moves each enemy moves marchRows (two) squares straight down,
// the front first, so it stays on a dark square. An enemy whose square holds your piece, or an
// enemy that could not move, waits. When no enemy is left on the board while ranks still wait
// above it, the ranks advance again at once. In the endless run a new rank appears above the board
// whenever none waits there. An enemy on your side's row overruns you.
import { isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';

import { SIDE_ROW, enemyAt, hasEnemyOnBoard, isSameSquare } from './board-squares.ts';
import { TUNING, knobsFor } from './jump-chain-tuning.ts';
import { makeRank } from './ranks.ts';

import type {
  EnemyShift,
  JumpChainEvent,
  JumpChainResult,
  JumpChainState,
} from './jump-chain-types.ts';

/** The first row above the board on the ranks' rows: where the endless run's new ranks wait. */
export const WAITING_ROW = 1 - TUNING.rankGap;

/** One advance of every enemy that can move, front first; the shifts list who moved. */
export function marchRanks(state: JumpChainState): {
  readonly state: JumpChainState;
  readonly shifts: readonly EnemyShift[];
} {
  const frontFirst = [...state.enemies].sort((a, b) =>
    a.row === b.row ? a.col - b.col : b.row - a.row,
  );
  let enemies = state.enemies;
  const shifts: EnemyShift[] = [];
  for (const enemy of frontFirst) {
    const to = { col: enemy.col, row: enemy.row + TUNING.marchRows };
    if (isSameSquare(to, state.piece) || enemyAt(enemies, to) !== undefined) continue;
    enemies = enemies.map((other) => (other.id === enemy.id ? { ...other, row: to.row } : other));
    shifts.push({ enemyId: enemy.id, col: enemy.col, fromRow: enemy.row, toRow: to.row });
  }
  return { state: { ...state, enemies }, shifts };
}

/** The endless run's next rank, when no rank waits above the board. */
function spawnIfDue(state: JumpChainState, events: JumpChainEvent[]): JumpChainState {
  if (!isEndlessDifficulty(state.difficulty) || state.enemies.some((enemy) => enemy.row < 0)) {
    return state;
  }
  const knobs = knobsFor(state.difficulty);
  const made = makeRank({
    rng: state.rng,
    rank: state.nextRank,
    row: WAITING_ROW,
    fill: knobs.fill,
    firstId: state.nextId,
  });
  events.push({ kind: 'rank-spawned', rank: state.nextRank, enemies: made.enemies });
  return {
    ...state,
    enemies: [...state.enemies, ...made.enemies],
    total: state.total + made.enemies.length,
    nextRank: state.nextRank + 1,
    nextId: state.nextId + made.enemies.length,
    rng: made.rng,
  };
}

/** One advance with its event, the march clock restarted and the endless run's new rank. */
function march(
  state: JumpChainState,
  events: JumpChainEvent[],
): { state: JumpChainState; didMove: boolean } {
  const marched = marchRanks(state);
  if (marched.shifts.length > 0) events.push({ kind: 'ranks-advanced', shifts: marched.shifts });
  const restarted = { ...marched.state, marchIn: knobsFor(state.difficulty).marchEvery };
  return { state: spawnIfDue(restarted, events), didMove: marched.shifts.length > 0 };
}

/**
 * After a move: the advance when the march clock ran out, the advance at once onto an empty
 * board (until nothing can move), and the overrun.
 */
export function advanceRanks(state: JumpChainState): JumpChainResult {
  const events: JumpChainEvent[] = [];
  let next = state;
  if (next.marchIn <= 0) next = march(next, events).state;
  let didMove = true;
  while (didMove && next.enemies.length > 0 && !hasEnemyOnBoard(next.enemies)) {
    const marched = march(next, events);
    next = marched.state;
    didMove = marched.didMove;
  }
  const over = next.enemies.filter((enemy) => enemy.row >= SIDE_ROW);
  if (over.length > 0)
    events.push({ kind: 'side-reached', enemyIds: over.map((enemy) => enemy.id) });
  return { state: next, events };
}
