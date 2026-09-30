// packages/shell/src/game-host/run-writer.test.ts
import { startGameSession } from '@e07/shell/game-host/game-session-reducer.ts';
import { createGameSessionStore } from '@e07/shell/game-host/game-session-store.ts';
import {
  createRunWriter,
  shouldWriteRun,
  writeRunForHome,
} from '@e07/shell/game-host/run-writer.ts';
import {
  COUNTER_PERSISTENCE,
  COUNTER_RULES,
  COUNTER_START,
} from '@e07/shell/testing/counter-game.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

import type { Counter } from '@e07/shell/testing/counter-game.ts';

const TURNS = { kind: 'after-every-move' } as const;
const SAVE_POINTS = { kind: 'save-points', points: ['wave-end', 'pause'] } as const;

describe('shouldWriteRun', () => {
  it.each([
    { action: { type: 'apply-move', move: 1 }, policy: TURNS, status: 'playing', isWrite: true },
    { action: { type: 'undo' }, policy: TURNS, status: 'playing', isWrite: true },
    { action: { type: 'use-hint' }, policy: TURNS, status: 'playing', isWrite: true },
    { action: { type: 'pause' }, policy: TURNS, status: 'paused', isWrite: true },
    { action: { type: 'resume' }, policy: TURNS, status: 'playing', isWrite: false },
    { action: { type: 'add-play-time', ms: 16 }, policy: TURNS, status: 'playing', isWrite: false },
    { action: { type: 'apply-move', move: 1 }, policy: TURNS, status: 'won', isWrite: false },
    {
      action: { type: 'apply-move', move: 1 },
      policy: SAVE_POINTS,
      status: 'playing',
      isWrite: false,
    },
    { action: { type: 'pause' }, policy: SAVE_POINTS, status: 'paused', isWrite: true },
  ] as const)(
    'decides $action.type under $policy.kind while $status: write $isWrite',
    ({ action, policy, status, isWrite }) => {
      expect(shouldWriteRun(action, policy, status)).toBe(isWrite);
    },
  );
});

describe('createRunWriter', () => {
  it('saves every move of a turn-based run to the current slot only', () => {
    const { save, readSlot } = createTestSave();
    const store = createGameSessionStore<Counter, number, string>({
      rules: COUNTER_RULES,
      initial: startGameSession(COUNTER_RULES, COUNTER_START),
      persist: createRunWriter(save, COUNTER_PERSISTENCE),
    });
    store.getState().dispatch({ type: 'apply-move', move: 3 });
    const run = readSlot('current').run;
    expect(run?.state).toStrictEqual({ n: 5 });
    expect(run?.log).toStrictEqual([{ kind: 'move', move: 3 }]);
    expect(run?.resumeOnLaunch).toBe(true);
    expect(readSlot('backup').run).toBeNull();
  });

  it('keeps the run but lands on Home after Pause -> Home', () => {
    const { save, readSlot } = createTestSave();
    const session = startGameSession(COUNTER_RULES, COUNTER_START);
    writeRunForHome(save, COUNTER_PERSISTENCE, session);
    expect(readSlot('current').run?.resumeOnLaunch).toBe(false);
  });
});
