// packages/shell/src/game-host/game-session-store.test.ts
import { startGameSession } from '@e07/shell/game-host/game-session-reducer.ts';
import { createGameSessionStore } from '@e07/shell/game-host/game-session-store.ts';
import { COUNTER_RULES, COUNTER_START } from '@e07/shell/testing/counter-game.ts';

import type { GameSessionStore } from '@e07/shell/game-host/game-session-store.ts';
import type { Counter } from '@e07/shell/testing/counter-game.ts';

type Setup = {
  readonly calls: string[];
  readonly store: GameSessionStore<Counter, number, string>;
};

/** Records the order of persist and publish calls. */
function setup(): Setup {
  const calls: string[] = [];
  const store = createGameSessionStore<Counter, number, string>({
    rules: COUNTER_RULES,
    initial: startGameSession(COUNTER_RULES, COUNTER_START),
    persist: (session, action) => {
      calls.push(`persist ${action.type} n=${String(session.state.n)}`);
    },
  });
  store.subscribe((state) => {
    calls.push(`publish n=${String(state.session.state.n)}`);
  });
  return { calls, store };
}

describe('game session store', () => {
  it('persists a move before it publishes (and so before the board animates)', () => {
    const { calls, store } = setup();
    store.getState().dispatch({ type: 'apply-move', move: 3 });
    expect(calls).toStrictEqual(['persist apply-move n=5', 'publish n=5']);
  });

  it('ignores an action that changes nothing: no persist, no publish', () => {
    const { calls, store } = setup();
    store.getState().dispatch({ type: 'resume' });
    store.getState().dispatch({ type: 'undo' });
    expect(calls).toStrictEqual([]);
  });
});
