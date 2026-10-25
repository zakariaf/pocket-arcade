// apps/toggle-drop/src/board/to-view.test.ts
import { create } from '@e07/toggle-drop/rules/create.ts';

import { toView } from './to-view.ts';

const PERSIAN = { formatNumber: (value: number) => '۰۱۲۳۴۵۶۷۸۹'.charAt(value) };

describe('toView', () => {
  // Spec 7.3: numbers on the board follow the chosen digits.
  it('carries the board and what each cup still needs, in the chosen digits', () => {
    const state = { ...create(1, 0), needs: [0, 2, 0, 1, 0], filled: [0, 1, 0, 1, 0] };
    const view = toView(state, PERSIAN);
    expect(view.needTexts).toStrictEqual(['', '۱', '', '', '']);
    expect([view.cols, view.rows]).toStrictEqual([5, 3]);
    expect(view.pegs).toBe(state.pegs);
    expect(view.filled).toStrictEqual([0, 1, 0, 1, 0]);
    expect(view.ballsLeft).toBe(state.ballsLeft);
  });

  it('carries what a cup needed before its last ball, shown while that ball still falls', () => {
    const state = { ...create(1, 0), needs: [0, 2, 0, 1, 2], filled: [0, 1, 0, 1, 0] };
    expect(toView(state, PERSIAN).pendingTexts).toStrictEqual(['', '۲', '', '۱', '']);
  });

  it('is a pure function of the state', () => {
    const state = create(4, 60);
    expect(toView(state, PERSIAN)).toStrictEqual(toView(state, PERSIAN));
  });
});
