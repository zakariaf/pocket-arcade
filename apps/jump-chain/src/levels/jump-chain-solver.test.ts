// apps/jump-chain/src/levels/jump-chain-solver.test.ts
// Spec 8.1: "Where the game allows it, each level is checked by a solver before it ships, so no
// level is impossible". Jump Chain proves its levels with a witness: the greedy bot's winning line.
import fc from 'fast-check';

import { verifyLine } from '@e07/game-kit/solver/verify-line.ts';
import { applyMove } from '@e07/jump-chain/rules/apply-move.ts';
import { create } from '@e07/jump-chain/rules/create.ts';
import { listMoves } from '@e07/jump-chain/rules/list-moves.ts';
import { outcome } from '@e07/jump-chain/rules/outcome.ts';

import { JUMP_CHAIN_SOLVER, WITNESS_MAX_NODES } from './jump-chain-solver.ts';

const ENGINE = { listMoves, applyMove, outcome };

describe('JUMP_CHAIN_SOLVER', () => {
  it('wins seed 1 at difficulty 0 with a line the engine replays, ending in a won state', () => {
    const start = create(1, 0);
    const result = JUMP_CHAIN_SOLVER.solve(start, WITNESS_MAX_NODES);
    if (result.kind !== 'solved') throw new Error(`expected solved, got ${result.kind}`);
    expect(result.par).toBe(GOLDEN_WITNESS_PAR);
    expect(outcome(result.final)).toStrictEqual({ kind: 'won', score: result.final.score });
    expect(verifyLine(ENGINE, start, result.line)).toStrictEqual({
      kind: 'wins',
      moves: GOLDEN_WITNESS_PAR,
    });
  });

  it('stops at the node budget', () => {
    expect(JUMP_CHAIN_SOLVER.solve(create(1, 0), 3)).toStrictEqual({ kind: 'budget-exceeded' });
  });

  it('reports a lost witness as over budget, never as unsolvable', () => {
    const lost = { ...create(1, 0), enemies: [{ id: 0, rank: 0, col: 3, row: 9 }] };
    expect(JUMP_CHAIN_SOLVER.solve(lost, WITNESS_MAX_NODES)).toStrictEqual({
      kind: 'budget-exceeded',
    });
  });

  it('gives lines that win when replayed through the real engine, deterministically', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        const start = create(seed, difficulty);
        const result = JUMP_CHAIN_SOLVER.solve(start, WITNESS_MAX_NODES);
        expect(JUMP_CHAIN_SOLVER.solve(start, WITNESS_MAX_NODES)).toStrictEqual(result);
        const verdict = result.kind === 'solved' ? verifyLine(ENGINE, start, result.line) : result;
        expect(verdict).toStrictEqual(
          result.kind === 'solved'
            ? { kind: 'wins', moves: result.par }
            : { kind: 'budget-exceeded' },
        );
      }),
      { seed: 17, numRuns: 25 },
    );
  });
});

/** Pinned: the witness's winning line for seed 1 at difficulty 0 (a new bot seed changes it). */
const GOLDEN_WITNESS_PAR = 9;
