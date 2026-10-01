// packages/shell/src/game-host/top-bar-model.test.ts
import { isolate } from '@e07/shell/i18n/bidi.ts';
import { perkOffer } from '@e07/shell/services/ads/perk-offer.ts';

import { modeTextOf, topBarPropsOf } from './top-bar-model.ts';

import type { SessionView } from './session-view.ts';
import type { RunText, TopBarInput } from './top-bar-model.ts';
import type { TFunction } from '@e07/shell/i18n/create-t.ts';

/** A readable fake t(): the key, then its values. */
const t: TFunction = (key, values) =>
  values === undefined ? key : `${key} ${JSON.stringify(values)}`;
const TEXT: RunText = {
  t,
  formatNumber: (value) => `#${String(value)}`,
  gameText: (message) => `game:${message.id}`,
};
const LEVEL_12 = { kind: 'level', level: 12 } as const;
const VIEW: SessionView = {
  status: 'playing',
  ref: LEVEL_12,
  hud: {
    mode: LEVEL_12,
    goal: { kind: 'moves-par', moves: 5, par: 7 },
    score: 1840,
  },
  moveCount: 5,
  isUndoSupported: true,
  canUndo: true,
  isHintSupported: true,
  isHintShown: false,
  continueState: 'none',
  loseReasonKey: null,
  summary: null,
  eventSeq: 5,
};

function input(overrides: Partial<TopBarInput> = {}): TopBarInput {
  return {
    view: VIEW,
    hintOffer: 'free',
    text: TEXT,
    labels: { undo: 'Undo', hint: 'Hint' },
    isReducedMotion: false,
    onUndo: jest.fn(),
    onHint: jest.fn(),
    onPause: jest.fn(),
    ...overrides,
  };
}

/** perkOffer for the hint as the Game screen asks it, with no rewarded ad loaded. */
function hintOfferWith(freeHintsLeft: number): TopBarInput['hintOffer'] {
  const config = {
    isAdsEnabled: true,
    minLevelsCompletedBeforeFirst: 3,
    minMsBetweenInterstitials: 180_000,
    minLevelsCompletedBetween: 2,
  };
  const context = {
    isPremium: false,
    isOnline: true,
    canRequestAds: true,
    isTutorialDone: true,
    levelsCompletedTotal: 4,
  };
  return perkOffer(
    { kind: 'hint', freeHintsLeft },
    { config, context, rewardedStatus: 'unavailable' },
  );
}

describe('topBarPropsOf', () => {
  it('offers the free hint only while game.config leaves one today (hints.freePerDay)', () => {
    // selectFreeHintsLeft(progress, today, freePerDay) is 0 all day for a game with freePerDay 0.
    expect(topBarPropsOf(input({ hintOffer: hintOfferWith(0) })).hint).toBeNull();
    expect(topBarPropsOf(input({ hintOffer: hintOfferWith(1) })).hint).toMatchObject({
      isAvailable: true,
    });
  });

  it('shows the mode, "Moves / Par" and the score in the chosen digits', () => {
    expect(topBarPropsOf(input())).toMatchObject({
      modeText: 'game-screen.mode.level {"level":12}',
      progressText: 'game-screen.progress.moves-par {"moves":5,"par":7}',
      scoreText: '#1840',
      undo: { label: 'Undo', isAvailable: true },
      hint: { label: 'Hint', isAvailable: true },
    });
  });

  it("shows the game's own goal line when the level is not par-rated", () => {
    const goal = { kind: 'game', message: { id: 'tally.goal', values: { target: 4 } } } as const;
    const view = { ...VIEW, hud: { ...VIEW.hud, goal } };
    expect(topBarPropsOf(input({ view })).progressText).toBe('game:tally.goal');
  });

  it('leaves out tools the game lacks and disables tools that cannot be used now', () => {
    const view = { ...VIEW, isUndoSupported: false, canUndo: false, isHintShown: true };
    const props = topBarPropsOf(input({ view }));
    expect(props.undo).toBeNull();
    expect(props.hint?.isAvailable).toBe(false);
    const noUndoYet = topBarPropsOf(input({ view: { ...VIEW, canUndo: false } }));
    expect(noUndoYet.undo?.isAvailable).toBe(false);
  });

  it('hides the hint when there is no way to pay for it and in games without hints', () => {
    expect(topBarPropsOf(input({ hintOffer: 'hidden' })).hint).toBeNull();
    const view = { ...VIEW, isHintSupported: false };
    expect(topBarPropsOf(input({ view })).hint).toBeNull();
  });
});

describe('modeTextOf', () => {
  it('labels daily and endless runs and gives the tutorial no label', () => {
    expect(modeTextOf({ kind: 'daily', date: '2026-09-26' }, TEXT)).toContain(
      'game-screen.mode.daily',
    );
    expect(modeTextOf({ kind: 'endless' }, TEXT)).toBe('common.mode.endless');
    expect(modeTextOf({ kind: 'tutorial' }, TEXT)).toBe('');
  });

  it('hands t() the daily date without its own isolates, so each value is isolated once', () => {
    // Like the Shell's t(): every value comes back isolated (FSI…PDI).
    const isolating: TFunction = (key, values) =>
      values === undefined
        ? key
        : [key, ...Object.values(values).map((value) => isolate(String(value)))].join(' ');
    const label = modeTextOf({ kind: 'daily', date: '2026-09-26' }, { ...TEXT, t: isolating });
    expect(label).toBe(`game-screen.mode.daily ${isolate(`date.day-month 26 date.month-short.9`)}`);
  });
});
