// rules-checks.mjs: static checks of one game's rules folder (apps/<id>/src/rules). Not an entry point.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { readText, walk } from '../check-lib.mjs';
import { bare, code, exportNames, importsOf, matchesWithLines, typeBlock } from './ts-scan.mjs';

/** The four engine functions live one per file, under these names. */
export const RULE_FILES = {
  'create.ts': 'create',
  'list-moves.ts': 'listMoves',
  'apply-move.ts': 'applyMove',
  'outcome.ts': 'outcome',
};

const IMPURE = [
  { test: (s) => s === 'react' || s.startsWith('react/') || s.startsWith('react-'), what: 'React' },
  { test: (s) => s === 'react-native' || s.startsWith('react-native-') || s.startsWith('@react-native'), what: 'React Native' },
  { test: (s) => s === 'expo' || s.startsWith('expo-') || s.startsWith('@expo/'), what: 'Expo' },
  { test: (s) => s.startsWith('@shopify/'), what: 'Skia' },
  { test: (s) => s === 'zustand' || s.startsWith('zustand/'), what: 'zustand' },
  { test: (s) => s.startsWith('@e07/shell/') || s.startsWith('@e07/tooling/'), what: 'the Shell or tooling' },
  { test: (s) => s.startsWith('node:'), what: 'a Node built-in' },
];

/** Math members the determinism policy allows: exactly specified by IEEE 754 / ECMA-262. */
const ALLOWED_MATH = new Set(['sqrt', 'imul', 'floor', 'round', 'abs', 'min', 'max', 'PI']);

const PAST_TENSE_WORDS = new Set([
  'won', 'lost', 'hit', 'dealt', 'drawn', 'drew', 'shot', 'swept', 'spun', 'built', 'set', 'split',
  'fell', 'fallen', 'began', 'begun', 'ran', 'broke', 'broken', 'made', 'found', 'struck', 'held',
  'cut', 'put', 'shut', 'spent', 'sent', 'bent', 'left', 'met', 'lit', 'led', 'fed', 'fled', 'sped',
  'slid', 'bit', 'hid', 'shed', 'spread', 'burst', 'cast', 'dug', 'hung', 'stuck', 'swung', 'flung',
  'wound', 'bound', 'sold', 'told', 'done', 'gone', 'seen', 'taken', 'given', 'thrown', 'blown',
  'grown', 'shown', 'flown', 'chosen', 'frozen', 'woken', 'risen', 'ridden', 'written', 'eaten',
  'fought', 'caught', 'taught', 'brought', 'bought', 'kept', 'slept', 'felt', 'meant', 'burnt',
  'over', 'froze', 'rose', 'rode', 'wrote', 'ate', 'became', 'came', 'went', 'got', 'gave', 'took',
]);

