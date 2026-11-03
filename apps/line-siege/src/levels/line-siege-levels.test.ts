// apps/line-siege/src/levels/line-siege-levels.test.ts
import { ENDLESS_DIFFICULTY, MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { dailySeed } from '@e07/game-kit/dates/daily-seed.ts';
import { addDays } from '@e07/game-kit/dates/date-key.ts';
import { dailyStart } from '@e07/game-kit/levels/daily-start.ts';
import { levelsContractProblems } from '@e07/game-kit/levels/levels-contract.ts';
import { createWitnessSolver } from '@e07/game-kit/levels/witness-solver.ts';
import { verifyLine } from '@e07/game-kit/solver/verify-line.ts';
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';
import { create } from '@e07/line-siege/rules/create.ts';
import { evaluateLineSiege } from '@e07/line-siege/rules/line-siege-evaluate.ts';
import { listMoves } from '@e07/line-siege/rules/list-moves.ts';
import { outcome } from '@e07/line-siege/rules/outcome.ts';

import {
  LINE_SIEGE_DAILY_DIFFICULTY,
  LINE_SIEGE_DAILY_SALT,
  LINE_SIEGE_LEVELS,
} from './line-siege-levels.ts';
import { WITNESS_BOT_SEED, WITNESS_MAX_NODES } from './line-siege-solver.ts';

/** game.config.ts `levels` for this app; the packs must match it exactly. */
const CONFIG = { packCount: 3, levelsPerPack: 30 };

const RULES = { listMoves, applyMove, outcome };

/** The level witness's greedy bot from its own tie-break seed, then from seeds 1 to 19. */
const DAILY_WITNESSES = [WITNESS_BOT_SEED, ...Array.from({ length: 19 }, (_, at) => at + 1)].map(
  (botSeed) =>
    createWitnessSolver({ rules: RULES, policy: greedyPolicy(RULES, evaluateLineSiege), botSeed }),
);

/** A daily's board and whether a witness's winning line, replayed by the real engine, wins it. */
function isDailyWinnable(date: string): boolean {
  const start = create(dailySeed(date, LINE_SIEGE_DAILY_SALT), LINE_SIEGE_DAILY_DIFFICULTY);
  return DAILY_WITNESSES.some((witness) => {
    const result = witness.solve(start, WITNESS_MAX_NODES);
    return result.kind === 'solved' && verifyLine(RULES, start, result.line).kind === 'wins';
  });
}

describe('LINE_SIEGE_LEVELS', () => {
  it('proves every shipped level winnable by the witness, with packs matching the config', () => {
    const problems = levelsContractProblems({
      levels: LINE_SIEGE_LEVELS,
      engine: { create, listMoves, applyMove, outcome },
      config: CONFIG,
      maxNodes: WITNESS_MAX_NODES,
    });
    expect(problems).toStrictEqual([]);
  });

  it('opens pack 1 at once and asks 45 then 90 stars for the next packs', () => {
    expect(LINE_SIEGE_LEVELS.packs.map((pack) => pack.starsToUnlock)).toStrictEqual([0, 45, 90]);
  });

  it('rates every level by score, where any score wins (Line Siege is a score game)', () => {
    const rules = LINE_SIEGE_LEVELS.table.map((entry) => entry.stars);
    expect(rules.every((rule) => rule.kind === 'score' && rule.thresholds[0] === 0)).toBe(true);
  });

  it('starts the daily challenge at the daily difficulty from the date and salt', () => {
    expect(dailyStart(LINE_SIEGE_LEVELS, '2026-09-28')?.difficulty).toBe(
      LINE_SIEGE_DAILY_DIFFICULTY,
    );
  });

  // Spec 8.1 "no level is impossible" and 8.3: the daily is create(dailySeed(date, salt), 45) and
  // frozen since the first release, so create cannot swap a board the level witness loses for a
  // proven one (on 2026-11-03 the witness's own seed lost 302 of these 765 dailies; seeds 1 to 19
  // of the same greedy bot won every one). Instead each daily is shown winnable by a replayed line.
  it('shows every daily from 2026-10-01 to 2028-11-03 winnable by a replayed greedy line', () => {
    const lost = Array.from({ length: 765 }, (_, day) => addDays('2026-10-01', day)).filter(
      (date) => !isDailyWinnable(date),
    );
    expect(lost).toStrictEqual([]);
  });

  it('runs endless at the reserved endless difficulty, which no level uses', () => {
    expect(LINE_SIEGE_LEVELS.endless).toStrictEqual({
      kind: 'endless',
      difficulty: ENDLESS_DIFFICULTY,
    });
    const top = Math.max(...LINE_SIEGE_LEVELS.table.map((entry) => entry.difficulty));
    expect(top).toBe(MAX_LEVEL_DIFFICULTY);
  });
});
