// test/sims/line-siege/balance.sim.test.ts — BOT SIMULATION. Slow: `npm run test:sim` only.
// Plays every (policy, difficulty) cell of balance-bands.json over seedsPerCell seeds, writes
// reports/sim/line-siege.json, and fails when a run hangs, a replay differs or a band is missed.
import { bandProblems } from '@e07/game-kit/testing/balance-bands.ts';
import { greedyPolicy, lookaheadPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { parseBands } from '@e07/game-kit/testing/parse-balance-bands.ts';
import { randomPolicy } from '@e07/game-kit/testing/play-bot.ts';
import { summarizeCell } from '@e07/game-kit/testing/sim-stats.ts';
import { traceBot } from '@e07/game-kit/testing/trace-bot.ts';
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';
import { create } from '@e07/line-siege/rules/create.ts';
import { listMoves } from '@e07/line-siege/rules/list-moves.ts';
import { outcome } from '@e07/line-siege/rules/outcome.ts';
import {
  evaluateLineSiege,
  scoreOfLineSiege,
  tagLineSiegeEvent,
} from '@e07/line-siege/testing/line-siege-bot.ts';
import { rulesFingerprint, writeSimReport } from '@e07/tooling/sims/write-sim-report.ts';

import bandsJson from './balance-bands.json' with { type: 'json' };

import type { SimReport } from '@e07/game-kit/testing/balance-bands.ts';
import type { BotGame, BotPolicy } from '@e07/game-kit/testing/play-bot.ts';
import type { SimCell } from '@e07/game-kit/testing/sim-stats.ts';
import type {
  LineSiegeEvent,
  LineSiegeMove,
  LineSiegeState,
} from '@e07/line-siege/rules/line-siege-types.ts';

type State = LineSiegeState;
type Move = LineSiegeMove;

const GAME_ID = 'line-siege';
const BANDS = parseBands(bandsJson);
const GAME: BotGame<State, Move, LineSiegeEvent> = { create, listMoves, applyMove, outcome };

/** The three standard players: the baseline, the reasonable player and the upper bound of skill. */
const POLICIES: Readonly<Record<string, () => BotPolicy<State, Move>>> = {
  random: () => randomPolicy(),
  greedy: () => greedyPolicy(GAME, evaluateLineSiege),
  lookahead: () => lookaheadPolicy(GAME, evaluateLineSiege, { depth: 2, beam: 4 }),
};

function playCell(policy: string, difficulty: number): SimCell {
  const makePolicy = POLICIES[policy];
  if (makePolicy === undefined)
    throw new Error(`balance-bands.json names unknown policy ${policy}`);
  const traces = Array.from({ length: BANDS.seedsPerCell }, (_, index) =>
    traceBot(GAME, {
      seed: index + 1,
      difficulty,
      policy: makePolicy(),
      maxMoves: BANDS.maxMoves,
      tagEvent: tagLineSiegeEvent,
      scoreOf: scoreOfLineSiege,
    }),
  );
  return summarizeCell(policy, difficulty, traces);
}

describe('line-siege balance', () => {
  // The grid runs level difficulties (0..99, the lower bound of each tuning row) and makes the
  // curve; the endless cell, if the game has one, is played once more and judged on its own bands.
  const endless = BANDS.endless ?? null;
  const cells = [
    ...Object.entries(BANDS.grid).flatMap(([policy, difficulties]) =>
      difficulties.map((difficulty) => playCell(policy, difficulty)),
    ),
    ...(endless === null ? [] : [playCell(endless.policy, endless.difficulty)]),
  ];
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

  it('ends every run before the move cap', () => {
    expect(cells.filter((cell) => cell.capHits > 0)).toStrictEqual([]);
  });

  it('replays identically for the same seeds', () => {
    const [first] = cells;
    if (first === undefined) throw new Error('the grid in balance-bands.json is empty');
    expect(playCell(first.policy, first.difficulty)).toStrictEqual(first);
  });

  it('stays inside every band of balance-bands.json', () => {
    expect(report.cells.length).toBeGreaterThan(0);
  });
});
