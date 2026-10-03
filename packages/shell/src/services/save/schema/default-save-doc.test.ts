// packages/shell/src/services/save/schema/default-save-doc.test.ts
import fc from 'fast-check';
import * as v from 'valibot';

import {
  createDefaultSaveDoc,
  DEFAULT_SETTINGS,
} from '@e07/shell/services/save/schema/default-save-doc.ts';
import {
  LATEST_SAVE_SCHEMA,
  LATEST_SAVE_VERSION,
} from '@e07/shell/services/save/schema/save-doc.ts';
import { SETTINGS_V1 } from '@e07/shell/services/save/schema/save-sections-v1.ts';

const GAME_ID = 'line-siege';

function accepts(doc: unknown): boolean {
  return v.safeParse(LATEST_SAVE_SCHEMA, doc).success;
}

function withExtraKey(path: 'top' | 'settings' | 'premium'): unknown {
  const doc = createDefaultSaveDoc(GAME_ID);
  if (path === 'top') {
    return { ...doc, coins: 0 };
  }
  return { ...doc, [path]: { ...doc[path], typo: true } };
}

const percent = fc.integer({ min: 0, max: 100 });
const { entries } = SETTINGS_V1;
const settingsArb = fc.record({
  language: fc.constantFrom(null, ...entries.language.wrapped.options),
  digits: fc.constantFrom(...entries.digits.options),
  soundEnabled: fc.boolean(),
  soundVolume: percent,
  musicEnabled: fc.boolean(),
  musicVolume: percent,
  vibrationEnabled: fc.boolean(),
  theme: fc.constantFrom(...entries.theme.options),
  colorBlind: fc.boolean(),
  reduceMotion: fc.constantFrom(...entries.reduceMotion.options),
  hintsDuringPlay: fc.boolean(),
});

describe('createDefaultSaveDoc', () => {
  // spec 8.6: "Everything is saved on the phone only: current level state, level results,
  // stars, daily results, statistics, settings, Premium status." "Every save carries a
  // version number."
  it('creates a first-launch document the save schema accepts (spec 8.6)', () => {
    const doc = createDefaultSaveDoc(GAME_ID);

    expect(accepts(doc)).toBe(true);
    expect(doc.schemaVersion).toBe(LATEST_SAVE_VERSION);
    expect(LATEST_SAVE_VERSION).toBe(1);
    expect(doc.gameId).toBe(GAME_ID);
  });

  // spec 8.7: "Music is off by default, because no platform API reports whether the
  // player's own music is playing."
  it('starts with the pinned first-launch settings, music off (spec 8.7)', () => {
    expect(DEFAULT_SETTINGS).toStrictEqual({
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
    });
    expect(createDefaultSaveDoc(GAME_ID).settings).toStrictEqual(DEFAULT_SETTINGS);
  });

  it('starts without Premium, without a run and with empty progress, daily and stats', () => {
    const doc = createDefaultSaveDoc(GAME_ID);

    expect(doc.premium).toStrictEqual({
      owned: false,
      ownedSinceMs: null,
      lastCheckedAtMs: null,
      revokedAtMs: null,
    });
    expect(doc.run).toBeNull();
    expect(doc.progress).toStrictEqual({ levels: {}, endlessBest: 0 });
    expect(doc.daily).toStrictEqual({
      results: {},
      completed: 0,
      streak: { lastDate: null, length: 0 },
      bestStreak: 0,
    });
    expect(doc.stats.gamesPlayed).toBe(0);
    expect(doc.stats.days).toStrictEqual({});
    expect(doc.stats.counters).toStrictEqual({});
  });
});

describe('LATEST_SAVE_SCHEMA', () => {
  it.each(['top', 'settings', 'premium'] as const)(
    'rejects an unknown key at any depth (N10): %s',
    (path) => {
      expect(accepts(withExtraKey(path))).toBe(false);
    },
  );

  it('rejects a document that claims another version', () => {
    expect(accepts({ ...createDefaultSaveDoc(GAME_ID), schemaVersion: 2 })).toBe(false);
  });

  // spec 8.14: "recovers where possible: a broken level falls back to Home with a gentle
  // message, never a crash loop." The game's own parser judges the run later.
  it('accepts any game state inside a saved run (spec 8.14)', () => {
    fc.assert(
      fc.property(fc.jsonValue(), fc.jsonValue(), (state, move) => {
        const run = {
          ref: { kind: 'level', level: 3 },
          seed: 42,
          difficulty: 10,
          stateVersion: 1,
          state,
          log: [{ kind: 'move', move }, { kind: 'continue' }],
          moveCount: 1,
          undoCount: 0,
          hintsUsed: 0,
          continuesUsed: 1,
          playMs: 1000,
          resumeOnLaunch: true,
        };

        expect(accepts({ ...createDefaultSaveDoc(GAME_ID), run })).toBe(true);
      }),
    );
  });

  it('keeps every settings value from its own choices valid after a JSON round trip', () => {
    fc.assert(
      fc.property(settingsArb, (settings) => {
        const doc = { ...createDefaultSaveDoc(GAME_ID), settings };

        expect(accepts(JSON.parse(JSON.stringify(doc)))).toBe(true);
      }),
    );
  });
});
