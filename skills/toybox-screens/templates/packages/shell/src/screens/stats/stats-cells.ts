// packages/shell/src/screens/stats/stats-cells.ts
// Pure: the S10 stat cells and rows, in design order. Each id is the last segment of the design
// testID: StatGrid and StatList derive <panel testID>.<id> (.value, .label) from it.
import type { StatsModel } from './stats-model.ts';
import type { TFunction } from '@e07/shell/i18n/create-t.ts';
import type { StatCell } from '@e07/shell/ui/stat-grid.tsx';
import type { StatListRow } from '@e07/shell/ui/stat-list.tsx';

type Input = Pick<StatsModel, 'snapshot' | 'formatNumber'>;

/** Overview, 2 columns: games played, wins, win rate, total play time. */
export function overviewCells({ snapshot: s, formatNumber }: Input, t: TFunction): StatCell[] {
  return [
    {
      id: 'games-played',
      value: formatNumber(s.gamesPlayed),
      label: t('stats.overview.games-played'),
    },
    {
      id: 'wins',
      value: formatNumber(s.wins),
      label: t('stats.overview.wins'),
    },
    {
      id: 'win-rate',
      value: t('stats.win-rate', { rate: s.winRate }),
      label: t('stats.overview.win-rate'),
    },
    {
      id: 'play-time',
      value: t('stats.duration', { hours: s.playHours, minutes: s.playMinutes }),
      label: t('stats.overview.play-time'),
    },
  ];
}

/** Levels, 3 columns: completed, stars earned / total, three-star levels. */
export function levelCells({ snapshot: s, formatNumber }: Input, t: TFunction): StatCell[] {
  return [
    {
      id: 'completed',
      value: formatNumber(s.levelsCompleted),
      label: t('stats.levels.completed'),
    },
    {
      id: 'stars',
      value: t('stats.levels.stars-value', { earned: s.starsEarned, total: s.starsTotal }),
      label: t('stats.levels.stars'),
    },
    {
      id: 'three-star',
      value: formatNumber(s.threeStarLevels),
      label: t('stats.levels.three-star'),
    },
  ];
}

/** Daily challenge, 3 columns: completed, current streak, best streak. */
export function dailyCells({ snapshot: s, formatNumber }: Input, t: TFunction): StatCell[] {
  return [
    {
      id: 'completed',
      value: formatNumber(s.dailyCompleted),
      label: t('stats.daily.completed'),
    },
    {
      id: 'current-streak',
      value: t('daily.streak.days', { daysCount: s.currentStreak }),
      label: t('daily.streak.current'),
    },
    {
      id: 'best-streak',
      value: t('daily.streak.days', { daysCount: s.bestStreak }),
      label: t('daily.streak.best'),
    },
  ];
}

/** The Endless row, only for games with an Endless mode. */
function endlessRows({ snapshot: s, formatNumber }: Input, t: TFunction): StatListRow[] {
  if (s.bestEndless === null) return [];
  return [{ id: 'endless', label: t('common.mode.endless'), value: formatNumber(s.bestEndless) }];
}

/** The best level score, once a level is won (never "Level 0: 0"). */
function levelScoreRows({ snapshot: s }: Input, t: TFunction): StatListRow[] {
  if (s.bestLevelScore === null) return [];
  return [
    {
      id: 'level-score',
      label: t('stats.best.level-score'),
      value: t('stats.best.level-score-value', s.bestLevelScore),
    },
  ];
}

/** Best scores list: per mode (Endless only when the game has it), best level score, win streak. */
export function bestRows(input: Input, t: TFunction): StatListRow[] {
  const { snapshot: s, formatNumber } = input;
  return [
    { id: 'levels', label: t('common.levels'), value: formatNumber(s.bestLevels) },
    { id: 'daily', label: t('common.mode.daily'), value: formatNumber(s.bestDaily) },
    ...endlessRows(input, t),
    ...levelScoreRows(input, t),
    { id: 'win-streak', label: t('stats.best.win-streak'), value: formatNumber(s.bestWinStreak) },
  ];
}

/** The game's own counters: ids are their kebab keys (stats.game-card.monsters-defeated). */
export function gameCells({ snapshot }: Input): StatCell[] {
  return snapshot.gameStats.map((stat) => ({
    id: stat.key,
    value: stat.valueText,
    label: stat.label,
  }));
}
