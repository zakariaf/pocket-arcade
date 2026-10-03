// packages/game-kit/src/levels/star-rating.ts
import type { StarRule } from '@e07/game-kit/contract/levels.ts';

/** 0 for a loss; 1 to 3 for a win. Only wins are recorded as level results. */
export type StarCount = 0 | 1 | 2 | 3;

/** The facts of a finished level that stars are rated on. */
export type RatedRun = {
  readonly isWon: boolean;
  /** Moves the player made (undone moves not counted). */
  readonly moves: number;
  readonly score: number;
};

/** Spec 8.1: a win within par + 2 moves still earns 2 stars. */
export const PAR_SLACK_FOR_TWO_STARS = 2;

function parStars(par: number, moves: number): StarCount {
  if (moves <= par) return 3;
  return moves <= par + PAR_SLACK_FOR_TWO_STARS ? 2 : 1;
}

function scoreStars(thresholds: readonly [number, number, number], score: number): StarCount {
  if (score >= thresholds[2]) return 3;
  return score >= thresholds[1] ? 2 : 1;
}

/**
 * Spec 8.1 stars. Puzzle levels: 3 at or under par, 2 up to par + 2, 1 for finishing.
 * Score levels: 3 / 2 at thresholds[2] / thresholds[1], 1 for finishing. thresholds[0] is the
 * lowest score a win can have (0 when the win is not score-based, as in Line Siege, where clearing
 * the wave wins); the game's outcome decides the win, so starsFor never reads it.
 */
export function starsFor(rule: StarRule, run: RatedRun): StarCount {
  if (!run.isWon) return 0;
  return rule.kind === 'par'
    ? parStars(rule.par, run.moves)
    : scoreStars(rule.thresholds, run.score);
}
