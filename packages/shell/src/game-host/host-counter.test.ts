// packages/shell/src/game-host/host-counter.test.ts
// Spec S10: the game card writes each counter as the game declares it. hostCounterOf hands the
// screens the counter without its measure, and a best-of style only when the game names one, so
// every game that names none reads exactly as before.
import { hostCounterOf } from './host-counter.ts';

describe('hostCounterOf', () => {
  it('keeps the best-of style the game names', () => {
    expect(
      hostCounterOf({
        id: 'longest-snake',
        labelId: 'tally.stats.biggest',
        aggregate: 'max',
        bestOfStyle: 'plain',
      }),
    ).toStrictEqual({
      id: 'longest-snake',
      labelId: 'tally.stats.biggest',
      aggregate: 'max',
      bestOfStyle: 'plain',
    });
  });

  it('leaves the style out when the game names none', () => {
    const counter = hostCounterOf({
      id: 'adds',
      labelId: 'tally.stats.adds',
      aggregate: 'sum',
      bestOfStyle: undefined,
    });

    expect(counter).toStrictEqual({ id: 'adds', labelId: 'tally.stats.adds', aggregate: 'sum' });
    expect(counter).not.toHaveProperty('bestOfStyle');
  });
});
