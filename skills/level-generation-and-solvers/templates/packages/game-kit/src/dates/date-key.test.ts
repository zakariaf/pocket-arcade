// packages/game-kit/src/dates/date-key.test.ts
import fc from 'fast-check';

import { dailySeed } from './daily-seed.ts';
import { addDays, dayNumber, daysBetween, fromDayNumber, isoWeekday } from './date-key.ts';

describe('date-key', () => {
  it('matches known day numbers', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('2026-09-26')).toBe(20_722);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2100-02-28', 1)).toBe('2100-03-01');
    expect(addDays('2000-02-28', 1)).toBe('2000-02-29');
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-09-27', '2026-09-26')).toBe(-1);
  });

  it('names ISO weekdays (1 = Monday ... 7 = Sunday)', () => {
    expect(isoWeekday('1970-01-01')).toBe(4);
    expect(isoWeekday('2000-01-01')).toBe(6);
    expect(isoWeekday('2024-02-29')).toBe(4);
    expect(isoWeekday('2026-09-26')).toBe(6);
    expect(isoWeekday('2026-09-28')).toBe(1);
    expect(isoWeekday('1969-12-28')).toBe(7);
  });

  it('rejects keys that are not YYYY-MM-DD', () => {
    expect(dayNumber('2026-9-26')).toBeNaN();
    expect(dayNumber('26.09.2026')).toBeNaN();
  });

  it('returns every day number between 1900 and 2400 after a round trip', () => {
    fc.assert(
      fc.property(fc.integer({ min: -25_567, max: 157_000 }), (days) => {
        expect(dayNumber(fromDayNumber(days))).toBe(days);
      }),
      { numRuns: 2000 },
    );
  });

  it('pins the daily seed (compatibility contract: same level for every player)', () => {
    expect(dailySeed('2026-09-26', 17)).toBe(2_599_028_541);
    expect(dailySeed('2026-09-27', 17)).toBe(2_582_250_922);
    expect(dailySeed('2027-01-01', 17)).toBe(2_349_681_313);
    expect(dailySeed('2026-09-26', 0)).toBe(2_362_601_272);
    expect(dailySeed('2028-02-29', 4242)).toBe(773_016_242);
  });

  it('gives a different seed for another day or another game salt', () => {
    expect(dailySeed('2026-09-26', 18)).not.toBe(dailySeed('2026-09-26', 17));
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), fc.nat(0xffff), (days, salt) => {
        const seed = dailySeed(fromDayNumber(days), salt);
        expect(Number.isInteger(seed) && seed >= 0 && seed <= 0xffff_ffff).toBe(true);
      }),
    );
  });
});
