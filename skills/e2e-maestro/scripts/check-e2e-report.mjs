#!/usr/bin/env node
// check-e2e-report.mjs: reads the artefacts of an end-to-end run and proves it: every flow in
// reports/e2e/<game-id>/junit.xml passed, every smoke flow of the Shell and the game ran, the socket
// sampler's network.txt exists and is empty, the simulator cold start and memory are within budget
// (perf.json), the app asked for the win sound and the success haptic during the game's smoke flows
// (feedback.json, read from the perf log), S15's save benchmark ran on the simulator within budget
// (save-benchmark.json, read from the perf log after the flows), the a11y flows passed at 200 % text in en and fa on the
// phone and the iPad, and (with
// --screenshots) no screenshot differs from its baseline and every device/language/theme set is
// complete. Prints the evidence lines for the report.
// Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-e2e-report.mjs . --app <game-id> [--screenshots]

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, fail, parseArgs, requireDir, run } from './check-lib.mjs';
import { parseFlow } from './lib/maestro-yaml.mjs';

const SPEC = {
  name: 'check-e2e-report',
  summary: 'Checks the reports of npm run e2e:ios (and screenshots:ios) for one game and prints the evidence lines.',
  usage: '--app <game-id> [options] [repo-root]',
  options: {
    app: { type: 'string', value: 'game-id', help: 'The game the run was for (required)' },
    reports: { type: 'string', default: 'reports', value: 'dir', help: 'The reports folder, relative to the repo root' },
    screenshots: { type: 'boolean', help: 'Also check reports/screenshots/summary.json from npm run screenshots:ios' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  flow-failed          a test case in junit.xml has a failure/error or a status other than SUCCESS or WARNING',
    '  no-flows             junit.xml holds no test case',
    '  smoke-not-run        a smoke flow of the Shell or the game is not in junit.xml',
    '  network-report       network.txt is missing (the socket sampler did not run)',
    '  network-sockets      network.txt lists a non-loopback socket of the app (spec N3)',
    '  perf-missing         perf.json is missing: the cold-start and memory steps did not run (--flows-only is not evidence)',
    '  cold-start           the simulator cold-start step failed, or its median is over baseline x 1.2',
    '  memory               the memory step failed, or phys_footprint after the smoke flow and a relaunch (Maestro 2.10',
    '                       stops the app when a test ends) is over the budget (150 MB)',
    '  feedback-evidence    feedback.json is missing (the memory step did not read the perf log), or the game\'s',
    '                       smoke flows asked for no win sound (a sound id "win" or ending in ".win", the Shell\'s ui.win)',
    '                       or no success haptic: the win feedback is not wired to the ports (test builds record each',
    '                       cue in the perf log; how they sound and feel is the owner\'s device check)',
    '  save-benchmark       save-benchmark.json (the perf log read right after the flows step) holds no save-benchmark',
    '                       entry (the Shell\'s smoke flow 04-debug-performance taps S15\'s Run save benchmark), its run',
    '                       made other than 300 writes, or its p95 is not under quality-gates.json perf.saveWriteP95MsMax',
    '                       (5 ms, performance-budgets)',
    '  large-text-missing   a11y flows exist but large-text/<phone|tablet>-<en|fa>/junit.xml is missing',
    '  large-text-failed    an a11y flow failed at 200 % text',
    '  screenshot-changed   (--screenshots) a screenshot differs from its baseline, changed size or has no baseline',
    '  matrix-incomplete    (--screenshots) a device/language/theme set has fewer screenshots than the others',
  ].join('\n'),
};

function attributes(text) {
  const out = {};
  for (const match of text.matchAll(/([\w:-]+)="([^"]*)"/g)) out[match[1]] = match[2].replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return out;
}

function testCases(xml) {
  const cases = [];
  for (const match of xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const attrs = attributes(match[1]);
    const body = match[3] ?? '';
    const failure = /<(failure|error)\b[^>]*?(?:\/>|>([\s\S]*?)<\/\1>)/.exec(body);
    const tags = /<property\s+name="tags"\s+value="([^"]*)"/.exec(body)?.[1] ?? '';
    cases.push({ name: attrs.name ?? '', file: attrs.file ?? '', status: attrs.status ?? (failure ? 'ERROR' : 'SUCCESS'), failure: failure ? (failure[2] ?? failure[0]).trim() : null, tags, line: xml.slice(0, match.index).split('\n').length });
  }
  return cases;
}

