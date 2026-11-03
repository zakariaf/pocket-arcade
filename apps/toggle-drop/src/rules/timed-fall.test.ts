// apps/toggle-drop/src/rules/timed-fall.test.ts
import fc from 'fast-check';

import { STEP_MS } from '@e07/game-kit/timeline/fixed-step.ts';

import { CELL_UNITS, FALL_PER_TICK, MAX_TICKS, fallMark } from './timed-fall.ts';

const colArb = fc.integer({ min: 0, max: 8 });
const lineArb = fc.integer({ min: 0, max: 10 });

describe('fallMark', () => {
  // Spec 13 (toggle-drop): "the drop is simulated inside the move and replayed".
  it('puts the ball in the middle of its column on each line, in whole fixed steps', () => {
    const marks = [fallMark(1, 0), fallMark(1, 1), fallMark(2, 2), fallMark(1, 3)];
    expect(marks).toStrictEqual(GOLDEN_BOARD_DROP_1);
  });

  it('stops the clock at MAX_TICKS, far below any board', () => {
    const lastLine = (MAX_TICKS * FALL_PER_TICK) / CELL_UNITS;
    expect(fallMark(0, lastLine).atMs).toBe(Math.round(MAX_TICKS * STEP_MS));
    expect(fallMark(0, lastLine + 5)).toStrictEqual({
      x: 60,
      y: (lastLine + 5) * CELL_UNITS,
      atMs: Math.round(MAX_TICKS * STEP_MS),
    });
  });

  it('reaches the next line one row lower, at most one column aside, never faster (property)', () => {
    fc.assert(
      fc.property(colArb, fc.integer({ min: -1, max: 1 }), lineArb, (col, aside, line) => {
        const from = fallMark(col, line);
        const to = fallMark(col + aside, line + 1);
        const reach = FALL_PER_TICK * Math.round((to.atMs - from.atMs) / STEP_MS);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        expect(dy).toBe(CELL_UNITS);
        expect(dx * dx + dy * dy).toBeLessThanOrEqual(2 * reach * reach);
      }),
    );
  });

  it('times every mark in whole milliseconds inside the board (property)', () => {
    fc.assert(
      fc.property(colArb, lineArb, (col, line) => {
        const mark = fallMark(col, line);
        expect(Number.isInteger(mark.atMs)).toBe(true);
        expect(mark.x).toBeGreaterThan(col * CELL_UNITS);
        expect(mark.x).toBeLessThan((col + 1) * CELL_UNITS);
      }),
    );
  });
});

/** The drop of column 1 on the 3 x 2 board of drop-path.test: right at row 0, left at row 1. */
const GOLDEN_BOARD_DROP_1 = [
  { x: 180, y: 0, atMs: 0 },
  { x: 180, y: 120, atMs: 167 },
  { x: 300, y: 240, atMs: 333 },
  { x: 180, y: 360, atMs: 500 },
];
