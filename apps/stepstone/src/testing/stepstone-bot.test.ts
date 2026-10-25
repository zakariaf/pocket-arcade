// apps/stepstone/src/testing/stepstone-bot.test.ts
// Spec 8.13: bots play the game before anyone does. The greedy bot is the "reasonable player":
// it looks one hop ahead, heads for the flag by eye and keeps stones in reach.
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { create } from '@e07/stepstone/rules/create.ts';
import { listMoves } from '@e07/stepstone/rules/list-moves.ts';
import { pondFromText } from '@e07/stepstone/rules/pond-text.ts';

import {
  evaluateStepstone,
  scoreOfStepstone,
  stepsToFlag,
  stepstoneBot,
  tagStepstoneEvent,
} from './stepstone-bot.ts';

import type { StepstoneState } from '@e07/stepstone/rules/stepstone-types.ts';

function pond(text: string, moves = 0): StepstoneState {
  return { ...pondFromText(text), moves, par: 2, kindsUsed: ['rook'] };
}

describe('evaluateStepstone', () => {
  it('prefers the frog nearer the flag by eye', () => {
    const near = pond(['.....', '.....', '..r.F', '..R..', '.....'].join('\n'));
    const far = pond(['r....', '.....', 'R...F', '.....', '.....'].join('\n'));
    expect(evaluateStepstone(near)).toBeGreaterThan(evaluateStepstone(far));
  });

  it('prefers more stones in reach when the flag is as far', () => {
    const many = pond(['R.R..', '.....', 'r.R.F', '.....', 'R....'].join('\n'));
    const few = pond(['.....', '.....', 'r.R.F', '.....', '.....'].join('\n'));
    expect(evaluateStepstone(many)).toBeGreaterThan(evaluateStepstone(few));
  });

  it('ranks a win above every pond, fewer hops first, and a stranded frog below', () => {
    const won = pond(['R....', '.....', '....f', '.....', '.....'].join('\n'), 3);
    const slowWin = { ...won, moves: 6 };
    const playing = pond(['.....', '.....', '..r.F', '.....', '.....'].join('\n'));
    const stranded = pond(['k....', '.....', '....F', '.....', '.....'].join('\n'));
    expect(evaluateStepstone(won)).toBeGreaterThan(evaluateStepstone(slowWin));
    expect(evaluateStepstone(slowWin)).toBeGreaterThan(evaluateStepstone(playing));
    expect(evaluateStepstone(stranded)).toBeLessThan(evaluateStepstone(playing));
  });
});

describe('stepsToFlag', () => {
  it('counts king steps from the frog to the flag', () => {
    expect(stepsToFlag(pond(['r....', '.....', '.....', '.....', '...F.'].join('\n')))).toBe(4);
    expect(stepsToFlag(pond(['.....', '..r..', '...F.', '.....', '.....'].join('\n')))).toBe(1);
  });
});

describe('scoreOfStepstone', () => {
  it('reports the hops made, the number the top bar and the result show', () => {
    expect(scoreOfStepstone(pond(['r.F', '...', '...'].join('\n'), 5))).toBe(5);
  });
});

describe('tagStepstoneEvent', () => {
  it('tags the flag and a first-time hop kind as the payoff and every kind change as the twist', () => {
    expect(tagStepstoneEvent({ kind: 'goal-reached', cell: 4, moves: 3, par: 3 })).toStrictEqual([
      'payoff',
    ]);
    const newKind = {
      kind: 'move-kind-changed',
      cell: 2,
      from: 'rook',
      to: 'king',
      isNewKind: true,
    } as const;
    expect(tagStepstoneEvent(newKind)).toStrictEqual(['payoff', 'twist']);
    expect(tagStepstoneEvent({ ...newKind, isNewKind: false })).toStrictEqual(['twist']);
    expect(tagStepstoneEvent({ kind: 'stone-sank', cell: 0, stone: 'rook' })).toStrictEqual([]);
  });
});

describe('stepstoneBot', () => {
  it('takes the hop onto the flag when it is in reach', () => {
    const state = pond(['r.K.F', '.....', '.....', '.....', '.....'].join('\n'));
    expect(stepstoneBot(state, listMoves(state), seedRng(1)).move).toStrictEqual({
      kind: 'hop',
      to: 4,
    });
  });

  it('avoids a stone that strands the frog', () => {
    const state = pond(['r...K', '.....', 'R...F', '.....', '.....'].join('\n'));
    // the king at 4 has no stone around it; the rook at 10 reaches the flag
    expect(stepstoneBot(state, listMoves(state), seedRng(1)).move).toStrictEqual({
      kind: 'hop',
      to: 10,
    });
  });

  it('plays only listed hops on a real level', () => {
    const start = create(7, 40);
    const moves = listMoves(start);
    expect(moves).toContainEqual(stepstoneBot(start, moves, seedRng(7)).move);
  });
});
