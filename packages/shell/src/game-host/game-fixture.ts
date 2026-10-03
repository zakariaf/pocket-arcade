// packages/shell/src/game-host/game-fixture.ts
// Pure: the design's numbers for the game frames (S5 top bar, S6 Pause, S7 Result) as a session
// view. The parity harness's parityGameFixture() hands them over (level 12, score 1,840, the game's
// progress line at mid and at full, 3 stars, New best, 7 moves, par 7 or the score line, the game's
// first lose reason and the continue offer); the debug controls show them over the played run.
import type { StarCount } from '@e07/game-kit/levels/star-rating.ts';
import type { GoalLine, HudView } from '@e07/shell/game-host/hud-model.ts';
import type { RunSummary } from '@e07/shell/game-host/run-summary.ts';
import type { ViewFixture } from '@e07/shell/game-host/session-view-of.ts';
import type { SessionView } from '@e07/shell/game-host/session-view.ts';

/** What the host reads of a game frame's fixture (parity-session's ParityGameFixture fits it). */
export type GameFixture = {
  readonly level: number;
  readonly score: number;
  /** Values of the game's own progress message mid-level (S5, S6) and at the end (S7 win). */
  readonly progress: {
    readonly mid: Readonly<Record<string, number | string>>;
    readonly full: Readonly<Record<string, number | string>>;
  };
  readonly stars: Exclude<StarCount, 0>;
  readonly isNewBest: boolean;
  readonly movesCount: number;
  /** The par of a moves-rated game; null for a score-rated one (S7 prints the score line). */
  readonly par: number | null;
  /** The level's best after the run: the score line's second number. */
  readonly bestScore: number;
  /** The game's first lose reason key (S7 lose). */
  readonly loseReasonKey: string;
  /** Whether the S7 lose frame offers the continue. */
  readonly isContinueOffered: boolean;
};

export type FixtureResult = 'won' | 'lost';

/** The goal line: "Moves 7 / Par 7" for a moves-rated game, else the game's message with the values. */
function goalOf(played: GoalLine, fixture: GameFixture, isFull: boolean): GoalLine {
  if (fixture.par !== null)
    return { kind: 'moves-par', moves: fixture.movesCount, par: fixture.par };
  if (played.kind !== 'game') return played;
  const values = isFull ? fixture.progress.full : fixture.progress.mid;
  return { kind: 'game', message: { ...played.message, values } };
}

/** The top bar of a game frame: the fixture's level, score and progress (mid, or full on S7). */
export function fixtureHudOf(view: SessionView, fixture: GameFixture, isFull: boolean): HudView {
  const mode = { kind: 'level', level: fixture.level } as const;
  return { mode, goal: goalOf(view.hud.goal, fixture, isFull), score: fixture.score };
}

/** The recorded run S7 shows for the frame; nothing of it is saved. */
export function fixtureSummaryOf(fixture: GameFixture, result: FixtureResult): RunSummary {
  const isWon = result === 'won';
  return {
    ref: { kind: 'level', level: fixture.level },
    isWon,
    loseReasonKey: isWon ? null : fixture.loseReasonKey,
    score: fixture.score,
    moves: fixture.movesCount,
    playMs: 0,
    stars: isWon ? fixture.stars : 0,
    par: fixture.par,
    isNewBest: isWon && fixture.isNewBest,
    levelBestScore: fixture.bestScore,
    nextLevel: isWon ? fixture.level + 1 : null,
  };
}

/**
 * S5 and S6: the played run with the fixture's level, score and progress in the top bar. The design
 * draws the frame mid-level (7 moves in), so Undo shows enabled; a game without undo still leaves
 * the key out (isUndoSupported is the game's own).
 */
export function fixtureHudViewOf(view: SessionView, fixture: GameFixture): ViewFixture {
  return {
    ref: { kind: 'level', level: fixture.level },
    hud: fixtureHudOf(view, fixture, false),
    canUndo: true,
  };
}

/**
 * S7: the result over the run. A win is recorded with its stars; a loss that offers the continue is
 * still pending (no summary), as the real lose screen with the offer is.
 */
export function fixtureResultViewOf(
  view: SessionView,
  fixture: GameFixture,
  result: FixtureResult,
): ViewFixture {
  const isOffered = result === 'lost' && fixture.isContinueOffered;
  return {
    ref: { kind: 'level', level: fixture.level },
    hud: fixtureHudOf(view, fixture, result === 'won'),
    status: result,
    summary: isOffered ? null : fixtureSummaryOf(fixture, result),
    continueState: isOffered ? 'offered' : 'none',
    loseReasonKey: result === 'lost' ? fixture.loseReasonKey : null,
  };
}
