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
