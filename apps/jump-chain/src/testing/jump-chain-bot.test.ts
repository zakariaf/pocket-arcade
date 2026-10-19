// apps/jump-chain/src/testing/jump-chain-bot.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { applyMove } from '@e07/jump-chain/rules/apply-move.ts';
import { create } from '@e07/jump-chain/rules/create.ts';
import { evaluateJumpChain as evaluateInRules } from '@e07/jump-chain/rules/jump-chain-evaluate.ts';
import { listMoves } from '@e07/jump-chain/rules/list-moves.ts';

import {
  evaluateJumpChain,
  jumpChainBot,
  scoreOfJumpChain,
  tagJumpChainEvent,
} from './jump-chain-bot.ts';

import type { JumpChainState } from '@e07/jump-chain/rules/jump-chain-types.ts';

describe('the bot hooks', () => {
  it('shares the evaluation the level witness plays with', () => {
    expect(evaluateJumpChain).toBe(evaluateInRules);
  });

  it('reports the points the top bar and the result show as the score', () => {
    expect(scoreOfJumpChain({ ...create(1, 0), score: 270 })).toBe(270);
  });
});

describe('tagJumpChainEvent', () => {
  it('tags a capture as the payoff and a chain of two or more jumps as the twist too', () => {
    expect(
      tagJumpChainEvent({ kind: 'enemies-captured', enemyIds: [3], chain: 1, points: 10 }),
    ).toStrictEqual(['payoff']);
    expect(
      tagJumpChainEvent({ kind: 'enemies-captured', enemyIds: [3, 5], chain: 2, points: 30 }),
    ).toStrictEqual(['payoff', 'twist']);
    expect(
      tagJumpChainEvent({
        kind: 'piece-stepped',
        from: { col: 3, row: 7 },
        to: { col: 2, row: 6 },
      }),
    ).toStrictEqual([]);
  });
});

describe('jumpChainBot', () => {
  it('picks the longest chain when it can (here every enemy in one move)', () => {
    const enemies = [
      { id: 0, rank: 0, col: 3, row: 5 },
      { id: 1, rank: 1, col: 5, row: 3 },
    ];
    const state: JumpChainState = {
      ...create(1, 0),
      piece: { col: 2, row: 6 },
      enemies,
      total: 2,
      nextId: 2,
    };
    const choice = jumpChainBot(state, listMoves(state), seedRng(1));
    expect(choice.move).toStrictEqual({
      kind: 'jump',
      path: [
        { col: 4, row: 4 },
        { col: 6, row: 2 },
      ],
    });
  });

  it('reaches the first capture within three moves on the easiest level (the kill test)', () => {
    let state = create(1, 0);
    let rng = seedRng(1);
    let captureAt = 0;
    for (let move = 1; move <= 3 && captureAt === 0; move += 1) {
      const choice = jumpChainBot(state, listMoves(state), rng);
      rng = choice.rng;
      const result = applyMove(state, choice.move);
      if (result.events.some((event) => event.kind === 'enemies-captured')) captureAt = move;
      state = result.state;
    }
    expect(captureAt).toBeGreaterThan(0);
  });
});
