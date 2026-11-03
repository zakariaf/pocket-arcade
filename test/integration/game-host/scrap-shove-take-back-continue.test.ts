// test/integration/game-host/scrap-shove-take-back-continue.test.ts
// Spec 8.10, S5 and S7 on the real game module: Scrap Shove's continue takes the losing move back
// (isTakeBack), so the top bar, the saved run, the Result's moves line and the stars count only the
// moves the player kept, also after the app is killed and the run resumed.
import { scrapShoveGame as game } from '@e07/scrap-shove/index.ts';
import { createGameHost } from '@e07/shell/game-host/game-host.ts';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';

import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { ScrapShoveMove, ScrapShoveState } from '@e07/scrap-shove/rules/scrap-shove-types.ts';
import type { SessionHandle } from '@e07/shell/game-host/session-view.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';

const LEVEL_1 = { kind: 'level', level: 1 } as const;
const PAR = 5; // pack-1.json, level 1

function hostOver(save: SaveService) {
  return createGameHost(game, {
    save,
    clock: TEST_CLOCK,
    errorLog: { record: jest.fn(), entries: () => [] },
    isContinueAllowed: true,
    createBoardHost: () => () => null,
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
    writeRunEnd: (write) => {
      save.update(write.recipe, { refreshBackup: write.refreshBackup });
    },
  });
}

/** The floor as the save holds it after the last write. */
function savedFloor(save: SaveService): ScrapShoveState {
  const run = save.doc().run;
  const state = run === null ? null : game.persistence.parseState(run.state);
  if (state === null) throw new Error('the save holds no Scrap Shove run');
  return state;
}

/** Scrap Shove is played with taps only: the player's square waits, a neighbour steps or shoves. */
function tapFor(state: ScrapShoveState, move: ScrapShoveMove): InputIntent {
  const square = move.kind === 'wait' ? state.player : { col: move.col, row: move.row };
  return { kind: 'tap', target: { regionId: 'board', ...square }, selected: null };
}

/** The hint's move: the first move of a shortest winning line from here. */
function hintedMove(state: ScrapShoveState): ScrapShoveMove {
  const move = game.rules.hints.kind === 'solver' ? game.rules.hints.suggest(state) : null;
  if (move === null) throw new Error('the hint finds no winning move');
  return move;
}

/** A legal move that gets the player caught. */
function losingMove(state: ScrapShoveState): ScrapShoveMove {
  const move = game.engine
    .listMoves(state)
    .find((m) => game.engine.outcome(game.engine.applyMove(state, m).state).kind === 'lost');
  if (move === undefined) throw new Error('no move loses from here');
  return move;
}

function playHinted(handle: SessionHandle, save: SaveService, count: number): void {
  for (let played = 0; played < count; played += 1) {
    const state = savedFloor(save);
    handle.send({ type: 'intent', intent: tapFor(state, hintedMove(state)) });
  }
}

describe('a take-back continue in Scrap Shove', () => {
  it('counts only the kept moves on the top bar, in the save and in the stars after a relaunch', () => {
    const { save } = createTestSave();
    const opened = hostOver(save).openSession({ start: 'new', ref: LEVEL_1 });
    if (opened === null) throw new Error('level 1 did not open');
    playHinted(opened.handle, save, 2);
    const beforeLoss = savedFloor(save);
    opened.handle.send({ type: 'intent', intent: tapFor(beforeLoss, losingMove(beforeLoss)) });
    expect(opened.handle.getView()).toMatchObject({
      status: 'lost',
      moveCount: 3,
      continueState: 'offered',
    });

    opened.handle.send({ type: 'continue' }); // paid for: the Result sends it after the ad
    expect(opened.handle.getView()).toMatchObject({ status: 'playing', moveCount: 2 });
    expect(opened.handle.getView().hud).toMatchObject({ goal: { moves: 2, par: PAR } });
    expect(save.doc().run?.moveCount).toBe(2);

    // The app is killed and relaunched: the resumed run keeps the same count.
    const resumed = hostOver(save).openSession({ start: 'resume' });
    if (resumed === null) throw new Error('the saved run did not resume');
    expect(resumed.handle.getView()).toMatchObject({ status: 'paused', moveCount: 2 });
    resumed.handle.send({ type: 'resume' });
    playHinted(resumed.handle, save, PAR - 2);

    expect(resumed.handle.getView().summary).toMatchObject({
      isWon: true,
      moves: PAR,
      par: PAR,
      stars: 3,
    });
    expect(save.doc().progress.levels['1']).toMatchObject({ stars: 3, bestMoves: PAR });
  });
});
