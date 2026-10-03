// packages/shell/src/game-host/game-session-reducer.test.ts
import { gameSessionReducer, startGameSession } from '@e07/shell/game-host/game-session-reducer.ts';

import type { SessionRules } from '@e07/shell/game-host/game-session-types.ts';

type Counter = { readonly n: number };

const RULES: SessionRules<Counter, number, string> = {
  create: (seed) => ({ n: seed }),
  applyMove: (state, move) => ({ state: { n: state.n + move }, events: ['added'] }),
  outcome: (state) => {
    if (state.n >= 10) return { kind: 'won', score: state.n };
    if (state.n < 0) return { kind: 'lost', reasonKey: 'test.lose.below-zero' };
    return { kind: 'playing' };
  },
  undo: { kind: 'limited', perLevel: 1 },
  continueRun: {
    kind: 'once',
    descriptionId: 'test.continue.reset',
    apply: () => ({ state: { n: 0 }, events: ['continued'] }),
  },
};
const START = { ref: { kind: 'level', level: 1 } as const, seed: 2, difficulty: 10 };

describe('gameSessionReducer', () => {
  it('applies a move, records it and remembers the previous state', () => {
    const next = gameSessionReducer(RULES, startGameSession(RULES, START), {
      type: 'apply-move',
      move: 3,
    });
    expect(next.state).toStrictEqual({ n: 5 });
    expect(next.past).toStrictEqual([{ n: 2 }]);
    expect(next.log).toStrictEqual([{ kind: 'move', move: 3 }]);
    expect(next.eventSeq).toBe(1);
  });

  it('undoes one move and then refuses beyond the per-level limit', () => {
    const played = [3, 1].reduce(
      (s, move) => gameSessionReducer(RULES, s, { type: 'apply-move', move }),
      startGameSession(RULES, START),
    );
    const once = gameSessionReducer(RULES, played, { type: 'undo' });
    expect(once.state).toStrictEqual({ n: 5 });
    expect(gameSessionReducer(RULES, once, { type: 'undo' })).toBe(once);
  });

  it('ignores moves while paused', () => {
    const paused = gameSessionReducer(RULES, startGameSession(RULES, START), { type: 'pause' });
    expect(gameSessionReducer(RULES, paused, { type: 'apply-move', move: 1 })).toBe(paused);
  });

  it('allows exactly one continue after a loss', () => {
    const lost = gameSessionReducer(RULES, startGameSession(RULES, START), {
      type: 'apply-move',
      move: -5,
    });
    expect(lost.status).toBe('lost');
    const continued = gameSessionReducer(RULES, lost, { type: 'use-continue' });
    expect(continued.status).toBe('playing');
    expect(continued.past).toStrictEqual([]);
    const lostAgain = gameSessionReducer(RULES, continued, { type: 'apply-move', move: -1 });
    expect(gameSessionReducer(RULES, lostAgain, { type: 'use-continue' })).toBe(lostAgain);
  });
});
