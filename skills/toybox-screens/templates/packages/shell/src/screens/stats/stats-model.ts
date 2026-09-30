// packages/shell/src/screens/stats/stats-model.ts
// What S10 Statistics draws. use-stats-model.ts builds it from the stats and progress stores.
import type { LogoArt } from '@e07/shell/art/logo-art.ts';
import type { AdBannerSlotProps } from '@e07/shell/ui/ad-banner-slot.tsx';

export type StatsWeekDay = {
  /** date.weekday-strip.<ISO weekday>. */
  readonly letter: string;
  /** date.weekday.<ISO weekday>, for the bar's VoiceOver label. */
  readonly weekdayName: string;
  readonly games: number;
};

/** One of the game's own counters (games.<id>.stats); key is kebab-case: monsters-defeated. */
export type GameStat = { readonly key: string; readonly label: string; readonly valueText: string };

export type StatsSnapshot = {
  readonly gamesPlayed: number;
  readonly wins: number;
  /** 0..1, shown with stats.win-rate (::percent). */
  readonly winRate: number;
  readonly playHours: number;
  readonly playMinutes: number;
  readonly levelsCompleted: number;
  readonly starsEarned: number;
  readonly starsTotal: number;
  readonly threeStarLevels: number;
  readonly bestLevels: number;
  readonly bestDaily: number;
  /** null for games without an Endless mode: the row is left out. */
  readonly bestEndless: number | null;
  /**
   * The best single-level score and its level; null until a level is won (the save's best level is
   * empty then): the row is left out, never shown as "Level 0: 0" (Chosen).
   */
  readonly bestLevelScore: { readonly level: number; readonly score: number } | null;
  readonly bestWinStreak: number;
  readonly dailyCompleted: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  /**
   * Exactly the last seven days, oldest first (runs right to left in fa/ckb). WeekBars keys the
   * columns by position: stats.week-bar.1 is the oldest day, .7 is today.
   */
  readonly week: readonly StatsWeekDay[];
  readonly gameStats: readonly GameStat[];
};

export type StatsModel = {
  /** A new player: the friendly empty state, never a wall of zeros. */
  readonly isEmpty: boolean;
  readonly snapshot: StatsSnapshot;
  readonly gameName: string;
  /** The game's logo data for the game panel's 36 pt logo tile. */
  readonly logo: LogoArt;
  /** Plain numbers in the chosen digits (createNumberFormatter). */
  readonly formatNumber: (value: number) => string;
  readonly isReducedMotion: boolean;
  readonly banner: Pick<AdBannerSlotProps, 'renderBanner' | 'isAllowed'>;
  readonly onBack: () => void;
  /** Opens the reset-statistics dialog. */
  readonly onReset: () => void;
  /** Empty state: plays like Home's Play key. */
  readonly onPlay: () => void;
};
