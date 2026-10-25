// apps/toggle-drop/src/levels/toggle-drop-levels.test.ts
import { addDays } from '@e07/game-kit/dates/date-key.ts';
import { dailyStart } from '@e07/game-kit/levels/daily-start.ts';
import { levelsContractProblems } from '@e07/game-kit/levels/levels-contract.ts';
import { applyMove } from '@e07/toggle-drop/rules/apply-move.ts';
import { create } from '@e07/toggle-drop/rules/create.ts';
import { dropPath } from '@e07/toggle-drop/rules/drop-path.ts';
import { listMoves } from '@e07/toggle-drop/rules/list-moves.ts';
import { outcome } from '@e07/toggle-drop/rules/outcome.ts';
import { knobsFor } from '@e07/toggle-drop/rules/toggle-drop-tuning.ts';

import { TOGGLE_DROP_DAILY_DIFFICULTY, TOGGLE_DROP_LEVELS } from './toggle-drop-levels.ts';
import { TOGGLE_DROP_SOLVER } from './toggle-drop-solver.ts';

/** game.config.ts `levels` for this app; the packs must match it exactly. */
const CONFIG = { packCount: 3, levelsPerPack: 30 };

describe('TOGGLE_DROP_LEVELS', () => {
  it('proves every shipped level winnable at its recorded par, with packs matching the config', () => {
    const problems = levelsContractProblems({
      levels: TOGGLE_DROP_LEVELS,
      engine: { create, listMoves, applyMove, outcome },
      config: CONFIG,
      maxNodes: 60_000,
    });
    expect(problems).toStrictEqual([]);
  });

  it('opens pack 1 at once and asks 45 then 90 stars for the next packs', () => {
    expect(TOGGLE_DROP_LEVELS.packs.map((pack) => pack.starsToUnlock)).toStrictEqual([0, 45, 90]);
  });

  it('rates every level against par (a puzzle game)', () => {
    expect(TOGGLE_DROP_LEVELS.table.every((entry) => entry.stars.kind === 'par')).toBe(true);
  });

  it('starts the daily challenge at the daily difficulty from the date and salt', () => {
    expect(dailyStart(TOGGLE_DROP_LEVELS, '2026-09-28')?.difficulty).toBe(
      TOGGLE_DROP_DAILY_DIFFICULTY,
    );
  });

  it('makes a proven daily board with every cup and its twist for every date of two years (spec 8.1 and 8.3)', () => {
    const knobs = knobsFor(TOGGLE_DROP_DAILY_DIFFICULTY);
    const problems: string[] = [];
    for (let day = 0; day < 731; day += 1) {
      const date = addDays('2026-10-01', day);
      const start = dailyStart(TOGGLE_DROP_LEVELS, date);
      if (start === null) throw new Error('Toggle Drop has a daily mode');
      const state = create(start.seed, start.difficulty);
      const solved = TOGGLE_DROP_SOLVER.solve(state, 60_000);
      const cups = state.needs.flatMap((need, col) => (need > 0 ? [col] : []));
      const firstLandings = new Set(
        Array.from({ length: state.cols }, (_, col) => dropPath(state, col).landing),
      );
      const hasTwist = cups.some((col) => !firstLandings.has(col));
      if (
        solved.kind !== 'solved' ||
        outcome(solved.final).kind !== 'won' ||
        cups.length !== knobs.cups ||
        !hasTwist
      ) {
        problems.push(
          `${date}: ${solved.kind}, ${String(cups.length)} cups, twist ${String(hasTwist)}`,
        );
      }
    }
    expect(problems).toStrictEqual([]);
  });
});
