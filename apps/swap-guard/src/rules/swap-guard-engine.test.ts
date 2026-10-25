// apps/swap-guard/src/rules/swap-guard-engine.test.ts
// Spec 10 THE GAME CONTRACT: the engine members, the board's pan gesture, the top-bar line, undo,
// hints and the one continue (spec 8.5, 8.10).
import { engineContractProblems } from '@e07/game-kit/testing/engine-contract.ts';
import { buildTimeline } from '@e07/swap-guard/board/build-timeline.ts';
import { suggestSwap } from '@e07/swap-guard/levels/swap-guard-solver.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { intentToMove } from './intent-to-move.ts';
import { SWAP_GUARD_ENGINE, SWAP_GUARD_RULES } from './swap-guard-engine.ts';
import { SWAP_GUARD_PERSISTENCE } from './swap-guard-persistence.ts';

import type { SwapGuardState } from './swap-guard-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';

/** A tap on every square of the board plus one row and one column outside it. */
function everyIntent(state: SwapGuardState): InputIntent[] {
  const intents: InputIntent[] = [];
  for (let row = 0; row <= state.size; row += 1) {
    for (let col = 0; col <= state.size; col += 1) {
      intents.push({ kind: 'tap', target: { regionId: 'board', col, row }, selected: null });
    }
  }
  return intents;
}

describe('SWAP_GUARD_ENGINE', () => {
  it('keeps the engine contract over seeded random games at every difficulty band', () => {
    const problems = engineContractProblems({
      gameId: 'swap-guard',
      engine: SWAP_GUARD_ENGINE,
      persistence: SWAP_GUARD_PERSISTENCE,
      starts: [0, 25, 50, 99].flatMap((difficulty) =>
        [1, 2, 3].map((seed) => ({ seed, difficulty })),
      ),
      maxMoves: 40,
      intents: everyIntent,
      endless: { kind: 'none' },
    });
    expect(problems).toStrictEqual([]);
  });

  it('swaps by tap on a board that selects nothing first', () => {
    expect(SWAP_GUARD_ENGINE.panMode).toBe('none');
    expect(SWAP_GUARD_ENGINE.selectRegions).toStrictEqual([]);
    expect(SWAP_GUARD_ENGINE.intentToMove).toBe(intentToMove);
    expect(SWAP_GUARD_ENGINE.buildTimeline).toBe(buildTimeline);
  });
});

describe('SWAP_GUARD_RULES', () => {
  it('shows the score and the enemies down of the level total in the top bar', () => {
    const start = SWAP_GUARD_ENGINE.create(1, 0);
    const state = { ...start, enemies: start.enemies.slice(1), score: 100 };
    expect(SWAP_GUARD_RULES.hud(state)).toStrictEqual({
      score: 100,
      goal: { id: 'swap-guard.progress', values: { defeated: 1, total: start.enemyCount } },
    });
  });

  it('undoes freely and hints the planned next swap (design notes 7 and 8)', () => {
    expect(SWAP_GUARD_RULES.undo).toStrictEqual({ kind: 'unlimited' });
    expect(SWAP_GUARD_RULES.hints.kind).toBe('solver');
    if (SWAP_GUARD_RULES.hints.kind !== 'solver') throw new Error('solver hints expected');
    expect(SWAP_GUARD_RULES.hints.suggest).toBe(suggestSwap);
  });

  it('turns a lost run back into a playing one with the single continue: the swap undone', () => {
    const start = SWAP_GUARD_ENGINE.create(1, 0);
    const lost = SWAP_GUARD_ENGINE.listMoves(start)
      .map((move) => applyMove(start, move).state)
      .find((state) => state.isHit);
    if (lost === undefined) throw new Error('a losing swap expected');
    expect(SWAP_GUARD_ENGINE.outcome(lost).kind).toBe('lost');
    if (SWAP_GUARD_RULES.continueRun.kind !== 'once') throw new Error('continue expected');
    expect(SWAP_GUARD_RULES.continueRun.descriptionId).toBe('swap-guard.continue.swap-back');
    expect(SWAP_GUARD_RULES.continueRun.apply(lost)).toStrictEqual(continueAfterLoss(lost));
    expect(SWAP_GUARD_ENGINE.outcome(SWAP_GUARD_RULES.continueRun.apply(lost).state)).toStrictEqual(
      {
        kind: 'playing',
      },
    );
  });
});
