// apps/jump-chain/src/rules/jump-chain-stats.test.ts
import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { JUMP_CHAIN_STATS } from './jump-chain-stats.ts';
import { listMoves } from './list-moves.ts';

import type { JumpChainEvent } from './jump-chain-types.ts';

/** A three-jump chain that clears a rank, then the ranks advance. */
const CHAIN_MOVE: readonly JumpChainEvent[] = [
  { kind: 'piece-jumped', from: { col: 2, row: 6 }, to: { col: 0, row: 4 }, enemyId: 0, jump: 1 },
  { kind: 'piece-jumped', from: { col: 0, row: 4 }, to: { col: 2, row: 2 }, enemyId: 1, jump: 2 },
  { kind: 'piece-jumped', from: { col: 2, row: 2 }, to: { col: 4, row: 0 }, enemyId: 2, jump: 3 },
  { kind: 'enemies-captured', enemyIds: [0, 1, 2], chain: 3, points: 60 },
  { kind: 'rank-cleared', rank: 0, points: 50 },
  { kind: 'ranks-advanced', shifts: [{ enemyId: 3, col: 5, fromRow: 1, toRow: 3 }] },
];
const STEP_MOVE: readonly JumpChainEvent[] = [
  { kind: 'piece-stepped', from: { col: 3, row: 7 }, to: { col: 2, row: 6 } },
];

type Totals = Readonly<Record<string, number>>;

/** Folds counters over a move line the way the Shell does: sums add up, maxima keep the best. */
function fold(moves: readonly (readonly JumpChainEvent[])[]): Totals {
  const totals: Record<string, number> = {};
  for (const counter of JUMP_CHAIN_STATS.counters) {
    const values = moves.map((events) => counter.measure(events));
    totals[counter.id] =
      counter.aggregate === 'sum'
        ? values.reduce((sum, value) => sum + value, 0)
        : Math.max(0, ...values);
  }
  return totals;
}

/** A seeded run played by its choices: the event line of each move and the final state. */
function run(seed: number, choices: readonly number[]) {
  const lines: (readonly JumpChainEvent[])[] = [];
  let state = create(seed, 0);
  for (const choice of choices) {
    const moves = listMoves(state);
    const move = moves[choice % Math.max(moves.length, 1)];
    if (move === undefined) break;
    const result = applyMove(state, move);
    lines.push(result.events);
    state = result.state;
  }
  return { lines, state };
}

describe('JUMP_CHAIN_STATS', () => {
  it('measures one move: pieces captured, the chain and the ranks cleared', () => {
    const measured = JUMP_CHAIN_STATS.counters.map((counter) => [
      counter.id,
      counter.measure(CHAIN_MOVE),
    ]);
    expect(measured).toStrictEqual([
      ['pieces-captured', 3],
      ['longest-chain', 3],
      ['ranks-cleared', 1],
    ]);
  });

  it('counts each capture once per run and keeps the longest chain', () => {
    expect(fold([STEP_MOVE, CHAIN_MOVE, CHAIN_MOVE.slice(0, 1), STEP_MOVE])).toStrictEqual({
      'pieces-captured': 4,
      'longest-chain': 3,
      'ranks-cleared': 1,
    });
  });

  it('counts what the run did, the same again when the kept move line is replayed', () => {
    const choices = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9];
    const { lines, state } = run(7, choices);
    expect(fold(lines)).toMatchObject({
      'pieces-captured': state.captured,
      'ranks-cleared': state.ranksCleared,
    });
    expect(state.captured).toBeGreaterThan(0);
    expect(fold(run(7, choices).lines)).toStrictEqual(fold(lines));
  });

  it('declares 2 to 4 counters with unique kebab-case ids and their labels', () => {
    const ids = JUMP_CHAIN_STATS.counters.map((counter) => counter.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids.length).toBeLessThanOrEqual(4);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toBe(true);
    expect(JUMP_CHAIN_STATS.counters.map((counter) => counter.labelId)).toStrictEqual(
      ids.map((id) => `jump-chain.stats.${id}`),
    );
  });
});
