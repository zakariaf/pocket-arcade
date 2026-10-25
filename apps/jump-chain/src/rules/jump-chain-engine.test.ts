// apps/jump-chain/src/rules/jump-chain-engine.test.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { engineContractProblems } from '@e07/game-kit/testing/engine-contract.ts';
import { buildTimeline } from '@e07/jump-chain/board/build-timeline.ts';

import { intentToMove } from './intent-to-move.ts';
import { JUMP_CHAIN_ENGINE, JUMP_CHAIN_RULES } from './jump-chain-engine.ts';
import { JUMP_CHAIN_PERSISTENCE } from './jump-chain-persistence.ts';
import { TUNING } from './jump-chain-tuning.ts';

import type { JumpChainState } from './jump-chain-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

const SQUARES = Array.from({ length: TUNING.cols * TUNING.rows }, (_, index): BoardTarget => ({
  regionId: 'board',
  col: index % TUNING.cols,
  row: Math.floor(index / TUNING.cols),
}));

/** What the board sends: a drag of the piece to every square and off the board, a tap on each. */
function everyIntent(state: JumpChainState): InputIntent[] {
  const from = { regionId: 'board', col: state.piece.col, row: state.piece.row };
  return [
    ...SQUARES.map((to): InputIntent => ({ kind: 'drag-end', from, to })),
    { kind: 'drag-end', from, to: null },
    ...SQUARES.map((target): InputIntent => ({ kind: 'tap', target, selected: null })),
  ];
}

describe('JUMP_CHAIN_ENGINE', () => {
  it('keeps the engine contract over seeded games at every level row and endless', () => {
    const problems = engineContractProblems({
      gameId: 'jump-chain',
      engine: JUMP_CHAIN_ENGINE,
      persistence: JUMP_CHAIN_PERSISTENCE,
      starts: [0, 25, 50, 75, 100].map((difficulty) => ({ seed: difficulty + 1, difficulty })),
      maxMoves: 40,
      intents: everyIntent,
      endless: { kind: 'endless', difficulty: ENDLESS_DIFFICULTY },
    });
    expect(problems).toStrictEqual([]);
  });

  it('drags the piece, selects nothing first, and names the board timeline and the input', () => {
    expect(JUMP_CHAIN_ENGINE.panMode).toBe('drag');
    expect(JUMP_CHAIN_ENGINE.selectRegions).toStrictEqual([]);
    expect(JUMP_CHAIN_ENGINE.buildTimeline).toBe(buildTimeline);
    expect(JUMP_CHAIN_ENGINE.intentToMove).toBe(intentToMove);
  });
});

describe('JUMP_CHAIN_RULES', () => {
  it('shows the score and the enemies captured against the level’s enemies in the top bar', () => {
    const state = JUMP_CHAIN_ENGINE.create(1, 0);
    expect(JUMP_CHAIN_RULES.hud({ ...state, captured: 4, score: 150 })).toStrictEqual({
      score: 150,
      goal: { id: 'jump-chain.progress', values: { captured: 4, total: state.total } },
    });
  });

  it('counts only the captured enemies in the endless run, which has no last enemy', () => {
    const state = JUMP_CHAIN_ENGINE.create(1, ENDLESS_DIFFICULTY);
    expect(JUMP_CHAIN_RULES.hud({ ...state, captured: 9, score: 400 })).toStrictEqual({
      score: 400,
      goal: { id: 'jump-chain.progress.endless', values: { captured: 9 } },
    });
  });

  it('allows no undo and no hints, and one continue that steps the ranks back', () => {
    expect(JUMP_CHAIN_RULES.undo).toStrictEqual({ kind: 'none' });
    expect(JUMP_CHAIN_RULES.hints).toStrictEqual({ kind: 'none' });
    const { continueRun } = JUMP_CHAIN_RULES;
    if (continueRun.kind !== 'once') throw new Error('continue expected');
    expect(continueRun.descriptionId).toBe('jump-chain.continue.step-back');
    const start = JUMP_CHAIN_ENGINE.create(1, 0);
    const [first] = start.enemies;
    if (first === undefined) throw new Error('no enemy');
    const lost = { ...start, enemies: [{ ...first, row: 9 }, ...start.enemies.slice(1)] };
    expect(JUMP_CHAIN_ENGINE.outcome(lost)).toMatchObject({ kind: 'lost' });
    expect(JUMP_CHAIN_ENGINE.outcome(continueRun.apply(lost).state)).toStrictEqual({
      kind: 'playing',
    });
  });
});
