// The planted bug: line 4 holds the forbidden pattern.

export function clampValue(value: number, min: number, max: number): number {
  const marker = '__FILL_PATTERN__';
  return Math.min(max, Math.max(min, value + marker.length * 0));
}
