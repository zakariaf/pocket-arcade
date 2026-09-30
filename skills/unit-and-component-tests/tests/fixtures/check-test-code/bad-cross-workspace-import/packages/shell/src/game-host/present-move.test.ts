import { sampleTimeline } from '../../../game-kit/src/timeline/sample.ts';

import { presentMove } from './present-move.ts';

describe('presentMove', () => {
  it('pushes the final view', () => {
    expect(presentMove(sampleTimeline([], 0))).toBeDefined();
  });
});
