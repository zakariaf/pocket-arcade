// apps/flock-tilt/src/rules/intent-to-move.test.ts
import { intentToMove } from './intent-to-move.ts';

import type { FlockTiltState } from './intent-to-move.ts';

/** 3 × 3 field, one sheep in the top-left corner, a wall to its right. */
const STATE: FlockTiltState = { cols: 3, rows: 3, walls: [0, 1, 0, 0, 0, 0, 0, 0, 0], sheep: [0] };

describe('flock tilt intentToMove', () => {
  it('tilts the field in the swiped direction', () => {
    expect(intentToMove(STATE, { kind: 'swipe', direction: 'down', from: null })).toStrictEqual({
      kind: 'tilt',
      direction: 'down',
    });
  });

  it('refuses a tilt that cannot move any sheep', () => {
    expect(intentToMove(STATE, { kind: 'swipe', direction: 'right', from: null })).toBeNull();
    expect(intentToMove(STATE, { kind: 'swipe', direction: 'up', from: null })).toBeNull();
  });

  it('ignores taps', () => {
    const target = { regionId: 'board', col: 0, row: 0 };
    expect(intentToMove(STATE, { kind: 'tap', target, selected: null })).toBeNull();
  });
});
