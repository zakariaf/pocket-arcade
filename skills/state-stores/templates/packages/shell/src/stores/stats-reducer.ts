// packages/shell/src/stores/stats-reducer.ts
import { DEFAULT_STATS } from '@e07/shell/services/save/schema/default-save-doc.ts';

import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

/** The stats store holds only the `stats` section. */
export type StatsState = { readonly stats: SaveDoc['stats'] };

/**
 * A finished run is NOT an action here: the run end records level result, daily result and
 * statistics in ONE save update (update-and-publish.ts), before the result screen appears.
 */
export type StatsAction = { readonly type: 'reset-statistics' };

/**
 * Pure. The one action is "reset-statistics" (S10/S11, after the confirm dialog): it clears
 * this section only. When a second action arrives, switch over action.type as the other
 * reducers do.
 */
export function statsReducer(state: StatsState, _action: StatsAction): StatsState {
  return { ...state, stats: DEFAULT_STATS };
}

/** Every stats action is a reset, so the backup slot is refreshed too (a reset must stick). */
export function statsActionRefreshesBackup(_action: StatsAction): boolean {
  return true;
}
