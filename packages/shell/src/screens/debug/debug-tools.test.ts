// packages/shell/src/screens/debug/debug-tools.test.ts
import { isolate } from '@e07/shell/i18n/bidi.ts';

import {
  dateChoices,
  errorLogText,
  ERROR_LOG_LINES,
  giveStarsRequest,
  levelChoices,
  localeValue,
  LOCALE_CHOICES,
  networkAttemptsOf,
  packChoices,
  stateText,
  unlockAllRequest,
  utcStamp,
} from './debug-tools.ts';

import type { ErrorLogEntry } from '@e07/shell/services/error-log/error-log-port.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

const WON = {
  stars: 2,
  bestScore: 10,
  bestMoves: null,
  completions: 1,
  firstCompletedOn: '2026-09-26',
} as const;
const LEVELS: SaveDoc['progress']['levels'] = { '1': WON, '3': WON };

const entry = (source: ErrorLogEntry['source'], atMs = 0): ErrorLogEntry => ({
  atMs,
  source,
  message: `${source} failed`,
});

describe('S15 tools', () => {
  it('unlocks every level without a result and keeps the results there are', () => {
    expect(unlockAllRequest(LEVELS, 4)).toStrictEqual({
      stars: [
        { level: 2, stars: 1 },
        { level: 4, stars: 1 },
      ],
    });
    expect(unlockAllRequest({ '1': WON }, 1)).toBeNull();
  });

  it('gives every won level three stars, in level order', () => {
    expect(giveStarsRequest({ '10': WON, '2': WON })).toStrictEqual({
      stars: [
        { level: 2, stars: 3 },
        { level: 10, stars: 3 },
      ],
    });
    expect(giveStarsRequest({})).toBeNull();
  });

  it('offers the packs, then the levels of the chosen pack', () => {
    expect(packChoices(3, 30).map((choice) => choice.label)).toStrictEqual([
      'Levels 1-30',
      'Levels 31-60',
      'Levels 61-90',
    ]);
    const second = levelChoices(1, 30);
    expect([second[0], second.at(-1)]).toStrictEqual([
      { label: 'Level 31', value: 31 },
      { label: 'Level 60', value: 60 },
    ]);
  });

  it('offers dates around today, the real calendar and the screenshot day', () => {
    expect(dateChoices('2026-12-31').map((choice) => choice.value)).toStrictEqual([
      null,
      '2026-12-30',
      '2027-01-01',
      '2027-01-07',
      '2026-09-26',
    ]);
  });

  it('reloads back to S15 after a language flip, and changes digits in place', () => {
    expect(LOCALE_CHOICES.map((choice) => choice.value)).toContainEqual({
      lang: 'fa',
      screen: 'debug',
    });
    expect(LOCALE_CHOICES.map((choice) => choice.value)).toContainEqual({ digits: 'latin' });
  });

  it('shows the seed override and the saved run as JSON', () => {
    expect(JSON.parse(stateText(42, null))).toStrictEqual({ seedOverride: 42, run: null });
  });

  it('lists the newest errors, one per line, and says when there are none', () => {
    const entries = Array.from({ length: 12 }, (_, index) => entry('save', index * 1000));
    const lines = errorLogText(entries).split('\n');
    expect(lines).toHaveLength(ERROR_LOG_LINES);
    expect(lines[0]).toBe('1970-01-01 00:00:00 UTC save: save failed');
    expect(errorLogText([])).toBe('No errors recorded.');
  });

  it('writes error-log times as UTC days and clock times', () => {
    expect(utcStamp(1_790_424_005_000)).toBe('2026-09-26 12:00:05 UTC');
  });

  it('counts only the network guard entries as network attempts', () => {
    expect(networkAttemptsOf([entry('network'), entry('ads'), entry('network')])).toBe(2);
    expect(networkAttemptsOf([])).toBe(0);
  });

  it('keeps the locale value left-to-right inside right-to-left text', () => {
    expect(localeValue('fa', 'rtl', '۱۲۳')).toBe(isolate('fa · rtl · ۱۲۳'));
  });
});
