// packages/game-kit/src/testing/play-bot.test.ts
import { playBot, playBotLine, randomPolicy } from './play-bot.ts';

import type { BotGame } from './play-bot.ts';

/** Toy game: count up by 1 or 2; exactly 6 wins, passing 6 loses. */
const GAME: BotGame<number, number, never> = {
  create: () => 0,
  listMoves: (state) => (state < 6 ? [1, 2] : []),
  applyMove: (state, step) => ({ state: state + step, events: [] }),
  outcome: (state) => {
    if (state === 6) return { kind: 'won', score: 1 };
    return state > 6 ? { kind: 'lost', reasonKey: 'count.lose.over' } : { kind: 'playing' };
  },
};

describe('playBot', () => {
  it('plays the same game for the same seed', () => {
    const options = {
      seed: 11,
      difficulty: 0,
      policy: randomPolicy<number, number>(),
      maxMoves: 50,
    };
    expect(playBot(GAME, options)).toStrictEqual(playBot(GAME, options));
  });

  it('ends every game within the move cap', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const run = playBot(GAME, { seed, difficulty: 0, policy: randomPolicy(), maxMoves: 50 });
      expect(run.outcome.kind).not.toBe('playing');
    }
  });

  it('stops at maxMoves when the game never ends', () => {
    const stuck: BotGame<number, number, never> = {
      ...GAME,
      outcome: () => ({ kind: 'playing' }),
      listMoves: () => [0],
    };
    expect(
      playBot(stuck, { seed: 1, difficulty: 0, policy: randomPolicy(), maxMoves: 7 }),
    ).toStrictEqual({
      outcome: { kind: 'playing' },
      moves: 7,
    });
  });

  it('refuses to pick from an empty move list', () => {
    expect(() => randomPolicy<number, number>()(0, [], [1, 2, 3, 4])).toThrow(
      'randomPolicy called without legal moves',
    );
  });
});

/** playBot's own moves for seed 11, recorded through a policy that wraps randomPolicy: 7, lost. */
const PINNED_SEED_11_MOVES = [1, 1, 2, 1, 2];

describe('playBotLine', () => {
  const options = { seed: 11, difficulty: 0, policy: randomPolicy<number, number>(), maxMoves: 50 };

  it('plays exactly the game playBot plays, and lists each state with the move made from it', () => {
    const played = playBotLine(GAME, options);
    expect({ outcome: played.outcome, moves: played.moves }).toStrictEqual(playBot(GAME, options));
    expect(played.line).toHaveLength(played.moves);
    let state = GAME.create(options.seed, options.difficulty);
    for (const step of played.line) {
      expect(step.state).toBe(state);
      state = GAME.applyMove(state, step.move).state;
    }
  });

  it('pins the line of seed 11 (the same bot RNG rule as playBot, on every machine)', () => {
    expect(playBotLine(GAME, options).line.map((step) => step.move)).toStrictEqual(
      PINNED_SEED_11_MOVES,
    );
  });

  it('stops at maxMoves with that many steps when the game never ends', () => {
    const stuck: BotGame<number, number, never> = {
      ...GAME,
      outcome: () => ({ kind: 'playing' }),
      listMoves: () => [0],
    };
    const played = playBotLine(stuck, { ...options, maxMoves: 3 });
    expect([played.moves, played.line.length, played.outcome.kind]).toStrictEqual([
      3,
      3,
      'playing',
    ]);
  });
});
