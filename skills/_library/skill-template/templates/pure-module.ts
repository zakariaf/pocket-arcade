// __MODULE_SUMMARY__
// Pure and deterministic: no React, React Native, Expo or Shell imports, no clock and no Math.random().

export type __RANGE_TYPE__ = {
  readonly min: number;
  readonly max: number;
};

export function __FUNCTION_NAME__(value: number, range: __RANGE_TYPE__): number {
  if (range.min > range.max) {
    throw new RangeError(`min ${String(range.min)} is greater than max ${String(range.max)}`);
  }
  return Math.min(range.max, Math.max(range.min, value));
}
