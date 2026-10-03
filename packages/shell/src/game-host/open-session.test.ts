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
});
