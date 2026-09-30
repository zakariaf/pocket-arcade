// kit-checks.mjs: the game-kit side of check-rules-engine (contract files, RNG and its goldens,
// test helpers). Not an entry point.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { readText, walk } from '../check-lib.mjs';
import { errorText } from './app-modules.mjs';
import { code, exportNames, importsOf } from './ts-scan.mjs';

const KIT = 'packages/game-kit/src';

/** Every game-kit file the rules engine needs, with the exports that must be there. */
export const KIT_FILES = {
  'contract/game-engine.ts': ['GameEngine', 'Outcome', 'ApplyResult', 'PanMode'],
  'contract/game-module.ts': ['GameModule'],
  'contract/game-identity.ts': ['GameIdentity'],
  'contract/messages.ts': ['LanguageCode', 'MessageId', 'Message', 'Catalog', 'GameTexts'],
  'contract/game-rules.ts': ['GameRules', 'Hud', 'UndoPolicy', 'HintPolicy', 'ContinuePolicy'],
  'contract/levels.ts': ['LevelsSpec', 'LevelEntry', 'LevelPack', 'StarRule', 'Solver', 'SolveResult'],
  'contract/teaching.ts': ['TeachingSpec', 'TutorialStep', 'HowToPlayStep', 'TutorialPointer'],
  'contract/stats.ts': ['StatsSpec', 'CounterSpec'],
  'contract/testing.ts': ['TestingSpec', 'ExampleStateId'],
  'contract/persistence.ts': ['PersistenceSpec', 'SavePolicy', 'SavePoint'],
  'contract/realtime.ts': ['RealtimeSpec'],
  'contract/input-intent.ts': ['InputIntent'],
  'contract/difficulty.ts': ['ENDLESS_DIFFICULTY', 'MAX_LEVEL_DIFFICULTY', 'clampDifficulty', 'isEndlessDifficulty', 'rowFor'],
  'contract/difficulty.test.ts': [],
  'rng/sfc32.ts': ['RngState', 'RngDraw', 'mix32', 'hashU32', 'nextU32', 'seedRng', 'nextInt', 'nextUnit', 'hashSeed'],
  'rng/sfc32.test.ts': [],
  'testing/play-choices.ts': ['playChoices', 'PlayableRules'],
  'testing/play-bot.ts': ['playBot', 'randomPolicy', 'BotPolicy', 'BotGame'],
  'testing/json-shape.ts': ['jsonShapeProblems', 'jsonOf'],
  'testing/engine-contract.ts': ['engineContractProblems', 'EngineContractInput'],
  'testing/contract-intents.ts': ['contractIntentProblems', 'engineMemberProblems'],
  'geom/board-layout.ts': ['BoardTarget', 'BoardLayout'],
  'geom/classify-swipe.ts': ['SwipeDirection'],
  'timeline/track.ts': ['Track', 'Motion'],
};

/**
 * Members a current contract file declares; an older copy lacks them (a repo made before the
 * tap-then-tap selection, the witness solver's final state or the endless contract property).
 */
export const KIT_MEMBERS = {
  'contract/game-engine.ts': ['selectRegions'],
  'contract/input-intent.ts': ['selected'],
  'contract/levels.ts': ['final'],
  'testing/engine-contract.ts': ['endless', 'contractIntentProblems'],
};

/** The pinned sfc32 values: the daily-challenge and replay compatibility contract. */
export const GOLDEN_SEED_1 = [1828152527, 3394835397, 2967886022, 2251045104, 4148684523];
export const GOLDEN_DAILY_HASH = 2224665572;
export const GOLDEN_HASH_KEY = 'line-siege:2026-09-26';

const RULE_TEXT = {
  golden: 'Copy templates/packages/game-kit/src/rng/sfc32.ts back verbatim; the sequence is a compatibility contract and never changes.',
};

export function checkKitFiles(repo, report) {
  let checked = 0;
  for (const [rel, exports] of Object.entries(KIT_FILES)) {
    const path = `${KIT}/${rel}`;
    checked += 1;
    if (!repo.exists(path)) {
      report.problem({ file: path, rule: 'kit-file-missing', message: 'game-kit file the rules engine needs is missing', fix: `Copy templates/${path} from this skill (verbatim; contract files are canonical).` });
      continue;
    }
    const text = readText(join(repo.root, path)) ?? '';
    const names = exportNames(text);
    for (const name of exports.filter((item) => !names.has(item))) {
      report.problem({ file: path, line: 1, rule: 'kit-export-missing', message: `does not export ${name}`, fix: `Restore the file from templates/${path}; other code imports ${name} by this name.` });
    }
    for (const member of (KIT_MEMBERS[rel] ?? []).filter((item) => !new RegExp(`\\b${item}\\b`).test(code(text)))) {
      report.problem({ file: path, line: 1, rule: 'kit-member-missing', message: `is an older copy: it never names ${member}`, fix: `Copy templates/${path} again (verbatim): the contract gained ${member}.` });
    }
  }
  return checked;
}