function smokeFlows(root, game) {
  const flows = [];
  for (const base of ['packages/shell/e2e/flows', `apps/${game}/e2e/flows`]) {
    const dir = join(root, base);
    if (!existsSync(dir)) continue;
    for (const area of readdirSync(dir).sort()) {
      const areaDir = join(dir, area);
      if (!statSync(areaDir).isDirectory()) continue;
      for (const entry of readdirSync(areaDir, { withFileTypes: true })) {
        if (!entry.isFile() || !/\.ya?ml$/.test(entry.name)) continue;
        const rel = `${base}/${area}/${entry.name}`;
        const tags = parseFlow(readFileSync(join(root, rel), 'utf8')).header?.tags;
        const list = Array.isArray(tags) ? tags.map(String) : [];
        flows.push({ rel, isSmoke: list.includes('smoke'), isQuarantined: list.includes('quarantine'), isA11y: list.includes('a11y') });
      }
    }
  }
  return flows;
}

function checkJunit(root, out, game, report) {
  const junit = join(out, 'junit.xml');
  const rel = `${junit.slice(root.length + 1)}`;
  if (!existsSync(junit)) fail(`nothing to check: ${rel} does not exist`, `Run npm run e2e:ios -- --app ${game} first (it needs a Release simulator build of the test variant with ADS_MODE=off).`);
  const xml = readFileSync(junit, 'utf8');
  const cases = testCases(xml);
  if (cases.length === 0) report.problem({ file: rel, line: 1, rule: 'no-flows', message: 'holds no test case', fix: 'Check that flows exist under packages/shell/e2e/flows/<area>/ and apps/<game-id>/e2e/flows/<area>/ and that the runner lists them.' });
  const failed = cases.filter((item) => item.failure !== null || !['SUCCESS', 'WARNING'].includes(item.status));
  for (const item of failed) report.problem({ file: item.file || rel, line: 0, rule: 'flow-failed', message: `"${item.name}" ${item.status}: ${String(item.failure ?? 'no detail').split('\n')[0].slice(0, 160)}`, fix: `Open reports/e2e/${game}/ (per-flow logs and screenshots), rerun that one flow alone; if it passes alone it is flaky: fix the wait, the setup or the app, never add retry.` });
  const flows = smokeFlows(root, game);
  const ran = new Set(cases.map((item) => item.file));
  for (const flow of flows.filter((item) => item.isSmoke && !ran.has(item.rel))) report.problem({ file: flow.rel, line: 0, rule: 'smoke-not-run', message: 'this smoke flow is not in junit.xml', fix: `Run the full suite (npm run e2e:ios -- --app ${game}) without --include-tags filters before calling the run done.` });
  const quarantined = flows.filter((item) => item.isQuarantined).map((item) => item.rel);
  report.note(`evidence: End-to-end: ${cases.length - failed.length}/${cases.length} flows pass, quarantined: ${quarantined.length === 0 ? 'none' : quarantined.join(', ')} (reports/e2e/${game}/junit.xml)`);
  return cases.length;
}

