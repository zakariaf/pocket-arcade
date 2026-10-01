// A default export in a comment is ignored: export default clampValue;

export type ClampRange = {
  readonly min: number;
  readonly max: number;
};

export function clampValue(value: number, range: ClampRange): number {
  return Math.min(range.max, Math.max(range.min, value));
}
