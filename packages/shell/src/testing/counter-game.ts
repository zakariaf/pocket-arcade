// packages/shell/src/testing/counter-game.ts
// A tiny game for session tests: the state is a number, a move adds to it,
// 10 or more wins, below 0 loses. One continue resets to 0.
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';
import type { SessionRules, SessionStart } from '@e07/shell/game-host/game-session-types.ts';

export type Counter = { readonly n: number };

export const COUNTER_RULES: SessionRules<Counter, number, string> = {
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

const isCounter = (json: unknown): json is Counter =>
  typeof json === 'object' && json !== null && 'n' in json && typeof json.n === 'number';

export const COUNTER_PERSISTENCE: PersistenceSpec<Counter, number> = {
  stateVersion: 1,
  parseState: (json) => (isCounter(json) ? { n: json.n } : null),
  parseMove: (json) => (typeof json === 'number' ? json : null),
  migrateState: () => null,
  savePolicy: { kind: 'after-every-move' },
};

export const COUNTER_START: SessionStart = {
  ref: { kind: 'level', level: 1 },
  seed: 2,
  difficulty: 10,
};
