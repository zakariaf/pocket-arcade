// packages/shell/src/game-host/measure-counters.test.ts
import { gameSessionReducer, startGameSession } from '@e07/shell/game-host/game-session-reducer.ts';
import { COUNTER_RULES, COUNTER_START } from '@e07/shell/testing/counter-game.ts';

import { measureCounters } from './measure-counters.ts';

import type { CounterSpec } from '@e07/game-kit/contract/stats.ts';

const COUNTERS: readonly CounterSpec<string>[] = [
  {
    id: 'moves',
    labelId: 'test.stats.moves',
    aggregate: 'sum',
    measure: (events) => events.length,
  },
  {
    id: 'rescues',
    labelId: 'test.stats.rescues',
    aggregate: 'max',
    measure: (events) => events.filter((event) => event === 'continued').length,
  },
];

describe('measureCounters', () => {
  it('folds each counter over the kept move line and ignores undone moves', () => {
    let session = startGameSession(COUNTER_RULES, COUNTER_START);
    for (const action of [
      { type: 'apply-move', move: 3 },
      { type: 'apply-move', move: 1 },
      { type: 'undo' },
    ] as const) {
      session = gameSessionReducer(COUNTER_RULES, session, action);
    }
    expect(measureCounters(COUNTER_RULES, session, COUNTERS)).toStrictEqual({
      moves: { value: 1, aggregate: 'sum' },
      rescues: { value: 0, aggregate: 'max' },
    });
  });

  it("replays the one continue through the game's own rescue", () => {
    const lost = gameSessionReducer(COUNTER_RULES, startGameSession(COUNTER_RULES, COUNTER_START), {
      type: 'apply-move',
      move: -5,
    });
    const rescued = gameSessionReducer(COUNTER_RULES, lost, { type: 'use-continue' });
    expect(measureCounters(COUNTER_RULES, rescued, COUNTERS)['rescues']).toStrictEqual({
      value: 1,
      aggregate: 'max',
    });
  });

  it('measures nothing for a game without counters', () => {
    expect(
      measureCounters(COUNTER_RULES, startGameSession(COUNTER_RULES, COUNTER_START), []),
    ).toStrictEqual({});
  });

  it('skips a logged continue for rules that have none', () => {
    const rules = { ...COUNTER_RULES, continueRun: { kind: 'none' } } as const;
    const session = { seed: 2, difficulty: 0, log: [{ kind: 'continue' }] } as const;
    expect(measureCounters(rules, session, COUNTERS)).toStrictEqual({
      moves: { value: 0, aggregate: 'sum' },
      rescues: { value: 0, aggregate: 'max' },
    });
  });
});
