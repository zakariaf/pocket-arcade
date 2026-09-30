#!/usr/bin/env node
// check-daily-stats.mjs: checks the daily challenge and statistics of a Pocket Arcade app repo.
// It runs the app's own pure modules (date keys, daily seed, daily model, stats model, run end,
// S9/S10 summaries) against the spec rules and pinned golden values, and scans the daily and
// statistics code for wall-clock reads, cached "today" values and day maths inside screens.
// A partial Shell (shell-slice.json) skips the Shell modules its screens do not need.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-daily-stats.mjs [repo-root]

import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  SHELL_SLICE_FILE,
  createReporter,
  lineOf,
  maskComments,
  parseArgs,
  readShellSlice,
  requireDir,
  run,
  sliceSkipReason,
  walk,
} from './check-lib.mjs';
import { enableAppImports, lineOfExport, reasonOf } from './lib/app-modules.mjs';
import { DAILY_CHECKS } from './lib/daily-checks.mjs';
import { STATS_CHECKS } from './lib/stats-checks.mjs';

const SPEC = {
  name: 'check-daily-stats',
  summary:
    'Checks the daily challenge (date keys, daily seed goldens, streak rules, 7-day strip) and the statistics (model, run-end recording, S10 summary) of a Pocket Arcade app repo, by running its pure modules against the spec rules, plus static checks on the daily and statistics code.',
  usage: '[repo-root] [--json]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Behaviour rules: missing-module, module-load, date-math, seed-golden, daily-first-attempt,',
    'daily-streak, daily-clock-back, daily-prune, daily-week, stats-counts, stats-streak, stats-best,',
    'stats-days, stats-counters, run-end-record, view-daily, view-countdown, view-stats.',
    'Static rules:',
    '  clock-countdown   ClockPort (clock-port.ts), the system adapter or the fake lacks msUntilNextLocalDay',
    '  wall-clock        Date / Math.random / Intl.DateTimeFormat / toLocale* in daily or statistics code',
    '  today-cached      "today" kept in useState/useRef/a module constant instead of read on every render',
    '  day-maths-in-ui   streak, date or countdown arithmetic in a screen instead of the summaries',
    '',
    'Partial Shell (shell-slice.json at the repo root): a missing Shell module is a SKIP line, not a',
    'problem, when no screen of the slice needs it (daily-summary.ts: S4 or S9; stats-summary.ts: S10;',
    'the stores\' daily, stats and run-end models: any Shell screen, so only "screens": [] skips them).',
    'The game-kit date modules are always required. Any module that exists is checked in full.',
    '',
    'Example: node check-daily-stats.mjs .',
  ].join('\n'),
};

const MODULES = {
  dateKey: 'packages/game-kit/src/dates/date-key.ts',
  dailySeed: 'packages/game-kit/src/dates/daily-seed.ts',
  dailyModel: 'packages/shell/src/stores/daily-model.ts',
  statsModel: 'packages/shell/src/stores/stats-model.ts',
  runEnd: 'packages/shell/src/stores/run-end.ts',
  dailySummary: 'packages/shell/src/screens/daily/daily-summary.ts',
  statsSummary: 'packages/shell/src/screens/stats/stats-summary.ts',
};

/** The Shell screens that need a module: it may be missing only while none of them is in the slice. */
const MODULE_SCREENS = { dailySummary: ['S4', 'S9'], statsSummary: ['S10'] };
/** Shell modules every Shell screen stands on (run ends): missing only in a repo with no Shell app. */
const SHELL_APP_MODULES = new Set(['dailyModel', 'statsModel', 'runEnd']);

/** Why a missing module is not a problem in this repo, or null when it is due. */
function missingSkipReason(slice, key) {
  if (slice === null) return null;
  if (SHELL_APP_MODULES.has(key)) return sliceSkipReason(slice);
  const screens = MODULE_SCREENS[key];
  if (screens === undefined) return null;
  if (screens.some((id) => sliceSkipReason(slice, id) === null)) return null;
  return `${screens.join(' and ')} not in ${SHELL_SLICE_FILE}`;
}

const DAILY_CODE = [
  /^packages\/game-kit\/src\/dates\//,
  /^packages\/shell\/src\/stores\/(daily-model|stats-model|run-end)\.ts$/,
  /^packages\/shell\/src\/screens\/(daily|stats|home)\//,
  /^packages\/shell\/src\/app\/use-today\.ts$/,
];
const isTest = (rel) => /\.test\.tsx?$/.test(rel);

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  requireDir(join(root, 'packages'), 'packages folder');
  const slice = readShellSlice(root);
  const report = createReporter({ name: 'check-daily-stats', json: options.json });
  const checked = { count: 0 };
  scanSources(root, report, checked);
  checkClockPort(root, report, checked);
  const app = enableAppImports(root);
  const loaded = {};
  for (const [key, rel] of Object.entries(MODULES)) {
    if (!app.exists(rel)) {
      const skip = missingSkipReason(slice, key);
      if (skip !== null) {
        report.skip({ file: rel, rule: 'missing-module', message: skip });
        continue;
      }
      report.problem({ file: rel, rule: 'missing-module', message: 'module is missing', fix: 'Copy it from the skill templates (templates/<same path>) and adapt it.' });
      continue;
    }
    try {
      loaded[key] = await app.load(rel);
    } catch (error) {
      report.problem({ file: rel, line: 1, rule: 'module-load', message: `cannot be imported: ${String(error.message).split('\n')[0]}`, fix: 'Keep the module pure: import types and pure modules only, with .ts extensions, no enums.' });
    }
  }
  for (const check of [...DAILY_CHECKS, ...STATS_CHECKS]) {
    if (!check.needs.every((key) => loaded[key] !== undefined)) continue;
    checked.count += 1;
    try {
      check.run(loaded, { deepStrictEqual, ok, strictEqual });
    } catch (error) {
      const rel = MODULES[check.needs[0]];
      const source = readFileSync(join(root, rel), 'utf8');
      report.problem({ file: rel, line: lineOfExport(source, check.fn), rule: check.rule, message: `${check.fn}: ${check.name}: ${reasonOf(error)}`, fix: check.fix });
    }
  }
  return report.finish({ checked: checked.count, unit: 'checks' });
});

