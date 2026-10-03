// packages/shell/src/services/save/schema/save-sections-v1.ts
import * as v from 'valibot';

import {
  COUNT,
  DATE_KEY,
  KEBAB_ID,
  LEVEL_KEY,
  PERCENT,
  STARS,
} from '@e07/shell/services/save/schema/save-primitives.ts';

export const SETTINGS_V1 = v.strictObject({
  /** null = "System" (the i18n layer resolves it against the device languages). */
  language: v.nullable(v.picklist(['en', 'de', 'fa', 'ckb'])),
  digits: v.picklist(['automatic', 'latin', 'local']),
  soundEnabled: v.boolean(),
  soundVolume: PERCENT,
  musicEnabled: v.boolean(),
  musicVolume: PERCENT,
  vibrationEnabled: v.boolean(),
  theme: v.picklist(['system', 'light', 'dark']),
  colorBlind: v.boolean(),
  reduceMotion: v.picklist(['system', 'on', 'off']),
  hintsDuringPlay: v.boolean(),
});

export const FIRST_RUN_V1 = v.strictObject({
  languageChosen: v.boolean(),
  tutorialDone: v.boolean(),
});

export const LEVEL_RESULT_V1 = v.strictObject({
  stars: STARS,
  bestScore: COUNT,
  bestMoves: v.nullable(COUNT),
  completions: COUNT,
  firstCompletedOn: DATE_KEY,
});

export const PROGRESS_V1 = v.strictObject({
  levels: v.record(LEVEL_KEY, LEVEL_RESULT_V1),
  endlessBest: COUNT,
});

/** The first finished attempt of a day; replays never change it (spec S9). */
export const DAILY_RESULT_V1 = v.strictObject({
  won: v.boolean(),
  score: COUNT,
  moves: COUNT,
  playMs: COUNT,
});

export const DAILY_V1 = v.strictObject({
  /** Pruned to the last 60 days on write. */
  results: v.record(DATE_KEY, DAILY_RESULT_V1),
  /** Days ever recorded (S10 "Challenges completed"); results are pruned, this count is not. */
  completed: COUNT,
  streak: v.strictObject({ lastDate: v.nullable(DATE_KEY), length: COUNT }),
  bestStreak: COUNT,
});

export const STATS_V1 = v.strictObject({
  gamesPlayed: COUNT,
  wins: COUNT,
  losses: COUNT,
  playMs: COUNT,
  bestScore: v.strictObject({ level: COUNT, daily: COUNT, endless: COUNT }),
  currentWinStreak: COUNT,
  longestWinStreak: COUNT,
  /** Games and time per local day, pruned to the last 14 days (7-day chart). */
  days: v.record(DATE_KEY, v.strictObject({ games: COUNT, playMs: COUNT })),
  /** Game-specific counters by CounterSpec.id. */
  counters: v.record(KEBAB_ID, COUNT),
});

export const HINTS_V1 = v.strictObject({
  freeDate: v.nullable(DATE_KEY),
  freeUsed: COUNT,
});

/** The ads service's AdHistory (frequency caps survive a kill) + the last consent answer. */
export const ADS_V1 = v.strictObject({
  history: v.strictObject({
    lastInterstitialAtMs: v.nullable(COUNT),
    levelsCompletedSinceInterstitial: COUNT,
    didLastInterstitialFollowLoss: v.boolean(),
  }),
  consent: v.strictObject({
    canRequestAds: v.nullable(v.boolean()),
    isPrivacyOptionsRequired: v.boolean(),
  }),
});

/** Never touched by "Reset all progress" (spec S11). */
export const PREMIUM_V1 = v.strictObject({
  owned: v.boolean(),
  ownedSinceMs: v.nullable(COUNT),
  lastCheckedAtMs: v.nullable(COUNT),
  revokedAtMs: v.nullable(COUNT),
});

export const UPSELL_V1 = v.strictObject({
  lastShownOn: v.nullable(DATE_KEY),
});
