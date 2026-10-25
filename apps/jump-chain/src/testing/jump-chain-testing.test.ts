// apps/jump-chain/src/testing/jump-chain-testing.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { playBot } from '@e07/game-kit/testing/play-bot.ts';
import { applyMove } from '@e07/jump-chain/rules/apply-move.ts';
import { create } from '@e07/jump-chain/rules/create.ts';
import { parseState } from '@e07/jump-chain/rules/jump-chain-persistence.ts';
import { listMoves } from '@e07/jump-chain/rules/list-moves.ts';
import { outcome } from '@e07/jump-chain/rules/outcome.ts';

import { jumpChainBot } from './jump-chain-bot.ts';
import { JUMP_CHAIN_TESTING } from './jump-chain-testing.ts';

const GAME = { create, listMoves, applyMove, outcome };

describe('JUMP_CHAIN_TESTING', () => {
  it('gives every example state the outcome its name promises (spec 10 TESTING)', () => {
    const { examples } = JUMP_CHAIN_TESTING;
    expect(outcome(examples.start()).kind).toBe('playing');
    expect(outcome(examples.middle()).kind).toBe('playing');
    expect(outcome(examples.win()).kind).toBe('won');
    expect(outcome(examples.lose()).kind).toBe('lost');
  });

  // The Shell saves an example it stages (debug links, E2E): a save must restore it (spec 8.6).
  it('gives only example states legal play reaches, so each one survives a save', () => {
    for (const example of Object.values(JUMP_CHAIN_TESTING.examples)) {
      const state = example();
      expect(parseState(JSON.parse(JSON.stringify(state)))).toStrictEqual(state);
    }
  });

  it('loses the lose example with points scored, so an endless best can show it', () => {
    expect(JUMP_CHAIN_TESTING.examples.lose().score).toBeGreaterThan(0);
  });

  it('shows a board with a capture made in the middle example', () => {
    expect(JUMP_CHAIN_TESTING.examples.middle().captured).toBeGreaterThan(0);
  });

  it('uses the greedy reasonable player as its bot, which picks a legal move', () => {
    expect(JUMP_CHAIN_TESTING.bot).toBe(jumpChainBot);
    const state = create(4, 20);
    const choice = JUMP_CHAIN_TESTING.bot(state, listMoves(state), seedRng(4));
    expect(listMoves(state)).toContainEqual(choice.move);
  });

  it('finishes every bot game within the move limit, endless runs included', () => {
    for (const difficulty of [40, 100]) {
      for (let seed = 1; seed <= 10; seed += 1) {
        const run = playBot(GAME, {
          seed,
          difficulty,
          policy: JUMP_CHAIN_TESTING.bot,
          maxMoves: 400,
        });
        expect(run.outcome.kind).not.toBe('playing');
      }
    }
  });
});
