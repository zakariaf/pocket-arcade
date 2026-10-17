// packages/shell/src/ui/font-scale-curve.ts
// The size a phone draws a text size at (spec 8.11: up to 200 %). iOS and Android before 14 scale
// linearly. Android 14 (API 34) and later scale sp values along curves: React Native turns every
// fontSize and lineHeight into pixels through TypedValue.applyDimension(COMPLEX_UNIT_SP)
// (PixelUtil.toPixelFromSP), which runs FontScaleConverterFactory.forScale(fontScale). So at 200 %
// a 36.25 sp line is drawn 43.5 dp tall, not 72.5 (E18-T25: the hero key kept an empty band under
// its label). This is a port of AOSP frameworks/base core/java/android/content/res/
// FontScaleConverterFactory.java and FontScaleConverterImpl.java as the Android SDK's API 35
// sources ship them (sources/android-35, revision 1): the same tables, keys, interpolation and
// linear fallbacks. API 34 shipped the 1.15 to 2.0 tables with the same values.

/** Text grows with Dynamic Type up to 200 % and no further (spec 8.11): maxFontSizeMultiplier. */
export const MAX_TEXT_SCALE = 2;

/** The sp sizes every table converts (FontScaleConverterFactory's commonSpSizes). */
const TABLE_SP: readonly number[] = [8, 10, 12, 14, 18, 20, 24, 30, 100];

/** Scale key (fontScale x 100) -> the dp each TABLE_SP size is drawn at. */
const TABLES: ReadonlyMap<number, readonly number[]> = new Map([
  [105, [8.4, 10.5, 12.6, 14.8, 18.6, 20.6, 24.4, 30, 100]],
  [110, [8.8, 11, 13.2, 15.6, 19.2, 21.2, 24.8, 30, 100]],
  [115, [9.2, 11.5, 13.8, 16.4, 19.8, 21.8, 25.2, 30, 100]],
  [120, [9.6, 12, 14.4, 17.2, 20.4, 22.4, 25.6, 30, 100]],
  [130, [10.4, 13, 15.6, 18.8, 21.6, 23.6, 26.4, 30, 100]],
  [150, [12, 15, 18, 22, 24, 26, 28, 30, 100]],
  [180, [14.4, 18, 21.6, 24.4, 27.6, 30.8, 32.8, 34.8, 100]],
  [200, [16, 20, 24, 26, 30, 34, 36, 38, 100]],
]);

const KEYS: readonly number[] = [...TABLES.keys()];

/** Curves apply from the first key less 0.01 (sMinScaleBeforeCurvesApplied). */
const MIN_CURVED_SCALE = (KEYS[0] ?? 0) / 100 - 0.01;

/** Java's (int) (fontScale * 100f), in float32 as the platform computes it. */
function keyOf(fontScale: number): number {
  return Math.trunc(Math.fround(Math.fround(fontScale) * 100));
}

type Point = readonly [sp: number, dp: number];

/** The segment `sp` falls in: from (0, 0) below the first point. */
function segmentOf(sp: number, points: readonly Point[]): readonly [Point, Point] {
  const upper = Math.max(
    0,
    points.findIndex(([pointSp]) => pointSp >= sp),
  );
  const end = points[upper] ?? [sp, sp];
  return [points[upper - 1] ?? [0, 0], end];
}

/** FontScaleConverterImpl.lookupAndInterpolate, sp to dp, for a size of 0 or more. */
function lookup(sp: number, fromSp: readonly number[], toDp: readonly number[]): number {
  const points = fromSp.map((value, index): Point => [value, toDp[index] ?? value]);
  const [lastSp, lastDp] = points.at(-1) ?? [1, 1];
  // Past the table: the last pair's ratio, linearly.
  if (sp >= lastSp) return sp * (lastDp / lastSp);
  const [[startSp, startDp], [endSp, endDp]] = segmentOf(sp, points);
  if (endSp === sp) return endDp;
  return startDp + ((sp - startSp) / (endSp - startSp)) * (endDp - startDp);
}

/** FontScaleConverterFactory.forScale: a table, two interpolated, or null for linear scaling. */
function tableFor(fontScale: number): readonly number[] | null {
  const key = keyOf(fontScale);
  const exact = TABLES.get(key);
  if (exact !== undefined) return exact;
  const higher = KEYS.findIndex((candidate) => candidate > key);
  if (higher <= 0) return null;
  const startKey = KEYS[higher - 1] ?? 0;
  const endKey = KEYS[higher] ?? 0;
  const start = TABLES.get(startKey) ?? TABLE_SP;
  const end = TABLES.get(endKey) ?? TABLE_SP;
  const point = Math.min(
    1,
    Math.max(0, (fontScale - startKey / 100) / ((endKey - startKey) / 100)),
  );
  return TABLE_SP.map((sp) => {
    const startDp = lookup(sp, TABLE_SP, start);
    return startDp + (lookup(sp, TABLE_SP, end) - startDp) * point;
  });
}

/** The dp Android 14+ draws `sp` at for the phone's font scale (before React Native's cap). */
export function androidSpToDp(sp: number, fontScale: number): number {
  if (fontScale < MIN_CURVED_SCALE) return sp * fontScale;
  const table = tableFor(fontScale);
  if (table === null) return sp * fontScale;
  return Math.sign(sp) * lookup(Math.abs(sp), TABLE_SP, table);
}

/**
 * The size a text size or line height is drawn at: linear (iOS, Android before 14) or along
 * Android's curve, capped at 200 % as maxFontSizeMultiplier caps it (toPixelFromSP's min).
 */
export function scaledSizeOf(size: number, fontScale: number, isCurved: boolean): number {
  if (!isCurved) return size * Math.min(fontScale, MAX_TEXT_SCALE);
  return Math.min(androidSpToDp(size, fontScale), size * MAX_TEXT_SCALE);
}

/** Android 14, the first release with FontScaleConverterFactory. */
const FIRST_CURVED_API = 34;

/** Android 14 (API 34) and later scale sp along the curves; iOS and older Android linearly. */
export function isCurvedScalingOn(os: string, version: unknown): boolean {
  return os === 'android' && typeof version === 'number' && version >= FIRST_CURVED_API;
}
