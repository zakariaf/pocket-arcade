// packages/shell/src/stores/stats-selectors.ts
import type { StatsStoreState } from '@e07/shell/stores/stats-store.ts';

type Stats = StatsStoreState['stats'];

// Primitives or references already in the state; the S10 view model derives the rest.
export const selectStats = (state: StatsStoreState): Stats => state.stats;
export const selectGamesPlayed = (state: StatsStoreState): number => state.stats.gamesPlayed;
export const selectHasPlayed = (state: StatsStoreState): boolean => state.stats.gamesPlayed > 0;
export const selectStatsDispatch = (state: StatsStoreState): StatsStoreState['dispatch'] =>
  state.dispatch;
