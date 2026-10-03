// packages/shell/src/screens/result/result-model.ts
// What S7 Result draws. The game host builds it after stars and statistics are saved
// (spec S7: saved BEFORE this screen appears). A due full-screen ad shows only after a tap.
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

export type ResultActions = {
  readonly onNext: () => void;
  readonly onReplay: () => void;
  /** popTo('Levels') after the host has saved the run. */
  readonly onLevels: () => void;
  readonly onTryAgain: () => void;
  /** popTo('Home'). */
  readonly onHome: () => void;
  /** Rewarded ad, or free for Premium owners; once per level. */
  readonly onContinue: () => void;
  readonly onOpenPremium: () => void;
};

type ResultBase = {
  /** game-screen.mode.level, game-screen.mode.daily or common.mode.endless, already formatted. */
  readonly modeText: string;
  /** The score in the chosen digits ("1,840"). */
  readonly scoreText: string;
  readonly isNewBest: boolean;
  readonly isReducedMotion: boolean;
  readonly actions: ResultActions;
};

export type WinResult = ResultBase & {
  readonly kind: 'win';
  readonly stars: 1 | 2 | 3;
  /** games.<id>.winTitle, e.g. "The wall holds!". */
  readonly winTitle: string;
  /** games.<id>.progress in full, e.g. "Monsters 10 / 10". */
  readonly progressText: string;
  /** This run's score, for the score line of a score-rated level. */
  readonly score: number;
  /** The level's best score after this run (progress.levels[n].bestScore). */
  readonly bestScore: number;
  readonly movesCount: number;
  /**
   * The level's par, or null for a level rated by score (Line Siege). A moves-rated level prints
   * "7 moves – par 7" (result.win.moves); a score-rated one prints "Score 1,840 – best 2,010"
   * (result.win.score-line). resultModelOf passes null whenever the level's star rule is
   * score-based.
   */
  readonly par: number | null;
  /** The store price for the once-a-day nudge; null for owners or when already shown today. */
  readonly nudgePriceText: string | null;
};

export type LoseResult = Omit<ResultBase, 'scoreText' | 'isNewBest'> & {
  readonly kind: 'lose';
  /** The game's logo data for the tilted lose picture. */
  readonly logo: LogoArt;
  /** games.<id>.loseReason; null falls back to result.lose.reason.no-moves. */
  readonly loseReason: string | null;
  /**
   * 'ad' = a rewarded ad is ready; 'ad-loading' = the same offer while its rewarded ad loads (the ad
   * key busy: label kept, hopping blocks for the icon, pushed in, not pressable); 'premium' = free
   * for owners; null = no continue: the game allows none, it is used, or nobody can give it. A loss
   * nobody can rescue is recorded at once (L11, never strand a finished run), so a lose screen
   * without the offer always shows a recorded loss.
   */
  readonly continueOffer: 'ad' | 'ad-loading' | 'premium' | null;
};

export type DailyResult = ResultBase & {
  readonly kind: 'daily';
  readonly progressText: string;
  readonly streakDays: number;
};

export type EndlessResult = ResultBase & {
  readonly kind: 'endless';
  readonly bestScore: number;
};

export type ResultModel = WinResult | LoseResult | DailyResult | EndlessResult;
