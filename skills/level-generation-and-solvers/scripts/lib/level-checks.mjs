// level-checks.mjs: static checks of the level kit and of one game's levels folder
// (apps/<id>/src/levels), plus the level quality metrics. Not an entry point.

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { readText, walk } from '../check-lib.mjs';
import { bare, code, exportNames, importsOf, matchesWithLines } from './ts-scan.mjs';

const KIT = 'packages/game-kit/src';

/** Level kit files and the exports other code imports by name. */
export const KIT_FILES = {
  'solver/search-problem.ts': ['SearchProblem', 'SolvableEngine', 'engineProblem'],
  'solver/bfs-solve.ts': ['bfsSolve'],
  'solver/ida-star-solve.ts': ['idaStarSolve', 'HeuristicProblem'],
  'solver/engine-solver.ts': ['createBfsSolver', 'createIdaStarSolver'],
  'solver/verify-line.ts': ['verifyLine'],
  'levels/level-table.ts': ['toLevelEntries'],
  'levels/levels-contract.ts': ['levelsContractProblems'],
  'levels/pack-progress.ts': ['isLevelUnlocked', 'defaultStarsToUnlock', 'totalStars', 'nextLevel'],
  'levels/star-rating.ts': ['starsFor', 'StarCount'],
  'levels/daily-start.ts': ['dailyStart'],
  'levels/level-plan.ts': ['LevelPlan', 'SolvedCandidate'],
  'levels/plan-level-table.ts': ['planLevelTable', 'candidateSeed', 'packsOf'],
  'levels/witness-solver.ts': ['createWitnessSolver', 'WitnessSetup'],
  'testing/render-cells.ts': ['renderCells'],
  'dates/date-key.ts': ['DateKey', 'addDays', 'daysBetween'],
  'dates/daily-seed.ts': ['dailySeed'],
};

export const TOOLING_FILE = 'packages/tooling/src/levels/generate-levels.ts';

/** The pinned daily seeds: the "same level for every player" contract (spec 8.3). */
export const DAILY_GOLDENS = [
  { date: '2026-09-26', salt: 17, seed: 2599028541 },
  { date: '2026-09-27', salt: 17, seed: 2582250922 },
];

/** Spec 8.1 stars, run against the real starsFor: par 7 and score thresholds [100, 250, 400]. */
export const STAR_GOLDENS = [
  { rule: { kind: 'par', par: 7 }, run: { isWon: true, moves: 7, score: 0 }, stars: 3 },
  { rule: { kind: 'par', par: 7 }, run: { isWon: true, moves: 9, score: 0 }, stars: 2 },
  { rule: { kind: 'par', par: 7 }, run: { isWon: true, moves: 10, score: 0 }, stars: 1 },
  { rule: { kind: 'par', par: 7 }, run: { isWon: false, moves: 3, score: 0 }, stars: 0 },
  { rule: { kind: 'score', thresholds: [100, 250, 400] }, run: { isWon: true, moves: 12, score: 249 }, stars: 1 },
  { rule: { kind: 'score', thresholds: [100, 250, 400] }, run: { isWon: true, moves: 12, score: 250 }, stars: 2 },
  { rule: { kind: 'score', thresholds: [100, 250, 400] }, run: { isWon: true, moves: 12, score: 400 }, stars: 3 },
  { rule: { kind: 'score', thresholds: [100, 250, 400] }, run: { isWon: false, moves: 12, score: 999 }, stars: 0 },
];

const IMPURE = /^(react|react-native|expo|zustand)(\/|-|$)|^@(shopify|expo|react-native)\/|^@e07\/(shell|tooling)\/|^node:/;
const ALLOWED_MATH = new Set(['sqrt', 'imul', 'floor', 'round', 'abs', 'min', 'max', 'PI']);
const UINT32_MAX = 4294967295;

