// packages/shell/src/services/save/schema/save-primitives.ts
import * as v from 'valibot';

/** Non-negative safe integer: counts, milliseconds, scores. */
export const COUNT = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
export const PERCENT = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100));
export const UINT32 = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4_294_967_295));
export const DIFFICULTY = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100));
export const LEVEL_NUMBER = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(9999));
export const STARS = v.picklist([1, 2, 3]);

/** Local calendar day 'YYYY-MM-DD' (ClockPort.today()). */
export const DATE_KEY = v.pipe(
  v.string(),
  v.regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/),
);

/** Record keys are strings in JSON: level numbers as '1'..'9999'. */
export const LEVEL_KEY = v.pipe(v.string(), v.regex(/^[1-9]\d{0,3}$/));

/** kebab-case identifiers: game ids, counter ids. */
export const KEBAB_ID = v.pipe(v.string(), v.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/));
