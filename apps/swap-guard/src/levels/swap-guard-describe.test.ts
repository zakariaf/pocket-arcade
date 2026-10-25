// apps/swap-guard/src/levels/swap-guard-describe.test.ts
import { describeLevel } from './swap-guard-describe.ts';

import type { SwapGuardState } from '@e07/swap-guard/rules/swap-guard-types.ts';

describe('describeLevel', () => {
  it('shows the swap budget, then the board row by row with the guard and every enemy', () => {
    const state: SwapGuardState = {
      size: 3,
      guard: 4,
      enemies: [
        { id: 0, kind: 'spear', facing: 'right', cell: 3 },
        { id: 1, kind: 'archer', facing: 'up', cell: 8 },
        { id: 2, kind: 'brute', facing: 'down', cell: 0 },
      ],
      enemyCount: 3,
      swaps: 0,
      maxSwaps: 7,
      score: 0,
      isHit: false,
      lastSwap: null,
      hasContinued: false,
    };
    expect(describeLevel(state)).toBe(['swaps 7', 'B..', 'rG.', '..U'].join('\n'));
  });
});
