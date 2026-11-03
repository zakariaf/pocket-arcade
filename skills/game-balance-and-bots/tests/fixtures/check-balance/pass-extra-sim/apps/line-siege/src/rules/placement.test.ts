// apps/line-siege/src/rules/placement.test.ts
import fc from 'fast-check';

import { create } from './create.ts';
import { fittingMoves, hasAnyMove } from './placement.ts';

import type { Cell, LineSiegeState } from './line-siege-types.ts';

function onlyFree(state: LineSiegeState, free: readonly number[]): LineSiegeState {
  const cells = state.cells.map((_, index): Cell => (free.includes(index) ? 0 : 1));
  return { ...state, cells };
}

describe('hasAnyMove', () => {
  it('finds a fitting block even when the tray holds used slots', () => {
    expect(hasAnyMove(onlyFree({ ...create(1, 0), tray: [null, 0, null] }, [63]))).toBe(true);
  });

  it('finds nothing when no offered block fits', () => {
    expect(hasAnyMove(onlyFree({ ...create(1, 0), tray: [5, null, 5] }, [0, 63]))).toBe(false);
  });

  it('agrees with fittingMoves on random boards and trays', () => {
    const slotArb = fc.option(fc.integer({ min: 0, max: 9 }), { nil: null });
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 63 }), { maxLength: 12 }),
        fc.tuple(slotArb, slotArb, slotArb),
        (free, tray) => {
          const state = onlyFree({ ...create(2, 0), tray }, free);
          expect(hasAnyMove(state)).toBe(fittingMoves(state).length > 0);
        },
      ),
    );
  });

  it('keeps the pinned fitting count of a crowded board', () => {
    const crowded = onlyFree({ ...create(1, 0), tray: [0, 1, 2] }, [0, 1, 8, 9, 30]);
    expect(fittingMoves(crowded)).toHaveLength(GOLDEN_CROWDED_FITS);
  });
});

const GOLDEN_CROWDED_FITS = 9;
