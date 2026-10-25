// apps/swap-guard/src/testing/swap-guard-testing.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { playBot } from '@e07/game-kit/testing/play-bot.ts';
import pack1 from '@e07/swap-guard/levels/pack-1.json';
import { applyMove } from '@e07/swap-guard/rules/apply-move.ts';
import { create } from '@e07/swap-guard/rules/create.ts';
import { listMoves } from '@e07/swap-guard/rules/list-moves.ts';
import { outcome } from '@e07/swap-guard/rules/outcome.ts';
import { planLine } from '@e07/swap-guard/rules/plan-line.ts';
import { parseState } from '@e07/swap-guard/rules/swap-guard-persistence.ts';

import { LEVEL_1, SWAP_GUARD_TESTING } from './swap-guard-testing.ts';

const GAME = { create, listMoves, applyMove, outcome };

describe('SWAP_GUARD_TESTING (spec 10 TESTING: a bot and example states)', () => {
  it('gives every example state the outcome its name promises', () => {
    const { examples } = SWAP_GUARD_TESTING;
    expect(outcome(examples.start()).kind).toBe('playing');
    expect(outcome(examples.middle()).kind).toBe('playing');
    expect(outcome(examples.win()).kind).toBe('won');
    expect(outcome(examples.lose())).toStrictEqual({
      kind: 'lost',
      reasonKey: 'swap-guard.lose.hit',
    });
  });

  it('shows the double hit in the middle example and a played loss in the lose example', () => {
    const { examples } = SWAP_GUARD_TESTING;
    expect(examples.middle().enemies).toHaveLength(examples.start().enemies.length - 2);
    expect(examples.lose().lastSwap).not.toBeNull();
  });

  // Spec 8.6: an example the debug menu or an E2E flow opens is saved like any run, so it must be a
  // run legal play reaches, or the next launch drops it.
  it('reaches every example through the rules, so a saved example loads back unchanged', () => {
    const states = Object.values(SWAP_GUARD_TESTING.examples).map((example) => example());
    const reloaded = states.map((state) => parseState(JSON.parse(JSON.stringify(state))));
    expect(reloaded).toStrictEqual(states);
  });

  // The examples are level 1's real board (pack-1.json), so the debug links and E2E flows that open
  // them on level 1 show what level 1 plays.
  it('plays the win example from level 1’s start along the planned line', () => {
    const level1 = pack1.find((entry) => entry.level === 1);
    if (level1 === undefined) throw new Error('pack-1.json has no level 1');
    expect(LEVEL_1).toStrictEqual({ seed: level1.seed, difficulty: level1.difficulty });
    const start = create(level1.seed, level1.difficulty);
    expect(SWAP_GUARD_TESTING.examples.start()).toStrictEqual(start);
    const line = planLine(start) ?? [];
    const end = line.reduce((state, move) => applyMove(state, move).state, start);
    expect(SWAP_GUARD_TESTING.examples.win()).toStrictEqual(end);
  });

  it('lets the bot pick a legal move', () => {
    const state = create(4, 20);
    const choice = SWAP_GUARD_TESTING.bot(state, listMoves(state), seedRng(4));
    expect(listMoves(state)).toContainEqual(choice.move);
  });

  it('finishes every bot game within the swap budget', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const run = playBot(GAME, {
        seed,
        difficulty: 40,
        policy: SWAP_GUARD_TESTING.bot,
        maxMoves: 200,
      });
      expect(run.outcome.kind).not.toBe('playing');
    }
  });
});
