// packages/shell/src/game-host/run-end-policy.test.ts
import { isLossStranded } from './run-end-policy.ts';

import type { RunSummary } from './run-summary.ts';
import type { SessionView } from './session-view.ts';
import type { PerkOffer } from '@e07/shell/services/ads/perk-offer.ts';

const ENDLESS = { kind: 'endless' } as const;
const LOST: SessionView = {
  status: 'lost',
  ref: ENDLESS,
  hud: {
    mode: ENDLESS,
    goal: { kind: 'game', message: { id: 'tally.goal', values: {} } },
    score: 340,
  },
  moveCount: 31,
  isUndoSupported: false,
  canUndo: false,
  isHintSupported: false,
  isHintShown: false,
  continueState: 'offered',
  loseReasonKey: 'tally.lose.overshot',
  summary: null,
  eventSeq: 31,
};
const RECORDED: RunSummary = {
  ref: ENDLESS,
  isWon: false,
  loseReasonKey: 'tally.lose.overshot',
  score: 340,
  moves: 31,
  playMs: 60_000,
  stars: 0,
  par: null,
  isNewBest: true,
  levelBestScore: null,
  nextLevel: null,
};

describe('isLossStranded (L11)', () => {
  it('is true for a pending loss whose continue nobody can give', () => {
    expect(isLossStranded(LOST, 'hidden')).toBe(true);
  });

  it.each<PerkOffer>(['loading', 'watch-ad', 'free'])(
    'keeps the loss open while the offer is %s (the player can still take it)',
    (offer) => {
      expect(isLossStranded(LOST, offer)).toBe(false);
    },
  );

  it.each<readonly [string, SessionView]>([
    ['the continue was used', { ...LOST, continueState: 'used' }],
    ['the game has no continue', { ...LOST, continueState: 'none' }],
    ['the run is already recorded', { ...LOST, summary: RECORDED }],
    ['the run was won', { ...LOST, status: 'won', continueState: 'none' }],
    ['the run is still playing', { ...LOST, status: 'playing', continueState: 'none' }],
    ['it is the tutorial', { ...LOST, ref: { kind: 'tutorial' } }],
  ])('is false when %s', (_name, view) => {
    expect(isLossStranded(view, 'hidden')).toBe(false);
  });
});
