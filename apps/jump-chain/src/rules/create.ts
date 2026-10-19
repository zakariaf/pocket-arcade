// apps/jump-chain/src/rules/create.ts
// The start of a level, the daily or the endless run from (seed, difficulty): the same pair gives
// the same board on every phone. Your piece starts in the middle column, two rows below the front rank; the
// enemy ranks stand two rows apart from the front rank's row upward, and the ranks that do not fit
// wait above the board. The endless run makes ranks up to the first row above the board, so one
// rank always waits there.
import { clampDifficulty, isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { TUNING, knobsFor } from './jump-chain-tuning.ts';
import { makeRank } from './ranks.ts';

import type { Enemy, JumpChainState } from './jump-chain-types.ts';

/** The rows of the opening ranks, front first. */
export function openingRankRows(difficulty: number): number[] {
  const knobs = knobsFor(difficulty);
  const count = isEndlessDifficulty(difficulty)
    ? (knobs.frontRow + 1) / TUNING.rankGap + 1
    : knobs.ranks;
  return Array.from({ length: count }, (_, rank) => knobs.frontRow - rank * TUNING.rankGap);
}

export function create(seed: number, difficulty: number): JumpChainState {
  const clamped = clampDifficulty(difficulty);
  const knobs = knobsFor(clamped);
  const rows = openingRankRows(clamped);
  let rng = seedRng(seed);
  const enemies: Enemy[] = [];
  rows.forEach((row, rank) => {
    const made = makeRank({ rng, rank, row, fill: knobs.fill, firstId: enemies.length });
    rng = made.rng;
    enemies.push(...made.enemies);
  });
  return {
    difficulty: clamped,
    piece: { col: TUNING.pieceStart.col, row: TUNING.pieceStart.row },
    enemies,
    total: enemies.length,
    captured: 0,
    nextRank: rows.length,
    ranksCleared: 0,
    moves: 0,
    marchIn: knobs.marchEvery,
    score: 0,
    hasContinued: false,
    nextId: enemies.length,
    rng,
  };
}
