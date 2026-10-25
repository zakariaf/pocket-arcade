// apps/flock-tilt/src/rules/flock-tilt-engine.test.ts
import { buildTimeline } from '@e07/flock-tilt/board/build-timeline.ts';
import { suggestTilt } from '@e07/flock-tilt/levels/flock-tilt-solver.ts';
import { FLOCK_TILT_TESTING } from '@e07/flock-tilt/testing/flock-tilt-testing.ts';
import { engineContractProblems } from '@e07/game-kit/testing/engine-contract.ts';

import { FLOCK_TILT_ENGINE, FLOCK_TILT_RULES } from './flock-tilt-engine.ts';
import { FLOCK_TILT_PERSISTENCE } from './flock-tilt-persistence.ts';
import { TUNING } from './flock-tilt-tuning.ts';
import { intentToMove, TILT_KEY_IDS } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { DIRECTIONS } from './tilt-field.ts';

import type { FlockTiltState } from './flock-tilt-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

const { examples } = FLOCK_TILT_TESTING;

const tapOn = (target: BoardTarget): InputIntent => ({ kind: 'tap', target, selected: null });

/** Every swipe, every tilt key and a tap on every field cell: each move they yield must be legal. */
function everyIntent(state: FlockTiltState): InputIntent[] {
  const swipes = DIRECTIONS.map((direction): InputIntent => ({
    kind: 'swipe',
    direction,
    from: null,
  }));
  const keys = DIRECTIONS.map((direction) =>
    tapOn({ regionId: TILT_KEY_IDS[direction], col: 0, row: 0 }),
  );
  const cells = Array.from({ length: state.cols * state.rows }, (_, cell) =>
    tapOn({ regionId: 'field', col: cell % state.cols, row: Math.floor(cell / state.cols) }),
  );
  return [...swipes, ...keys, ...cells];
}

describe('FLOCK_TILT_ENGINE', () => {
  it('keeps the engine contract over seeded random games at every difficulty band', () => {
    const problems = engineContractProblems({
      gameId: 'flock-tilt',
      engine: FLOCK_TILT_ENGINE,
      persistence: FLOCK_TILT_PERSISTENCE,
      starts: [0, 25, 50, 75, 99].flatMap((difficulty) =>
        [1, 2, 3].map((seed) => ({ seed, difficulty })),
      ),
      maxMoves: 60,
      intents: everyIntent,
    });
    expect(problems).toStrictEqual([]);
  });

  it('names the swipe pan mode, no select regions, and the game input and timeline', () => {
    expect(FLOCK_TILT_ENGINE.panMode).toBe('swipe');
    expect(FLOCK_TILT_ENGINE.selectRegions).toStrictEqual([]);
    expect(FLOCK_TILT_ENGINE.intentToMove).toBe(intentToMove);
    expect(FLOCK_TILT_ENGINE.buildTimeline).toBe(buildTimeline);
  });
});

describe('FLOCK_TILT_RULES', () => {
  it('shows the score and the sheep penned out of the flock in the top bar', () => {
    expect([examples.start(), examples.win()].map(FLOCK_TILT_RULES.hud)).toStrictEqual([
      { score: 0, goal: { id: 'flock-tilt.progress', values: { penned: 0, total: 3 } } },
      { score: 660, goal: { id: 'flock-tilt.progress', values: { penned: 3, total: 3 } } },
    ]);
  });

  it('allows unlimited undo, which gives tilts back', () => {
    expect(FLOCK_TILT_RULES.undo).toStrictEqual({ kind: 'unlimited' });
  });

  it('turns a lost run back into a playing one with the single continue', () => {
    const rescue = FLOCK_TILT_RULES.continueRun;
    if (rescue.kind !== 'once') throw new Error('continue expected');
    expect(rescue.descriptionId).toBe('flock-tilt.continue.undo-tilt');
    const { state, events } = rescue.apply(examples.lose());
    expect(outcome(state)).toStrictEqual({ kind: 'playing' });
    expect(events).toStrictEqual([{ kind: 'tilt-taken-back', tiltsAdded: TUNING.continueTilts }]);
  });

  it('suggests a legal tilt from the solver as the hint, and none once the field is won', () => {
    const hints = FLOCK_TILT_RULES.hints;
    if (hints.kind !== 'solver') throw new Error('solver hints expected');
    expect(hints.suggest).toBe(suggestTilt);
    const start = examples.start();
    expect(listMoves(start)).toContainEqual(hints.suggest(start));
    expect(hints.suggest(examples.win())).toBeNull();
  });
});
