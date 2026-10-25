// apps/flock-tilt/src/board/to-view.test.ts
import { parseField } from '@e07/flock-tilt/rules/field-text.ts';
import { TUNING } from '@e07/flock-tilt/rules/flock-tilt-tuning.ts';

import { toView } from './to-view.ts';

import type { FlockTiltState } from '@e07/flock-tilt/rules/flock-tilt-types.ts';

const FIELD = parseField(['s.#.o', '.s...', 'w....']);
const STATE: FlockTiltState = {
  ...FIELD,
  sheep: [
    { id: 0, cell: 4, status: 'penned' },
    { id: 1, cell: 6, status: 'field' },
  ],
  tilts: 3,
  tiltLimit: TUNING.tiltLimit,
  par: 4,
  hasContinued: false,
  beforeLoss: null,
};
const PERSIAN = { formatNumber: (value: number) => new Intl.NumberFormat('fa').format(value) };

describe('toView', () => {
  it('keeps the field, the flock with their places, and localises the penned count (spec 7.3)', () => {
    expect(toView(STATE, PERSIAN)).toStrictEqual({
      cols: 5,
      rows: 3,
      rocks: [2],
      pen: 4,
      sheep: STATE.sheep,
      wolves: [{ id: 0, cell: 10 }],
      pennedText: '۱',
      pennedCount: 1,
    });
  });

  it('gives the same view for the same state (a pure function)', () => {
    expect(toView(STATE, { formatNumber: String })).toStrictEqual(
      toView(STATE, { formatNumber: String }),
    );
    expect(toView(STATE, { formatNumber: String }).pennedText).toBe('1');
  });
});
