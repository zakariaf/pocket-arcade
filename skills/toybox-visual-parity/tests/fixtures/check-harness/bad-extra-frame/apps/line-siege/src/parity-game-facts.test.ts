// apps/line-siege/src/parity-game-facts.test.ts
// The game facts the parity captures read (this game's entry in parity/game-facts.json at the repo
// root) pick the reference variant of S6, S7 and S11: no Music key or rows for a game without
// music, the score line for a game whose levels are rated by score. This test pins the facts to the
// game module through the Shell's own helpers (the rules the game host uses); check-harness.mjs
// (toybox-visual-parity) keeps PARITY_GAME_FACTS equal to the JSON entry. Set both to this game's
// facts; a change of either needs a Gate-Change trailer (parity/game-facts.json is a gated path).
import { hasMusicOf, isScoreRatedOf } from '@e07/shell/game-host/game-facts.ts';

import { lineSiegeGame as game } from './index.ts';

/** This game's entry of parity/game-facts.json. */
const PARITY_GAME_FACTS = { designGame: 'lineSiege', hasMusic: false, winLine: 'score' } as const;

describe('the parity game facts of line-siege', () => {
  it('names a design game whose references exist', () => {
    expect(['lineSiege', 'flockTilt', 'scrapShove']).toContain(PARITY_GAME_FACTS.designGame);
  });

  it('says whether the game has music exactly as its sound bank does', () => {
    expect(PARITY_GAME_FACTS.hasMusic).toBe(hasMusicOf(game));
  });

  it('says how the levels are rated exactly as their stars rule does', () => {
    expect(PARITY_GAME_FACTS.winLine).toBe(isScoreRatedOf(game) ? 'score' : 'moves');
  });
});
