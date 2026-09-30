export type ClampRange = {
  readonly min: number;
  readonly max: number;
};

export default function clampValue(value: number, range: ClampRange): number {
  return Math.min(range.max, Math.max(range.min, value));
}