export function checkKit(repo, report) {
  let checked = 0;
  for (const [rel, names] of Object.entries(KIT_FILES)) {
    const path = `${KIT}/${rel}`;
    checked += 1;
    if (!repo.exists(path)) {
      report.problem({ file: path, rule: 'kit-file-missing', message: 'level kit file is missing', fix: `Copy templates/${path} from this skill (with its test).` });
      continue;
    }
    const exported = exportNames(readText(join(repo.root, path)) ?? '');
    for (const name of names.filter((item) => !exported.has(item))) report.problem({ file: path, line: 1, rule: 'kit-export-missing', message: `does not export ${name}`, fix: `Restore the file from templates/${path}.` });
  }
  checked += 1;
  if (!repo.exists(TOOLING_FILE)) report.problem({ file: TOOLING_FILE, rule: 'kit-file-missing', message: 'the level table generator is missing', fix: `Copy templates/${TOOLING_FILE}; pack-<n>.json files are generated, never typed.` });
  return checked;
}

/**
 * Packages the level kit's and the levels' tests import that the bootstrap does not install, with
 * the pin of the versions table. They belong in the root devDependencies, pinned exactly.
 */
export const TEST_DEPENDENCIES = { 'fast-check': '4.10.2' };

/** The first file under `folders` that imports `name`, or null. */
function firstImporter(repo, folders, name) {
  for (const folder of folders.filter((item) => repo.exists(item))) {
    for (const rel of walk(join(repo.root, folder), { include: ['*.ts', '*.tsx'] })) {
      const text = readText(join(repo.root, folder, rel)) ?? '';
      if (importsOf(text).some((item) => item.specifier === name)) return `${folder}/${rel}`;
    }
  }
  return null;
}

function readRootManifest(repo) {
  try {
    return JSON.parse(readText(join(repo.root, 'package.json')) ?? '');
  } catch {
    return null;
  }
}

/**
 * The kit's tests (date keys, IDA*, stars, the witness) and the solver template import fast-check,
 * which the bootstrap leaves out: without it tsc and eslint fail with TS2307 on the copied tests.
 */
export function checkTestDependencies(repo, folders, report) {
  const manifest = readRootManifest(repo);
  for (const [name, pin] of Object.entries(TEST_DEPENDENCIES)) {
    const importer = firstImporter(repo, folders, name);
    if (importer === null) continue;
    const install = `Run npm install -D -E ${name}@${pin} at the repo root (an exact pin in the root devDependencies), then npm approve-scripts --allow-scripts-pending and approve fsevents if it is listed.`;
    const version = manifest?.devDependencies?.[name];
    if (version === undefined) {
      report.problem({ file: 'package.json', line: 1, rule: 'kit-test-dependency', message: `${importer} imports ${name}, but the root package.json has no ${name} devDependency`, fix: install });
    } else if (!/^\d+\.\d+\.\d+$/.test(String(version))) {
      report.problem({ file: 'package.json', line: 1, rule: 'kit-test-dependency', message: `${name} is "${version}", not an exact version`, fix: install });
    }
  }
}

export function levelFiles(root, gameId) {
  const folder = `apps/${gameId}/src/levels`;
  return walk(join(root, folder)).map((rel) => {
    const abs = join(root, folder, rel);
    return { rel: `${folder}/${rel}`, name: rel, abs, text: readText(abs) ?? '', isTest: /\.test\.tsx?$/.test(rel) };
  });
}

/**
 * The levels import zone (the same as check-boundaries' rules-pure zone): @e07/game-kit/**, the
 * game's own @e07/<id>/rules/** and @e07/<id>/levels/**, and relative files inside rules/ or
 * levels/. Returns why a specifier is outside it, or null. A witness that needs the game's bot
 * evaluation imports it from rules/<id>-evaluate.ts; testing/<id>-bot.ts only re-exports it.
 */
