// balance.mjs: the fingerprint and the balance-contract rules, in plain JavaScript (not an entry point).
// A port of templates/packages/tooling/src/sims/write-sim-report.ts (rulesFingerprint) and of
// templates/packages/game-kit/src/testing/{parse-balance-bands,balance-bands}.ts, so the checker
// judges a report independently of the TypeScript that wrote it.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, sep } from 'node:path';

export const METRICS = ['winRate', 'medianMoves', 'p10Moves', 'p90Moves', 'medianScore', 'payoffPerRun', 'twistPerRun'];
export const MIN_SEEDS = 100;
/** The one difficulty scale (game-kit contract/difficulty.ts): levels 0..99, the endless run 100. */
export const MAX_LEVEL_DIFFICULTY = 99;
export const ENDLESS_DIFFICULTY = 100;
/** The app folders the fingerprint covers; game code there may import only from them and game-kit. */
export const GAME_LOGIC_FOLDERS = ['rules', 'levels', 'sim', 'testing'];

const KIT_SOURCE = 'packages/game-kit/src';
const KIT_ALIAS = '@e07/game-kit/';
/** Every quoted specifier after `from` or `import` (static, side-effect and dynamic imports). */
const SPECIFIER = /\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

/** The game's logic folders and the sim folder; game-kit counts only as far as they import it. */
export function fingerprintFolders(gameId) {
  return [...GAME_LOGIC_FOLDERS.map((folder) => `apps/${gameId}/src/${folder}`), `test/sims/${gameId}`];
}

function isFingerprinted(path) {
  if (path.endsWith('.sim.test.ts')) return true;
  if (/\.test\.tsx?$/.test(path) || path.includes('.snap')) return false;
  return /\.(ts|tsx|json)$/.test(path) && !path.endsWith('balance-bands.json');
}

const isFile = (root, path) => existsSync(join(root, path)) && statSync(join(root, path)).isFile();

function filesUnder(root, folder) {
  const base = join(root, folder);
  if (!existsSync(base)) return [];
  return readdirSync(base, { recursive: true, encoding: 'utf8' })
    .map((path) => `${folder}/${path.split(sep).join('/')}`)
    .filter((path) => isFingerprinted(path) && isFile(root, path));
}

/** The game-kit file a specifier in `from` names, or null (another package or a game folder). */
function kitTarget(from, specifier) {
  if (specifier.startsWith(KIT_ALIAS)) return `${KIT_SOURCE}/${specifier.slice(KIT_ALIAS.length)}`;
  if (!specifier.startsWith('.')) return null;
  const target = posix.normalize(posix.join(posix.dirname(from), specifier));
  return target.startsWith(`${KIT_SOURCE}/`) ? target : null;
}

/** The game-kit files `starts` import, followed through game-kit's own imports (the sim's import closure). */
function kitClosure(root, starts) {
  const seen = new Set();
  const queue = [...starts];
  for (const from of queue) {
    for (const match of readFileSync(join(root, from), 'utf8').matchAll(SPECIFIER)) {
      const target = kitTarget(from, match[1] ?? '');
      if (target === null || seen.has(target) || !isFingerprinted(target) || !isFile(root, target)) continue;
      seen.add(target);
      queue.push(target);
    }
  }
  return [...seen];
}

/** Every file the fingerprint hashes, sorted by repo-relative path (write-sim-report.ts fingerprintFiles). */
export function fingerprintFiles(root, gameId) {
  const own = fingerprintFolders(gameId).flatMap((folder) => filesUnder(root, folder));
  return [...own, ...kitClosure(root, own)].sort();
}