function checkNetwork(root, out, game, report) {
  const file = join(out, 'network.txt');
  const rel = file.slice(root.length + 1);
  if (!existsSync(file)) {
    report.problem({ file: rel, line: 0, rule: 'network-report', message: 'is missing, so the socket sampler did not run', fix: `Run through npm run e2e:ios -- --app ${game} (the runner writes network.txt and samples the app's sockets every second), never maestro test by hand for evidence.` });
    return;
  }
  const lines = readFileSync(file, 'utf8').split('\n').filter((line) => line.trim() !== '');
  lines.forEach((line, index) => report.problem({ file: rel, line: index + 1, rule: 'network-sockets', message: `the app opened a non-loopback socket: ${line.trim().slice(0, 140)}`, fix: 'Find the code path that opened it (spec N3: only AdMob and StoreKit may use the network, and E2E builds run with ADS_MODE=off); fix it, then rerun the flows.' }));
  if (lines.length === 0) report.note('evidence: Network: 0 JS attempts (smoke flows asserted debug.network-attempts = 0), no non-loopback sockets (network.txt empty)');
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function checkPerf(root, out, game, report) {
  const file = join(out, 'perf.json');
  const rel = file.slice(root.length + 1);
  const perf = existsSync(file) ? readJson(file) : null;
  if (perf === null) {
    report.problem({ file: rel, line: 0, rule: 'perf-missing', message: existsSync(file) ? 'is not valid JSON' : 'is missing, so the cold-start and memory steps did not run', fix: `Run the evidence run without --flows-only: npm run e2e:ios -- --app ${game}.` });
    return;
  }
  const cold = perf.coldStart ?? {};
  if (typeof cold.error === 'string') report.problem({ file: rel, line: 0, rule: 'cold-start', message: cold.error, fix: 'Run check-e2e-setup.mjs . (rule perf-layer: app/perf/, the shell-native module, markJsEntry in start-shell.ts, the perf log createDebugParts makes, Home\'s useColdStartMark(useOptionalDebugServices()?.perfLog ?? null)), rebuild the Release test variant, then rerun.' });
  else if (cold.isRegression === true) report.problem({ file: rel, line: 0, rule: 'cold-start', message: `median ${cold.medianMs} ms of the last 5 launches is over ${cold.limitMs} ms (baseline ${cold.baselineMs} ms x 1.2)`, fix: 'Find the start-up work that grew (module scope, Splash, fonts, save load) and move it after Home; never rewrite the baseline to pass (a slower baseline needs the owner and a Gate-Change trailer).' });
  else if (typeof cold.medianMs === 'number') report.note(`evidence: Cold start (simulator): median ${Math.round(cold.medianMs)} ms of 5 launches, ${cold.baselineMs === null ? 'first run, baseline written' : `baseline ${cold.baselineMs} ms, limit ${Math.round(cold.limitMs)} ms`}`);
  const memory = perf.memory ?? {};
  if (typeof memory.error === 'string') report.problem({ file: rel, line: 0, rule: 'memory', message: memory.error, fix: /not running|did not start again/.test(memory.error) ? 'Maestro 2.10 stops the app when a test ends: the memory step relaunches it (xcrun simctl launch), waits for its pid and 10 s, then runs footprint. Restore sim-perf-steps.ts from this skill\'s template if it measures without the relaunch; if the relaunch itself failed, open reports/e2e/' + game + '/memory/ and the simulator.' : `Open reports/e2e/${game}/memory/ (the smoke flow's log and footprint.json), fix the cause and rerun.` });
  else if (memory.isOver === true) report.problem({ file: rel, line: 0, rule: 'memory', message: `phys_footprint ${memory.physFootprintMb} MB after the smoke flow is over ${memory.limitMb} MB`, fix: 'Find what holds memory (textures, pictures, audio buffers, canvases per screen; the performance-budgets skill) and release it.' });
  else if (typeof memory.physFootprintMb === 'number') report.note(`evidence: Memory (simulator): phys_footprint ${memory.physFootprintMb} MB after the smoke flow and a relaunch (budget ${memory.limitMb} MB)`);
}

const BENCHMARK_WRITES = 300;

/** quality-gates.json perf.saveWriteP95MsMax (performance-budgets), else 5 ms. */
function saveBudgetMs(root) {
  const gates = existsSync(join(root, 'quality-gates.json')) ? readJson(join(root, 'quality-gates.json')) : null;
  const budget = gates?.perf?.saveWriteP95MsMax;
  return typeof budget === 'number' ? budget : 5;
}

/** S15's save benchmark on the simulator: the entry the Shell's 04-debug-performance flow left. */
function checkSaveBenchmark(root, out, game, report) {
  if (!existsSync(join(out, 'perf.json'))) return; // perf-missing already says the evidence steps did not run
  const file = join(out, 'save-benchmark.json');
  const rel = file.slice(root.length + 1);
  const evidence = existsSync(file) ? readJson(file) : null;
  const flowFix = "Copy this skill's templates/packages/shell/e2e/flows/smoke/04-debug-performance.yaml (it taps debug.perf-benchmark-row, the last flow of the flows step) and run the evidence run without a tag filter: npm run e2e:ios -- --app " + game + '.';
  if (evidence === null || !Object.hasOwn(evidence, 'entry')) {
    report.problem({ file: rel, line: 0, rule: 'save-benchmark', message: existsSync(file) ? 'is not { flows, entry } JSON' : 'is missing, so the runner never read the perf log after the flows step', fix: "Restore run-e2e-ios.ts from this skill's template (recordSaveBenchmark right after the flows), then rerun." });
    return;
  }
  if (evidence.entry === null) {
    report.problem({ file: rel, line: 0, rule: 'save-benchmark', message: "the flows ran no save benchmark: the perf log holds no save-benchmark entry after the flows step (S15's Run save benchmark never ran on the simulator)", fix: flowFix });
    return;
  }
  const data = evidence.entry.data ?? {};
  const budget = saveBudgetMs(root);
  if (data.writes !== BENCHMARK_WRITES) report.problem({ file: rel, line: 0, rule: 'save-benchmark', message: `the save benchmark made ${typeof data.writes === 'number' ? data.writes : 'an unrecorded number of'} writes, not ${BENCHMARK_WRITES}`, fix: "performance-budgets' saveBenchmarkEntry records data.writes = BENCHMARK_WRITES (300); rebuild the test variant and rerun." });
  if (typeof data.p95 !== 'number' || !(data.p95 < budget)) report.problem({ file: rel, line: 0, rule: 'save-benchmark', message: `save write p95 ${typeof data.p95 === 'number' ? `${data.p95} ms` : 'is missing and'} is not under the ${budget} ms budget`, fix: 'Find what made the save write slow (the document size, a write per frame, a missing transaction or WAL; the save-persistence-and-migrations and performance-budgets skills), then rerun.' });
  if (data.writes === BENCHMARK_WRITES && typeof data.p95 === 'number' && data.p95 < budget) report.note(`evidence: Save benchmark (simulator, S15): ${BENCHMARK_WRITES} writes, p95 ${data.p95} ms (budget under ${budget} ms), p50 ${data.p50} ms, max ${data.max} ms (reports/e2e/${game}/save-benchmark.json)`);
}

/** The win feedback: the Shell's win sound (ui.win) and the success haptic, asked for on the simulator. */
function checkFeedback(root, out, game, report) {
  const perfFile = join(out, 'perf.json');
  if (!existsSync(perfFile)) return; // perf-missing already says the evidence steps did not run
  const file = join(out, 'feedback.json');
  const rel = file.slice(root.length + 1);
  const evidence = existsSync(file) ? readJson(file) : null;
  const fix = "Test builds record every feedback cue in the perf log: createDebugParts wraps the audio and haptics ports (TEST_ONLY.recordAudioFeedback / recordHapticsFeedback), and the game host plays the Shell's feedback through parts.feedback. Run check-e2e-setup.mjs . (perf-layer, feedback-evidence), rebuild the test variant and rerun.";
  if (evidence === null || !Array.isArray(evidence.sounds) || !Array.isArray(evidence.haptics)) {
    report.problem({ file: rel, line: 0, rule: 'feedback-evidence', message: existsSync(file) ? 'is not { flows, sounds, haptics } JSON' : 'is missing, so nothing shows the app asked for the win feedback on the simulator', fix: existsSync(file) ? fix : `Run the evidence run without --flows-only (npm run e2e:ios -- --app ${game}): the memory step writes it from the perf log after the smoke flows.` });
    return;
  }
  const win = evidence.sounds.find((label) => /(^|\.)win$/.test(String(label)));
  const success = evidence.haptics.includes('success');
  if (win === undefined) report.problem({ file: rel, line: 0, rule: 'feedback-evidence', message: `the smoke flows asked for no win sound (sounds: ${evidence.sounds.slice(0, 8).join(', ') || 'none'})`, fix });
  if (!success) report.problem({ file: rel, line: 0, rule: 'feedback-evidence', message: `the smoke flows asked for no success haptic (haptics: ${evidence.haptics.slice(0, 8).join(', ') || 'none'})`, fix });
  if (win !== undefined && success) report.note(`evidence: Feedback (simulator): the win asked for sound ${win} and the success haptic (${evidence.sounds.length} sounds, ${evidence.haptics.length} haptics logged); how they sound and feel is the owner's device check`);
}

const LARGE_TEXT_SETS = ['phone-en', 'phone-fa', 'tablet-en', 'tablet-fa'];

function checkLargeText(root, out, game, report) {
  const a11yFlows = smokeFlows(root, game).filter((flow) => flow.isA11y && !flow.isQuarantined);
  if (a11yFlows.length === 0) return 0;
  let passed = 0;
  let total = 0;
  for (const set of LARGE_TEXT_SETS) {
    const file = join(out, 'large-text', set, 'junit.xml');
    const rel = file.slice(root.length + 1);
    if (!existsSync(file)) {
      report.problem({ file: rel, line: 0, rule: 'large-text-missing', message: `${a11yFlows.length} a11y flow(s) exist but the ${set} large-text run left no report`, fix: `Run the evidence run without --flows-only: npm run e2e:ios -- --app ${game} (step 4 runs the a11y flows at 200 % text).` });
      continue;
    }
    for (const item of testCases(readFileSync(file, 'utf8'))) {
      total += 1;
      if (item.failure === null && ['SUCCESS', 'WARNING'].includes(item.status)) passed += 1;
      else report.problem({ file: item.file || rel, line: 0, rule: 'large-text-failed', message: `${set}: "${item.name}" ${item.status}: ${String(item.failure ?? 'no detail').split('\n')[0].slice(0, 140)}`, fix: `Open reports/e2e/${game}/large-text/${set}/ (log and screenshots): text must grow to 200 % without clipping; stack the row, use minHeight, never cap the font.` });
    }
  }
  report.note(`evidence: Large text: ${passed}/${total} a11y flow runs pass at 200 % (phone and iPad, en and fa); read the screenshots in reports/e2e/${game}/large-text/`);
  return total;
}

function checkScreenshots(root, reports, report) {
  const file = join(root, reports, 'screenshots', 'summary.json');
  const rel = file.slice(root.length + 1);
  if (!existsSync(file)) fail(`nothing to check: ${rel} does not exist`, 'Run npm run screenshots:ios -- --app <game-id> first, or drop --screenshots.');
  let rows;
  try {
    rows = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${rel} is not valid JSON: ${error.message}`, 'Rerun npm run screenshots:ios.');
  }
  if (!Array.isArray(rows)) fail(`${rel} is not a list of rows`, 'Rerun npm run screenshots:ios.');
  const perSet = new Map();
  let changed = 0;
  const fresh = [];
  for (const row of rows) {
    const set = String(row.label ?? '').split('/').slice(0, 2).join('/');
    perSet.set(set, (perSet.get(set) ?? 0) + 1);
    if (row.result === 'baseline-written') {
      fresh.push(row.baseline);
      continue;
    }
    const kind = row.result?.kind;
    if (kind === 'match') continue;
    changed += 1;
    const detail = kind === 'mismatch' ? `${(Number(row.result.diffRatio) * 100).toFixed(2)}% of pixels differ, diff ${row.result.diffPath}` : kind === 'size-changed' ? `size ${row.result.expected} became ${row.result.actual}` : kind === 'missing-baseline' ? `no baseline at ${row.result.baselinePath}` : `result ${JSON.stringify(row.result)}`;
    report.problem({ file: row.baseline ?? rel, line: 0, rule: 'screenshot-changed', message: `${row.label}: ${detail}`, fix: 'Open the baseline, this run and the diff with the Read tool. A bug: fix the screen. Intended: rerun with --update for that device and language, open every new PNG, commit with a Gate-Change trailer. Never raise the tolerance.' });
  }
  const most = Math.max(0, ...perSet.values());
  for (const [set, count] of perSet) if (count < most) report.problem({ file: rel, line: 0, rule: 'matrix-incomplete', message: `${set} has ${count} screenshots, other sets have ${most}`, fix: `Look at the Maestro log under reports/screenshots/raw/${set}/ for the step that failed, fix it, and rerun that device and language.` });
  if (fresh.length > 0) report.note(`note: ${fresh.length} new baseline(s) written; open each one with the Read tool before committing (first: ${fresh[0]})`);
  report.note(`evidence: Screenshots: ${rows.length} captured in ${perSet.size} sets, ${changed} changed (reports/screenshots/index.html)`);
  return rows.length;
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  if (!options.app) fail('pass --app <game-id>', 'Example: --app line-siege');
  const report = createReporter({ name: SPEC.name, json: options.json });
  const out = join(root, options.reports, 'e2e', options.app);
  let checked = checkJunit(root, out, options.app, report);
  checkNetwork(root, out, options.app, report);
  checkPerf(root, out, options.app, report);
  checkFeedback(root, out, options.app, report);
  checkSaveBenchmark(root, out, options.app, report);
  checked += checkLargeText(root, out, options.app, report);
  if (options.screenshots) checked += checkScreenshots(root, options.reports, report);
  return report.finish({ checked: Math.max(checked, 1), unit: 'flows and screenshots' });
});
