// apps/line-siege/src/rules/score-level.ts
// The "after" of examples/splitting-a-long-function.md: one options object, a lookup table and
// small named steps instead of one 44-line function with nested conditions. The star bands follow
// spec 8.1; the daily bonus and the hint cost are illustration values, not project rules.

export type StarRule =
  | { readonly kind: 'par'; readonly par: number }
  | { readonly kind: 'score'; readonly thresholds: readonly [number, number, number] };

export type Stars = 0 | 1 | 2 | 3;

export type LevelResult = {
  readonly moves: number;
  readonly score: number;
  readonly isWon: boolean;
};

export type ScoreOptions = {
  readonly result: LevelResult;
  readonly rule: StarRule;
  readonly isDaily: boolean;
  readonly hintsUsed: number;
};

export type LevelScore = { readonly stars: Stars; readonly points: number };

/** Points per star; in this illustration the daily challenge doubles them. */
const POINTS_PER_STAR = { regular: 100, daily: 200 } as const;
const HINT_PENALTY = 25;

/** Stars for a puzzle rated against par: par or better is 3, each extra move band drops one. */
export function starsByPar(moves: number, par: number): Stars {
  if (moves <= par) return 3;
  if (moves <= par + 2) return 2;
  return 1;
}

const STARS_BY_THRESHOLDS_REACHED: readonly Stars[] = [0, 1, 2, 3];

/** Stars for a score game: one star per threshold reached. */
export function starsByScore(score: number, thresholds: readonly [number, number, number]): Stars {
  const reached = thresholds.filter((threshold) => score >= threshold).length;
  return STARS_BY_THRESHOLDS_REACHED[reached] ?? 0;
}

function starsFor(result: LevelResult, rule: StarRule): Stars {
  if (!result.isWon) return 0;
  switch (rule.kind) {
    case 'par':
      return starsByPar(result.moves, rule.par);
    case 'score':
      return starsByScore(result.score, rule.thresholds);
  }
}

/** Stars and points for a finished level; hints cost points but never stars. */
export function scoreLevel(options: ScoreOptions): LevelScore {
  const stars = starsFor(options.result, options.rule);
  const perStar = options.isDaily ? POINTS_PER_STAR.daily : POINTS_PER_STAR.regular;
  const points = Math.max(0, stars * perStar - options.hintsUsed * HINT_PENALTY);
  return { stars, points };
}