/** sha256 over "<repo-relative path>\n<bytes>\n" of every fingerprinted file, sorted by path. */
export function rulesFingerprint(root, gameId) {
  const hash = createHash('sha256');
  for (const path of fingerprintFiles(root, gameId)) {
    hash.update(`${path}\n`);
    hash.update(readFileSync(join(root, path)));
    hash.update('\n');
  }
  return hash.digest('hex');
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isMetric = (value) => METRICS.includes(value);
const isLevelDifficulty = (value) => isNumber(value) && Number.isInteger(value) && value >= 0 && value <= MAX_LEVEL_DIFFICULTY;

function fields(object, spec, at) {
  return Object.entries(spec).filter(([key, isValid]) => !isValid(object[key])).map(([key]) => `${at}.${key} is missing or invalid`);
}

const RULES = {
  curve: { policy: isText, metric: isMetric, direction: (v) => v === 'up' || v === 'down', minStep: isNumber },
  skillGap: { difficulty: isNumber, metric: isMetric, order: (v) => Array.isArray(v) && v.length >= 2 && v.every(isText), better: (v) => v === 'higher' || v === 'lower', minStep: isNumber },
  firstPayoff: { policy: isText, difficulty: isNumber, withinMoves: (v) => isNumber(v) && v >= 1 && v <= 10, minShare: (v) => isNumber(v) && v > 0 && v <= 1 },
  twist: { policy: isText, difficulty: isNumber, minPerRun: isNumber },
};

/** Problems of a parsed balance-bands.json (the same checks as parseBands, plus cross-references). */
export function bandsProblems(bands) {
  if (!isObject(bands)) return ['the bands file is not a JSON object'];
  const problems = fields(bands, {
    gameId: isText,
    status: (v) => v === 'proposed' || v === 'approved',
    seedsPerCell: (v) => isNumber(v) && v >= MIN_SEEDS,
    maxMoves: (v) => isNumber(v) && v > 0,
    notes: isText,
  }, 'bands file');
  const grid = isObject(bands.grid) ? bands.grid : {};
  if (!isObject(bands.grid) || Object.keys(grid).length === 0) problems.push('grid is missing or empty');
  for (const [policy, levels] of Object.entries(grid)) {
    if (!(Array.isArray(levels) && levels.length > 0 && levels.every(isNumber))) problems.push(`grid.${policy} must list difficulties`);
    else if (!levels.every(isLevelDifficulty)) problems.push(`grid.${policy} must list level difficulties 0..${MAX_LEVEL_DIFFICULTY} (the endless run has its own block)`);
  }
  const list = Array.isArray(bands.bands) ? bands.bands : [];
  if (list.length === 0) problems.push('bands must list at least one band');
  list.forEach((band, index) => {
    const at = `bands[${index}]`;
    if (!isObject(band)) return problems.push(`${at} is not an object`);
    problems.push(...fields(band, { policy: isText, difficulty: isNumber, metric: isMetric, min: isNumber, max: isNumber, why: isText }, at));
    if (isNumber(band.min) && isNumber(band.max) && band.min > band.max) problems.push(`${at}.min is above max`);
    if (isText(band.policy) && !(grid[band.policy] ?? []).includes(band.difficulty)) problems.push(`${at} names ${band.policy} d${band.difficulty}, which the grid does not run`);
  });
  for (const [name, spec] of Object.entries(RULES)) {
    const rule = bands[name];
    if (name === 'twist' && rule === null) continue;
    if (!isObject(rule)) {
      problems.push(`${name} is missing`);
      continue;
    }
    problems.push(...fields(rule, spec, name));
    const policies = name === 'skillGap' ? (Array.isArray(rule.order) ? rule.order : []) : [rule.policy];
    for (const policy of policies) if (isText(policy) && grid[policy] === undefined) problems.push(`${name} names policy ${policy}, which the grid does not run`);
  }
  problems.push(...endlessProblems(bands.endless, grid));
  if (bands.status === 'approved' && !/^\d{4}-\d{2}-\d{2}$/.test(bands.approvedOn ?? '')) problems.push('approved bands need approvedOn as YYYY-MM-DD');
  return problems;
}

const ENDLESS_BAND = { metric: (v) => isMetric(v) && v !== 'winRate', min: isNumber, max: isNumber, why: isText };

/** The optional endless block: one policy at difficulty 100 with its own bands, never part of the curve. */
function endlessProblems(endless, grid) {
  if (endless === undefined || endless === null) return [];
  if (!isObject(endless)) return ['endless must be an object or null'];
  const problems = fields(endless, { policy: isText }, 'endless');
  if (endless.difficulty !== ENDLESS_DIFFICULTY) problems.push(`endless.difficulty must be ${ENDLESS_DIFFICULTY} (ENDLESS_DIFFICULTY)`);
  if (isText(endless.policy) && grid[endless.policy] === undefined) problems.push(`endless names policy ${endless.policy}, which the grid does not run`);
  const list = Array.isArray(endless.bands) ? endless.bands : [];
  if (list.length === 0) problems.push('endless.bands must list at least one band');
  list.forEach((band, index) => {
    const at = `endless.bands[${index}]`;
    if (!isObject(band)) return problems.push(`${at} is not an object`);
    problems.push(...fields(band, ENDLESS_BAND, at));
    if (isNumber(band.min) && isNumber(band.max) && band.min > band.max) problems.push(`${at}.min is above max`);
  });
  return problems;
}

const CELL_FIELDS = ['runs', 'wins', 'capHits', ...METRICS];

/** Problems of a parsed reports/sim/<id>.json (shape only). */
export function reportShapeProblems(report) {
  if (!isObject(report)) return ['the report is not a JSON object'];
  const problems = fields(report, { gameId: isText, rulesFingerprint: isText, seedsPerCell: isNumber, maxMoves: isNumber, cells: Array.isArray }, 'report');
  (Array.isArray(report.cells) ? report.cells : []).forEach((cell, index) => {
    if (!isObject(cell)) return problems.push(`cells[${index}] is not an object`);
    for (const key of CELL_FIELDS) if (!isNumber(cell[key])) problems.push(`cells[${index}].${key} is missing or invalid`);
    if (!isText(cell.policy) || !isNumber(cell.difficulty)) problems.push(`cells[${index}] has no policy/difficulty`);
    if (!(Array.isArray(cell.firstPayoffShare) && cell.firstPayoffShare.length === 10)) problems.push(`cells[${index}].firstPayoffShare must list 10 shares`);
  });
  return problems;
}

export function cellOf(report, policy, difficulty) {
  return report.cells.find((cell) => cell.policy === policy && cell.difficulty === difficulty);
}
