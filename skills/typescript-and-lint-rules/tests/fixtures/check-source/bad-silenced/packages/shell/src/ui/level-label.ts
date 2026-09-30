// packages/shell/src/ui/level-label.ts
/** Formats a level label. */
export function levelLabel(level: number): string {
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  // @ts-ignore
  return `Level ${level}`;
}

// @ts-expect-error: x
export const WRONG: number = "a";

// TODO: translate this label
