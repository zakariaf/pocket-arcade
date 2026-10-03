// packages/shell/src/game-host/session-view-of.test.ts
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { entryFor, newSession, sessionRulesFor } from './open-session.ts';
import { sessionViewOf } from './session-view-of.ts';

const LEVEL_1 = { kind: 'level', level: 1 } as const;
const DEPS = {
  rules: sessionRulesFor(TALLY_GAME, LEVEL_1),
  gameRules: TALLY_GAME.rules,
  entry: entryFor(TALLY_GAME, LEVEL_1),
  isContinueAllowed: true,
};

function freshRun() {
  const session = newSession(TALLY_GAME, LEVEL_1, () => 1);
  if (session === null) throw new Error('no run');
  return session;
}

describe('sessionViewOf', () => {
  it('shows the played run as plain data', () => {
    const view = sessionViewOf(DEPS, freshRun(), { summary: null, hint: null, fixture: null });
    expect(view).toMatchObject({
      status: 'playing',
      ref: LEVEL_1,
      hud: { mode: LEVEL_1, goal: { kind: 'moves-par', moves: 0, par: 2 }, score: 0 },
      isUndoSupported: true,
      canUndo: false,
      isHintSupported: true,
      isHintShown: false,
      continueState: 'none',
    });
  });

  it('shows a fixture over the played run, field by field', () => {
    const hud = {
      mode: { kind: 'level', level: 12 },
      goal: { kind: 'moves-par', moves: 7, par: 7 },
      score: 1840,
    } as const;
    const extras = { summary: null, hint: null, fixture: { hud, status: 'paused' } } as const;
    expect(sessionViewOf(DEPS, freshRun(), extras)).toMatchObject({
      status: 'paused',
      ref: LEVEL_1,
      hud,
      moveCount: 0,
    });
  });
});
