// packages/shell/src/game-host/session-controller.test.ts
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { entryFor, newSession, sessionRulesFor } from './open-session.ts';
import { createSessionController } from './session-controller.ts';

import type { ControllerDeps } from './session-controller.ts';
import type { TallyEvent, TallyMove, TallyState } from '@e07/shell/testing/tally-game.ts';

type Deps = ControllerDeps<TallyState, TallyMove, TallyEvent>;

const LEVEL_1 = { kind: 'level', level: 1 } as const;
/** Level 1 of the tally game: reach exactly 4; column 0 adds 1, column 1 adds 2. */
const tap = (col: number) =>
  ({
    type: 'intent',
    intent: { kind: 'tap', target: { regionId: 'board', col, row: 0 }, selected: null },
  }) as const;

/** A controller for level 1 built the way createGameHost builds it, with recording ports. */
function controllerFor(extra: Partial<Deps> = {}) {
  const { save } = createTestSave();
  const order: string[] = [];
  const deps: Deps = {
    rules: sessionRulesFor(TALLY_GAME, LEVEL_1),
    hud: TALLY_GAME.rules.hud,
    counters: TALLY_GAME.stats.counters,
    entry: entryFor(TALLY_GAME, LEVEL_1),
    table: TALLY_GAME.levels.table,
    errorLog: { record: () => undefined, entries: () => [] },
    engine: TALLY_GAME.engine,
    gameRules: TALLY_GAME.rules,
    persistence: TALLY_GAME.persistence,
    save,
    today: TEST_CLOCK.today,
    nowMs: TEST_CLOCK.nowMs,
    isContinueAllowed: true,
    writeRunEnd: (write) => {
      order.push('write');
      save.update(write.recipe, { refreshBackup: write.refreshBackup });
    },
    feedback: {
      audio: {
        ...createFakeAudio(),
        play: (soundId) => {
          order.push(soundId);
        },
      },
      haptics: {
        ...createFakeHaptics(),
        play: (cue) => {
          order.push(cue);
        },
      },
    },
    ...extra,
  };
  const session = newSession(TALLY_GAME, LEVEL_1, () => 1);
  if (session === null) throw new Error('level 1 did not open');
  return { controller: createSessionController(deps, session), order };
}

describe('createSessionController', () => {
  it('plays the win feedback once, after the run end is written', () => {
    const { controller, order } = controllerFor();
    controller.handle.send(tap(1));
    controller.handle.send(tap(1));
    controller.handle.send({ type: 'finish' });
    expect(order).toStrictEqual(['write', 'ui.win', 'success']);
  });

  it('plays the lose feedback when a move loses, even while the continue is offered', () => {
    const { controller, order } = controllerFor();
    for (const col of [1, 0, 1]) controller.handle.send(tap(col));
    expect(controller.handle.getView().continueState).toBe('offered');
    expect(order).toStrictEqual(['ui.lose', 'error']);
    controller.handle.send({ type: 'finish' });
    expect(order).toStrictEqual(['ui.lose', 'error', 'write']);
  });

  it('stays silent for moves that keep the run going, undo, pause and resume', () => {
    const { controller, order } = controllerFor();
    controller.handle.send(tap(0));
    controller.handle.send({ type: 'undo' });
    controller.handle.send({ type: 'pause' });
    controller.handle.send({ type: 'resume' });
    expect(order).toStrictEqual([]);
  });

  it('takes no command once finish ended or replaced the run, so nothing writes the save (N10)', () => {
    const { save } = createTestSave();
    const writeRunEnd: Deps['writeRunEnd'] = (write) => {
      save.update(write.recipe, { refreshBackup: write.refreshBackup });
    };
    const lost = controllerFor({ save, writeRunEnd }).controller;
    for (const col of [1, 0, 1]) lost.handle.send(tap(col));
    lost.handle.send({ type: 'finish' });
    expect([save.doc().run, save.doc().stats.losses]).toStrictEqual([null, 1]);
    // A rewarded continue that pays out after the player left the lose screen changes nothing.
    lost.handle.send({ type: 'continue' });
    expect([lost.handle.getView().status, save.doc().run, save.doc().stats.losses]).toStrictEqual([
      'lost',
      null,
      1,
    ]);

    // A run still being played, replaced (Restart level, Try again): a late hint or move is dropped.
    const replaced = controllerFor({ save, writeRunEnd }).controller;
    replaced.handle.send(tap(0));
    replaced.handle.send({ type: 'finish' });
    const afterFinish = save.doc();
    replaced.handle.send({ type: 'hint' });
    replaced.handle.send(tap(0));
    expect(save.doc()).toBe(afterFinish);
  });

  it('says whether a hint can be given before anyone pays for it (spec 8.5)', () => {
    const { controller } = controllerFor();
    expect(controller.canHint()).toBe(true);
    controller.handle.send({ type: 'hint' });
    // One shows already: a second would be paid for and show nothing new.
    expect(controller.canHint()).toBe(false);
    for (const col of [1, 0, 1]) controller.handle.send(tap(col));
    expect([controller.handle.getView().status, controller.canHint()]).toStrictEqual([
      'lost',
      false,
    ]);
    // A solver that has no move for the position: nothing to pay for.
    const stuck = controllerFor({
      gameRules: { ...TALLY_GAME.rules, hints: { kind: 'solver', suggest: () => null } },
    });
    expect(stuck.controller.canHint()).toBe(false);
  });

  it("runs the game's hint search once for one press: canHint, then the hint itself", () => {
    const asked: number[] = [];
    const suggest = (state: TallyState): TallyMove => {
      asked.push(state.count);
      return { kind: 'add', amount: 2 };
    };
    const { controller } = controllerFor({
      gameRules: { ...TALLY_GAME.rules, hints: { kind: 'solver', suggest } },
    });
    expect(controller.canHint()).toBe(true);
    controller.handle.send({ type: 'hint' });
    controller.handle.send(tap(0));
    expect(controller.canHint()).toBe(true);
    // One search per position: the press at count 0, then the new position at count 1.
    expect(asked).toStrictEqual([0, 1]);
  });

  it('highlights the hinted move only for the position it was asked for', () => {
    const { controller } = controllerFor();
    controller.handle.send({ type: 'hint' });
    expect(controller.hintedMove()).toStrictEqual({ kind: 'add', amount: 2 });
    controller.handle.send(tap(0));
    expect(controller.hintedMove()).toBeNull();
  });

  it('ends the run at an example state exactly like a deciding move (the debug controls)', () => {
    const { controller, order } = controllerFor();
    expect(controller.endWith({ count: 2, target: 4 })).toBe(false); // still playing: nothing ends
    expect(controller.endWith({ count: 4, target: 4 })).toBe(true);
    expect(order).toStrictEqual(['write', 'ui.win', 'success']);
    expect(controller.handle.getView()).toMatchObject({ status: 'won', summary: { stars: 3 } });
    expect(controller.endWith({ count: 5, target: 4 })).toBe(false); // already recorded
  });

  it('shows fixture numbers over the run without saving them, and keeps acting on the run', () => {
    const { controller } = controllerFor();
    const hud = {
      mode: { kind: 'level', level: 12 },
      goal: { kind: 'moves-par', moves: 7, par: 7 },
      score: 1840,
    } as const;
    controller.showFixture({ hud });
    controller.handle.send(tap(0));
    expect(controller.handle.getView()).toMatchObject({ hud, moveCount: 1, status: 'playing' });
    controller.showFixture({ status: 'won' });
    expect(controller.handle.getView()).toMatchObject({ hud, status: 'won' });
  });
});
