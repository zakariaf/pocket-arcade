// daily-checks.mjs: the spec rules for date keys, the daily seed and the daily model (spec S9, 8.3).
// Each check: { rule, fn, name, needs, fix, run(modules, assert) } and throws when a rule breaks.

const EMPTY_DAILY = () => ({ results: {}, completed: 0, streak: { lastDate: null, length: 0 }, bestStreak: 0 });
const WIN = { won: true, score: 120, moves: 9, playMs: 60_000 };
const LOSS = { won: false, score: 10, moves: 4, playMs: 20_000 };
const record = (dailyModel, dates, result = WIN, start = EMPTY_DAILY()) =>
  dates.reduce((acc, date) => dailyModel.recordDailyResult(acc, date, result), start);

/** Golden seeds: the compatibility contract "same level for every player on the same day". */
export const SEED_GOLDENS = [
  ['2026-09-26', 17, 2_599_028_541],
  ['2026-09-27', 17, 2_582_250_922],
  ['2027-01-01', 17, 2_349_681_313],
  ['2026-09-26', 0, 2_362_601_272],
  ['2028-02-29', 4242, 773_016_242],
];

export const DAILY_CHECKS = [
  {
    rule: 'date-math', fn: 'dayNumber', needs: ['dateKey'], name: 'calendar maths on YYYY-MM-DD keys is exact',
    fix: "Use integer day numbers (Hinnant's days_from_civil / civil_from_days); never Date.",
    run: ({ dateKey }, { strictEqual, ok }) => {
      strictEqual(dateKey.dayNumber('1970-01-01'), 0);
      strictEqual(dateKey.dayNumber('2026-09-26'), 20_722);
      strictEqual(dateKey.addDays('2026-02-28', 1), '2026-03-01');
      strictEqual(dateKey.addDays('2028-02-28', 1), '2028-02-29');
      strictEqual(dateKey.addDays('2100-02-28', 1), '2100-03-01');
      strictEqual(dateKey.addDays('2000-02-28', 1), '2000-02-29');
      strictEqual(dateKey.daysBetween('2026-12-31', '2027-01-01'), 1);
      ok(Number.isNaN(dateKey.dayNumber('2026-9-26')), 'a malformed key gives NaN');
      strictEqual(dateKey.isoWeekday('2026-09-26'), 6, 'isoWeekday 2026-09-26 is a Saturday');
      strictEqual(dateKey.isoWeekday('1969-12-28'), 7, 'isoWeekday before 1970 is a Sunday');
      for (let days = -25_567; days <= 157_000; days += 97) {
        strictEqual(dateKey.dayNumber(dateKey.fromDayNumber(days)), days, `round trip of day ${days}`);
      }
    },
  },
  {
    rule: 'seed-golden', fn: 'dailySeed', needs: ['dailySeed'], name: 'the daily seed matches the pinned golden values',
    fix: 'Restore dailySeed exactly (FNV-1a over the key, offset basis XOR salt, Math.imul, >>> 0): changing it gives players different daily levels between app versions.',
    run: ({ dailySeed }, { strictEqual }) => {
      for (const [date, salt, seed] of SEED_GOLDENS) strictEqual(dailySeed.dailySeed(date, salt), seed, `dailySeed('${date}', ${salt})`);
    },
  },
  {
    rule: 'daily-first-attempt', fn: 'recordDailyResult', needs: ['dailyModel'], name: 'the first finished attempt of a day counts, won or lost; replays change nothing',
    fix: 'if (date in daily.results) return daily; record lost first attempts too.',
    run: ({ dailyModel }, { strictEqual, ok }) => {
      const first = record(dailyModel, ['2026-09-26'], LOSS);
      ok(dailyModel.isDailyDone(first, '2026-09-26'), 'a lost first attempt marks the day done');
      strictEqual(dailyModel.recordDailyResult(first, '2026-09-26', WIN), first, 'a replay returns the same object');
      strictEqual(first.completed, 1, 'completed counts the recorded day');
    },
  },
  {
    rule: 'daily-streak', fn: 'currentDailyStreak', needs: ['dailyModel'], name: 'streaks follow "played yesterday or today"; the best streak is kept',
    fix: 'gap 1 -> length + 1, gap > 1 -> 1; currentDailyStreak is length when lastDate is today or yesterday, else 0; bestStreak = max.',
    run: ({ dailyModel }, { strictEqual }) => {
      const three = record(dailyModel, ['2026-09-24', '2026-09-25', '2026-09-26']);
      strictEqual(dailyModel.currentDailyStreak(three, '2026-09-26'), 3, 'today');
      strictEqual(dailyModel.currentDailyStreak(three, '2026-09-27'), 3, 'yesterday still counts');
      strictEqual(dailyModel.currentDailyStreak(three, '2026-09-28'), 0, 'a missed day ends it');
      const broken = record(dailyModel, ['2026-09-28'], WIN, three);
      strictEqual(broken.streak.length, 1, 'a new streak after a gap');
      strictEqual(broken.bestStreak, 3, 'best streak kept');
    },
  },
  {
    rule: 'daily-clock-back', fn: 'recordDailyResult', needs: ['dailyModel'], name: 'the clock going backwards keeps done days and never double-counts',
    fix: 'nextStreak returns the streak unchanged when the new date is not after lastDate.',
    run: ({ dailyModel }, { deepStrictEqual, ok }) => {
      const later = record(dailyModel, ['2026-09-26']);
      const earlier = dailyModel.recordDailyResult(later, '2026-09-20', WIN);
      deepStrictEqual(earlier.streak, later.streak, 'streak unchanged');
      ok(dailyModel.isDailyDone(earlier, '2026-09-26'), 'the later day stays done');
    },
  },
  {
    rule: 'daily-prune', fn: 'recordDailyResult', needs: ['dailyModel', 'dateKey'], name: 'results are pruned to 60 days; streak and completed keep counting',
    fix: 'Prune results to the last 60 days on write; keep streak and completed as stored counters.',
    run: ({ dailyModel, dateKey }, { strictEqual }) => {
      const days = Array.from({ length: 65 }, (_, i) => dateKey.addDays('2026-01-01', i));
      const daily = record(dailyModel, days);
      strictEqual(Object.keys(daily.results).length, 60, 'results kept');
      strictEqual(daily.streak.length, 65, 'streak length');
      strictEqual(daily.completed, 65, 'completed');
    },
  },
  {
    rule: 'daily-week', fn: 'lastSevenDays', needs: ['dailyModel'], name: 'the 7-day strip lists the last seven days, oldest first',
    fix: 'Map back = 6..0 to addDays(today, -back) with isDone = date in results.',
    run: ({ dailyModel }, { deepStrictEqual }) => {
      const daily = record(dailyModel, ['2026-09-21', '2026-09-26']);
      deepStrictEqual(dailyModel.lastSevenDays(daily, '2026-09-26').map((day) => `${day.date}:${day.isDone}`), [
        '2026-09-20:false', '2026-09-21:true', '2026-09-22:false', '2026-09-23:false', '2026-09-24:false', '2026-09-25:false', '2026-09-26:true',
      ]);
    },
  },
  {
    rule: 'view-daily', fn: 'buildDailySummary', needs: ['dailySummary', 'dailyModel'], name: 'S9 view: done/missed/today marks, today result and streaks',
    fix: 'mark = done when recorded, today for an unplayed today, missed otherwise; todayResult = results[today] ?? null.',
    run: ({ dailySummary, dailyModel }, { deepStrictEqual, strictEqual }) => {
      const fresh = dailySummary.buildDailySummary(EMPTY_DAILY(), '2026-09-26');
      deepStrictEqual(fresh.week.map((day) => day.weekday), [7, 1, 2, 3, 4, 5, 6], 'ISO weekdays for the letter and name keys');
      deepStrictEqual(fresh.week.map((day) => day.mark), ['missed', 'missed', 'missed', 'missed', 'missed', 'missed', 'today']);
      strictEqual(fresh.todayResult, null);
      const played = dailySummary.buildDailySummary(record(dailyModel, ['2026-09-25', '2026-09-26']), '2026-09-26');
      strictEqual(played.isDone, true);
      deepStrictEqual(played.todayResult, WIN);
      strictEqual(played.currentStreak, 2);
      deepStrictEqual(played.week.at(-1), { date: '2026-09-26', weekday: 6, mark: 'done', isToday: true });
    },
  },
  {
    rule: 'view-countdown', fn: 'splitCountdown', needs: ['dailySummary'], name: 'S9 "Next challenge in {h} h {m} min" from msUntilNextLocalDay()',
    fix: 'splitCountdown(ms): total minutes = ceil(ms / 60000) (never 0 h 0 min before midnight), hours = floor(total / 60), minutes = total % 60.',
    run: ({ dailySummary }, { deepStrictEqual, ok }) => {
      ok(typeof dailySummary.splitCountdown === 'function', 'daily-summary.ts exports splitCountdown');
      deepStrictEqual(dailySummary.splitCountdown(11_100_000), { hours: 3, minutes: 5 }, '3 h 5 min left');
      deepStrictEqual(dailySummary.splitCountdown(30_000), { hours: 0, minutes: 1 }, 'the last 30 s of the day round up to 1 min');
      deepStrictEqual(dailySummary.splitCountdown(3_600_001), { hours: 1, minutes: 1 }, 'a part minute rounds up');
      deepStrictEqual(dailySummary.splitCountdown(86_400_000), { hours: 24, minutes: 0 }, 'a whole day');
    },
  },
];
