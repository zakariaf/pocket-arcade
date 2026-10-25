// apps/toggle-drop/src/levels/toggle-drop-describe.ts
// A level start as readable text for the data goldens: the balls, the switch rows ('<' and '>'
// switches, '.' none) and the cups under the columns (the balls each needs, '_' the gutter).
import type { ToggleDropState } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

const PEG_TEXT = { '-1': '.', '0': '<', '1': '>' } as const;

/** The golden text of a level start (the golden test adds the seed and the difficulty). */
export function describeLevel(state: ToggleDropState): string {
  const rows = Array.from({ length: state.rows }, (_, row) =>
    state.pegs
      .slice(row * state.cols, (row + 1) * state.cols)
      .map((peg) => PEG_TEXT[peg])
      .join(''),
  );
  const cups = state.needs.map((need) => (need === 0 ? '_' : String(need))).join('');
  return [`balls ${String(state.ballsLeft)}`, ...rows, cups].join('\n');
}
