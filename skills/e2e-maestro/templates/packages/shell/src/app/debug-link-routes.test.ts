// packages/shell/src/app/debug-link-routes.test.ts
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import { debugRouteFor, isGameExample, nextLevelOf } from './debug-link-routes.ts';

import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

const RESULT = {
  stars: 3,
  bestScore: 0,
  bestMoves: null,
  completions: 1,
  firstCompletedOn: '2026-09-26',
} as const;

function wonUpTo(level: number): SaveDoc {
  const doc = createDefaultSaveDoc('line-siege');
  const levels = Object.fromEntries(
    Array.from({ length: level }, (_, index) => [String(index + 1), RESULT]),
  );
  return { ...doc, progress: { ...doc.progress, levels } };
}

describe('debug link routes', () => {
  it('names the navigator route of each screen', () => {
    expect(debugRouteFor('how-to-play', 1)).toStrictEqual({ name: 'HowToPlay' });
    expect(debugRouteFor('debug', 1)).toStrictEqual({ name: 'Debug' });
  });

  it('starts a new run of the level for screen=game', () => {
    expect(debugRouteFor('game', 12)).toStrictEqual({
      name: 'Game',
      params: { start: 'new', ref: { kind: 'level', level: 12 } },
    });
  });

  it('finds the next level like Home does, and stays on the last one', () => {
    expect(nextLevelOf(wonUpTo(0), 90)).toBe(1);
    expect(nextLevelOf(wonUpTo(11), 90)).toBe(12);
    expect(nextLevelOf(wonUpTo(3), 3)).toBe(3);
  });

  it('tells the game example states apart', () => {
    expect(isGameExample('result-win')).toBe(true);
    expect(isGameExample('game')).toBe(false);
    expect(isGameExample(undefined)).toBe(false);
  });
});
