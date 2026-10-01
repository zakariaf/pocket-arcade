#!/usr/bin/env node
// check-balance.mjs: checks the bot and balance setup of a Pocket Arcade repo and judges each game's latest
// sim report (reports/sim/<game-id>.json) against its balance contract (test/sims/<game-id>/balance-bands.json).
// Run from the app repo root after `npm run test:sim`: node ${CLAUDE_SKILL_DIR}/scripts/check-balance.mjs [repo-root]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

import { createReporter, fail, lineOf, maskComments, parseArgs, run } from './check-lib.mjs';
import { GAME_LOGIC_FOLDERS, MIN_SEEDS, bandsProblems, cellOf, reportShapeProblems, rulesFingerprint } from './lib/balance.mjs';

const SPEC = {
  name: 'check-balance',
  summary: 'Checks the bot harness, every game\'s sims, bands and tuning file, and judges each sim report against its bands.',
  usage: '[options] [repo-root]',
  options: {
    game: { type: 'string', multiple: true, value: 'id', help: 'Check only this game (apps/<id>)' },
    release: { type: 'boolean', help: 'Release run: prints unapproved bands as an OWNER STEP (not blocking) line (owner decision O6)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Setup rules:',
    '  sim-config           jest.sim.config.js (node env, test/**/*.sim.test.ts), the test:sim script, sims kept out of npm test',
    '  harness-missing      the game-kit bot harness, its tests and the tooling report writer (with its test) exist',
    '  harness-outdated     the report writer fingerprints the sim\'s import closure (exports fingerprintFiles)',
    '  sim-missing          every game (apps/<id>/src/rules or src/sim) has test/sims/<id>/*.sim.test.ts',
    '  sim-location         a *.sim.test.ts that needs Node APIs lives under test/sims/, not in apps/ or packages/',
    '  sim-determinism      sims and bot hooks use no Math.random, Date, performance.now, retries, skips or focus',
    '  sim-harness          each sim plays through the game-kit harness, writes the report and asserts bandProblems',
    '  bot-missing          apps/<id>/src/testing/ declares the game\'s BotPolicy (testing.bot) or, real-time, its CommandPolicy',
    '  fingerprint-scope    game code in rules/, levels/, sim/ and testing/ imports only from those folders and game-kit',
    '                       (anything else could change the bots\' numbers without making the report stale)',
    '  bands-missing        test/sims/<id>/balance-bands.json exists',
    '  bands-invalid        the bands file is complete and consistent (metrics, rules, >= 100 seeds, a grid of level',
    '                       difficulties 0..99; an endless mode has its own "endless" block at difficulty 100)',
    '  bands-unapproved     (--release) an OWNER STEP (not blocking) line, never a problem: the bands are still',
    '                       "proposed" until the owner play-tests (owner decision O6: the play-test never blocks)',
    '  tuning-missing       apps/<id>/src/rules/<id>-tuning.ts (real-time: src/sim/<id>-tuning.ts) holds the balance knobs',
    '  tuning-undocumented  every knob in the tuning file has a comment saying what it controls (a key documented on',
    '                       the DifficultyKnobs type counts; rows of the difficulty table are values, not knobs)',
    'Report rules (reports/sim/<id>.json, written by npm run test:sim):',
    '  report-missing       the report exists',
    '  report-invalid       the report has the expected shape, is for this game and matches the bands\' seeds and move cap',
    '  report-stale         the report was made from the current code (fingerprint: the game\'s logic folders, the sim and the game-kit files they import;',
    '                       the generated levels/pack-*.json do not count, so writing the packs after the sims keeps the report fresh)',
    '  report-cell-missing  every grid cell (policy x difficulty) and the endless cell are in the report',
    '  cap-hit              no run hit maxMoves (no stuck or endless games)',
    '  band-violated        every band holds',
    '  curve                the difficulty curve moves in its direction by at least minStep per level',
    '  skill-gap            each smarter policy beats the previous one by at least minStep',
    '  first-payoff         the kill test: the first payoff comes within withinMoves in minShare of runs',
    '  twist                the twist happens at least minPerRun times per run',
    '  endless-won          the endless cell (bands "endless", difficulty 100) has no won run; its bands hold,',
    '                       and it is never a step of the curve',
    '',
    'Example: npm run test:sim && node check-balance.mjs .',
  ].join('\n'),
};

const HARNESS = [
  'packages/game-kit/src/testing/play-bot.ts',
  'packages/game-kit/src/testing/trace-bot.ts',
  'packages/game-kit/src/testing/trace-bot.test.ts',
  'packages/game-kit/src/testing/bot-policies.ts',
  'packages/game-kit/src/testing/bot-policies.test.ts',
  'packages/game-kit/src/testing/sim-stats.ts',
  'packages/game-kit/src/testing/sim-stats.test.ts',
  'packages/game-kit/src/testing/balance-bands.ts',
  'packages/game-kit/src/testing/balance-bands.test.ts',
  'packages/game-kit/src/testing/parse-balance-bands.ts',
  'packages/game-kit/src/testing/parse-balance-bands.test.ts',
  'packages/game-kit/src/testing/run-sim-bot.ts',
  'packages/game-kit/src/testing/run-sim-bot.test.ts',
  'packages/tooling/src/sims/write-sim-report.ts',
  'packages/tooling/src/sims/write-sim-report.test.ts',
];
const WRITER = 'packages/tooling/src/sims/write-sim-report.ts';
const NONDETERMINISM = [
  [/\bMath\.random\s*\(/, 'Math.random()'],
  [/\bDate\.now\s*\(/, 'Date.now()'],
  [/\bnew\s+Date\s*\(/, 'new Date()'],
  [/\bperformance\.now\s*\(/, 'performance.now()'],
  [/\bjest\.retryTimes\s*\(/, 'jest.retryTimes()'],
  [/\b(it|test|describe)\.(skip|only)\s*\(|\b(xit|xdescribe|fit|fdescribe)\s*\(/, 'a skipped or focused test'],
];
const KNOB_LINE = /^\s*(readonly\s+)?[A-Za-z_$][\w$]*\??\s*:\s*(number|-?[\d_]+(\.\d+)?)\s*[,;]?\s*$/;

function readRel(root, rel) {
  const abs = join(root, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

function listDir(root, rel, predicate) {
  const abs = join(root, rel);
  return existsSync(abs) ? readdirSync(abs, { withFileTypes: true }).filter(predicate).map((entry) => entry.name).sort() : [];
}

/** 1-based line of the first match of `needle` (a string) in `text`, or 1. */
function lineAt(text, needle) {
  const index = text.indexOf(needle);
  return index === -1 ? 1 : lineOf(text, index);
}

function checkSimConfig(root, report) {
  const config = readRel(root, 'jest.sim.config.js');
  if (config === null) report.problem({ file: 'jest.sim.config.js', line: 0, rule: 'sim-config', message: 'no jest.sim.config.js at the repo root', fix: 'Copy templates/jest.sim.config.js: bot sims run in plain Node, never in npm test or pre-commit.' });
  else if (!/testEnvironment\s*:\s*['"]node['"]/.test(config) || !config.includes('test/**/*.sim.test.ts')) report.problem({ file: 'jest.sim.config.js', line: 1, rule: 'sim-config', message: 'the sim config is not a plain-Node config matching test/**/*.sim.test.ts', fix: 'Use templates/jest.sim.config.js (testEnvironment node, testMatch for *.sim.test.ts, the @e07 moduleNameMapper).' });
  const pkgText = readRel(root, 'package.json');
  let scripts = {};
  try {
    scripts = JSON.parse(pkgText ?? '{}').scripts ?? {};
  } catch {
    scripts = {};
  }
  if (!/jest\.sim\.config\.js/.test(scripts['test:sim'] ?? '')) report.problem({ file: 'package.json', line: pkgText === null ? 0 : lineAt(pkgText, '"scripts"'), rule: 'sim-config', message: 'no "test:sim" script running jest.sim.config.js', fix: 'Add "test:sim": "jest --ci --config jest.sim.config.js" to the root package.json scripts.' });
  const unit = readRel(root, 'jest.config.js');
  if (unit !== null && !/sim[\\.]{1,3}test/.test(maskComments(unit))) report.problem({ file: 'jest.config.js', line: 1, rule: 'sim-config', message: 'npm test does not ignore *.sim.test.ts', fix: "Add '\\\\.sim\\\\.test\\\\.' to the unit project's testPathIgnorePatterns: sims take seconds to minutes." });
}

function checkHarness(root, report) {
  for (const rel of HARNESS) {
    if (!existsSync(join(root, rel))) report.problem({ file: rel, line: 0, rule: 'harness-missing', message: 'bot harness file is missing', fix: `Copy templates/${rel} from the game-balance-and-bots skill (verbatim).` });
  }
  // A writer from before the import-closure fingerprint hashes all of game-kit, so its reports never match this check.
  const writer = readRel(root, WRITER);
  if (writer !== null && !/^export function fingerprintFiles\(/m.test(maskComments(writer))) report.problem({ file: WRITER, line: 1, rule: 'harness-outdated', message: 'the report writer is an older copy: it hashes all of packages/game-kit/src, not the game-kit files the sim imports (no fingerprintFiles export)', fix: `Copy templates/${WRITER} and its test again (verbatim), then rerun npm run test:sim.` });
}

function strayNodeSims(root, report) {
  for (const base of ['apps', 'packages']) {
    for (const dir of listDir(root, base, (entry) => entry.isDirectory())) {
      const src = `${base}/${dir}/src`;
      if (!existsSync(join(root, src))) continue;
      for (const rel of readdirSync(join(root, src), { recursive: true, encoding: 'utf8' })) {
        const path = `${src}/${rel.split('\\').join('/')}`;
        if (!path.endsWith('.sim.test.ts')) continue;
        const source = readFileSync(join(root, path), 'utf8');
        const at = source.search(/from\s+['"]node:|require\(\s*['"]node:/);
        if (at !== -1) report.problem({ file: path, line: lineOf(source, at), rule: 'sim-location', message: 'a sim that uses Node APIs lives in app or package source', fix: 'Move it to test/sims/<game-id>/ (only the root test/ folder has Node types; app code may not import node:*).' });
      }
    }
  }
}

function checkDeterminism(report, rel, source) {
  const code = maskComments(source);
  for (const [pattern, what] of NONDETERMINISM) {
    const match = pattern.exec(code);
    if (match) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'sim-determinism', message: `uses ${what}`, fix: 'Bots and sims take randomness only from seeds (sfc32) and never skip, focus or retry: a rerun must give identical numbers.' });
  }
}

function checkSims(root, game, report) {
  const dir = `test/sims/${game}`;
  const sims = listDir(root, dir, (entry) => entry.isFile() && entry.name.endsWith('.sim.test.ts'));
  if (sims.length === 0) {
    report.problem({ file: `${dir}/balance.sim.test.ts`, line: 0, rule: 'sim-missing', message: `${game} has no bot simulation`, fix: 'Copy templates/test/sims/__GAME_ID__/balance.sim.test.ts and replace the placeholders.' });
    return;
  }
  for (const name of sims) {
    const rel = `${dir}/${name}`;
    const source = readFileSync(join(root, rel), 'utf8');
    checkDeterminism(report, rel, source);
    const code = maskComments(source);
    const needs = [
      [/from\s+['"]@e07\/game-kit\/testing\//, 'does not play through the game-kit harness (traceBot/playBot)'],
      [/\bwriteSimReport\s*\(/, 'does not write reports/sim/<id>.json (writeSimReport)'],
      [/\bbandProblems\s*\(/, 'does not assert bandProblems(report, bands)'],
    ];
    for (const [pattern, message] of needs) {
      if (!pattern.test(code)) report.problem({ file: rel, line: 1, rule: 'sim-harness', message, fix: 'Start from templates/test/sims/__GAME_ID__/balance.sim.test.ts.' });
    }
  }
}

function checkBot(root, game, report) {
  const dir = `apps/${game}/src/testing`;
  const files = listDir(root, dir, (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name));
  let found = false;
  for (const name of files) {
    const source = readFileSync(join(root, `${dir}/${name}`), 'utf8');
    checkDeterminism(report, `${dir}/${name}`, source);
    if (/\b(BotPolicy|CommandPolicy)\b/.test(source)) found = true;
  }
  if (!found) report.problem({ file: `${dir}/${game}-bot.ts`, line: 0, rule: 'bot-missing', message: `${game} declares no BotPolicy (the game module's testing.bot) or CommandPolicy (real-time)`, fix: 'Write apps/<id>/src/testing/<id>-bot.ts with evaluate, scoreOf, tag and the greedy bot, like examples/line-siege (real-time: the SimBotGame hooks and a CommandPolicy, references/bots-and-sims.md).' });
}

function checkTuning(root, game, report) {
  const candidates = [`apps/${game}/src/rules/${game}-tuning.ts`, `apps/${game}/src/sim/${game}-tuning.ts`];
  const rel = candidates.find((path) => existsSync(join(root, path))) ?? candidates[0];
  const source = readRel(root, rel);
  if (source === null) {
    report.problem({ file: rel, line: 0, rule: 'tuning-missing', message: `${game} has no tuning file`, fix: 'Copy templates/apps/__GAME_ID__/src/rules/__GAME_ID__-tuning.ts and move every balance number of the rules into it.' });
    return;
  }
  const lines = source.split('\n');
  const tableLines = difficultyTableLines(lines);
  const typed = documentedTypeKeys(lines);
  let isInSatisfies = false;
  lines.forEach((line, index) => {
    // A `satisfies { ... }` block restates the shape; the knobs are documented where they are set.
    if (/\bsatisfies\s*\{\s*$/.test(line)) isInSatisfies = true;
    else if (isInSatisfies && /^\s*\}/.test(line)) isInSatisfies = false;
    // Rows of a difficulty table are values (Prettier may wrap a row over several lines).
    if (isInSatisfies || tableLines.has(index) || !KNOB_LINE.test(line)) return;
    if (typed.has(knobKey(line))) return;
    const above = (lines.slice(0, index).reverse().find((text) => text.trim() !== '') ?? '').trim();
    if (!(above.endsWith('*/') || above.startsWith('//') || above.startsWith('*'))) report.problem({ file: rel, line: index + 1, rule: 'tuning-undocumented', message: `knob "${line.trim()}" has no comment`, fix: 'Put a /** ... */ line above it, or document the key on the DifficultyKnobs type: what it controls and which direction is harder.' });
  });
}

const knobKey = (line) => line.trim().replace(/^readonly\s+/, '').split(/[?:]/)[0].trim();

/** Indexes of the lines inside `[ ... ] as const satisfies readonly <Type>[]` tables (the difficulty rows). */
function difficultyTableLines(lines) {
  const inside = new Set();
  let start = -1;
  lines.forEach((line, index) => {
    if (/=\s*\[\s*$/.test(line)) start = index;
    else if (start !== -1 && /^\s*\]\s*as\s+const\s+satisfies\s+readonly\s+[A-Za-z_$][\w$]*\s*\[\]/.test(line)) {
      for (let at = start + 1; at < index; at += 1) inside.add(at);
      start = -1;
    }
  });
  return inside;
}

/** Keys that carry a doc comment on a `type X = { ... }` declared in the tuning file (DifficultyKnobs, KindWeights). */
function documentedTypeKeys(lines) {
  const keys = new Set();
  let depth = 0;
  lines.forEach((line, index) => {
    if (/^\s*(export\s+)?type\s+[A-Za-z_$][\w$]*\s*=\s*\{\s*$/.test(line)) depth = 1;
    else if (depth > 0) {
      if (/^\s*\}/.test(line)) depth = 0;
      else if (/^\s*(readonly\s+)?[A-Za-z_$][\w$]*\??\s*:/.test(line)) {
        const above = (lines.slice(0, index).reverse().find((text) => text.trim() !== '') ?? '').trim();
        if (above.endsWith('*/') || above.startsWith('//')) keys.add(knobKey(line));
      }
    }
  });
  return keys;
}

/** Value imports (type-only imports are erased) of every non-test source in the game's logic folders. */
function checkFingerprintScope(root, game, report) {
  const allowed = GAME_LOGIC_FOLDERS.map((folder) => `apps/${game}/src/${folder}/`);
  for (const folder of GAME_LOGIC_FOLDERS) {
    const base = `apps/${game}/src/${folder}`;
    if (!existsSync(join(root, base))) continue;
    for (const entry of readdirSync(join(root, base), { recursive: true, encoding: 'utf8' })) {
      const rel = `${base}/${entry.split('\\').join('/')}`;
      if (!/\.tsx?$/.test(rel) || /\.test\.tsx?$/.test(rel)) continue;
      const code = maskComments(readFileSync(join(root, rel), 'utf8'));
      for (const match of code.matchAll(/^[ \t]*(?:import|export)\s+(?!type\b)[^;]*?\bfrom\s+['"]([^'"]+)['"]/gm)) {
        const spec = match[1];
        let target = null;
        if (spec.startsWith('.')) target = posix.normalize(posix.join(posix.dirname(rel), spec));
        else if (spec.startsWith(`@e07/${game}/`)) target = `apps/${game}/src/${spec.slice(`@e07/${game}/`.length)}`;
        else if (spec.startsWith('@e07/') && !spec.startsWith('@e07/game-kit/')) target = spec;
        if (target === null || allowed.some((prefix) => target.startsWith(prefix))) continue;
        // The engine assembly names buildTimeline for the board; bots never animate, so it decides no result.
        if (rel === `apps/${game}/src/rules/${game}-engine.ts` && target === `apps/${game}/src/board/build-timeline.ts`) continue;
        report.problem({ file: rel, line: lineOf(code, match.index), rule: 'fingerprint-scope', message: `imports ${spec}, which the sim report's fingerprint does not cover`, fix: 'Keep everything that decides a bot result in rules/, levels/, sim/ or testing/ (move a word list or table there) or in packages/game-kit; rules never import the Shell.' });
      }
    }
  }
}

/** Four decimals, like the report: 0.6 - 0.7 is -0.09999999999999998 in floating point, not -0.1. */
const round4 = (value) => Math.round(value * 10000) / 10000;

function readJson(root, rel) {
  const text = readRel(root, rel);
  if (text === null) return { text: null, value: null };
  try {
    return { text, value: JSON.parse(text) };
  } catch (error) {
    return { text, value: null, error: error.message };
  }
}

function checkBandsFile(root, game, report, options) {
  const rel = `test/sims/${game}/balance-bands.json`;
  const { text, value, error } = readJson(root, rel);
  if (text === null) {
    report.problem({ file: rel, line: 0, rule: 'bands-missing', message: `${game} has no balance contract`, fix: 'Copy templates/test/sims/__GAME_ID__/balance-bands.json and set the bands from the first sim run.' });
    return null;
  }
  const problems = error ? [`not valid JSON: ${error}`] : bandsProblems(value);
  for (const problem of problems) report.problem({ file: rel, line: 1, rule: 'bands-invalid', message: problem, fix: 'Fix the bands file (fields and metrics in references/balance-contract.md).' });
  if (problems.length > 0) return null;
  if (value.gameId !== game) report.problem({ file: rel, line: lineAt(text, '"gameId"'), rule: 'bands-invalid', message: `gameId is "${value.gameId}", expected "${game}"`, fix: 'Use the app folder name.' });
  // Owner decision O6 (2026-09-30): the play-test is the owner's personal step and never blocks a
  // release; a release run prints it for the report's "Owner steps (not blocking)" list.
  if (options.release && value.status !== 'approved') {
    console.log(`OWNER STEP (not blocking) ${rel}:${lineAt(text, '"status"')} [bands-unapproved] the bands are still "proposed": list "Play-test ${game} on a phone" under Owner steps (not blocking); when the owner agrees, set "status": "approved" and "approvedOn": "YYYY-MM-DD". Nothing waits for it.`);
  }
  return { rel, text, bands: value };
}

function judge(report, where, bands, sim) {
  const { rel: bandsRel, text } = where;
  const at = (needle) => ({ file: bandsRel, line: lineAt(text, needle) });
  const metric = (policy, difficulty, key) => cellOf(sim, policy, difficulty)?.[key] ?? NaN;
  for (const band of bands.bands) {
    const value = metric(band.policy, band.difficulty, band.metric);
    if (!(value >= band.min && value <= band.max)) report.problem({ ...at(band.why), rule: 'band-violated', message: `${band.policy} d${band.difficulty} ${band.metric} = ${value} is outside ${band.min}..${band.max} (${band.why})`, fix: 'Change a knob in the tuning file (never the band without the owner), rerun npm run test:sim, repeat.' });
  }
  const curve = bands.curve;
  const levels = [...bands.grid[curve.policy]].sort((a, b) => a - b);
  for (let i = 1; i < levels.length; i += 1) {
    const step = round4(metric(curve.policy, levels[i], curve.metric) - metric(curve.policy, levels[i - 1], curve.metric));
    const isOk = curve.direction === 'down' ? step <= -curve.minStep : step >= curve.minStep;
    if (!isOk) report.problem({ ...at('"curve"'), rule: 'curve', message: `${curve.policy} ${curve.metric} moves ${Number.isNaN(step) ? 'NaN' : step.toFixed(4)} from d${levels[i - 1]} to d${levels[i]}, expected ${curve.direction} by at least ${curve.minStep}`, fix: 'Spread the difficulty table so each level is clearly harder than the one before.' });
  }
  const gap = bands.skillGap;
  const sign = gap.better === 'higher' ? 1 : -1;
  for (let i = 1; i < gap.order.length; i += 1) {
    const gain = round4(sign * (metric(gap.order[i], gap.difficulty, gap.metric) - metric(gap.order[i - 1], gap.difficulty, gap.metric)));
    if (!(gain >= gap.minStep)) report.problem({ ...at('"skillGap"'), rule: 'skill-gap', message: `${gap.order[i]} does not beat ${gap.order[i - 1]} by ${gap.minStep} ${gap.metric} at d${gap.difficulty}`, fix: 'Skill must matter: if random plays as well as greedy, the choices are fake; change the rules or knobs, not the bots.' });
  }
  const fun = bands.firstPayoff;
  const share = cellOf(sim, fun.policy, fun.difficulty)?.firstPayoffShare?.[fun.withinMoves - 1] ?? 0;
  if (!(share >= fun.minShare)) report.problem({ ...at('"firstPayoff"'), rule: 'first-payoff', message: `only ${share} of ${fun.policy} d${fun.difficulty} runs reach the first payoff within ${fun.withinMoves} moves (need ${fun.minShare})`, fix: 'The fun-within-seconds kill test: build the opening so the first payoff comes at once (see references/fun-and-kill-test.md), or report that the idea fails it.' });
  if (bands.twist !== null) {
    const perRun = metric(bands.twist.policy, bands.twist.difficulty, 'twistPerRun');
    if (!(perRun >= bands.twist.minPerRun)) report.problem({ ...at('"twist"'), rule: 'twist', message: `the twist happens ${perRun} times per ${bands.twist.policy} d${bands.twist.difficulty} run (need ${bands.twist.minPerRun})`, fix: 'The twist barely matters: strengthen it in the rules (the Scrap Shove lesson), not in the band.' });
  }
  judgeEndless(report, where, bands, sim);
}

/** The endless cell (never part of the curve): never won, and inside its own bands. */
function judgeEndless(report, where, bands, sim) {
  const endless = bands.endless ?? null;
  if (endless === null) return;
  const at = (needle) => ({ file: where.rel, line: lineAt(where.text, needle) });
  const label = `endless ${endless.policy} d${endless.difficulty}`;
  const cell = cellOf(sim, endless.policy, endless.difficulty);
  if (cell === undefined) {
    report.problem({ ...at('"endless"'), rule: 'report-cell-missing', message: `no ${label} cell in the report`, fix: 'Play the endless cell in the sim after the grid (templates/test/sims/__GAME_ID__/balance.sim.test.ts), then rerun npm run test:sim.' });
    return;
  }
  if (cell.capHits > 0) report.problem({ ...at('"endless"'), rule: 'cap-hit', message: `${cell.capHits} ${label} runs hit maxMoves ${sim.maxMoves}`, fix: 'An endless run must still end: pressure has to rise (health, spawns) until the run is lost.' });
  if (cell.wins > 0) report.problem({ ...at('"endless"'), rule: 'endless-won', message: `${cell.wins} ${label} runs were won; an endless run only ever ends lost`, fix: 'Give the tuning an endless row with goal 0 and make outcome never return won at ENDLESS_DIFFICULTY (100).' });
  for (const band of endless.bands) {
    const value = cell[band.metric];
    if (!(value >= band.min && value <= band.max)) report.problem({ ...at(band.why), rule: 'band-violated', message: `${label} ${band.metric} = ${value} is outside ${band.min}..${band.max} (${band.why})`, fix: 'Change a knob of the endless row in the tuning file (never the band without the owner), rerun npm run test:sim, repeat.' });
  }
}

function checkReport(root, game, contract, report) {
  const rel = `reports/sim/${game}.json`;
  const { text, value, error } = readJson(root, rel);
  if (text === null) {
    report.problem({ file: rel, line: 0, rule: 'report-missing', message: `no sim report for ${game}`, fix: 'Run npm run test:sim (it writes reports/sim/<id>.json), then rerun this check.' });
    return;
  }
  const shape = error ? [`not valid JSON: ${error}`] : reportShapeProblems(value);
  for (const problem of shape) report.problem({ file: rel, line: 1, rule: 'report-invalid', message: problem, fix: 'Regenerate it with npm run test:sim; never edit a report by hand.' });
  if (shape.length > 0) return;
  if (value.gameId !== game) report.problem({ file: rel, line: lineAt(text, '"gameId"'), rule: 'report-invalid', message: `the report is for "${value.gameId}", not ${game}`, fix: 'The sim must write reports/sim/<its own game id>.json: fix GAME_ID in the sim file and rerun npm run test:sim.' });
  const fingerprint = rulesFingerprint(root, game);
  if (value.rulesFingerprint !== fingerprint) report.problem({ file: rel, line: lineAt(text, '"rulesFingerprint"'), rule: 'report-stale', message: 'the report was made from other rules, bots or harness than the current code', fix: 'Rerun npm run test:sim after every change to the game\'s rules, levels (not the generated pack-*.json), sim or testing folders, the game-kit files they import, or the sim file.' });
  if (contract === null) return;
  const { bands } = contract;
  if (value.seedsPerCell < Math.max(bands.seedsPerCell, MIN_SEEDS) || value.maxMoves !== bands.maxMoves) report.problem({ file: rel, line: lineAt(text, '"seedsPerCell"'), rule: 'report-invalid', message: `report ran ${value.seedsPerCell} seeds with maxMoves ${value.maxMoves}; the bands ask for ${bands.seedsPerCell} and ${bands.maxMoves}`, fix: 'Rerun npm run test:sim with the current bands file.' });
  for (const [policy, levels] of Object.entries(bands.grid)) {
    for (const difficulty of levels) {
      const cell = cellOf(value, policy, difficulty);
      if (cell === undefined) report.problem({ file: rel, line: 1, rule: 'report-cell-missing', message: `no ${policy} d${difficulty} cell`, fix: 'Rerun npm run test:sim; the sim plays every grid cell of the bands file.' });
      else if (cell.capHits > 0) report.problem({ file: rel, line: lineAt(text, `"policy": "${policy}",\n      "difficulty": ${difficulty}`), rule: 'cap-hit', message: `${cell.capHits} ${policy} d${difficulty} runs hit maxMoves ${value.maxMoves}`, fix: 'A game must always end: find the stuck state (replay the seed) and fix the rules.' });
    }
  }
  judge(report, contract, bands, value);
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = positionals[0] ?? '.';
  if (!existsSync(join(root, 'apps')) && !existsSync(join(root, 'packages/game-kit/src'))) fail(`nothing to check: ${root} has no apps/ and no packages/game-kit/src`, 'Run from the app repo root, or pass its path.');
  const report = createReporter({ name: 'check-balance', json: options.json });
  checkSimConfig(root, report);
  checkHarness(root, report);
  strayNodeSims(root, report);
  // Turn-based games have src/rules; real-time games (runSimBot) may have only src/sim.
  const withLogic = listDir(root, 'apps', (entry) => entry.isDirectory()).filter((game) => ['rules', 'sim'].some((folder) => existsSync(join(root, 'apps', game, 'src', folder))));
  const unknown = options.game.filter((game) => !withLogic.includes(game));
  if (unknown.length > 0) fail(`nothing to check: no apps/${unknown[0]}/src/rules or src/sim in ${root}`, `Pass an existing game id (${withLogic.join(', ') || 'none found'}).`);
  const games = withLogic.filter((game) => options.game.length === 0 || options.game.includes(game));
  for (const game of games) {
    checkSims(root, game, report);
    checkBot(root, game, report);
    checkTuning(root, game, report);
    checkFingerprintScope(root, game, report);
    const contract = checkBandsFile(root, game, report, options);
    checkReport(root, game, contract, report);
  }
  return report.finish({ checked: HARNESS.length + games.length, unit: 'harness files and games' });
});
