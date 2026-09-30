// packages/shell/src/app/parity/parity-doc.ts
// Test builds only (reached through test-only.ts). The save document a parity launch starts from:
// the design's player (the fixture) for the frame's plan, written through the one save service.
import { newSession } from '@e07/shell/game-host/open-session.ts';
import { toSavedRun } from '@e07/shell/game-host/saved-run.ts';
import { DEFAULT_STATS } from '@e07/shell/services/save/schema/default-save-doc.ts';

import { PARITY_FIXTURE } from './parity-fixture.ts';

import type { ParityFixture } from './parity-fixture.ts';
import type { ParityRequest } from './parity-request.ts';
import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

export type ParityDocInput<T extends ShellGameTypes> = {
  /** The document the save service holds now (a first launch, or the previous frame's). */
  readonly base: SaveDoc;
  readonly game: ShellGameModule<T>;
  readonly request: ParityRequest;
  /** Defaults to the committed fixture (parity-fixture-save.json). */
  readonly fixture?: ParityFixture;
};

/** The Language setting: System in English renders, the render language otherwise (S11, S11a). */
function settingsOf(request: ParityRequest, fixture: ParityFixture): SaveDoc['settings'] {
  return { ...fixture.settings, language: request.lang === 'en' ? null : request.lang };
}

/**
 * Premium follows the plan. The save keeps Premium unless a revocation carries a date
 * (keepPremiumUnlessRevoked), so a non-Premium frame after a Premium one turns it off the way a
 * refund does: with the fixture's revocation date. Without it, every later frame stays Premium.
 */
function premiumOf(
  isPremium: boolean,
  wasOwned: boolean,
  fixture: ParityFixture,
): SaveDoc['premium'] {
  if (isPremium) {
    return {
      owned: true,
      ownedSinceMs: fixture.premium.ownedSinceMs,
      lastCheckedAtMs: null,
      revokedAtMs: null,
    };
  }
  const revokedAtMs = wasOwned ? fixture.premium.revokedAtMs : null;
  return { owned: false, ownedSinceMs: null, lastCheckedAtMs: null, revokedAtMs };
}

/** "Continue – Level N": the fixture's level run, built by the game itself (never reopened at launch). */
function runOf<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
  fixture: ParityFixture,
): SaveDoc['run'] {
  const session = newSession(game, fixture.run.ref, () => 1);
  if (session === null) return null;
  return toSavedRun(session, game.persistence.stateVersion, fixture.run.resumeOnLaunch);
}

/** The demo player's statistics, with the counters of the game this launch shows. */
function statsOf(request: ParityRequest, fixture: ParityFixture): SaveDoc['stats'] {
  return { ...fixture.stats, counters: fixture.counters[request.game] ?? {} };
}

/** Progress, run, daily and statistics: the demo player, or a player with nothing yet. */
function playerOf<T extends ShellGameTypes>(
  input: ParityDocInput<T>,
  fixture: ParityFixture,
): Pick<SaveDoc, 'progress' | 'run' | 'daily' | 'stats'> {
  const { request, game } = input;
  if (request.plan.progress === 'demo') {
    return {
      progress: fixture.progress,
      run: runOf(game, fixture),
      daily: fixture.daily,
      stats: statsOf(request, fixture),
    };
  }
  return {
    progress: { levels: {}, endlessBest: 0 },
    run: null,
    daily: { results: {}, completed: 0, streak: { lastDate: null, length: 0 }, bestStreak: 0 },
    stats: DEFAULT_STATS,
  };
}

/** Ad consent: the fixture's (given) or, for the S3 consent moment, still to be asked. */
function adsOf(request: ParityRequest, fixture: ParityFixture): SaveDoc['ads'] {
  if (request.plan.consent === 'given') return fixture.ads;
  return { ...fixture.ads, consent: { ...fixture.ads.consent, canRequestAds: false } };
}

/** The save document for this frame: demo, new-player or first-run (plan.progress), Premium or not. */
export function parityDoc<T extends ShellGameTypes>(input: ParityDocInput<T>): SaveDoc {
  const { base, request } = input;
  const fixture = input.fixture ?? PARITY_FIXTURE;
  const isFirstRun = request.plan.progress === 'first-run';
  return {
    ...base,
    ...playerOf(input, fixture),
    settings: settingsOf(request, fixture),
    firstRun: { languageChosen: !isFirstRun, tutorialDone: !isFirstRun },
    hints: fixture.hints,
    ads: adsOf(request, fixture),
    premium: premiumOf(request.plan.premium, base.premium.owned, fixture),
    upsell: fixture.upsell,
  };
}
