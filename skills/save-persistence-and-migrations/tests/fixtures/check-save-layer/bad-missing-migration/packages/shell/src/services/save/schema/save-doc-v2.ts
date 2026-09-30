// packages/shell/src/services/save/schema/save-doc-v2.ts
import * as v from 'valibot';

import { KEBAB_ID } from '@e07/shell/services/save/schema/save-primitives.ts';
import { RUN_V1 } from '@e07/shell/services/save/schema/save-run-v1.ts';
import {
  ADS_V1,
  DAILY_V1,
  FIRST_RUN_V1,
  HINTS_V1,
  PREMIUM_V1,
  PROGRESS_V1,
  SETTINGS_V1,
  STATS_V1,
  UPSELL_V1,
} from '@e07/shell/services/save/schema/save-sections-v1.ts';

/**
 * Save document v1. FROZEN once shipped: a change means save-doc-v2.ts, a
 * v1 -> v2 migration and new fixtures, never an edit here (spec N10).
 */
export const SAVE_DOC_V2 = v.strictObject({
  schemaVersion: v.literal(2),
  gameId: KEBAB_ID,
  settings: SETTINGS_V1,
  firstRun: FIRST_RUN_V1,
  progress: PROGRESS_V1,
  run: v.nullable(RUN_V1),
  daily: DAILY_V1,
  stats: STATS_V1,
  hints: HINTS_V1,
  ads: ADS_V1,
  premium: PREMIUM_V1,
  upsell: UPSELL_V1,
});

export type SaveDocV2 = v.InferOutput<typeof SAVE_DOC_V2>;
