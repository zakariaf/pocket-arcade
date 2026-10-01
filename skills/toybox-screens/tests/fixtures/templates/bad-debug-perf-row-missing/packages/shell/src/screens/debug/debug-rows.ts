// packages/shell/src/screens/debug/debug-rows.ts
// Planted bug: the Performance group lost its Run save benchmark row.
// Pure: the fourteen S15 rows in design order. English in every language on purpose.
import type { ShellMessageKey } from '@e07/shell/i18n/messages.ts';
import type { IconTilePaint } from '@e07/shell/ui/icon-tile.tsx';
import type { IconName } from '@e07/shell/ui/icons/icon-paths.ts';

export type DebugAction =
  | 'jump-to-level'
  | 'unlock-all'
  | 'give-stars'
  | 'set-date'
  | 'show-state'
  | 'force-locale'
  | 'export-save'
  | 'import-save'
  | 'error-log'
  | 'font-test';
export type DebugSwitch = 'ads-always-test' | 'ads-never' | 'premium' | 'offline';
export type DebugValue = 'level' | 'date' | 'locale' | 'errors';

export type DebugRow = {
  readonly testID: string;
  readonly icon: IconName;
  readonly labelKey: ShellMessageKey;
  readonly iconPaint?: IconTilePaint;
  /** A chevron row runs an action; a switch row flips a test flag. */
  readonly action?: DebugAction;
  readonly switchId?: DebugSwitch;
  readonly value?: DebugValue;
};

export const DEBUG_ROWS: readonly DebugRow[] = [
  {
    testID: 'debug.jump-to-level-row',
    icon: 'grid',
    labelKey: 'debug.jump-to-level',
    action: 'jump-to-level',
    value: 'level',
  },
  {
    testID: 'debug.unlock-all-row',
    icon: 'lock',
    labelKey: 'debug.unlock-all',
    action: 'unlock-all',
  },
  {
    testID: 'debug.give-stars-row',
    icon: 'star-filled',
    labelKey: 'debug.give-stars',
    action: 'give-stars',
  },
  {
    testID: 'debug.set-date-row',
    icon: 'calendar',
    labelKey: 'debug.set-date',
    action: 'set-date',
    value: 'date',
  },
  {
    testID: 'debug.show-state-row',
    icon: 'doc',
    labelKey: 'debug.show-state',
    action: 'show-state',
  },
  {
    testID: 'debug.ads-always-test-switch',
    icon: 'ad',
    labelKey: 'debug.ads-always-test',
    switchId: 'ads-always-test',
  },
  {
    testID: 'debug.ads-never-switch',
    icon: 'close',
    labelKey: 'debug.ads-never',
    switchId: 'ads-never',
  },
  {
    testID: 'debug.premium-switch',
    icon: 'crown',
    iconPaint: 'gold',
    labelKey: 'debug.premium-toggle',
    switchId: 'premium',
  },
  {
    testID: 'debug.force-locale-row',
    icon: 'globe',
    labelKey: 'debug.force-locale',
    action: 'force-locale',
    value: 'locale',
  },
  {
    testID: 'debug.offline-switch',
    icon: 'wifi-off',
    labelKey: 'debug.offline',
    switchId: 'offline',
  },
  {
    testID: 'debug.export-save-row',
    icon: 'forward',
    labelKey: 'debug.export-save',
    action: 'export-save',
  },
  {
    testID: 'debug.import-save-row',
    icon: 'back',
    labelKey: 'debug.import-save',
    action: 'import-save',
  },
  {
    testID: 'debug.error-log-row',
    icon: 'alert',
    labelKey: 'debug.error-log',
    action: 'error-log',
    value: 'errors',
  },
  { testID: 'debug.font-test-row', icon: 'hash', labelKey: 'debug.font-test', action: 'font-test' },
];

/** The Performance group's rows (test builds; the design draws no such group): see DEBUG_PERF_ROWS. */
export type DebugPerfRowId = 'record' | 'share' | 'benchmark';

export type DebugPerfRow = {
  readonly id: DebugPerfRowId;
  readonly testID: string;
  readonly icon: IconName;
  readonly labelKey: ShellMessageKey;
};

/**
 * Debug menu > Performance, below the design's fourteen rows and the network counter, in this
 * order: the switch that records frame times, Share performance report, Run save benchmark. Their
 * testIDs are the screen map's S15 entries the design does not draw (check-screens debug-perf-rows).
 */
export const DEBUG_PERF_ROWS: readonly DebugPerfRow[] = [
  { id: 'record', testID: 'debug.perf-record-switch', icon: 'motion', labelKey: 'debug.perf.record' },
  { id: 'share', testID: 'debug.perf-share-row', icon: 'forward', labelKey: 'debug.perf.share' },
];
