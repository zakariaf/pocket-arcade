// packages/shell/src/stores/progress-reducer.ts
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

type ProgressSection = SaveDoc['progress'];
type LevelResult = ProgressSection['levels'][string];
type Stars = LevelResult['stars'];

/** Spec 8.5: one free hint per local day (then a rewarded ad, or unlimited with Premium). */
export const FREE_HINTS_PER_DAY = 1;

/** The progress store holds these save sections (the store writes only these). */
export type ProgressState = {
  readonly progress: ProgressSection;
  readonly daily: SaveDoc['daily'];
  readonly hints: SaveDoc['hints'];
  readonly upsell: SaveDoc['upsell'];
};

/** One finished and WON level. Spec 8.1: the best result per level is kept. */
export type LevelWin = {
  readonly level: number;
  readonly stars: Stars;
  readonly score: number;
  /** null for games that do not count moves. */
  readonly moves: number | null;
  /** The local day of the win (ClockPort.today()). */
  readonly date: DateKey;
};

/** Imperative kebab-case action names (record-<fact>, use-<thing>). */
export type ProgressAction =
  | { readonly type: 'record-level-result'; readonly win: LevelWin }
  | { readonly type: 'record-endless-score'; readonly score: number }
  | { readonly type: 'use-free-hint'; readonly today: DateKey }
  | { readonly type: 'record-upsell-shown'; readonly today: DateKey };

const moreStars = (a: Stars, b: Stars): Stars => (a >= b ? a : b);

function fewerMoves(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

/** Pure. Also used by the run-end write, which records a win in the same update as the stats. */
export function recordLevelResult(progress: ProgressSection, win: LevelWin): ProgressSection {
  const key = String(win.level);
  const previous = progress.levels[key];
  const next: LevelResult =
    previous === undefined
      ? {
          stars: win.stars,
          bestScore: win.score,
          bestMoves: win.moves,
          completions: 1,
          firstCompletedOn: win.date,
        }
      : {
          stars: win.stars,
          bestScore: Math.max(previous.bestScore, win.score),
          bestMoves: fewerMoves(previous.bestMoves, win.moves),
          completions: previous.completions + 1,
          firstCompletedOn: previous.firstCompletedOn,
        };
  return { ...progress, levels: { ...progress.levels, [key]: next } };
}

/** Pure. Endless mode keeps only the best score (spec 8.2). */
export function recordEndlessScore(progress: ProgressSection, score: number): ProgressSection {
  return score > progress.endlessBest ? { ...progress, endlessBest: score } : progress;
}

/** Free hints left today; a new local day starts a fresh allowance. */
export function freeHintsLeft(hints: SaveDoc['hints'], today: DateKey): number {
  return hints.freeDate === today
    ? Math.max(0, FREE_HINTS_PER_DAY - hints.freeUsed)
    : FREE_HINTS_PER_DAY;
}

function usedFreeHint(state: ProgressState, today: DateKey): ProgressState {
  if (freeHintsLeft(state.hints, today) === 0) return state;
  const freeUsed = state.hints.freeDate === today ? state.hints.freeUsed + 1 : 1;
  return { ...state, hints: { freeDate: today, freeUsed } };
}

/**
 * Pure. Returns the SAME state object when nothing changes, so the store skips the write.
 * Daily results and statistics are not actions here: a finished run records level result,
 * daily result and statistics in ONE save update (see update-and-publish.ts).
 */
export function progressReducer(state: ProgressState, action: ProgressAction): ProgressState {
  switch (action.type) {
    case 'record-level-result':
      return { ...state, progress: recordLevelResult(state.progress, action.win) };
    case 'record-endless-score': {
      const progress = recordEndlessScore(state.progress, action.score);
      return progress === state.progress ? state : { ...state, progress };
    }
    case 'use-free-hint':
      return usedFreeHint(state, action.today);
    case 'record-upsell-shown':
      return state.upsell.lastShownOn === action.today
        ? state
        : { ...state, upsell: { lastShownOn: action.today } };
  }
}
