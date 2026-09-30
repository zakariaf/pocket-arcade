// apps/__GAME_ID__/src/tutorial/__GAME_ID__-teaching.test.ts
import { applyMove } from '@e07/__GAME_ID__/rules/apply-move.ts';
import { listMoves } from '@e07/__GAME_ID__/rules/list-moves.ts';
import { outcome } from '@e07/__GAME_ID__/rules/outcome.ts';

import { __GAME_CONST___TEACHING } from './__GAME_ID__-teaching.ts';

describe('__GAME_CONST___TEACHING', () => {
  it('teaches in 3 to 5 how-to-play pages drawn from playing examples', () => {
    const pages = __GAME_CONST___TEACHING.howToPlay;
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(pages.length).toBeLessThanOrEqual(5);
    expect(pages.every((page) => outcome(page.example).kind === 'playing')).toBe(true);
  });

  it('expects a legal move at every step, and the scripted moves win the tutorial', () => {
    const { start, steps } = __GAME_CONST___TEACHING.tutorial;
    const end = steps.reduce((state, step) => {
      if (step.expect.kind !== 'move') return state;
      expect(listMoves(state)).toContainEqual(step.expect.move);
      return applyMove(state, step.expect.move).state;
    }, start);
    expect(outcome(end).kind).toBe('won');
  });
});
