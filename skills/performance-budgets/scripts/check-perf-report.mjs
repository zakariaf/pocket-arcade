#!/usr/bin/env node
// check-perf-report.mjs: judges a performance report exported from a test build (debug menu >
// Performance > "Share performance report", or the perf_log row read from the simulator or the
// Android emulator) against the budgets: cold start, frame times, hitch rate and the save benchmark.
// iOS and Android reports have the same shape; the header's deviceModel names the platform.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-perf-report.mjs <report.json> [--root <app repo>]

import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { createReporter, fail, parseArgs, run, toPosix } from './check-lib.mjs';
import { loadBudgets, median } from './lib/budgets.mjs';

const SPEC = {
  name: 'check-perf-report',
  summary: 'Checks an exported performance report ({ appId, appVersion, buildNumber, deviceModel, entries } or a bare entries array) against the perf budgets in quality-gates.json (or the product defaults).',
  usage: '<report.json> [--root <dir>] [--sim-baseline <ms> | --emu-baseline <ms>] [--min-launches <n>]',
  options: {
    root: { type: 'string', default: '.', value: 'dir', help: 'App repo root (reads quality-gates.json for the budgets)' },
    'sim-baseline': { type: 'string', value: 'ms', help: 'Simulator run: drop the first of the latest n+1 launches (warm-up), compare their median with this baseline x coldStartSimRegressionFactor, and need no frames entry' },
    'emu-baseline': { type: 'string', value: 'ms', help: 'Android emulator run: as --sim-baseline, against perf-baselines/cold-start-emu-<game>.json x coldStartEmuRegressionFactor' },
    'min-launches': { type: 'string', default: '5', value: 'n', help: 'Cold-start launches in the median: the latest n entries (older ones may be earlier builds)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 1, max: 1 },
  details: [
    'Rules:',
    '  report-shape     entries must be { kind, label, atEpochMs, data } objects',
    '  cold-start-runs  fewer cold-start entries with a total than --min-launches (+1 with a baseline run); on',
    '                   Android a null total means the Kotlin ProcessStartModule is missing',
    '  cold-start       median totalMs of the latest --min-launches cold starts is over the budget',
    '  frame-data       no "frames" entry: record frame times while playing (device reports only)',
    '  hitch-rate       a frames entry has hitchMsPerS over the budget',
    '  frame-p95        a frames entry has p95UpToMs over the budget (null means above 100 ms: fails)',
    '  save-write-p95   a save-benchmark entry has p95 at or over the budget',
    '',
    'Example: node check-perf-report.mjs reports/perf/iphone-1.0.0-12.json --root .',
    '         node check-perf-report.mjs reports/perf/emu-perf-log.json --root . --emu-baseline <medianMs>',
  ].join('\n'),
};

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const file = resolve(positionals[0]);
  if (!existsSync(file)) fail(`nothing to check: report ${positionals[0]} does not exist`, 'Pass the JSON the debug menu shared, or the perf_log payload read with sqlite3.');
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`the report is not valid JSON: ${error.message}`, 'Pass the exported JSON unchanged.');
  }
  const entries = Array.isArray(parsed) ? parsed : parsed?.entries;
  if (!Array.isArray(entries)) fail('the report has no entries array', 'Pass { ..., "entries": [...] } or a bare array of entries.');
  const { budgets } = loadBudgets(resolve(options.root));
  const minLaunches = Number(options['min-launches']);
  const shown = toPosix(relative(process.cwd(), file)) || file;
  const report = createReporter({ name: 'check-perf-report', json: options.json });
  const problem = (rule, message, fix) => report.problem({ file: shown, line: 0, rule, message, fix });

  const valid = [];
  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || typeof entry.kind !== 'string' || typeof entry.data !== 'object' || entry.data === null) {
      problem('report-shape', `entry ${index} is not { kind, label, atEpochMs, data }`, 'Export the report again from the debug menu; do not edit it by hand.');
      return;
    }
    valid.push(entry);
  });
  if (parsed && !Array.isArray(parsed)) console.log(`report: ${parsed.appId ?? '?'} ${parsed.appVersion ?? '?'} (${parsed.buildNumber ?? '?'}) on ${parsed.deviceModel ?? '?'}`);

  if (options['sim-baseline'] !== undefined && options['emu-baseline'] !== undefined) fail('--sim-baseline and --emu-baseline name two different runs', 'Pass the one baseline of the run the report comes from.');
  const isEmu = options['emu-baseline'] !== undefined;
  // A baseline run (simulator or emulator): the first launch is a warm-up and no frames are needed.
  const isSim = options['sim-baseline'] !== undefined || isEmu;
  const baselineMs = Number(isEmu ? options['emu-baseline'] : options['sim-baseline']);
  const isAndroid = isEmu || /^android\b/i.test(String(parsed?.deviceModel ?? ''));
  if (isAndroid) console.log(`platform: android${isEmu ? ' (emulator run)' : ''}`);
  if (isSim && !(baselineMs > 0)) fail(`--${isEmu ? 'emu' : 'sim'}-baseline must be a positive number of ms, got ${isEmu ? options['emu-baseline'] : options['sim-baseline']}`, `Pass the medianMs of the committed ${isEmu ? 'emulator' : 'simulator'} baseline.`);
  if (!(minLaunches >= 1)) fail(`--min-launches must be a positive number, got ${options['min-launches']}`, 'Pass --min-launches 5.');
  // The perf log is a ring buffer that survives app updates: judge only the latest launches, in time order.
  const coldRuns = valid.filter((e) => e.kind === 'cold-start' && typeof e.data.totalMs === 'number').sort((a, b) => (a.atEpochMs ?? 0) - (b.atEpochMs ?? 0));
  const needed = isSim ? minLaunches + 1 : minLaunches;
  const coldCount = valid.filter((e) => e.kind === 'cold-start').length;
  if (coldCount > 0 || isSim) {
    if (coldRuns.length < needed) {
      const relaunch = isEmu
        ? `Launch ${needed} times (adb -s <serial> shell am force-stop <package>, then am start -W, and wait for the cold-start entry); the first is dropped as warm-up.`
        : isSim
          ? `Launch ${needed} times (terminate, launch, wait for the cold-start entry); the first is dropped as warm-up.`
          : 'Force-quit and relaunch the app until it has 5 cold starts (skip launches that flipped direction).';
      const nullTotals = isAndroid && coldCount > coldRuns.length ? ' On Android a null totalMs means process-start.ts found no Kotlin ProcessStartModule: copy templates/shell-native/android/ (perf-layer) and rebuild.' : '';
      problem('cold-start-runs', `${coldRuns.length} cold-start runs with a process-start time (need ${needed})`, `${relaunch}${nullTotals}`);
    } else {
      const used = coldRuns.slice(-needed).slice(isSim ? 1 : 0).map((e) => e.data.totalMs);
      const med = median(used);
      const limit = isSim ? baselineMs * (isEmu ? budgets.coldStartEmuRegressionFactor : budgets.coldStartSimRegressionFactor) : budgets.coldStartHomeMsMax;
      const note = coldRuns.length > used.length ? ` (the latest ${used.length} of ${coldRuns.length} recorded${isSim ? ', first of the run dropped' : ''})` : '';
      console.log(`cold start: median ${Math.round(med)} ms of ${used.length} launches${note} (limit ${Math.round(limit)} ms)`);
      const over = isSim ? med > limit : med >= limit;
      const against = isEmu ? ' (the emulator baseline x coldStartEmuRegressionFactor)' : isSim ? ' (the simulator baseline x coldStartSimRegressionFactor)' : '';
      if (over) problem('cold-start', `median cold start ${Math.round(med)} ms is over ${Math.round(limit)} ms${against}`, 'Move work out of module scope and the Splash (ads, consent, store, textures start after Home is interactive); compare nativeMs and jsMs to see which side grew.');
    }
  }

  const frames = valid.filter((e) => e.kind === 'frames');
  if (frames.length === 0 && !isSim) {
    problem('frame-data', 'no frame-time recording in the report', 'Debug menu > Performance > "Record frame times", then play 5 levels (60 s of a real-time game) before sharing.');
  }
  for (const entry of frames) {
    const { hitchMsPerS, p95UpToMs, frames: count, refreshHz } = entry.data;
    console.log(`frames ${entry.label}: ${count} frames at ${refreshHz} Hz, p95 <= ${p95UpToMs} ms, hitch ${hitchMsPerS} ms/s`);
    if (typeof hitchMsPerS === 'number' && hitchMsPerS > budgets.hitchMsPerSecondMax) {
      problem('hitch-rate', `${entry.label}: hitch rate ${hitchMsPerS} ms/s is over ${budgets.hitchMsPerSecondMax} ms/s`, 'Find per-frame work: React state per frame, Skia allocations in the worklet, unbatched draws (use Atlas), frame callbacks that never stop.');
    }
    // p95 in the slowest bucket (> 100 ms) is Infinity in the app, which JSON writes as null.
    const p95Shown = typeof p95UpToMs === 'number' ? `up to ${p95UpToMs} ms` : 'above 100 ms (null = the slowest bucket)';
    if (typeof p95UpToMs !== 'number' || p95UpToMs > budgets.frameP95MsMax) {
      problem('frame-p95', `${entry.label}: p95 frame time ${p95Shown} is over ${budgets.frameP95MsMax} ms`, 'Reduce the busiest frame: re-record only the dynamic layer, cache static layers as a picture, check the draw-call budget.');
    }
    if (typeof hitchMsPerS !== 'number') {
      problem('report-shape', `${entry.label}: hitchMsPerS is ${JSON.stringify(hitchMsPerS)}, not a number`, 'Export the report again from the debug menu; do not edit it by hand.');
    }
  }

  for (const entry of valid.filter((e) => e.kind === 'save-benchmark')) {
    const { p95 } = entry.data;
    console.log(`save write: p95 ${p95} ms`);
    if (typeof p95 === 'number' && p95 >= budgets.saveWriteP95MsMax) {
      problem('save-write-p95', `save write p95 ${p95} ms is not under ${budgets.saveWriteP95MsMax} ms`, 'Check that each move writes only `current` in one transaction and that the serializer is linear; compare with the Jest save-write perf test.');
    }
  }
  return report.finish({ checked: valid.length, unit: 'report entries' });
});