/**
 * Packages the kit's and the rules' tests import that the bootstrap does not install, with the
 * pin of the versions table. They belong in the root devDependencies, pinned exactly.
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
  const path = join(repo.root, 'package.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readText(path) ?? '');
  } catch {
    return null;
  }
}

/**
 * The kit's tests (sfc32, difficulty, board-layout) and the rules templates import fast-check, which
 * the bootstrap leaves out: without it tsc and eslint fail with TS2307 on every copied test.
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

export function checkRngSource(repo, report) {
  const rngPath = `${KIT}/rng/sfc32.ts`;
  const testPath = `${KIT}/rng/sfc32.test.ts`;
  if (repo.exists(rngPath)) {
    const text = code(readText(join(repo.root, rngPath)) ?? '');
    if (!/^['"]worklet['"];/.test(text.trimStart())) {
      report.problem({ file: rngPath, line: 1, rule: 'rng-worklet', message: "sfc32.ts has no file-level 'worklet'; directive (real-time sims call it on the UI thread)", fix: "Put 'worklet'; as the first statement after the path comment." });
    }
  }
  if (repo.exists(testPath)) {
    const text = readText(join(repo.root, testPath)) ?? '';
    const digits = text.replace(/_/g, '');
    const missing = [...GOLDEN_SEED_1, GOLDEN_DAILY_HASH].filter((value) => !digits.includes(String(value)));
    if (missing.length > 0) {
      report.problem({ file: testPath, line: 1, rule: 'rng-golden-test', message: `the RNG test does not pin the golden values (missing ${missing.join(', ')})`, fix: 'Restore GOLDEN_SEED_1 and GOLDEN_DAILY_HASH from templates/packages/game-kit/src/rng/sfc32.test.ts; never edit them.' });
    }
  }
}

function drawMany(rng, state, count) {
  const values = [];
  let current = state;
  for (let i = 0; i < count; i += 1) {
    const draw = rng.nextU32(current);
    values.push(draw.value);
    current = draw.state;
  }
  return values;
}

/** Independent transcription of PractRand's C sfc32 (the oracle). */
function referenceSfc32(seed, count) {
  let [a, b, c, d] = seed;
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const tmp = (a + b + d) >>> 0;
    d = (d + 1) >>> 0;
    a = (b ^ (b >>> 9)) >>> 0;
    b = (c + (c << 3)) >>> 0;
    c = ((((c << 21) | (c >>> 11)) >>> 0) + tmp) >>> 0;
    out.push(tmp);
  }
  return out;
}

function rngProblems(rng) {
  const problems = [];
  const reference = referenceSfc32([1, 2, 3, 4], 50);
  if (JSON.stringify(drawMany(rng, [1, 2, 3, 4], 50)) !== JSON.stringify(reference)) problems.push('nextU32 does not match the PractRand sfc32 reference algorithm');
  const seeded = drawMany(rng, rng.seedRng(1), 5);
  if (JSON.stringify(seeded) !== JSON.stringify(GOLDEN_SEED_1)) problems.push(`seedRng(1) draws ${seeded.join(', ')}, the golden sequence is ${GOLDEN_SEED_1.join(', ')}`);
  const hash = rng.hashSeed(GOLDEN_HASH_KEY);
  if (hash !== GOLDEN_DAILY_HASH) problems.push(`hashSeed('${GOLDEN_HASH_KEY}') is ${hash}, the golden value is ${GOLDEN_DAILY_HASH}`);
  for (const max of [1, 2, 3, 7, 1000]) {
    let state = rng.seedRng(max);
    for (let i = 0; i < 200; i += 1) {
      const draw = rng.nextInt(state, max);
      if (!Number.isInteger(draw.value) || draw.value < 0 || draw.value >= max) {
        problems.push(`nextInt(state, ${max}) returned ${draw.value}`);
        return problems;
      }
      state = draw.state;
    }
  }
  const unit = rng.nextUnit(rng.seedRng(3)).value;
  if (!(unit >= 0 && unit < 1)) problems.push(`nextUnit returned ${unit}, outside [0, 1)`);
  return problems;
}

/** Runs the real sfc32.ts and compares it with the reference algorithm and the golden values. */
export async function checkRngGolden(repo, modules, report) {
  const rngPath = `${KIT}/rng/sfc32.ts`;
  if (!repo.exists(rngPath)) return 0;
  let rng;
  try {
    rng = await modules.load(rngPath);
  } catch (error) {
    report.problem({ file: rngPath, line: 1, rule: 'rng-load', message: `sfc32.ts cannot be loaded: ${errorText(error)}`, fix: 'Keep sfc32.ts free of imports and runtime-only syntax (copy the template).' });
    return 1;
  }
  for (const message of rngProblems(rng)) report.problem({ file: rngPath, line: 1, rule: 'rng-golden', message, fix: RULE_TEXT.golden });
  return 1;
}
