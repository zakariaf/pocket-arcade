// packages/shell/src/game-host/open-session.test.ts
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { entryFor, newSession, resumeSession, sessionRulesFor, startFor } from './open-session.ts';
import { toSavedRun } from './saved-run.ts';

const SEED = (): number => 99;

function errorLog() {
  const recorded: string[] = [];
  return {
    port: {
      record: (_source: string, error: unknown) => {
        recorded.push(error instanceof Error ? error.message : String(error));
      },
      entries: () => [],
    },
    recorded,
  };
}

describe('startFor', () => {
  it('takes a level from the table, the daily from date and salt, endless from a fresh seed', () => {
    expect(startFor(TALLY_GAME, { kind: 'level', level: 2 }, SEED)).toMatchObject({
      seed: 2,
      difficulty: 2,
    });
    expect(startFor(TALLY_GAME, { kind: 'daily', date: '2026-09-28' }, SEED)?.difficulty).toBe(2);
    expect(startFor(TALLY_GAME, { kind: 'endless' }, SEED)).toStrictEqual({
      seed: 99,
      difficulty: 7,
    });
    expect(startFor(TALLY_GAME, { kind: 'tutorial' }, SEED)).toStrictEqual({
      seed: 0,
      difficulty: 0,
    });
  });

  it('has no start for a level outside the table or a mode the game lacks', () => {
    expect(startFor(TALLY_GAME, { kind: 'level', level: 99 }, SEED)).toBeNull();
    const noModes = {
      ...TALLY_GAME,
      levels: { ...TALLY_GAME.levels, daily: { kind: 'none' }, endless: { kind: 'none' } },
    } as const;
    expect(startFor(noModes, { kind: 'daily', date: '2026-09-28' }, SEED)).toBeNull();
    expect(startFor(noModes, { kind: 'endless' }, SEED)).toBeNull();
  });
});

describe('newSession', () => {
  it('starts the tutorial from the scripted tutorial state', () => {
    const session = newSession(TALLY_GAME, { kind: 'tutorial' }, SEED);
    expect(session?.state).toStrictEqual(TALLY_GAME.teaching.tutorial.start);
    expect(sessionRulesFor(TALLY_GAME, { kind: 'tutorial' }).create(5, 5)).toStrictEqual({
      count: 0,
      target: 3,
    });
  });

  it('starts a level playing, with its table entry', () => {
    const ref = { kind: 'level', level: 1 } as const;
    expect(newSession(TALLY_GAME, ref, SEED)?.status).toBe('playing');
    expect(entryFor(TALLY_GAME, ref)?.stars).toStrictEqual({ kind: 'par', par: 2 });
    expect(entryFor(TALLY_GAME, { kind: 'endless' })).toBeNull();
    expect(newSession(TALLY_GAME, { kind: 'level', level: 99 }, SEED)).toBeNull();
  });
});

describe('resumeSession', () => {
  const ref = { kind: 'level', level: 1 } as const;

  it('resumes a saved run paused', () => {
    const session = newSession(TALLY_GAME, ref, SEED);
    if (session === null) throw new Error('no session');
    const log = errorLog();
    expect(resumeSession(TALLY_GAME, toSavedRun(session, 1, true), log.port)?.status).toBe(
      'paused',
    );
    expect(log.recorded).toStrictEqual([]);
  });

  it('drops a run the game cannot read and says so in the error log', () => {
    const session = newSession(TALLY_GAME, ref, SEED);
    if (session === null) throw new Error('no session');
    const log = errorLog();
    const saved = { ...toSavedRun(session, 1, true), state: 'garbage' };
    expect(resumeSession(TALLY_GAME, saved, log.port)).toBeNull();
    expect(log.recorded).toStrictEqual(['saved run dropped: state-invalid']);
  });

  it('keeps the position but logs a replay that does not reproduce it', () => {
    const session = newSession(TALLY_GAME, ref, SEED);
    if (session === null) throw new Error('no session');
    const log = errorLog();
    const saved = {
      ...toSavedRun(session, 1, true),
      state: { count: 2, target: 4 },
      log: [{ kind: 'move', move: { kind: 'add', amount: 1 } }] as const,
    };
    expect(resumeSession(TALLY_GAME, saved, log.port)?.state).toStrictEqual({
      count: 2,
      target: 4,
    });
    expect(log.recorded).toStrictEqual([
      'saved run replay differs from its snapshot; undo history dropped',
    ]);
  });

  it('keeps the position when the replay throws, never crashing the boot (spec 8.14, N10)', () => {
    // spec 8.14: "recovers where possible ... never a crash loop": a changed rule set refuses a
    // logged move (RangeError); the snapshot is the truth, so only the undo history goes.
    const refusing: typeof TALLY_GAME = {
      ...TALLY_GAME,
      engine: {
        ...TALLY_GAME.engine,
        applyMove: () => {
          throw new RangeError('illegal move');
        },
      },
    };
    const session = newSession(refusing, ref, SEED);
    if (session === null) throw new Error('no session');
    const log = errorLog();
    const saved = {
      ...toSavedRun(session, 1, true),
      state: { count: 1, target: 4 },
      log: [{ kind: 'move', move: { kind: 'add', amount: 1 } }] as const,
    };
    let resumed: ReturnType<typeof resumeSession> = null;
    expect(() => {
      resumed = resumeSession(refusing, saved, log.port);
    }).not.toThrow();
    expect(resumed).toMatchObject({ state: { count: 1, target: 4 }, past: [], log: [] });
    expect(log.recorded).toStrictEqual([
      'illegal move',
      'saved run replay differs from its snapshot; undo history dropped',
    ]);
  });
  it('marks a run restored without its log after a refused replay (spec S10 counters)', () => {
    // The snapshot is the start position, so the empty log replays to it; the moves the player
    // kept before it are still unknown, so the run end must not measure counters.
    const refusing: typeof TALLY_GAME = {
      ...TALLY_GAME,
      engine: {
        ...TALLY_GAME.engine,
        applyMove: () => {
          throw new RangeError('illegal move');
        },
      },
    };
    const session = newSession(refusing, ref, SEED);
    if (session === null) throw new Error('no session');
    const saved = {
      ...toSavedRun(session, 1, true),
      log: [{ kind: 'move', move: { kind: 'add', amount: 1 } }] as const,
    };
    expect(resumeSession(refusing, saved, errorLog().port)).toMatchObject({
      state: { count: 0, target: 4 },
      hasPartialLog: true,
    });
  });

  it('drops the run alone when even its snapshot cannot be restored, never throwing', () => {
    const session = newSession(TALLY_GAME, ref, SEED);
    if (session === null) throw new Error('no session');
    const broken: typeof TALLY_GAME = {
      ...TALLY_GAME,
      engine: {
        ...TALLY_GAME.engine,
        create: () => {
          throw new RangeError('unknown seed');
        },
      },
    };
    const log = errorLog();
    expect(resumeSession(broken, toSavedRun(session, 1, true), log.port)).toBeNull();
    expect(log.recorded).toStrictEqual([
      'unknown seed',
      'unknown seed',
      'saved run dropped: state-invalid',
    ]);
  });
});
