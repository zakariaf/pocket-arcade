#!/usr/bin/env node
// check-goldens.mjs: checks the goldens in a Pocket Arcade repo tree: every data golden has its
// snapshot and every snapshot its golden test, snapshots are readable data (never component trees),
// pixel goldens use the shared 0.1% matcher at 3 sizes x 3 moments and have baselines, every game with
// a daily challenge pins at least three dates including a year boundary, nothing automates `jest -u`,
// and the golden paths are gated and their diffs ignored.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-goldens.mjs [repo-root]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, posix } from 'node:path';

import { REPO_SCAN_IGNORES, createReporter, lineOf, maskComments, parseArgs, requireDir, run, walk } from './check-lib.mjs';

const SPEC = {
  name: 'check-goldens',
  summary: 'Checks data goldens, pixel goldens and the golden policy wiring of the repo (no Jest run needed).',
  usage: '[options] [repo-root]',
  options: {
    'max-entry-lines': { type: 'string', default: '120', value: 'n', help: 'Longest allowed snapshot entry, in lines' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  golden-never-runs       a *.golden.test.tsx or *.golden.spec.ts file: no Jest project runs it',
    '  snapshot-missing        a data golden calls toMatchSnapshot but has no <file>.snap.ios (jest --ci will fail)',
    '  snapshot-orphan         a .snap / .snap.ios whose test file is gone',
    '  snapshot-not-golden     a snapshot file that belongs to a test that is not *.golden.test.ts',
    '  snapshot-unreadable     a snapshot entry holds a component tree or is longer than --max-entry-lines',
    '  inline-snapshot         toMatchInlineSnapshot in a golden test (-u would rewrite the test file)',
    '  pixel-golden-place      a pixel golden outside test/goldens/ (it needs node:fs and Buffer)',
    '  pixel-matcher           a pixel golden does not extend expect with toMatchPixelGolden from skia-golden',
    '  golden-tolerance        a per-call failureThreshold, or skia-golden.ts above 0.1% of pixels',
    '  matcher-missing         pixel goldens exist but test/goldens/boards/skia-golden.ts does not',
    '  pixel-deps              pixel goldens exist but the root devDependencies lack exact pins of jest-image-snapshot',
    '                          and @types/jest-image-snapshot (verified: 6.5.2 and 6.4.2)',
    '  pixel-golden-cases      a pixel golden renders fewer than 3 sizes or not the moments 0, 0.5 and 1',
    '  baseline-missing        a pixel golden has no PNG in the __image_snapshots__ folder next to it',
    '  daily-golden-missing    a game with a daily challenge has no golden that calls dailySeed(',
    '  daily-golden-dates      the daily golden pins fewer than 3 dates or no Dec 31 / Jan 1 year boundary',
    '  update-in-automation    jest -u, --updateSnapshot, --ci=false or a baseline --update in scripts, hooks or CI',
    '  gated-path-missing      quality-gates.json gatedPaths lacks a golden path',
    '  diff-output-ignored     .gitignore does not ignore reports/ and __image_snapshots__/__diff_output__/',
  ].join('\n'),
};

// The shared repo-scan ignores (skills/, .claude/, node_modules, Pods, each app's generated ios/, android/,
// build/, out/) plus generated reports.
const IGNORE = [...REPO_SCAN_IGNORES, 'apps/*/dist/**', 'reports/**', 'coverage/**', 'tools/**', 'dist-audit/**', '.stryker-tmp/**'];
const GATED = ['**/*.golden.test.ts.snap.ios', '**/__snapshots__/*.golden.test.ts.snap', '**/__image_snapshots__/**', 'apps/*/e2e/baselines/**', 'test/goldens/boards/skia-golden.ts'];
const COMPONENT_TREE = /^\s*<[A-Z][A-Za-z0-9.]*(\s|>|\/>|$)|"props":\s*\{|^\s*style=\{/m;
const UPDATE = /\bjest\b[^\n"']*?(?:\s-u\b|--update-?[sS]napshot\b|--ci[= ]false\b)|(?:capture-screenshots-ios|render-board-previews|screenshots:ios)[^\n"']*?--update\b/;

const read = (root, rel) => readFileSync(join(root, rel), 'utf8');

/** The test file a snapshot belongs to, or null when the name does not look like a snapshot. */
function testOfSnapshot(rel) {
  const inFolder = /(^|\/)__snapshots__\/([^/]+)\.snap(?:\.(ios|android))?$/.exec(rel);
  if (inFolder) return posix.join(posix.dirname(posix.dirname(rel)), inFolder[2]);
  const beside = /^(.*\.(?:ts|tsx|js))\.snap(?:\.(ios|android))?$/.exec(rel);
  return beside ? beside[1] : null;
}

function snapshotEntries(text) {
  const entries = [];
  const re = /^exports\[`([\s\S]*?)`\] = `\n?([\s\S]*?)\n?`;$/gm;
  for (const match of text.matchAll(re)) entries.push({ key: match[1], body: match[2], index: match.index });
  return entries;
}

function checkSnapshots(root, snapshots, tests, maxLines, report) {
  for (const rel of snapshots) {
    const test = testOfSnapshot(rel);
    if (test === null) continue;
    if (!tests.has(test) && !existsSync(join(root, test))) {
      report.problem({ file: rel, line: 1, rule: 'snapshot-orphan', message: `belongs to ${test}, which does not exist`, fix: 'Delete the snapshot in the commit that removed its test (Gate-Change trailer).' });
      continue;
    }
    if (!/\.golden\.test\.ts$/.test(test)) {
      report.problem({ file: rel, line: 1, rule: 'snapshot-not-golden', message: `is a snapshot of ${basename(test)}, which is not a *.golden.test.ts`, fix: 'Delete it and assert roles, names and visible text instead; only data goldens use snapshots.' });
      continue;
    }
    const text = read(root, rel);
    for (const entry of snapshotEntries(text)) {
      const lines = entry.body.split('\n').length;
      if (COMPONENT_TREE.test(entry.body)) report.problem({ file: rel, line: lineOf(text, entry.index), rule: 'snapshot-unreadable', message: `entry "${entry.key.slice(0, 60)}" holds a component tree`, fix: 'Snapshot readable data (an ASCII board, short lines), never rendered UI.' });
      else if (lines > maxLines) report.problem({ file: rel, line: lineOf(text, entry.index), rule: 'snapshot-unreadable', message: `entry "${entry.key.slice(0, 60)}" is ${lines} lines (limit ${maxLines})`, fix: 'Render only what a player sees (renderCells, one header line) or split it into smaller goldens.' });
    }
  }
}

function checkDataGolden(root, rel, code, snapshots, report) {
  if (/\btoMatchSnapshot\s*\(/.test(code)) {
    const dir = posix.dirname(rel);
    const name = posix.basename(rel);
    const candidates = [`${rel}.snap.ios`, `${rel}.snap`, posix.join(dir, '__snapshots__', `${name}.snap`), posix.join(dir, '__snapshots__', `${name}.snap.ios`)];
    if (!candidates.some((candidate) => snapshots.has(candidate))) report.problem({ file: rel, line: lineOf(code, code.search(/\btoMatchSnapshot\s*\(/)), rule: 'snapshot-missing', message: 'has no snapshot file next to it', fix: `Create it on purpose: npx jest ${rel} --selectProjects golden -u, read the .snap.ios, commit with a Gate-Change trailer.` });
  }
  for (const match of code.matchAll(/\btoMatchInlineSnapshot\s*\(/g)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'inline-snapshot', message: 'uses an inline snapshot', fix: 'Use toMatchSnapshot(): the .snap.ios file is a gated path and -u never rewrites the test itself.' });
}

function checkPixelGolden(root, rel, code, report) {
  const problem = (rule, index, message, fix) => report.problem({ file: rel, line: index < 0 ? 1 : lineOf(code, index), rule, message, fix });
  const at = code.search(/\btoMatchImageSnapshot\s*\(/);
  if (!rel.startsWith('test/goldens/')) problem('pixel-golden-place', at, 'a pixel golden outside test/goldens/', 'Move it to test/goldens/boards/<game-id>-board.golden.test.ts (it reads the font with node:fs).');
  const importsMatcher = /import\s*\{[^}]*\btoMatchPixelGolden\b[^}]*\}\s*from\s*['"][^'"]*skia-golden(\.ts)?['"]/.test(code);
  const extendsMatcher = /expect\.extend\(\s*\{\s*toMatchImageSnapshot\s*:\s*toMatchPixelGolden\s*\}\s*\)/.test(code);
  if (!importsMatcher || !extendsMatcher) problem('pixel-matcher', at, 'does not use toMatchPixelGolden from skia-golden.ts', "Import it and call expect.extend({ toMatchImageSnapshot: toMatchPixelGolden }); never configureToMatchImageSnapshot in a test.");
  for (const match of code.matchAll(/\b(failureThreshold|failureThresholdType|customDiffConfig|configureToMatchImageSnapshot)\b/g)) problem('golden-tolerance', match.index, `sets ${match[1]} in the test`, 'Remove it: the tolerance lives only in skia-golden.ts (0.1% of pixels).');
  const widths = new Set([...code.matchAll(/\bwidth:\s*(\d+)/g)].map((match) => match[1]));
  const hasMoments = /\[\s*0\s*,\s*0\.5\s*,\s*1\s*\]/.test(code);
  if (widths.size < 3 || !hasMoments) problem('pixel-golden-cases', at, `renders ${widths.size} canvas size(s)${hasMoments ? '' : ' and not the moments [0, 0.5, 1]'}`, 'Render phone-portrait 390x560, tablet-landscape 1024x700 and small 320x400 at moments [0, 0.5, 1] of the busiest turn.');
  const folder = join(root, dirname(rel), '__image_snapshots__');
  const prefix = basename(rel).replace(/-board\.golden\.test\.ts$/, '-');
  const pngs = existsSync(folder) ? readdirSync(folder).filter((name) => name.endsWith('.png')) : [];
  const own = prefix.endsWith('.golden.test.ts') ? pngs : pngs.filter((name) => name.startsWith(prefix));
  if (own.length === 0) problem('baseline-missing', at, `no baseline PNG${prefix.endsWith('-') ? ` starting with ${prefix}` : ''} in ${posix.join(posix.dirname(rel), '__image_snapshots__')}/`, `Create them on purpose: npx jest ${rel} --selectProjects golden -u, open every PNG, commit with a Gate-Change trailer.`);
}

function checkMatcher(root, hasPixel, report) {
  const rel = 'test/goldens/boards/skia-golden.ts';
  if (!existsSync(join(root, rel))) {
    if (hasPixel) report.problem({ file: rel, line: 0, rule: 'matcher-missing', message: 'pixel goldens exist but the shared matcher does not', fix: "Copy this skill's templates/test/goldens/boards/skia-golden.ts." });
    return;
  }
  const code = maskComments(read(root, rel));
  const threshold = /failureThreshold\s*:\s*([0-9.eE+-]+)/.exec(code);
  const type = /failureThresholdType\s*:\s*['"](\w+)['"]/.exec(code);
  if (!threshold || Number(threshold[1]) > 0.001 || !type || type[1] !== 'percent') report.problem({ file: rel, line: threshold ? lineOf(code, threshold.index) : 1, rule: 'golden-tolerance', message: `tolerance is ${threshold ? threshold[1] : 'missing'} ${type ? type[1] : ''}, not at most 0.001 percent`, fix: "Restore failureThreshold: 0.001 with failureThresholdType: 'percent'; a tolerance changes only with the owner's agreement." });
}

const PIXEL_DEPS = { 'jest-image-snapshot': '6.5.2', '@types/jest-image-snapshot': '6.4.2' };

function checkPixelDeps(root, hasPixel, report) {
  if (!hasPixel || !existsSync(join(root, 'package.json'))) return;
  let pkg;
  try {
    pkg = JSON.parse(read(root, 'package.json'));
  } catch {
    return;
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [name, verified] of Object.entries(PIXEL_DEPS)) {
    const version = deps[name];
    if (version === undefined) report.problem({ file: 'package.json', line: 1, rule: 'pixel-deps', message: `pixel goldens exist but devDependencies lack ${name}`, fix: `npm install --save-dev --save-exact ${name}@${verified} at the repo root (the verified pin).` });
    else if (!/^\d+\.\d+\.\d+$/.test(version)) report.problem({ file: 'package.json', line: 1, rule: 'pixel-deps', message: `${name} is "${version}", not an exact version`, fix: `Pin it exactly (${verified} is verified); a moving matcher changes what "0.1% of pixels" means.` });
  }
}

function dailyApps(root, files) {
  const apps = new Map();
  for (const rel of files) {
    const app = /^apps\/([^/]+)\//.exec(rel)?.[1];
    if (!app || /\.test\.tsx?$/.test(rel) || !/\.(ts|tsx)$/.test(rel)) continue;
    const code = maskComments(read(root, rel));
    if (/kind\s*:\s*['"]daily['"]\s*,[^}]*\bsalt\s*:|\bdaily\s*:\s*true\b/.test(code) && !apps.has(app)) apps.set(app, rel);
  }
  return apps;
}

function checkDaily(root, files, goldenTests, report) {
  for (const [app, where] of dailyApps(root, files)) {
    const goldens = goldenTests.filter((rel) => rel.startsWith(`apps/${app}/`) || rel.startsWith(`test/goldens/${app}`));
    const daily = goldens.map((rel) => ({ rel, code: maskComments(read(root, rel)) })).filter(({ code }) => /\bdailySeed\s*\(/.test(code));
    if (daily.length === 0) {
      report.problem({ file: where, line: 1, rule: 'daily-golden-missing', message: `${app} has a daily challenge but no golden calls dailySeed(`, fix: `Copy this skill's templates/level.golden.test.ts to apps/${app}/src/levels/ and pin at least three dates (spec 8.3 contract).` });
      continue;
    }
    const dates = new Set(daily.flatMap(({ code }) => [...code.matchAll(/['"](\d{4})-(\d{2})-(\d{2})['"]/g)].map((match) => match.slice(1, 4).join('-'))));
    const years = [...dates].filter((date) => date.endsWith('-12-31')).map((date) => Number(date.slice(0, 4)));
    const boundary = years.some((year) => dates.has(`${year + 1}-01-01`));
    if (dates.size < 3 || !boundary) report.problem({ file: daily[0].rel, line: 1, rule: 'daily-golden-dates', message: `pins ${dates.size} daily date(s)${boundary ? '' : ' and no Dec 31 / Jan 1 year boundary'}`, fix: "Pin at least three dates, including a pair like '2026-12-31' and '2027-01-01' (add dates; never change an existing one)." });
  }
}

function checkAutomation(root, report) {
  const places = ['package.json', 'lefthook.yml', '.claude/settings.json'];
  const workflows = join(root, '.github', 'workflows');
  if (existsSync(workflows)) for (const name of readdirSync(workflows).sort()) if (/\.ya?ml$/.test(name)) places.push(`.github/workflows/${name}`);
  for (const rel of places) {
    if (!existsSync(join(root, rel))) continue;
    const text = read(root, rel);
    text.split('\n').forEach((line, index) => {
      const match = UPDATE.exec(line);
      if (match) report.problem({ file: rel, line: index + 1, rule: 'update-in-automation', message: `"${match[0].trim().slice(0, 70)}" updates goldens automatically`, fix: 'Remove it: goldens and baselines change only by hand, one file at a time, after looking at them, with a Gate-Change trailer.' });
    });
  }
}

function checkWiring(root, report) {
  const gates = join(root, 'quality-gates.json');
  if (existsSync(gates)) {
    try {
      const paths = JSON.parse(readFileSync(gates, 'utf8')).gatedPaths ?? [];
      for (const glob of GATED) if (!paths.includes(glob)) report.problem({ file: 'quality-gates.json', line: 1, rule: 'gated-path-missing', message: `gatedPaths lacks ${glob}`, fix: `Add "${glob}" to gatedPaths (owner agreement and a Gate-Change trailer); the commit-msg hook then asks for the trailer.` });
    } catch (error) {
      report.problem({ file: 'quality-gates.json', line: 1, rule: 'gated-path-missing', message: `is not valid JSON (${error.message.split('\n')[0]})`, fix: 'Fix the JSON.' });
    }
  }
  const ignore = join(root, '.gitignore');
  if (existsSync(ignore)) {
    const lines = readFileSync(ignore, 'utf8').split('\n').map((line) => line.trim());
    for (const needed of ['reports/', '**/__image_snapshots__/__diff_output__/']) if (!lines.includes(needed) && !lines.includes(needed.replace(/\/$/, ''))) report.problem({ file: '.gitignore', line: 1, rule: 'diff-output-ignored', message: `does not list ${needed}`, fix: `Add the line ${needed}; diff images are never committed.` });
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const maxLines = Number(options['max-entry-lines']);
  const report = createReporter({ name: SPEC.name, json: options.json });
  const files = walk(root, { ignore: IGNORE }).filter((rel) => /^(apps|packages|test)\//.test(rel));
  const snapshots = new Set(files.filter((rel) => /\.snap(\.(ios|android))?$/.test(rel)));
  const tests = new Set(files.filter((rel) => /\.test\.(ts|tsx|js)$/.test(rel)));
  for (const rel of files.filter((path) => /\.golden\.(test\.tsx|spec\.tsx?)$/.test(path))) report.problem({ file: rel, line: 1, rule: 'golden-never-runs', message: 'no Jest project runs this file', fix: 'Name it <unit>.golden.test.ts (the golden project matches only *.golden.test.ts).' });
  const goldenTests = files.filter((rel) => rel.endsWith('.golden.test.ts'));
  let hasPixel = false;
  for (const rel of goldenTests) {
    const code = maskComments(read(root, rel));
    checkDataGolden(root, rel, code, snapshots, report);
    if (/\btoMatchImageSnapshot\s*\(/.test(code)) {
      hasPixel = true;
      checkPixelGolden(root, rel, code, report);
    }
  }
  checkSnapshots(root, [...snapshots], tests, maxLines, report);
  checkMatcher(root, hasPixel, report);
  checkPixelDeps(root, hasPixel, report);
  checkDaily(root, files, goldenTests, report);
  checkAutomation(root, report);
  checkWiring(root, report);
  return report.finish({ checked: goldenTests.length + snapshots.size, unit: 'golden tests and snapshots' });
});
