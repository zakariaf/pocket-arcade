// packages/shell/src/game-host/game-session-properties.test.ts
import fc from 'fast-check';

import { gameSessionReducer, startGameSession } from '@e07/shell/game-host/game-session-reducer.ts';
import { restoreRun, toSavedRun } from '@e07/shell/game-host/saved-run.ts';
import {
  COUNTER_PERSISTENCE,
  COUNTER_RULES,
  COUNTER_START,
} from '@e07/shell/testing/counter-game.ts';

import type { GameSession, SessionRules } from '@e07/shell/game-host/game-session-types.ts';
import type { Counter } from '@e07/shell/testing/counter-game.ts';

type CounterSession = GameSession<Counter, number, string>;

const UNLIMITED: SessionRules<Counter, number, string> = {
  ...COUNTER_RULES,
  undo: { kind: 'unlimited' },
};

// Counter values the run passes through, each between 0 and 9, so the run stays 'playing'.
const VALUES = fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 30 });

function movesThrough(values: readonly number[]): readonly number[] {
  return values.map((value, index) => value - (values[index - 1] ?? COUNTER_START.seed));
}

function play(
  rules: SessionRules<Counter, number, string>,
  moves: readonly number[],
): CounterSession {
  return moves.reduce<CounterSession>(
    (session, move) => gameSessionReducer(rules, session, { type: 'apply-move', move }),
    startGameSession(rules, COUNTER_START),
  );
}

function undoTimes(
  rules: SessionRules<Counter, number, string>,
  session: CounterSession,
  times: number,
): CounterSession {
  let undone = session;
  for (let index = 0; index < times; index += 1)
    undone = gameSessionReducer(rules, undone, { type: 'undo' });
  return undone;
}

describe('game session properties', () => {
  it('returns the state k moves earlier after k undos (spec 8.5: "Undo steps back one move")', () => {
    fc.assert(
      fc.property(VALUES, fc.nat(), (values, pick) => {
        const k = pick % (values.length + 1);
        const session = play(UNLIMITED, movesThrough(values));
        const earlier = values[values.length - k - 1] ?? COUNTER_START.seed;

        expect(undoTimes(UNLIMITED, session, k).state).toStrictEqual({ n: earlier });
      }),
    );
  });

  it('restores a saved run with its history and the same state (spec 8.6)', () => {
    fc.assert(
      fc.property(VALUES, (values) => {
        const session = play(COUNTER_RULES, movesThrough(values));
        const restored = restoreRun(
          COUNTER_RULES,
          COUNTER_PERSISTENCE,
          toSavedRun(session, 1, true),
        );

        expect(restored).toMatchObject({ kind: 'restored', hasHistory: true });
        expect(restored.kind === 'restored' && restored.session.state).toStrictEqual(session.state);
      }),
    );
  });

  it('gives { n: 3 } after moves 1, 2, 1 and two undos from the counter start', () => {
    const session = undoTimes(UNLIMITED, play(UNLIMITED, [1, 2, 1]), 2);

    expect(session.state).toStrictEqual({ n: 3 });
  });
});
