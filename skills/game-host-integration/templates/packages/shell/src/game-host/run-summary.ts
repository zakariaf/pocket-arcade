// packages/shell/src/game-host/run-summary.ts
import { nextLevel } from '@e07/game-kit/levels/pack-progress.ts';
import { starsFor } from '@e07/game-kit/levels/star-rating.ts';
import { isScoreRule } from '@e07/shell/game-host/game-facts.ts';
import { measureCounters } from '@e07/shell/game-host/measure-counters.ts';

import type { Hud } from '@e07/game-kit/contract/game-rules.ts';
import type { LevelEntry, StarRule } from '@e07/game-kit/contract/levels.ts';
import type { CounterSpec } from '@e07/game-kit/contract/stats.ts';
import type { RatedRun, StarCount } from '@e07/game-kit/levels/star-rating.ts';
import type { GameSession, SessionRules } from '@e07/shell/game-host/game-session-types.ts';
import type { RunRef, SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { RunEnd } from '@e07/shell/stores/run-end.ts';

/** What S7 shows about a finished run; computed once, when the run is recorded. */
export type RunSummary = {
  readonly ref: RunRef;
  readonly isWon: boolean;
  /** The game's catalog key for a loss ("The wolf got a sheep"), else null. */
  readonly loseReasonKey: string | null;
  readonly score: number;
  readonly moves: number;
  readonly playMs: number;
  /** 1 to 3 for a won level (spec 8.1), 0 for losses and for daily, endless and tutorial runs. */
  readonly stars: StarCount;
  readonly par: number | null;
  readonly isNewBest: boolean;
  /**
   * A level run: the level's best score once this run is saved (progress.levels[n].bestScore, the
   * S7 score line of a score-rated win); null for daily, endless and tutorial runs.
   */
  readonly levelBestScore: number | null;
  /** The S7 "Next level" target, or null (not a level run, or the last level). */
  readonly nextLevel: number | null;
};

/** The game's parts a run end needs besides the session. */
export type RunEndContext<TState, TMove, TEvent> = {
  readonly rules: SessionRules<TState, TMove, TEvent>;
  readonly hud: (state: TState) => Hud;
  readonly counters: readonly CounterSpec<TEvent>[];
  /** The level's table entry (stars rule and par); null for other runs. */
  readonly entry: LevelEntry | null;
  readonly table: readonly LevelEntry[];
};

type Finished<TState, TMove, TEvent> = GameSession<TState, TMove, TEvent>;

function scoreOf<TState, TMove, TEvent>(
  session: Finished<TState, TMove, TEvent>,
  hud: (state: TState) => Hud,
): number {
  return session.outcome.kind === 'won' ? session.outcome.score : hud(session.state).score;
}

/** Spec S7 "New best!": compared with the save as it was before this run was recorded. */
function isAboveBest(before: SaveDoc, ref: RunRef, score: number): boolean {
  switch (ref.kind) {
    case 'level':
      return score > (before.progress.levels[String(ref.level)]?.bestScore ?? -1);
    case 'endless':
      return score > before.progress.endlessBest;
    case 'daily':
      return score > before.stats.bestScore.daily;
    case 'tutorial':
      return false;
  }
}

/**
 * A won run above its best is a new best. An endless run only ever ends lost (it has no goal), so
 * its best counts win or not; a lost level or daily run never shows "New best!".
 */
function isNewBest(before: SaveDoc, ref: RunRef, run: RatedRun): boolean {
  const isCounted = run.isWon || ref.kind === 'endless';
  return isCounted && isAboveBest(before, ref, run.score);
}

/**
 * What progress.levels[n].bestScore holds after this run is recorded: a won level keeps the higher
 * score (the first win sets it), a lost level records nothing.
 */
function levelBestAfter(before: SaveDoc, ref: RunRef, run: RatedRun): number | null {
  if (ref.kind !== 'level') return null;
  const saved = before.progress.levels[String(ref.level)]?.bestScore;
  if (!run.isWon) return saved ?? 0;
  return saved === undefined ? run.score : Math.max(saved, run.score);
}

/** Spec 8.1 stars for a level run, rated on its table entry's rule; 0 for every other run. */
function starsOf(ref: RunRef, rule: StarRule | null, run: RatedRun): StarCount {
  return ref.kind === 'level' && rule !== null ? starsFor(rule, run) : 0;
}

/** Summarises a won or lost session for S7 (stars from the level's table rule, spec 8.1). */
export function summarizeRun<TState, TMove, TEvent>(
  session: Finished<TState, TMove, TEvent>,
  context: RunEndContext<TState, TMove, TEvent>,
  before: SaveDoc,
): RunSummary {
  const isWon = session.outcome.kind === 'won';
  const score = scoreOf(session, context.hud);
  const { ref, moveCount: moves, playMs } = session;
  const rule = context.entry?.stars ?? null;
  const rated = { isWon, moves, score };
  return {
    ref,
    isWon,
    loseReasonKey: session.outcome.kind === 'lost' ? session.outcome.reasonKey : null,
    score,
    moves,
    playMs,
    stars: starsOf(ref, rule, rated),
    // Score-rated levels (and every other run) have no par: S7 then prints the score line.
    par: rule === null || isScoreRule(rule) ? null : rule.par,
    isNewBest: isNewBest(before, ref, rated),
    levelBestScore: levelBestAfter(before, ref, rated),
    nextLevel: ref.kind === 'level' && isWon ? nextLevel(context.table, ref.level) : null,
  };
}

/** The run-end record the Shell's applyRunEnd writes in ONE save update (progress, daily, stats). */
export function runEndOf<TState, TMove, TEvent>(
  session: Finished<TState, TMove, TEvent>,
  summary: RunSummary,
  context: RunEndContext<TState, TMove, TEvent>,
): RunEnd {
  const base = {
    isWon: summary.isWon,
    score: summary.score,
    moves: summary.moves,
    playMs: summary.playMs,
    counters: measureCounters(context.rules, session, context.counters),
  };
  const { ref } = session;
  switch (ref.kind) {
    case 'level':
      // A lost level records no result; its stars field is ignored, 1 only satisfies the type.
      return {
        ...base,
        mode: 'level',
        level: ref.level,
        stars: summary.stars === 0 ? 1 : summary.stars,
      };
    case 'daily':
      return { ...base, mode: 'daily', date: ref.date };
    case 'endless':
      return { ...base, mode: 'endless' };
    case 'tutorial':
      return { ...base, mode: 'tutorial' };
  }
}