function scanSources(root, report, checked) {
  const files = existsSync(join(root, 'packages')) ? walk(join(root, 'packages'), { include: ['*.ts', '*.tsx'] }).map((rel) => `packages/${rel}`) : [];
  for (const rel of files) {
    if (isTest(rel) || !DAILY_CODE.some((re) => re.test(rel))) continue;
    checked.count += 1;
    const source = maskComments(readFileSync(join(root, rel), 'utf8'));
    const add = (index, rule, message, fix) => report.problem({ file: rel, line: lineOf(source, index), rule, message, fix });
    for (const match of source.matchAll(/\b(Date\.now|new\s+Date|Date\.parse|Math\.random|Intl\.DateTimeFormat|toLocaleDateString|toLocaleTimeString|toLocaleString|getTimezoneOffset)\s*\(/g)) {
      add(match.index, 'wall-clock', `uses ${match[1].replace(/\s+/g, ' ')}`, "Days are DateKey strings from ClockPort.today() (only services/clock/*-adapter.ts reads Date); format dates with the catalog messages, never Intl dates (Hermes picks the Persian calendar for fa).");
    }
    for (const match of source.matchAll(/\b(useState|useRef)\s*\(\s*(?:\(\s*\)\s*=>\s*)?[\w.]*today\s*\(\s*\)/g)) {
      add(match.index, 'today-cached', `keeps today in ${match[1]}`, 'Read today on every render with useToday() (it re-reads on focus and when the app becomes active): the day changes at local midnight.');
    }
    for (const match of source.matchAll(/^(?:export\s+)?const\s+\w+\s*=\s*[\w.]*today\s*\(\s*\)/gm)) {
      add(match.index, 'today-cached', 'today read once at module load', 'Read today inside the hook or handler that needs it (useToday()).');
    }
    const isScreen = /^packages\/shell\/src\/screens\//.test(rel) && !/-summary\.ts$/.test(rel);
    if (!isScreen) continue;
    for (const match of source.matchAll(/\b(daysBetween|addDays|dayNumber|fromDayNumber)\s*\(|\.streak\.(length|lastDate)\b|\bdaily\.results\b|\bstats\.days\b/g)) {
      add(match.index, 'day-maths-in-ui', `computes ${match[0].replace(/\s*\($/, '')} in a screen`, 'Screens only format: take the numbers from buildDailySummary / buildStatsSummary (useDailySummary, useStatsSummary).');
    }
    if (/\/use-next-day-countdown\.ts$/.test(rel)) continue;
    for (const match of source.matchAll(/\bnowMs\s*\(\s*\)|\bmsUntilNextLocalDay\s*\(\s*\)|\b86_?400_?000\b/g)) {
      add(match.index, 'day-maths-in-ui', `computes the time to midnight in a screen (${match[0]})`, 'The "Next challenge in {h} h {m} min" line reads useNextDayCountdown() (ClockPort.msUntilNextLocalDay() through splitCountdown); epoch time modulo a day is UTC, not local midnight.');
    }
  }
}

/** The countdown needs the port method in the port, the device adapter and the fake. */
function checkClockPort(root, report, checked) {
  const files = {
    'packages/shell/src/services/clock/clock-port.ts': /\bmsUntilNextLocalDay\s*:\s*\(\s*\)\s*=>\s*number\b/,
    'packages/shell/src/services/clock/system-clock-adapter.ts': /\bmsUntilNextLocalDay\s*:/,
    'packages/shell/src/services/clock/fake-clock.ts': /\bmsUntilNextLocalDay\s*:/,
  };
  for (const [rel, pattern] of Object.entries(files)) {
    if (!existsSync(join(root, rel))) continue;
    checked.count += 1;
    if (!pattern.test(maskComments(readFileSync(join(root, rel), 'utf8')))) {
      report.problem({ file: rel, line: 1, rule: 'clock-countdown', message: 'ClockPort cannot tell the time to local midnight (no msUntilNextLocalDay)', fix: 'Copy services/clock/ from the skill templates: the port declares msUntilNextLocalDay(): number, the system adapter computes it with the local calendar (DST-safe) and the fake counts it down.' });
    }
  }
}
