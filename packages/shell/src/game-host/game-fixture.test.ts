// packages/shell/src/game-host/game-fixture.test.ts
import {
  fixtureHudOf,
  fixtureHudViewOf,
  fixtureResultViewOf,
  fixtureSummaryOf,
} from './game-fixture.ts';

import type { GameFixture } from './game-fixture.ts';
import type { SessionView } from './session-view.ts';

const LEVEL_1 = { kind: 'level', level: 1 } as const;
/** A played score-rated run (the game's own goal message) of level 1, paused. */
const PLAYED: SessionView = {
  status: 'paused',
  ref: LEVEL_1,
  hud: {
    mode: LEVEL_1,
    goal: {
      kind: 'game',
      message: { id: 'line-siege.progress', values: { defeated: 0, total: 4 } },
    },
    score: 0,
  },
  moveCount: 0,
  isUndoSupported: true,
  canUndo: false,
  isHintSupported: false,
  isHintShown: false,
  continueState: 'none',
  loseReasonKey: null,
  summary: null,
  eventSeq: 0,
};
/** The design's Line Siege numbers (score-rated: no par). */
const FIXTURE: GameFixture = {
  level: 12,
  score: 1840,
  progress: { mid: { defeated: 3, total: 10 }, full: { defeated: 10, total: 10 } },
  stars: 3,
  isNewBest: true,
  movesCount: 7,
  par: null,
  bestScore: 1840,
  loseReasonKey: 'line-siege.lose.broke-through',
  isContinueOffered: true,
};
const LEVEL_12 = { kind: 'level', level: 12 } as const;

describe('game fixture', () => {
  it('shows level 12, 1,840, the game progress at mid and Undo enabled in the S5 and S6 top bar', () => {
    expect(fixtureHudViewOf(PLAYED, FIXTURE)).toStrictEqual({
      ref: LEVEL_12,
      hud: {
        mode: LEVEL_12,
        goal: {
          kind: 'game',
          message: { id: 'line-siege.progress', values: { defeated: 3, total: 10 } },
        },
        score: 1840,
      },
      canUndo: true,
    });
  });

  it('shows "Moves 7 / Par 7" for a moves-rated game', () => {
    const rated = { ...FIXTURE, par: 7 };
    expect(fixtureHudOf(PLAYED, rated, false).goal).toStrictEqual({
      kind: 'moves-par',
      moves: 7,
      par: 7,
    });
    const movesPlayed: SessionView = {
      ...PLAYED,
      hud: { ...PLAYED.hud, goal: { kind: 'moves-par', moves: 0, par: 7 } },
    };
    // A fixture without par over a par line keeps the played line (there is no game message).
    expect(fixtureHudOf(movesPlayed, FIXTURE, true).goal).toStrictEqual(movesPlayed.hud.goal);
  });

  it('records the S7 win with its stars, New best, the full progress and the level best', () => {
    const view = fixtureResultViewOf(PLAYED, FIXTURE, 'won');
    expect(view).toMatchObject({
      status: 'won',
      continueState: 'none',
      loseReasonKey: null,
      hud: { goal: { message: { values: { defeated: 10, total: 10 } } } },
    });
    expect(view.summary).toStrictEqual({
      ref: LEVEL_12,
      isWon: true,
      loseReasonKey: null,
      score: 1840,
      moves: 7,
      playMs: 0,
      stars: 3,
      par: null,
      isNewBest: true,
      levelBestScore: 1840,
      nextLevel: 13,
    });
  });

  it('keeps the S7 loss pending while it offers the continue, and records it without one', () => {
    expect(fixtureResultViewOf(PLAYED, FIXTURE, 'lost')).toMatchObject({
      status: 'lost',
      summary: null,
      continueState: 'offered',
      loseReasonKey: 'line-siege.lose.broke-through',
    });
    const noOffer = { ...FIXTURE, isContinueOffered: false };
    expect(fixtureResultViewOf(PLAYED, noOffer, 'lost')).toMatchObject({
      summary: { isWon: false, stars: 0, isNewBest: false, nextLevel: null },
      continueState: 'none',
    });
    expect(fixtureSummaryOf(FIXTURE, 'lost').loseReasonKey).toBe('line-siege.lose.broke-through');
  });
});
