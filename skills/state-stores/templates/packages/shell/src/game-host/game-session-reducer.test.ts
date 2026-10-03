// packages/shell/src/game-host/game-session-reducer.test.ts
import {
  canUndo,
  gameSessionReducer,
  startGameSession,
} from '@e07/shell/game-host/game-session-reducer.ts';

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

// spec 8.5: "Undo steps back one move (unlimited in puzzle games; the game can limit it)."
describe('gameSessionReducer boundaries', () => {
  const UNLIMITED: SessionRules<Counter, number, string> = {
    ...RULES,
    undo: { kind: 'unlimited' },
  };
  const play = (rules: SessionRules<Counter, number, string>, moves: readonly number[]) =>
    moves.reduce(
      (s, move) => gameSessionReducer(rules, s, { type: 'apply-move', move }),
      startGameSession(rules, START),
    );

  it('drops the undone move from the log and the counts, and moves the event sequence on', () => {
    const undone = gameSessionReducer(UNLIMITED, play(UNLIMITED, [3, 1]), { type: 'undo' });
    expect(undone).toMatchObject({
      state: { n: 5 },
      past: [{ n: 2 }],
      log: [{ kind: 'move', move: 3 }],
      moveCount: 1,
      undoCount: 1,
      lastEvents: [],
      eventSeq: 3,
      outcome: { kind: 'playing' },
    });
  });

  it('keeps every earlier move in the log when the last of three is undone', () => {
    const undone = gameSessionReducer(UNLIMITED, play(UNLIMITED, [3, 1, 2]), { type: 'undo' });
    expect(undone.log).toStrictEqual([
      { kind: 'move', move: 3 },
      { kind: 'move', move: 1 },
    ]);
  });

  it('allows undo only after a move of a playing run, as the policy says', () => {
    const moved = play(RULES, [1]);
    const paused = gameSessionReducer(RULES, moved, { type: 'pause' });
    const afterContinue = { ...moved, log: [...moved.log, { kind: 'continue' as const }] };
    expect(canUndo(RULES, startGameSession(RULES, START))).toBe(false);
    expect(canUndo(RULES, moved)).toBe(true);
    expect(canUndo(RULES, paused)).toBe(false);
    expect(canUndo(RULES, afterContinue)).toBe(false);
    expect(canUndo({ ...RULES, undo: { kind: 'none' } }, moved)).toBe(false);
    expect(canUndo(UNLIMITED, { ...moved, undoCount: 5 })).toBe(true);
  });

  it('offers no continue to a run that is still playing or whose game has none', () => {
    const playing = play(RULES, [1]);
    const lost = play(RULES, [-5]);
    const noContinue = { ...RULES, continueRun: { kind: 'none' as const } };
    expect(gameSessionReducer(RULES, playing, { type: 'use-continue' })).toBe(playing);
    expect(gameSessionReducer(noContinue, lost, { type: 'use-continue' })).toBe(lost);
  });

  it('pauses only a playing run and resumes only a paused one', () => {
    const lost = play(RULES, [-5]);
    const paused = gameSessionReducer(RULES, play(RULES, [1]), { type: 'pause' });
    expect(gameSessionReducer(RULES, lost, { type: 'pause' })).toBe(lost);
    expect(gameSessionReducer(RULES, paused, { type: 'resume' }).status).toBe('playing');
    expect(gameSessionReducer(RULES, lost, { type: 'resume' })).toBe(lost);
  });

  it('counts each hint and adds play time only while playing', () => {
    const hinted = [1, 2].reduce(
      (s) => gameSessionReducer(RULES, s, { type: 'use-hint' }),
      play(RULES, [1]),
    );
    const timed = gameSessionReducer(RULES, hinted, { type: 'add-play-time', ms: 250 });
    const paused = gameSessionReducer(RULES, timed, { type: 'pause' });
    expect([hinted.hintsUsed, timed.playMs]).toStrictEqual([2, 250]);
    expect(gameSessionReducer(RULES, paused, { type: 'add-play-time', ms: 99 })).toBe(paused);
  });
});
