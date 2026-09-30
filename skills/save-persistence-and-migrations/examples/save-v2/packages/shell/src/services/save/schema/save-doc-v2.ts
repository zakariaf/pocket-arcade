// packages/shell/src/services/save/schema/save-doc-v2.ts
import * as v from 'valibot';

import { SAVE_DOC_V1 } from '@e07/shell/services/save/schema/save-doc-v1.ts';
import { SETTINGS_V2 } from '@e07/shell/services/save/schema/save-sections-v2.ts';

/**
 * Save document v2. FROZEN once shipped: a change means save-doc-v3.ts, a v2 -> v3 migration
 * and new fixtures, never an edit here (spec N10).
 */
export const SAVE_DOC_V2 = v.strictObject({
  ...SAVE_DOC_V1.entries,
  schemaVersion: v.literal(2),
  settings: SETTINGS_V2,
});

export type SaveDocV2 = v.InferOutput<typeof SAVE_DOC_V2>;
