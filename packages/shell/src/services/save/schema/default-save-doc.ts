// packages/shell/src/services/save/schema/default-save-doc.ts
import { LATEST_SAVE_VERSION } from '@e07/shell/services/save/schema/save-doc.ts';

import type { SaveDoc, SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';

/** First-launch settings. Music is OFF by default (never over the player's music, 8.7). */
export const DEFAULT_SETTINGS: SaveSettings = {
  language: null,
  digits: 'automatic',
  soundEnabled: true,
  soundVolume: 80,
  musicEnabled: false,
  musicVolume: 60,
  vibrationEnabled: true,
  theme: 'system',
  colorBlind: false,
  reduceMotion: 'system',
  hintsDuringPlay: true,
};

/** Empty statistics: a new player, and what "Reset statistics" writes. */
export const DEFAULT_STATS: SaveDoc['stats'] = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  playMs: 0,
  bestScore: { level: 0, daily: 0, endless: 0 },
  currentWinStreak: 0,
  longestWinStreak: 0,
  days: {},
  counters: {},
};

export function createDefaultSaveDoc(gameId: string): SaveDoc {
  return {
    schemaVersion: LATEST_SAVE_VERSION,
    gameId,
    settings: DEFAULT_SETTINGS,
    firstRun: { languageChosen: false, tutorialDone: false },
    progress: { levels: {}, endlessBest: 0 },
    run: null,
    daily: { results: {}, completed: 0, streak: { lastDate: null, length: 0 }, bestStreak: 0 },
    stats: DEFAULT_STATS,
    hints: { freeDate: null, freeUsed: 0 },
    ads: {
      history: {
        lastInterstitialAtMs: null,
        levelsCompletedSinceInterstitial: 0,
        didLastInterstitialFollowLoss: false,
      },
      consent: { canRequestAds: null, isPrivacyOptionsRequired: false },
    },
    premium: {
      owned: false,
      ownedSinceMs: null,
      lastCheckedAtMs: null,
      revokedAtMs: null,
    },
    upsell: { lastShownOn: null },
  };
}
