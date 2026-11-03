// packages/shell/src/game-host/create-memo.test.ts
import fc from 'fast-check';

import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { CREATE_MEMO_SIZE, memoizeCreate, withCreateMemo } from './create-memo.ts';
import { createGameHost } from './game-host.ts';

import type { GameHost, GameHostDeps } from './game-host.ts';
import type { TestSave } from '@e07/shell/testing/create-test-save.ts';

const LEVEL_1 = { kind: 'level', level: 1 } as const;

/** A start state that records its own seed and difficulty. */
const startOf = (seed: number, difficulty: number) => ({ seed, difficulty });

describe('memoizeCreate', () => {
  it('builds each (seed, difficulty) once and hands the same state out again', () => {
    const create = jest.fn(startOf);
    const memo = memoizeCreate(create);
    const first = memo(7, 3);
    expect(memo(7, 3)).toBe(first);
    expect(memo(7, 4)).toStrictEqual({ seed: 7, difficulty: 4 });
    expect(memo(8, 3)).toStrictEqual({ seed: 8, difficulty: 3 });
    expect(create.mock.calls).toStrictEqual([
      [7, 3],
      [7, 4],
      [8, 3],
    ]);
  });

  it('keeps the most recently asked starts and builds an older one again', () => {
    const create = jest.fn(startOf);
    const memo = memoizeCreate(create);
    for (let seed = 0; seed < CREATE_MEMO_SIZE; seed += 1) memo(seed, 0);
    memo(0, 0);
    memo(CREATE_MEMO_SIZE, 0);
    create.mockClear();
    memo(0, 0);
    expect(create).not.toHaveBeenCalled();
    memo(1, 0);
    expect(create.mock.calls).toStrictEqual([[1, 0]]);
  });

  it('answers every sequence of asks exactly as create does', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.nat({ max: 12 }), fc.nat({ max: 3 })), { maxLength: 40 }),
        (asks) => {
          const memo = memoizeCreate(startOf);
          const answers = asks.map(([seed, difficulty]) => memo(seed, difficulty));
          expect(answers).toStrictEqual(
            asks.map(([seed, difficulty]) => startOf(seed, difficulty)),
          );
        },
      ),
    );
  });
});

describe('withCreateMemo', () => {
  it('changes only the engine create of the module', () => {
    const shared = withCreateMemo(TALLY_GAME);
    expect(shared.engine.create).not.toBe(TALLY_GAME.engine.create);
    expect({
      ...shared,
      engine: { ...shared.engine, create: TALLY_GAME.engine.create },
    }).toStrictEqual(TALLY_GAME);
    expect(shared.engine.create(5, 2)).toStrictEqual(TALLY_GAME.engine.create(5, 2));
  });
});

/** The tally game whose create the test counts. */
function countedHost(test: TestSave, create: jest.Mock): GameHost {
  const game = { ...TALLY_GAME, engine: { ...TALLY_GAME.engine, create } };
  const deps: GameHostDeps = {
    save: test.save,
    clock: TEST_CLOCK,
    errorLog: { record: jest.fn(), entries: () => [] },
    isContinueAllowed: true,
    createBoardHost: () => () => null,
    writeRunEnd: (write) => {
      test.save.update(write.recipe, { refreshBackup: write.refreshBackup });
    },
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
  };
  return createGameHost(game, deps);
}

/** Taps column 1 (adds 2) on level 1 of the tally game (target 4): two taps win it. */
function addTwos(host: GameHost, open: Parameters<GameHost['openSession']>[0], taps: number): void {
  const handle = host.openSession(open)?.handle;
  if (handle === undefined) throw new Error('session did not open');
  if (open.start === 'resume') handle.send({ type: 'resume' });
  for (let tap = 0; tap < taps; tap += 1) {
    handle.send({
      type: 'intent',
      intent: { kind: 'tap', target: { regionId: 'board', col: 1, row: 0 }, selected: null },
    });
  }
}

describe('a host run', () => {
  it('builds a level once for its start, its run end and a retry of the same level', () => {
    const test = createTestSave();
    const create = jest.fn(TALLY_GAME.engine.create);
    const host = countedHost(test, create);
    addTwos(host, { start: 'new', ref: LEVEL_1 }, 2);
    addTwos(host, { start: 'new', ref: LEVEL_1 }, 2);
    expect(test.readSlot('current').progress.levels['1']).toMatchObject({ completions: 2 });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('builds a saved run once for its boot check, its resume and its run end', () => {
    const test = createTestSave();
    addTwos(
      countedHost(test, jest.fn(TALLY_GAME.engine.create)),
      { start: 'new', ref: LEVEL_1 },
      1,
    );
    const create = jest.fn(TALLY_GAME.engine.create);
    const relaunched = countedHost(test, create);
    addTwos(relaunched, { start: 'resume' }, 1);
    expect(test.readSlot('current').progress.levels['1']).toMatchObject({ completions: 1 });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
