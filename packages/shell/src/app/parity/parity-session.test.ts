// packages/shell/src/app/parity/parity-session.test.ts
import { PARITY_FIXTURE } from './parity-fixture.ts';
import { PARITY_PLANS } from './parity-plans.ts';
import {
  endParitySession,
  isParityBoardProbeOn,
  isParityMotionFrozen,
  parityBuildNumber,
  parityFrameState,
  parityGameFixture,
  startParitySession,
} from './parity-session.ts';

import type { ParityRequest } from './parity-request.ts';

const LEVELS_REQUEST: ParityRequest = {
  frame: 's8-levels',
  plan: PARITY_PLANS['s8-levels'],
  theme: 'light',
  lang: 'en',
  game: 'lineSiege',
  date: '2026-09-27',
  scrollY: 0,
};

const PAUSE_REQUEST: ParityRequest = {
  ...LEVELS_REQUEST,
  frame: 's6-pause',
  plan: PARITY_PLANS['s6-pause'],
};

describe('the parity session', () => {
  afterEach(() => {
    endParitySession();
  });

  it('answers nothing on a normal launch', () => {
    expect(parityBuildNumber()).toBeNull();
    expect(parityFrameState()).toBeNull();
    expect(isParityMotionFrozen()).toBe(false);
    expect(isParityBoardProbeOn()).toBe(false);
    expect(parityGameFixture()).toBeNull();
  });

  it('gives the fixture build number and the frame state of the request', () => {
    startParitySession(LEVELS_REQUEST);

    expect(parityBuildNumber()).toBe('8');
    expect(parityFrameState()).toBe('levels-locked-tile-tapped');
  });

  it('has no state for a frame that draws the plain screen', () => {
    startParitySession({ ...LEVELS_REQUEST, frame: 's4-home', plan: PARITY_PLANS['s4-home'] });

    expect(parityFrameState()).toBeNull();
  });

  it('freezes motion for every capture, without a probe', () => {
    startParitySession(LEVELS_REQUEST);

    expect(isParityMotionFrozen()).toBe(true);
    expect(isParityBoardProbeOn()).toBe(false);
  });

  it('turns the board probe on and opens no frame state in the probe launch', () => {
    startParitySession({ ...PAUSE_REQUEST, probe: 'board' });

    expect(isParityBoardProbeOn()).toBe(true);
    expect(parityFrameState()).toBeNull();
    expect(isParityMotionFrozen()).toBe(true);
  });

  it("gives the Game frames the design's numbers for the design game", () => {
    startParitySession(PAUSE_REQUEST);

    expect(parityGameFixture()).toStrictEqual({
      designGame: 'lineSiege',
      level: 12,
      score: 1840,
      progress: { mid: { defeated: 3, total: 10 }, full: { defeated: 10, total: 10 } },
      stars: 3,
      isNewBest: true,
      movesCount: 7,
      par: 7,
      bestScore: 1840,
      loseReasonKey: 'line-siege.lose.broke-through',
      isContinueOffered: true,
      outcome: null,
    });
  });

  it('gives a score-rated game no par, so the win card shows the score line', () => {
    startParitySession(PAUSE_REQUEST);

    expect(parityGameFixture({ isScoreRated: true })?.par).toBeNull();
    expect(parityGameFixture({ isScoreRated: false })?.par).toBe(7);
  });

  it.each([
    ['s7-result-win', 'won'],
    ['s7-result-lose', 'lost'],
  ] as const)('says %s shows a %s level', (frame, outcome) => {
    startParitySession({ ...LEVELS_REQUEST, frame, plan: PARITY_PLANS[frame] });

    expect(parityGameFixture()?.outcome).toBe(outcome);
  });

  it('has no game numbers for a frame off the Game route or an unknown design game', () => {
    startParitySession(LEVELS_REQUEST);
    expect(parityGameFixture()).toBeNull();

    startParitySession({ ...PAUSE_REQUEST, game: 'noSuchGame' });
    expect(parityGameFixture({ isScoreRated: false }, PARITY_FIXTURE)).toBeNull();
  });

  it('knows the params of every design game', () => {
    startParitySession({ ...PAUSE_REQUEST, game: 'flockTilt' });
    expect(parityGameFixture()?.progress.mid).toStrictEqual({ penned: 2, total: 4 });

    startParitySession({ ...PAUSE_REQUEST, game: 'scrapShove' });
    expect(parityGameFixture()?.loseReasonKey).toBe('scrap-shove.lose.caught');
  });
});
