// packages/shell/src/game-host/saved-run.test.ts
import { gameSessionReducer, startGameSession } from '@e07/shell/game-host/game-session-reducer.ts';
import { restoreRun, toSavedRun } from '@e07/shell/game-host/saved-run.ts';
import {
  COUNTER_PERSISTENCE,
  COUNTER_RULES,
  COUNTER_START,
} from '@e07/shell/testing/counter-game.ts';

import type { GameSession } from '@e07/shell/game-host/game-session-types.ts';
import type { Counter } from '@e07/shell/testing/counter-game.ts';

function played(moves: readonly number[]): GameSession<Counter, number, string> {
  return moves.reduce(
    (session, move) => gameSessionReducer(COUNTER_RULES, session, { type: 'apply-move', move }),
    startGameSession(COUNTER_RULES, COUNTER_START),
  );
}

describe('saved run', () => {
  it('restores a saved run paused, with its undo history rebuilt from the log', () => {
    const session = played([3, 1]);
    const restored = restoreRun(COUNTER_RULES, COUNTER_PERSISTENCE, toSavedRun(session, 1, true));
    if (restored.kind !== 'restored') throw new Error('expected a restored run');
    expect(restored.session.status).toBe('paused');
    expect(restored.session.state).toStrictEqual({ n: 6 });
    expect(restored.session.past).toStrictEqual([{ n: 2 }, { n: 5 }]);
    expect(restored.hasHistory).toBe(true);
  });

  it('keeps the snapshot and drops only the history when the replay disagrees', () => {
    const saved = { ...toSavedRun(played([3]), 1, true), state: { n: 7 } };
    const restored = restoreRun(COUNTER_RULES, COUNTER_PERSISTENCE, saved);
    if (restored.kind !== 'restored') throw new Error('expected a restored run');
    expect(restored.session.state).toStrictEqual({ n: 7 });
    expect(restored.session.past).toStrictEqual([]);
    expect(restored.hasHistory).toBe(false);
  });

  it('drops a run whose state the game cannot parse', () => {
    const saved = { ...toSavedRun(played([3]), 1, true), state: 'garbage' };
    expect(restoreRun(COUNTER_RULES, COUNTER_PERSISTENCE, saved)).toStrictEqual({
      kind: 'dropped',
      reason: 'state-invalid',
    });
  });

  it('drops a run from an older state version the game cannot migrate', () => {
    const saved = toSavedRun(played([3]), 1, true);
    const newerGame = { ...COUNTER_PERSISTENCE, stateVersion: 2 };
    expect(restoreRun(COUNTER_RULES, newerGame, saved)).toStrictEqual({
      kind: 'dropped',
      reason: 'state-not-migratable',
    });
  });
});
