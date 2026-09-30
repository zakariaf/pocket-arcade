// packages/shell/src/game-host/game-facts.test.ts
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { hasMusicOf, isScoreRatedOf, isScoreRule } from './game-facts.ts';

const THEME = { category: 'music', recipe: [], isLoop: true } as const;
const TAP = { category: 'sfx', recipe: [] } as const;
const SCORE = { kind: 'score', thresholds: [0, 150, 180] } as const;

/** The tally game with another sound bank or another star rule on every level. */
function tallyWith(change: { sounds?: object; rule?: typeof SCORE }): typeof TALLY_GAME {
  const { presentation, levels } = TALLY_GAME;
  const table = levels.table.map((entry) => ({ ...entry, stars: change.rule ?? entry.stars }));
  return {
    ...TALLY_GAME,
    presentation: { ...presentation, sounds: { ...presentation.sounds, ...change.sounds } },
    levels: { ...levels, table },
  };
}

describe('game facts', () => {
  it('finds music only in a sound of category music (the Music rows)', () => {
    expect(hasMusicOf(TALLY_GAME)).toBe(false);
    expect(hasMusicOf(tallyWith({ sounds: { tap: TAP } }))).toBe(false);
    expect(hasMusicOf(tallyWith({ sounds: { tap: TAP, theme: THEME } }))).toBe(true);
  });

  it('calls a game score-rated when every level has a score rule (the S7 score line)', () => {
    expect(isScoreRatedOf(TALLY_GAME)).toBe(false);
    expect(isScoreRatedOf(tallyWith({ rule: SCORE }))).toBe(true);
    const noLevels = { ...TALLY_GAME, levels: { ...TALLY_GAME.levels, table: [] } };
    expect(isScoreRatedOf(noLevels)).toBe(false);
  });

  it('rates one level by score only for a score rule', () => {
    expect(isScoreRule(SCORE)).toBe(true);
    expect(isScoreRule({ kind: 'par', par: 7 })).toBe(false);
    expect(isScoreRule(null)).toBe(false);
  });
});
