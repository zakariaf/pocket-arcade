// test/sims/halo-drift/balance.sim.test.ts — BOT SIMULATION of a real-time game. Slow: `npm run test:sim` only.
// Plays every (policy, difficulty) cell of balance-bands.json over seedsPerCell seeds through the
// same fixed-step sim the UI thread runs (runSimBot), writes reports/sim/halo-drift.json, and fails
// when a run hangs, a replay differs or a band is missed. "Moves" are ticks (120 = 1 s), and the
// first-payoff curve counts seconds (payoffStepTicks 120).
import { bandProblems } from '@e07/game-kit/testing/balance-bands.ts';
import { parseBands } from '@e07/game-kit/testing/parse-balance-bands.ts';
import { runSimBot } from '@e07/game-kit/testing/run-sim-bot.ts';
import { summarizeCell } from '@e07/game-kit/testing/sim-stats.ts';
import {
  dodgePolicy,
  HALO_DRIFT_SIM,
  idlePolicy,
  wanderPolicy,
} from '@e07/halo-drift/testing/halo-drift-bot.ts';
import { rulesFingerprint, writeSimReport } from '@e07/tooling/sims/write-sim-report.ts';

import bandsJson from './balance-bands.json' with { type: 'json' };

import type { SimReport } from '@e07/game-kit/testing/balance-bands.ts';
import type { CommandPolicy } from '@e07/game-kit/testing/run-sim-bot.ts';
import type { SimCell } from '@e07/game-kit/testing/sim-stats.ts';
import type { HaloDriftSim } from '@e07/halo-drift/sim/halo-drift-sim.ts';

const GAME_ID = 'halo-drift';
const BANDS = parseBands(bandsJson);
/** A person changes the stick about every 100 ms. */
const DECIDE_EVERY_TICKS = 12;
/** 120 ticks per step: firstPayoffShare[k - 1] is the share of runs with a payoff within k seconds. */
const PAYOFF_STEP_TICKS = 120;

/** The three real-time players: never moves, random directions, and the reasonable dodger. */
const POLICIES: Readonly<Record<string, CommandPolicy<HaloDriftSim>>> = {
  idle: idlePolicy,
  wander: wanderPolicy,
  dodge: dodgePolicy,
};

function playCell(policy: string, difficulty: number): SimCell {
  const chosen = POLICIES[policy];
  if (chosen === undefined) throw new Error(`balance-bands.json names unknown policy ${policy}`);
  const traces = Array.from({ length: BANDS.seedsPerCell }, (_, index) =>
    runSimBot(HALO_DRIFT_SIM, {
      seed: index + 1,
      difficulty,
      policy: chosen,
      maxTicks: BANDS.maxMoves,
      decideEveryTicks: DECIDE_EVERY_TICKS,
      payoffStepTicks: PAYOFF_STEP_TICKS,
    }),
  );
  return summarizeCell(policy, difficulty, traces);
}

describe('halo-drift balance', () => {
  const cells = Object.entries(BANDS.grid).flatMap(([policy, difficulties]) =>
    difficulties.map((difficulty) => playCell(policy, difficulty)),
  );
  const report: SimReport = {
    gameId: GAME_ID,
    rulesFingerprint: rulesFingerprint(GAME_ID),
    seedsPerCell: BANDS.seedsPerCell,
    maxMoves: BANDS.maxMoves,
    cells,
  };

  beforeAll(() => {
    // Written before the assertions, so a failing run still leaves numbers to read.
    writeSimReport(report);
  });

  it('ends every run before the tick cap', () => {
    expect(cells.filter((cell) => cell.capHits > 0)).toStrictEqual([]);
  });

  it('replays identically for the same seeds', () => {
    const [first] = cells;
    if (first === undefined) throw new Error('the grid in balance-bands.json is empty');
    expect(playCell(first.policy, first.difficulty)).toStrictEqual(first);
  });

  it('stays inside every band of balance-bands.json', () => {
    expect(bandProblems(report, BANDS)).toStrictEqual([]);
  });
});