/** Past tense (heuristic): some word ends in -ed or is an irregular past form. */
export function isPastTense(kind) {
  return kind.split('-').some((word) => word.endsWith('ed') || PAST_TENSE_WORDS.has(word));
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function pascal(id) {
  return id.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join('');
}

/** Files of a folder as { rel, abs, text, isTest }. */
export function sources(root, folder) {
  const abs = join(root, folder);
  return walk(abs, { include: ['*.ts', '*.tsx'] }).map((rel) => {
    const file = join(abs, rel);
    return { rel: `${folder}/${rel}`, abs: file, text: readText(file) ?? '', isTest: /\.test\.tsx?$/.test(rel) };
  });
}

/** `ownPackages`: the @e07 packages the folder may import (game-kit, plus the game itself). */
export function checkPurity(files, ownPackages, report) {
  for (const file of files) {
    for (const { specifier, line } of importsOf(file.text)) {
      const impure = IMPURE.find((entry) => entry.test(specifier));
      const otherApp = /^@e07\/([a-z0-9-]+)\//.exec(specifier);
      const isOtherApp = otherApp !== null && !['shell', 'tooling', ...ownPackages].includes(otherApp[1]);
      if (impure || isOtherApp) {
        report.problem({ file: file.rel, line, rule: 'pure-import', message: `imports ${specifier} (${impure ? impure.what : 'another app'}); rules must run headless in Node`, fix: 'Rules import only @e07/game-kit and their own files; move UI or platform code to board/ or the Shell.' });
      }
    }
  }
}

export function checkDeterminism(files, report) {
  for (const file of files) {
    const text = bare(file.text);
    const hits = [
      ...matchesWithLines(text, /\bMath\.random\b/g).map((hit) => ({ ...hit, what: 'Math.random' })),
      ...matchesWithLines(text, /\bDate\.now\b|\bnew\s+Date\b/g).map((hit) => ({ ...hit, what: 'the wall clock (Date)' })),
      ...matchesWithLines(text, /\bperformance\.now\b/g).map((hit) => ({ ...hit, what: 'performance.now' })),
    ];
    if (!file.isTest) {
      hits.push(...matchesWithLines(text, /\bMath\.([A-Za-z0-9_]+)/g).filter(({ match }) => !ALLOWED_MATH.has(match[1]) && match[1] !== 'random').map((hit) => ({ ...hit, what: `Math.${hit.match[1]}` })));
      hits.push(...matchesWithLines(text, /\*\*=?/g).map((hit) => ({ ...hit, what: 'the ** operator' })));
      hits.push(...matchesWithLines(text, /\bIntl\./g).map((hit) => ({ ...hit, what: 'Intl' })));
      hits.push(...matchesWithLines(text, /(?<![.\w])Date\b/g).filter(({ match, line }) => !/\bDate\.now\b|\bnew\s+Date\b/.test(text.split('\n')[line - 1] ?? '')).map((hit) => ({ ...hit, what: 'Date' })));
    }
    for (const { line, what } of hits) {
      report.problem({ file: file.rel, line, rule: 'determinism', message: `uses ${what}; results would differ between phones, Jest and replays`, fix: 'Use only + - * /, %, bitwise ops, Math.sqrt/imul/floor/round/abs/min/max/PI and the seeded sfc32 RNG; take time as ticks or ClockPort values.' });
    }
  }
}

export function checkRuleFiles(repo, gameId, report) {
  const folder = `apps/${gameId}/src/rules`;
  const typesRel = `${folder}/${gameId}-types.ts`;
  if (!repo.exists(typesRel)) report.problem({ file: typesRel, rule: 'rules-file-missing', message: 'the state, move and event types file is missing', fix: `Copy templates/apps/__GAME_ID__/src/rules/__GAME_ID__-types.ts and adapt it.` });
  for (const [file, name] of Object.entries(RULE_FILES)) {
    const rel = `${folder}/${file}`;
    if (!repo.exists(rel)) {
      report.problem({ file: rel, rule: 'rules-file-missing', message: `${name} has no file of its own`, fix: `Write ${name} test-first in ${rel} (one engine function per file; start from the template).` });
    } else if (!exportNames(readText(join(repo.root, rel)) ?? '').has(name)) {
      report.problem({ file: rel, line: 1, rule: 'rules-export-missing', message: `does not export ${name}`, fix: `Export the engine function by name: export function ${name}(...)` });
    }
  }
}

export function checkStateTypes(repo, gameId, files, report) {
  const typesRel = `apps/${gameId}/src/rules/${gameId}-types.ts`;
  const types = files.find((file) => file.rel === typesRel);
  if (types === undefined) return;
  const text = bare(types.text);
  for (const { match, line } of matchesWithLines(text, /\b(Map|Set|WeakMap|Date|bigint|symbol)\b|\bclass\s/g)) {
    report.problem({ file: typesRel, line, rule: 'state-not-json', message: `uses ${match[0].trim()}; states, moves and events are saved and compared as JSON`, fix: 'Use plain objects, arrays, numbers, strings, booleans and null only.' });
  }
  const drawsAfterCreate = files.filter((file) => !file.isTest && !file.rel.endsWith('/create.ts')).some((file) => importsOf(file.text).some(({ specifier, isType }) => !isType && specifier.endsWith('/rng/sfc32.ts')) && /\bnext(Int|U32|Unit)\s*\(/.test(bare(file.text)));
  if (drawsAfterCreate && !/\bRngState\b/.test(code(types.text))) {
    report.problem({ file: typesRel, line: 1, rule: 'rng-not-in-state', message: 'rules draw random numbers after create() but the state holds no RngState', fix: 'Keep `rng: RngState` in the state and thread it: const draw = nextInt(state.rng, n); ...{ rng: draw.state }.' });
  }
  const events = typeBlock(types.text, `${pascal(gameId)}Event`);
  if (events === null) {
    report.problem({ file: typesRel, line: 1, rule: 'event-kind', message: `no exported ${pascal(gameId)}Event type`, fix: `Declare export type ${pascal(gameId)}Event = { readonly kind: '<past-tense-kebab>'; ... } | ...` });
    return;
  }
  for (const { match } of matchesWithLines(events.text, /kind:\s*'([^']*)'/g)) {
    const kind = match[1];
    if (!KEBAB.test(kind) || !isPastTense(kind)) {
      report.problem({ file: typesRel, line: events.line, rule: 'event-kind', message: `event kind '${kind}' is not a past-tense kebab-case name`, fix: "Name what happened: 'column-cleared', 'monster-moved', 'cells-flipped'." });
    }
  }
}

export function checkPlaceholders(files, report) {
  for (const file of files) {
    for (const { match, line } of matchesWithLines(file.text, /__GAME_[A-Z]+__/g)) {
      report.problem({ file: file.rel, line, rule: 'placeholder-left', message: `template placeholder ${match[0]} was not replaced`, fix: 'Replace __GAME_ID__ (kebab-case), __GAME_PASCAL__, __GAME_CONST__ and __GAME_CAMEL__ with the game id forms.' });
    }
  }
}

export function checkMoveHandling(gameId, files, report) {
  const applyRel = `apps/${gameId}/src/rules/apply-move.ts`;
  const apply = files.find((file) => file.rel === applyRel);
  if (apply !== undefined && !/throw\s+new\s+RangeError\s*\(/.test(code(apply.text))) {
    report.problem({ file: applyRel, line: 1, rule: 'illegal-move-throws', message: 'applyMove never throws a RangeError for an illegal move', fix: 'Throw new RangeError(`illegal move ${JSON.stringify(move)}`) instead of returning a corrupted state.' });
  }
  for (const file of files.filter((item) => !item.isTest)) {
    for (const { match, line } of matchesWithLines(code(file.text), /reasonKey:\s*['"`]([^'"`]*)['"`]/g)) {
      if (!match[1].startsWith(`${gameId}.`)) {
        report.problem({ file: file.rel, line, rule: 'reason-key', message: `lose reason '${match[1]}' is not a ${gameId}.* catalog key`, fix: `Use a semantic key in the game's catalogs, e.g. '${gameId}.lose.out-of-moves'.` });
      }
    }
  }
}

export function checkRuleTests(gameId, files, report) {
  const folder = `apps/${gameId}/src/rules`;
  const tests = files.filter((file) => file.isTest);
  const all = tests.map((file) => code(file.text)).join('\n');
  if (!/\bfc\.assert\s*\(/.test(all)) report.problem({ file: folder, rule: 'property-tests', message: 'no fast-check property test in the rules folder', fix: 'Add fc.assert properties: same seed and moves give the same states (playChoices), invariants after any legal sequence, JSON round trip.' });
  if (!/JSON\.parse\s*\(\s*JSON\.stringify|engineContractProblems\s*\(/.test(all)) report.problem({ file: folder, rule: 'property-tests', message: 'no JSON round-trip test of a played state', fix: 'Assert JSON.parse(JSON.stringify(state)) deep-equals state after random play, or run engineContractProblems.' });
  if (!/\bGOLDEN_[A-Z0-9_]+\b/.test(all)) report.problem({ file: folder, rule: 'pinned-golden', message: 'no pinned golden value (a GOLDEN_* constant) in the rules tests', fix: 'Pin one exact example, e.g. the board create(1, 0) makes, as GOLDEN_SEED_1_BOARD next to the properties.' });
}

export function checkAssembly(repo, gameId, files, report) {
  const folder = `apps/${gameId}/src/rules`;
  const constant = gameId.toUpperCase().replaceAll('-', '_');
  const assembled = repo.exists(`apps/${gameId}/src/index.ts`);
  const engineRel = `${folder}/${gameId}-engine.ts`;
  const engine = files.find((file) => file.rel === engineRel);
  if (engine === undefined && assembled) report.problem({ file: engineRel, rule: 'engine-missing', message: 'the game is assembled (src/index.ts) but has no engine object file', fix: `Copy templates/apps/__GAME_ID__/src/rules/__GAME_ID__-engine.ts: ${constant}_ENGINE and ${constant}_RULES.` });
  if (engine !== undefined) {
    const text = code(engine.text);
    if (!/:\s*GameEngine</.test(text) || !/:\s*GameRules</.test(text)) report.problem({ file: engineRel, line: 1, rule: 'engine-typed', message: 'the engine and rules objects are not typed GameEngine<...> and GameRules<...>', fix: `export const ${constant}_ENGINE: GameEngine<State, Move, Event> = {...}; export const ${constant}_RULES: GameRules<...> = {...}` });
    for (const member of ['create', 'listMoves', 'applyMove', 'outcome', 'intentToMove', 'buildTimeline', 'hud', 'undo', 'hints', 'continueRun']) {
      if (!new RegExp(`\\b${member}\\b`).test(text)) report.problem({ file: engineRel, line: 1, rule: 'engine-typed', message: `the engine assembly never names ${member}`, fix: 'Assemble all six engine functions, panMode, selectRegions and the four rules members by their canonical names.' });
    }
    checkPanMode(engineRel, text, report);
    if (!/\bselectRegions\s*:/.test(text)) report.problem({ file: engineRel, line: 1, rule: 'select-regions', message: 'the engine assembly sets no selectRegions', fix: "Set selectRegions: [] when every tap acts, or the regions whose taps only select (Line Siege: ['tray']); the board host keeps the selection as UI state." });
    if (!files.some((file) => file.isTest && /engineContractProblems\s*\(/.test(file.text))) report.problem({ file: folder, rule: 'engine-contract-test', message: 'no test runs engineContractProblems on the assembled engine', fix: `Copy templates/apps/__GAME_ID__/src/rules/__GAME_ID__-engine.test.ts.` });
  }
  const persistenceRel = `${folder}/${gameId}-persistence.ts`;
  const persistence = files.find((file) => file.rel === persistenceRel);
  if (persistence === undefined && assembled) report.problem({ file: persistenceRel, rule: 'persistence-missing', message: 'the game is assembled but has no persistence file', fix: 'Copy templates/apps/__GAME_ID__/src/rules/__GAME_ID__-persistence.ts (parseState, parseMove, migrateState, savePolicy).' });
  if (persistence !== undefined) {
    const text = code(persistence.text);
    for (const member of ['stateVersion', 'parseState', 'parseMove', 'migrateState', 'savePolicy']) {
      if (!new RegExp(`\\b${member}\\b`).test(text)) report.problem({ file: persistenceRel, line: 1, rule: 'persistence-members', message: `PersistenceSpec member ${member} is missing`, fix: 'Declare every PersistenceSpec member; a run the game cannot parse is dropped alone.' });
    }
  }
  const statsRel = `${folder}/${gameId}-stats.ts`;
  const stats = files.find((file) => file.rel === statsRel);
  if (stats === undefined && assembled) report.problem({ file: statsRel, rule: 'stats-missing', message: 'the game is assembled but declares no statistics counters', fix: 'Copy templates/apps/__GAME_ID__/src/rules/__GAME_ID__-stats.ts and declare 2 to 4 counters.' });
  if (stats !== undefined) checkCounters(stats, statsRel, gameId, report);
}

const PAN_MODES = ['none', 'swipe', 'drag', 'aim'];

/** The engine assembly states the board's pan gesture as a literal the Shell's board host reads. */
function checkPanMode(engineRel, text, report) {
  const match = /\bpanMode\s*:\s*(['"])([^'"]*)\1/.exec(text);
  const line = match ? text.slice(0, match.index).split('\n').length : 1;
  const fix = "Set panMode: 'none' (taps only), 'swipe', 'drag' or 'aim' in the engine assembly, the mode whose intents intentToMove turns into moves (board-gestures-and-input has the table per game).";
  if (match === null) report.problem({ file: engineRel, line, rule: 'pan-mode', message: 'the engine assembly sets no panMode literal', fix });
  else if (!PAN_MODES.includes(match[2])) report.problem({ file: engineRel, line, rule: 'pan-mode', message: `panMode '${match[2]}' is not one of ${PAN_MODES.join(', ')}`, fix });
}

function checkCounters(stats, statsRel, gameId, report) {
  const text = code(stats.text);
  const ids = [...text.matchAll(/\bid:\s*'([^']*)'/g)].map((match) => match[1]);
  if (ids.length < 2 || ids.length > 4) report.problem({ file: statsRel, line: 1, rule: 'stats-counters', message: `${ids.length} counters declared; the S10 card shows 2 to 4`, fix: 'Declare 2 to 4 CounterSpec entries.' });
  for (const id of ids.filter((item) => !KEBAB.test(item))) report.problem({ file: statsRel, line: 1, rule: 'stats-counters', message: `counter id '${id}' is not kebab-case`, fix: 'Counter ids are kebab-case keys of the save document; choose them once and never rename.' });
  for (const match of text.matchAll(/labelId:\s*'([^']*)'/g)) {
    if (!match[1].startsWith(`${gameId}.`)) report.problem({ file: statsRel, line: 1, rule: 'stats-counters', message: `counter label '${match[1]}' is not a ${gameId}.* catalog key`, fix: `Use '${gameId}.stats.<counter-id>' and add it to all four catalogs.` });
  }
}

const CATALOG_LANGUAGES = ['en', 'de', 'fa', 'ckb'];

/** String literals in the rules code that are this game's catalog keys ('<id>.<segment>...'). */
function catalogKeysUsed(gameId, files) {
  const pattern = new RegExp(`['"\`](${gameId.replaceAll('-', '\\-')}(?:\\.[a-z0-9]+(?:-[a-z0-9]+)*)+)['"\`]`, 'g');
  const used = new Map();
  for (const file of files.filter((item) => !item.isTest)) {
    for (const { match, line } of matchesWithLines(code(file.text), pattern)) {
      if (!used.has(match[1])) used.set(match[1], { file: file.rel, line });
    }
  }
  return used;
}

function readCatalog(root, rel) {
  if (!existsSync(join(root, rel))) return null;
  try {
    return JSON.parse(readText(join(root, rel)) ?? 'null');
  } catch {
    return null;
  }
}

/**
 * Every catalog key the rules name (lose reasons, the HUD goal, the continue text, counter labels)
 * exists in all four game catalogs apps/<id>/src/i18n/{en,de,fa,ckb}.json.
 */
export function checkCatalogKeys(repo, gameId, files, report) {
  const used = catalogKeysUsed(gameId, files);
  if (used.size === 0) return;
  for (const lang of CATALOG_LANGUAGES) {
    const rel = `apps/${gameId}/src/i18n/${lang}.json`;
    const catalog = readCatalog(repo.root, rel);
    if (catalog === null || typeof catalog !== 'object') {
      report.problem({ file: rel, rule: 'catalog-key-missing', message: `the ${lang} catalog is missing or not JSON, and the rules use ${used.size} catalog keys`, fix: 'Create the four catalogs (new-game-scaffold writes them), then add every key the rules use in en, de, fa and ckb.' });
      continue;
    }
    for (const [key, where] of used) {
      if (!Object.hasOwn(catalog, key)) report.problem({ file: where.file, line: where.line, rule: 'catalog-key-missing', message: `'${key}' is not in ${rel}`, fix: `Add '${key}' to all four catalogs (the template keys and their texts are in this skill's assets/template-catalog-keys.json; fa and ckb go on the native review list).` });
    }
  }
}
