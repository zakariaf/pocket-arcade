// packages/shell/src/game-host/result-model-of.ts
import { modeTextOf, progressTextOf } from '@e07/shell/game-host/top-bar-model.ts';

import type { GameHost } from '@e07/shell/game-host/game-host.ts';
import type { RunSummary } from '@e07/shell/game-host/run-summary.ts';
import type { SessionView } from '@e07/shell/game-host/session-view.ts';
import type { RunText } from '@e07/shell/game-host/top-bar-model.ts';
import type {
  LoseResult,
  ResultActions,
  ResultModel,
} from '@e07/shell/screens/result/result-model.ts';
import type { PerkOffer } from '@e07/shell/services/ads/perk-offer.ts';

/** What S7 shows of the game itself: its win title key and its logo (useGameHost() fits). */
export type ResultGame = Pick<GameHost, 'winTitleId' | 'logo'>;

/** Values other layers own: the streak, the endless best, the Premium nudge. */
export type ResultExtras = {
  /** Daily streak after this run (daily-and-statistics). */
  readonly streakDays: number;
  /** Best endless score after this run (the progress store). */
  readonly endlessBest: number;
  /** The Premium nudge price, or null for owners or when already shown today. */
  readonly nudgePriceText: string | null;
};

export type ResultInput = {
  readonly view: SessionView;
  /** The game module's win title and logo, from the host: `game: useGameHost()`. */
  readonly game: ResultGame;
  readonly text: RunText;
  readonly actions: ResultActions;
  /** perkOffer({ kind: 'continue', ... }); read only while a loss waits for the continue. */
  readonly continueOffer: PerkOffer;
  readonly isReducedMotion: boolean;
  readonly extras: ResultExtras;
};

/** perkOffer says 'free' for a continue only to Premium owners. */
const CONTINUE_OFFER: Readonly<Record<PerkOffer, LoseResult['continueOffer']>> = {
  free: 'premium',
  'watch-ad': 'ad',
  hidden: null,
};

type Base = {
  readonly modeText: string;
  readonly isReducedMotion: boolean;
  readonly actions: ResultActions;
};

function loseResult(input: ResultInput, base: Base, isOffered: boolean): LoseResult {
  const key = input.view.loseReasonKey;
  const offer = isOffered ? input.continueOffer : 'hidden';
  return {
    ...base,
    kind: 'lose',
    logo: input.game.logo,
    loseReason: key === null ? null : input.text.gameText({ id: key, values: {} }),
    continueOffer: CONTINUE_OFFER[offer],
  };
}

/** A recorded run: win, lose, daily or endless (spec S7). */
function recordedResult(input: ResultInput, base: Base, summary: RunSummary): ResultModel {
  const { view, text, extras, game } = input;
  const scored = {
    ...base,
    scoreText: text.formatNumber(summary.score),
    isNewBest: summary.isNewBest,
  };
  const progressText = progressTextOf(view.hud.goal, text);
  if (summary.ref.kind === 'daily') {
    return { ...scored, kind: 'daily', progressText, streakDays: extras.streakDays };
  }
  if (summary.ref.kind === 'endless') {
    return { ...scored, kind: 'endless', bestScore: extras.endlessBest };
  }
  if (!summary.isWon || summary.stars === 0) return loseResult(input, base, false);
  return {
    ...scored,
    kind: 'win',
    stars: summary.stars,
    winTitle: text.gameText({ id: game.winTitleId, values: {} }),
    progressText,
    movesCount: summary.moves,
    // null for score-rated levels: the win line then prints the score line with the level's best
    // (result.win.score-line); a moves-rated level prints result.win.moves with its par.
    par: summary.par,
    score: summary.score,
    bestScore: summary.levelBestScore ?? summary.score,
    nudgePriceText: extras.nudgePriceText,
  };
}

/**
 * What S7 shows, built after the run-end save (spec S7): null while the run is live and for the
 * tutorial. A loss that still has its continue shows the lose screen with the offer; the record
 * follows when the player declines (finish) or continues.
 */
export function resultModelOf(input: ResultInput): ResultModel | null {
  const { view } = input;
  if (view.ref.kind === 'tutorial' || view.status === 'playing' || view.status === 'paused') {
    return null;
  }
  const base = {
    modeText: modeTextOf(view.ref, input.text),
    isReducedMotion: input.isReducedMotion,
    actions: input.actions,
  };
  if (view.summary === null) return loseResult(input, base, view.continueState === 'offered');
  return recordedResult(input, base, view.summary);
}
