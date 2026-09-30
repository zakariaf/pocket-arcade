// packages/shell/src/game-host/result-model-of.test.ts
import { resultModelOf } from './result-model-of.ts';

import type { ResultInput } from './result-model-of.ts';
import type { RunSummary } from './run-summary.ts';
import type { SessionView } from './session-view.ts';
import type { TFunction } from '@e07/shell/i18n/create-t.ts';

/** The game part of S7: its win title key and its logo, as useGameHost() hands them over. */
const GAME = {
  winTitleId: 'tally.win-title',
  logo: { layers: [{ role: 'k', d: 'M20 20H28V28H20Z' }] },
} as const;
const t: TFunction = (key, values) =>
  values === undefined ? key : `${key} ${JSON.stringify(values)}`;
const LEVEL_3 = { kind: 'level', level: 3 } as const;
const WON: RunSummary = {
  ref: LEVEL_3,
  isWon: true,
  loseReasonKey: null,
  score: 90,
  moves: 7,
  playMs: 42_000,
  stars: 2,
  par: 5,
  isNewBest: true,
  levelBestScore: 90,
  nextLevel: 4,
};
const VIEW: SessionView = {
  status: 'won',
  ref: LEVEL_3,
  hud: { mode: LEVEL_3, goal: { kind: 'moves-par', moves: 7, par: 5 }, score: 90 },
  moveCount: 7,
  isUndoSupported: true,
  canUndo: false,
  isHintSupported: false,
  isHintShown: false,
  continueState: 'none',
  loseReasonKey: null,
  summary: WON,
  eventSeq: 7,
};
const LOST_VIEW: SessionView = {
  ...VIEW,
  status: 'lost',
  continueState: 'offered',
  loseReasonKey: 'tally.lose.overshot',
  summary: null,
};

function input(view: SessionView, overrides: Partial<ResultInput> = {}): ResultInput {
  return {
    view,
    game: GAME,
    text: { t, formatNumber: (value) => `#${String(value)}`, gameText: (m) => `game:${m.id}` },
    actions: {
      onNext: jest.fn(),
      onReplay: jest.fn(),
      onLevels: jest.fn(),
      onTryAgain: jest.fn(),
      onHome: jest.fn(),
      onContinue: jest.fn(),
      onOpenPremium: jest.fn(),
    },
    continueOffer: 'watch-ad',
    isReducedMotion: false,
    extras: {
      streakDays: 4,
      endlessBest: 120,
      nudgePriceText: null,
    },
    ...overrides,
  };
}

describe('resultModelOf', () => {
  it('shows nothing while the run is live, and nothing for the tutorial', () => {
    expect(resultModelOf(input({ ...VIEW, status: 'playing', summary: null }))).toBeNull();
    expect(resultModelOf(input({ ...VIEW, status: 'paused', summary: null }))).toBeNull();
    expect(resultModelOf(input({ ...VIEW, ref: { kind: 'tutorial' } }))).toBeNull();
  });

  it('shows a won level with its stars, score, goal line and par', () => {
    expect(resultModelOf(input(VIEW))).toMatchObject({
      kind: 'win',
      modeText: 'game-screen.mode.level {"level":3}',
      stars: 2,
      scoreText: '#90',
      isNewBest: true,
      winTitle: 'game:tally.win-title',
      movesCount: 7,
      par: 5,
    });
  });

  it('passes no par and the level best for a score-rated level (the S7 score line)', () => {
    const scored = { ...VIEW, summary: { ...WON, par: null } } as const;
    expect(resultModelOf(input(scored))).toMatchObject({
      kind: 'win',
      scoreText: '#90',
      par: null,
      score: 90,
      bestScore: 90,
    });
  });

  it('shows the saved best, not this score, after a win that did not beat it', () => {
    const summary = { ...WON, par: null, isNewBest: false, levelBestScore: 150 } as const;
    expect(resultModelOf(input({ ...VIEW, summary }))).toMatchObject({
      kind: 'win',
      isNewBest: false,
      score: 90,
      bestScore: 150,
    });
  });

  it('keeps the par of a moves-rated level next to its best', () => {
    expect(resultModelOf(input(VIEW))).toMatchObject({ par: 5, bestScore: 90 });
  });

  it('offers the continue on a pending loss: an ad, or free for Premium owners', () => {
    expect(resultModelOf(input(LOST_VIEW))).toMatchObject({
      kind: 'lose',
      logo: GAME.logo,
      loseReason: 'game:tally.lose.overshot',
      continueOffer: 'ad',
    });
    const premium = resultModelOf(input(LOST_VIEW, { continueOffer: 'free' }));
    expect(premium).toMatchObject({ continueOffer: 'premium' });
    const offline = resultModelOf(input(LOST_VIEW, { continueOffer: 'hidden' }));
    expect(offline).toMatchObject({ continueOffer: null });
  });

  it('shows a recorded loss without a continue', () => {
    const summary = {
      ...WON,
      isWon: false,
      stars: 0,
      loseReasonKey: 'tally.lose.overshot',
    } as const;
    const view = { ...LOST_VIEW, continueState: 'used', summary } as const;
    expect(resultModelOf(input(view))).toMatchObject({ kind: 'lose', continueOffer: null });
  });

  it('shows daily and endless runs with their streak and best', () => {
    const daily = { kind: 'daily', date: '2026-09-26' } as const;
    const dailyView = { ...VIEW, ref: daily, summary: { ...WON, ref: daily, stars: 0 } } as const;
    expect(resultModelOf(input(dailyView))).toMatchObject({ kind: 'daily', streakDays: 4 });
    const endless = { kind: 'endless' } as const;
    const endlessView = {
      ...VIEW,
      status: 'lost',
      ref: endless,
      summary: { ...WON, ref: endless, isWon: false, stars: 0 },
    } as const;
    expect(resultModelOf(input(endlessView))).toMatchObject({ kind: 'endless', bestScore: 120 });
  });
});