function zoneProblem(gameId, fileRel, specifier) {
  if (IMPURE.test(specifier)) return 'levels must run headless in Node and in tooling';
  const workspace = /^@e07\/([a-z0-9-]+)\/(.*)$/.exec(specifier);
  if (workspace !== null) {
    const [, name, rest] = workspace;
    if (name === 'game-kit') return null;
    if (name === gameId && /^(rules|levels)\//.test(rest)) return null;
    return name === gameId ? `levels may import only the game's rules/ and levels/ (not ${rest.split('/')[0]}/)` : 'levels may import only @e07/game-kit and the game\'s own rules/ and levels/';
  }
  if (!specifier.startsWith('.')) return null;
  const folder = fileRel.split('/').slice(0, -1);
  const parts = [...folder];
  for (const part of specifier.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.') parts.push(part);
  }
  const target = parts.join('/');
  const src = `apps/${gameId}/src/`;
  return target.startsWith(`${src}rules/`) || target.startsWith(`${src}levels/`) ? null : `the relative import reaches ${target}, outside rules/ and levels/`;
}

export function checkPurityAndDeterminism(gameId, files, report) {
  for (const file of files.filter((item) => /\.tsx?$/.test(item.name))) {
    for (const { specifier, line } of importsOf(file.text)) {
      const why = zoneProblem(gameId, file.rel, specifier);
      if (why !== null) {
        report.problem({ file: file.rel, line, rule: 'pure-import', message: `imports ${specifier}; ${why}`, fix: 'Levels import only @e07/game-kit/**, @e07/<id>/rules/** and @e07/<id>/levels/** (check-boundaries\' rules-pure zone). An evaluation the witness needs lives in rules/<id>-evaluate.ts; testing/<id>-bot.ts re-exports it.' });
      }
    }
    const text = bare(file.text);
    const hits = [...matchesWithLines(text, /\bMath\.random\b|\bDate\.now\b|\bnew\s+Date\b|\bperformance\.now\b/g)];
    if (!file.isTest) {
      hits.push(...matchesWithLines(text, /\bMath\.([A-Za-z0-9_]+)/g).filter(({ match }) => !ALLOWED_MATH.has(match[1]) && match[1] !== 'random'));
      hits.push(...matchesWithLines(text, /\*\*=?|\bIntl\./g));
    }
    for (const { match, line } of hits) report.problem({ file: file.rel, line, rule: 'determinism', message: `uses ${match[0]}; generated levels would differ between machines`, fix: 'Use only exact arithmetic and the seeded RNG; levels are regenerated and compared byte for byte.' });
  }
}

function isInt(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function entryProblem(entry) {
  if (entry === null || typeof entry !== 'object') return 'is not an object';
  if (!isInt(entry.level, 1, 9999)) return `level ${JSON.stringify(entry.level)} is not 1..9999`;
  if (!isInt(entry.seed, 0, UINT32_MAX)) return `seed ${JSON.stringify(entry.seed)} is not a uint32`;
  if (!isInt(entry.difficulty, 0, 99)) return `difficulty ${JSON.stringify(entry.difficulty)} is not 0..99 (levels; 100 is the endless run)`;
  const stars = entry.stars;
  if (stars?.kind === 'par') return isInt(stars.par, 1, 9999) ? null : `par ${JSON.stringify(stars.par)} is not a whole number >= 1`;
  if (stars?.kind === 'score') {
    const t = stars.thresholds;
    const ok = Array.isArray(t) && t.length === 3 && t.every((value) => isInt(value, 0, Number.MAX_SAFE_INTEGER)) && t[0] < t[1] && t[1] < t[2];
    return ok ? null : `score thresholds ${JSON.stringify(t)} are not three ascending whole numbers`;
  }
  return `stars ${JSON.stringify(stars)} is neither { kind: 'par' } nor { kind: 'score' }`;
}

/** Reads pack-1.json, pack-2.json, ... in order; returns [{ rel, entries }] (entries null when unreadable). */
export function readPacks(root, gameId, report) {
  const folder = `apps/${gameId}/src/levels`;
  const names = existsSync(join(root, folder)) ? readdirSync(join(root, folder)).filter((name) => /^pack-\d+\.json$/.test(name)) : [];
  const numbers = names.map((name) => Number(/\d+/.exec(name)[0])).sort((a, b) => a - b);
  numbers.forEach((number, index) => {
    if (number !== index + 1) report.problem({ file: `${folder}/pack-${number}.json`, rule: 'level-numbering', message: `pack files are not numbered 1..n (found pack-${number}.json at position ${index + 1})`, fix: 'Regenerate the packs with the level generator; never rename them by hand.' });
  });
  return numbers.map((number) => {
    const rel = `${folder}/pack-${number}.json`;
    let entries = null;
    try {
      entries = JSON.parse(readText(join(root, rel)) ?? 'null');
    } catch (error) {
      report.problem({ file: rel, rule: 'pack-json', message: `is not valid JSON: ${error.message}`, fix: 'Regenerate it: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/levels/generate-levels.ts --app <id>' });
      return { rel, entries: null };
    }
    if (!Array.isArray(entries)) {
      report.problem({ file: rel, rule: 'pack-json', message: 'is not a JSON array of level entries', fix: 'Regenerate it with the level generator.' });
      return { rel, entries: null };
    }
    entries.forEach((entry, index) => {
      const problem = entryProblem(entry);
      if (problem) report.problem({ file: rel, rule: 'pack-json', message: `entry ${index} ${problem}`, fix: 'Regenerate the pack with the level generator; fix the plan, not the JSON.' });
    });
    return { rel, entries };
  });
}

/** Game config numbers the packs must match (null when game.config.ts is absent or unreadable). */
export function readGameConfig(root, gameId) {
  const path = join(root, 'apps', gameId, 'game.config.ts');
  if (!existsSync(path)) return null;
  const text = code(readText(path) ?? '');
  const levels = /levels:\s*\{\s*packCount:\s*(\d+),\s*levelsPerPack:\s*(\d+)\s*,?\s*\}/.exec(text);
  const modes = /modes:\s*\{\s*daily:\s*(true|false),\s*endless:\s*(true|false)\s*,?\s*\}/.exec(text);
  return {
    rel: `apps/${gameId}/game.config.ts`,
    packCount: levels ? Number(levels[1]) : null,
    levelsPerPack: levels ? Number(levels[2]) : null,
    daily: modes ? modes[1] === 'true' : null,
    endless: modes ? modes[2] === 'true' : null,
  };
}

function average(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Numbering, sizes, config match, duplicates and the quality metrics of the whole table. */
export function checkTable(packs, config, report) {
  const valid = packs.filter((pack) => Array.isArray(pack.entries));
  // Positions count every listed entry, so one invalid entry (already a pack-json problem) does not
  // shift the numbering of every level after it.
  const listed = valid.flatMap((pack) => pack.entries.map((entry) => ({ entry, rel: pack.rel })));
  const all = listed.filter(({ entry }) => entryProblem(entry) === null);
  listed.forEach(({ entry, rel }, index) => {
    if (entryProblem(entry) === null && entry.level !== index + 1) report.problem({ file: rel, rule: 'level-numbering', message: `level ${entry.level} is at position ${index + 1}; levels run 1..n across packs`, fix: 'Regenerate the packs from the plan.' });
  });
  const sizes = valid.map((pack) => pack.entries.length);
  if (new Set(sizes).size > 1) report.problem({ file: valid[0]?.rel ?? '', rule: 'pack-size', message: `packs have different sizes (${sizes.join(', ')})`, fix: 'Every pack holds levelsPerPack levels; regenerate from the plan.' });
  if (config !== null) {
    if (config.packCount !== null && config.packCount !== packs.length) report.problem({ file: config.rel, rule: 'pack-config', message: `game.config.ts says ${config.packCount} packs, the levels folder has ${packs.length} pack files`, fix: 'Make game.config.ts levels.packCount, the plan\'s packs and the generated files agree.' });
    if (config.levelsPerPack !== null && sizes.some((size) => size !== config.levelsPerPack)) report.problem({ file: config.rel, rule: 'pack-config', message: `game.config.ts says ${config.levelsPerPack} levels per pack, the packs hold ${sizes.join(', ')}`, fix: 'Make levelsPerPack agree in game.config.ts and the plan, then regenerate.' });
  }
  const seen = new Map();
  for (const { entry, rel } of all) {
    const key = `${entry.seed}/${entry.difficulty}`;
    if (seen.has(key)) report.problem({ file: rel, rule: 'duplicate-level', message: `level ${entry.level} repeats level ${seen.get(key)} (seed/difficulty ${key})`, fix: 'The generator skips repeated boards; regenerate instead of copying entries.' });
    else seen.set(key, entry.level);
  }
  all.forEach(({ entry, rel }, index) => {
    const previous = all[index - 1]?.entry;
    if (previous !== undefined && entry.difficulty < previous.difficulty) report.problem({ file: rel, rule: 'difficulty-curve', message: `level ${entry.level} difficulty ${entry.difficulty} is below level ${previous.level}'s ${previous.difficulty}`, fix: 'Make difficultyFor non-decreasing and regenerate.' });
    if (entry.stars.kind === 'par' && entry.stars.par < 2 && entry.level > 3) report.problem({ file: rel, rule: 'trivial-level', message: `level ${entry.level} is won in ${entry.stars.par} move`, fix: 'Reject candidates below a minimum par in the plan\'s rate() (only the first levels may be one-movers).' });
  });
  const parAverages = valid.map((pack) => average(pack.entries.filter((entry) => entry?.stars?.kind === 'par').map((entry) => entry.stars.par)));
  parAverages.forEach((value, index) => {
    if (index > 0 && value > 0 && value < parAverages[index - 1]) report.problem({ file: valid[index].rel, rule: 'par-curve', message: `pack ${index + 1} averages par ${value.toFixed(2)}, below pack ${index}'s ${parAverages[index - 1].toFixed(2)}`, fix: 'Later packs must not be easier: raise the minimum par or the difficulty of later packs.' });
  });
  return all;
}

/** Per-pack metrics for --report: levels, difficulty and par ranges. */
export function metrics(packs) {
  return packs.filter((pack) => Array.isArray(pack.entries)).map((pack, index) => {
    const entries = pack.entries.filter((entry) => entryProblem(entry) === null);
    const pars = entries.filter((entry) => entry.stars.kind === 'par').map((entry) => entry.stars.par);
    const difficulties = entries.map((entry) => entry.difficulty);
    const range = (values) => (values.length === 0 ? '-' : `${Math.min(...values)}..${Math.max(...values)} (avg ${average(values).toFixed(2)})`);
    return `pack ${index + 1}: ${entries.length} levels, difficulty ${range(difficulties)}, par ${range(pars)}`;
  });
}

function goldenSnapshotExists(root, file) {
  const dir = join(root, file.rel.slice(0, file.rel.length - file.name.length));
  const base = file.name.split('/').pop();
  return existsSync(join(dir, `${base}.snap.ios`)) || existsSync(join(dir, `${base}.snap`)) || existsSync(join(dir, '__snapshots__', `${base}.snap`)) || existsSync(join(dir, '__snapshots__', `${base}.snap.ios`));
}

/** levels.ts members, modes against game.config, goldens, the contract test, the solver. */
/** A game's daily salt from its LevelsSpec (inline or through a constant), or null. */
export function dailySaltOf(root, gameId) {
  const path = join(root, 'apps', gameId, 'src', 'levels', `${gameId}-levels.ts`);
  if (!existsSync(path)) return null;
  const text = code(readText(path) ?? '');
  const ref = /\bsalt:\s*([A-Za-z0-9_]+)/.exec(text)?.[1];
  if (ref === undefined) return null;
  const literal = /^(0x[0-9a-fA-F_]+|[0-9_]+)$/.test(ref) ? ref : new RegExp(`\\b${ref}\\s*=\\s*(0x[0-9a-fA-F_]+|[0-9_]+)\\b`).exec(text)?.[1];
  return literal === undefined ? null : Number(literal.replaceAll('_', ''));
}

/** Spec 8.3: each game has its own daily salt; a copied template salt makes two games share it. */
export function checkSaltsUnique(root, gameIds, report) {
  const appsDir = join(root, 'apps');
  if (!existsSync(appsDir)) return;
  const all = readdirSync(appsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => ({ id: entry.name, salt: dailySaltOf(root, entry.name) })).filter((app) => app.salt !== null);
  for (const app of all.filter((item) => gameIds.includes(item.id))) {
    const other = all.find((item) => item.id !== app.id && item.salt === app.salt);
    if (other !== undefined) report.problem({ file: `apps/${app.id}/src/levels/${app.id}-levels.ts`, line: 1, rule: 'daily-salt-shared', message: `the daily salt 0x${app.salt.toString(16)} is also apps/${other.id}'s`, fix: 'Give every game its own 16-bit salt before its first release (default: the value new-game-scaffold printed, FNV-1a of the game id folded to 16 bits); never change it afterwards.' });
  }
}

export function checkSpec(root, gameId, files, entries, config, report) {
  const folder = `apps/${gameId}/src/levels`;
  const specRel = `${folder}/${gameId}-levels.ts`;
  const spec = files.find((file) => file.rel === specRel);
  const planRel = `${folder}/${gameId}-level-plan.ts`;
  if (spec === undefined) report.problem({ file: specRel, rule: 'levels-file-missing', message: 'the LevelsSpec file is missing', fix: 'Copy templates/apps/__GAME_ID__/src/levels/__GAME_ID__-levels.ts and adapt it.' });
  if (!files.some((file) => file.rel === planRel)) report.problem({ file: planRel, rule: 'levels-file-missing', message: 'the level plan (generator recipe) is missing', fix: 'Copy templates/apps/__GAME_ID__/src/levels/__GAME_ID__-level-plan.ts and adapt create, curve and rate().' });
  if (entries.length === 0 && !files.some((file) => /^pack-\d+\.json$/.test(file.name))) report.problem({ file: `${folder}/pack-1.json`, rule: 'levels-file-missing', message: 'no generated pack tables', fix: 'Run the level generator: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/levels/generate-levels.ts --app <id>' });
  const tests = files.filter((file) => file.isTest);
  if (!tests.some((file) => /levelsContractProblems\s*\(/.test(code(file.text)))) report.problem({ file: folder, rule: 'levels-contract-test', message: 'no test runs levelsContractProblems on the shipped table', fix: 'Copy templates/apps/__GAME_ID__/src/levels/__GAME_ID__-levels.test.ts: every level solver-proven at its par, packs matching game.config.' });
  if (spec === undefined) return;
  const text = code(spec.text);
  const isDaily = /daily:\s*\{\s*kind:\s*'daily'/.test(text);
  const isEndless = /endless:\s*\{\s*kind:\s*'endless'/.test(text);
  const hasNullSolver = /solver:\s*null\b/.test(text);
  if (hasNullSolver && entries.some((entry) => entry.stars.kind === 'par')) report.problem({ file: specRel, line: 1, rule: 'solver-required', message: 'levels are rated against par but the LevelsSpec has solver: null', fix: 'Par comes from a solver (spec 8.1): add the game\'s solver and prove every level with it.' });
  if (isDaily && !/salt:/.test(text)) report.problem({ file: specRel, line: 1, rule: 'daily-mode', message: 'the daily mode has no salt', fix: 'daily: { kind: \'daily\', difficulty: <medium>, salt: <fixed per game, forever> }' });
  if (config !== null && config.daily !== null && config.daily !== isDaily) report.problem({ file: specRel, line: 1, rule: 'daily-mode', message: `game.config.ts modes.daily is ${config.daily} but the LevelsSpec daily is ${isDaily ? 'on' : 'off'}`, fix: 'A mode switched on in game.config.ts must be supported by levels.daily (and the reverse).' });
  if (config !== null && config.endless !== null && config.endless !== isEndless) report.problem({ file: specRel, line: 1, rule: 'endless-mode', message: `game.config.ts modes.endless is ${config.endless} but the LevelsSpec endless is ${isEndless ? 'on' : 'off'}`, fix: 'Make game.config.ts modes.endless and levels.endless agree.' });
  const goldens = tests.filter((file) => /\.golden\.test\.ts$/.test(file.name));
  if (goldens.length === 0) {
    report.problem({ file: folder, rule: 'level-golden', message: 'no data golden test for the level table', fix: 'Copy templates/apps/__GAME_ID__/src/levels/__GAME_ID__-levels.golden.test.ts, run it once with -u, read the snapshot, commit it with a Gate-Change: trailer.' });
    return;
  }
  for (const golden of goldens.filter((file) => !goldenSnapshotExists(root, file))) report.problem({ file: golden.rel, rule: 'golden-snapshot-missing', message: 'the golden test has no committed snapshot (jest --ci fails and nothing is pinned)', fix: 'Run npx jest <this file> --selectProjects golden -u once, open the .snap.ios and check it, commit it with a Gate-Change: trailer.' });
  if (isDaily) {
    const daily = goldens.find((file) => /dailySeed\s*\(/.test(code(file.text)));
    const dates = daily ? new Set(code(daily.text).match(/'\d{4}-\d{2}-\d{2}'/g) ?? []) : new Set();
    if (daily === undefined || dates.size < 3) report.problem({ file: daily?.rel ?? folder, rule: 'daily-golden', message: 'the daily challenge has no golden test over at least 3 fixed dates', fix: 'Pin the daily board for 3 dates (a year boundary included) with dailySeed(date, salt): the same level for every player is a hard contract.' });
  }
}
