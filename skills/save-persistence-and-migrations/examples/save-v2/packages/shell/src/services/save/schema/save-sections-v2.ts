// packages/shell/src/services/save/schema/save-sections-v2.ts
import * as v from 'valibot';

import { SETTINGS_V1 } from '@e07/shell/services/save/schema/save-sections-v1.ts';

/** Text size in percent of the system size (spec: text scales up to 200 %). */
export const TEXT_SCALE = v.pipe(v.number(), v.integer(), v.minValue(100), v.maxValue(200));

/**
 * v2 changes only the settings section: a text size. Only CHANGED sections live in this file;
 * every other section stays the frozen v1 schema.
 */
export const SETTINGS_V2 = v.strictObject({ ...SETTINGS_V1.entries, textScale: TEXT_SCALE });
