// engine-run.mjs: runs one game's real rules modules (create, listMoves, applyMove, outcome and
// the persistence parsers) over seeded random games and reports contract breaks. Not an entry point.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { errorText } from './app-modules.mjs';
import { RULE_FILES } from './rules-checks.mjs';

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEEDS = [1, 2, 3];
/** The save schema allows difficulty 0..100, so create() must accept the whole range. */
const DIFFICULTIES = [0, 50, 100];
/** ENDLESS_DIFFICULTY: the endless run of a game that has one; it only ever ends lost. */
const ENDLESS = 100;

/** True when game.config.ts switches endless on or the LevelsSpec declares an endless mode. */
export function hasEndlessMode(root, gameId) {
  const read = (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : '');
  const config = read(`apps/${gameId}/game.config.ts`);
  const levels = read(`apps/${gameId}/src/levels/${gameId}-levels.ts`);
  return /\bendless:\s*true\b/.test(config) || /endless:\s*\{\s*kind:\s*'endless'/.test(levels);
}
const MAX_MOVES = 150;

/** xorshift32: the checker's own deterministic move picker (never Math.random). */
function picker(seed) {
  let x = (seed * 2654435761) >>> 0 || 1;
  return (count) => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x % count;
  };
}

function isPlain(value) {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** First value in `value` that JSON cannot carry unchanged, as a path message, or null. */
export function jsonProblem(value, path = 'state') {
  if (value === undefined) return `${path} is undefined`;
  if (typeof value === 'number' && !Number.isFinite(value)) return `${path} is ${value}`;
  if (['function', 'symbol', 'bigint'].includes(typeof value)) return `${path} is a ${typeof value}`;
  if (typeof value !== 'object' || value === null) return null;
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = jsonProblem(item, `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (!isPlain(value)) return `${path} is a ${value.constructor?.name ?? 'non-plain object'}`;
  for (const [key, item] of Object.entries(value)) {
    const found = jsonProblem(item, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

function outcomeProblem(result, moveCount, gameId) {
  if (result === null || typeof result !== 'object') return `outcome returned ${JSON.stringify(result)}`;
  if (result.kind === 'lost' && !String(result.reasonKey).startsWith(`${gameId}.`)) return `lost reasonKey "${result.reasonKey}" is not a ${gameId}.* catalog key`;
  if (result.kind === 'won' && !(Number.isInteger(result.score) && result.score >= 0)) return `won score ${result.score} is not a whole number >= 0`;
  if (!['playing', 'won', 'lost'].includes(result.kind)) return `outcome kind "${result.kind}" is not playing, won or lost`;
  if (moveCount > 0 !== (result.kind === 'playing')) return `listMoves has ${moveCount} moves while outcome is ${result.kind} (it must be empty exactly when the game is over)`;
  return null;
}

function stepProblem(engine, state, move) {
  const before = JSON.stringify(state);
  let result;
  try {
    result = engine.applyMove(state, move);
  } catch (error) {
    return { problem: `applyMove threw for a move listMoves offered (${JSON.stringify(move)}): ${errorText(error)}` };
  }
  if (JSON.stringify(state) !== before) return { problem: 'applyMove changed its input state (it must return a new state and leave the old one untouched)' };
  if (!result || !Array.isArray(result.events)) return { problem: 'applyMove did not return { state, events }' };
  const shape = jsonProblem(result.state);
  if (shape) return { problem: `state is not JSON-safe: ${shape}` };
  const moveShape = jsonProblem(move, 'move');
  if (moveShape) return { problem: `move is not JSON-safe: ${moveShape}` };
  const badEvent = result.events.find((event) => typeof event?.kind !== 'string' || !KEBAB.test(event.kind));
  if (badEvent !== undefined) return { problem: `event ${JSON.stringify(badEvent)} has no kebab-case kind` };
  return { next: result.state };
}

function roundTripProblem(persistence, state, move) {
  if (persistence === null) return null;
  const parsedState = persistence.parseState(JSON.parse(JSON.stringify(state)));
  if (JSON.stringify(parsedState) !== JSON.stringify(state)) return 'parseState does not return a saved state unchanged';
  if (move !== undefined) {
    const parsedMove = persistence.parseMove(JSON.parse(JSON.stringify(move)));
    if (JSON.stringify(parsedMove) !== JSON.stringify(move)) return `parseMove does not return ${JSON.stringify(move)} unchanged`;
  }
  return null;
}

/** A random mover for the seeded games: picks one of the legal moves. */
function randomChooser(start) {
  const pick = picker(start.seed * 101 + start.difficulty);
  return (_state, moves) => moves[pick(moves.length)];
}

/**
 * The game's own bot as a chooser. Random play rarely wins a puzzle, so the bot is what reaches
 * won states and proves their scores. `rng` starts from the kit's seedRng when it loads.
 */
function botChooser(bot, rng) {
  let current = rng;
  return (state, moves) => {
    const choice = bot(state, moves, current);
    current = choice.rng;
    return choice.move;
  };
}

function endlessProblem(start, result) {
  return start.isEndless && result?.kind === 'won' ? `the endless run (difficulty ${ENDLESS}) was won with score ${result.score}; an endless run only ever ends lost` : null;
}

/** Plays one seeded game; returns the first problem found (or null) and the move line. */
function playOne(engine, persistence, start, gameId, choose = randomChooser(start)) {
  let state = engine.create(start.seed, start.difficulty);
  const created = JSON.stringify(state);
  if (JSON.stringify(engine.create(start.seed, start.difficulty)) !== created) return { problem: 'create gives two different states for the same seed and difficulty', line: [] };
  const shape = jsonProblem(state);
  if (shape) return { problem: `state is not JSON-safe: ${shape}`, line: [] };
  const opening = engine.outcome(state);
  if (opening?.kind !== 'playing') return { problem: `create() starts a game whose outcome is ${opening?.kind}; every level, daily and endless run must start in play`, line: [], rule: 'engine-contract' };
  const line = [];
  while (line.length < MAX_MOVES) {
    const moves = engine.listMoves(state);
    const result = engine.outcome(state);
    const outcome = outcomeProblem(result, moves.length, gameId);
    if (outcome) return { problem: outcome, line, rule: 'engine-contract' };
    const endless = endlessProblem(start, result);
    if (endless) return { problem: endless, line, rule: 'endless-won' };
    if (moves.length === 0) break;
    const move = choose(state, moves);
    if (!moves.some((legal) => JSON.stringify(legal) === JSON.stringify(move))) return { problem: `the bot chose ${JSON.stringify(move)}, which is not one of the moves listMoves offered`, line, rule: 'testing-bot' };
    const step = stepProblem(engine, state, move);
    if (step.problem) return { problem: step.problem, line };
    const trip = roundTripProblem(persistence, step.next, move);
    if (trip) return { problem: trip, line, rule: 'persistence-roundtrip' };
    state = step.next;
    line.push(move);
  }
  const replay = () => JSON.stringify(line.reduce((current, move) => engine.applyMove(current, move).state, engine.create(start.seed, start.difficulty)));
  if (replay() !== replay()) return { problem: 'replaying the same moves from the same seed gives a different state', line };
  return { problem: null, line };
}

async function loadEngine(modules, gameId) {
  const folder = `apps/${gameId}/src/rules`;
  const engine = {};
  for (const [file, name] of Object.entries(RULE_FILES)) {
    const module = await modules.load(`${folder}/${file}`);
    if (typeof module[name] !== 'function') throw new Error(`${file} does not export a function ${name}`);
    engine[name] = module[name];
  }
  const persistenceRel = `${folder}/${gameId}-persistence.ts`;
  let persistence = null;
  if (modules.exists(persistenceRel)) {
    const module = await modules.load(persistenceRel);
    const spec = Object.values(module).find((value) => value && typeof value === 'object' && typeof value.parseState === 'function');
    if (spec) persistence = spec;
  }
  return { engine, persistence };
}

/** The game's TestingSpec (bot + examples) and the kit's seedRng, or null while they do not exist. */
async function loadTesting(modules, gameId) {
  const rel = `apps/${gameId}/src/testing/${gameId}-testing.ts`;
  if (!modules.exists(rel)) return null;
  const module = await modules.load(rel);
  const spec = Object.values(module).find((value) => value && typeof value === 'object' && typeof value.bot === 'function' && value.examples);
  if (!spec) throw new Error(`${rel} exports no TestingSpec ({ bot, examples })`);
  const rngRel = 'packages/game-kit/src/rng/sfc32.ts';
  const seedRng = modules.exists(rngRel) ? (await modules.load(rngRel)).seedRng : null;
  return { rel, spec, seedRng: typeof seedRng === 'function' ? seedRng : (seed) => [seed >>> 0, 1, 2, 3] };
}

const EXAMPLE_KINDS = { start: 'playing', middle: 'playing', win: 'won', lose: 'lost' };

/** Each example state is JSON-safe and its outcome matches its name (start, middle, win, lose). */
function exampleProblems(engine, spec, gameId) {
  const problems = [];
  for (const [id, kind] of Object.entries(EXAMPLE_KINDS)) {
    const make = spec.examples[id];
    if (typeof make !== 'function') {
      problems.push(`examples.${id} is missing`);
      continue;
    }
    const state = make();
    const shape = jsonProblem(state, `examples.${id}()`);
    const outcome = engine.outcome(state);
    const found = shape ?? outcomeProblem(outcome, engine.listMoves(state).length, gameId);
    if (found) problems.push(`examples.${id}: ${found}`);
    else if (outcome.kind !== kind) problems.push(`examples.${id}() is ${outcome.kind}, expected ${kind}`);
  }
  return problems;
}

function reportRun(report, where, result, start) {
  if (!result.problem) return;
  const rule = result.rule ?? 'engine-contract';
  const file = rule === 'persistence-roundtrip' ? where.persistence : rule === 'testing-bot' ? where.testing : where.folder;
  const fixes = {
    'persistence-roundtrip': 'parseState/parseMove must return exactly what was saved (build a fresh typed object from the JSON).',
    'testing-bot': 'The bot returns one of the moves it was given, with the rng it was given (advanced if it drew).',
    'endless-won': 'At ENDLESS_DIFFICULTY the tuning\'s endless row has goal 0 and outcome never returns won (check isEndlessDifficulty before the win).',
  };
  report.problem({ file, rule, message: `${start.by} seed ${start.seed} difficulty ${start.difficulty}: ${result.problem}`, fix: fixes[rule] ?? 'Fix the engine function named in the message; add the failing seed as an example test first.' });
}

/**
 * Runs the engine over SEEDS x DIFFICULTIES with random moves and, once testing/<id>-testing.ts
 * exists, with the game's own bot (which reaches wins) and its four example states. Reports at
 * most one problem per game played.
 */
export async function runEngineContract(modules, gameId, report, root = '.') {
  const folder = `apps/${gameId}/src/rules`;
  const where = { folder, persistence: `${folder}/${gameId}-persistence.ts`, testing: `apps/${gameId}/src/testing/${gameId}-testing.ts` };
  let loaded;
  let testing;
  try {
    loaded = await loadEngine(modules, gameId);
  } catch (error) {
    report.problem({ file: folder, rule: 'engine-load', message: `the rules modules cannot run headless: ${errorText(error)}`, fix: 'Rules import only @e07/game-kit and their own files, with .ts extensions; nothing from React Native, Skia, Expo or the Shell.' });
    return 1;
  }
  try {
    testing = await loadTesting(modules, gameId);
  } catch (error) {
    report.problem({ file: where.testing, rule: 'testing-examples', message: `cannot run headless: ${errorText(error)}`, fix: 'Export <CONST>_TESTING: TestingSpec with bot and examples; import only the game\'s rules and game-kit.' });
    testing = null;
  }
  let runs = 0;
  const isEndlessGame = hasEndlessMode(root, gameId);
  const choosers = [{ by: 'random play', make: () => undefined }];
  if (testing) choosers.push({ by: 'the game\'s bot', make: (start) => botChooser(testing.spec.bot, testing.seedRng(start.seed ^ 0x5bd1e995)) });
  for (const chooser of choosers) {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        runs += 1;
        const start = { seed, difficulty, by: chooser.by, isEndless: isEndlessGame && difficulty === ENDLESS };
        let result;
        try {
          result = playOne(loaded.engine, loaded.persistence, start, gameId, chooser.make(start));
        } catch (error) {
          result = { problem: `the engine threw: ${errorText(error)}` };
        }
        reportRun(report, where, result, start);
      }
    }
  }
  if (testing) {
    runs += 1;
    let problems;
    try {
      problems = exampleProblems(loaded.engine, testing.spec, gameId);
    } catch (error) {
      problems = [`an example state could not be built or rated: ${errorText(error)}`];
    }
    for (const message of problems) report.problem({ file: testing.rel, rule: 'testing-examples', message, fix: 'examples.start and .middle are playing, .win is won (whole score >= 0), .lose is lost with a <game-id>.* reason; build them from create() and applyMove.' });
  }
  return runs;
}
