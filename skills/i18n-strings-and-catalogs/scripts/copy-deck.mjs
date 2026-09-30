#!/usr/bin/env node
// copy-deck.mjs: the bridge between the Toybox copy deck (assets/copy-deck.json, every Shell and
// game text in en/de/fa/ckb) and the app's catalogs.
//   keys   look up deck keys and texts (by screen, prefix, key or game)
//   apply  write deck texts into packages/shell/src/i18n/catalogs/ and apps/<game-id>/src/i18n/
//   check  prove the catalogs still say exactly what the deck (and so the design) says
// Run: node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs <keys|apply|check> [options]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, fail, parseArgs, run, toPosix } from './check-lib.mjs';
import { LANGUAGES, lineOfKey } from './lib/catalog-rules.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DECK = join(HERE, '..', 'assets', 'copy-deck.json');
/** The Shell texts the deck lacks, and the retired Shell keys (a table in this skill, never the deck). */
const EXTRAS_FILE = join(HERE, '..', 'assets', 'shell-extras.json');

const SPEC = {
  name: 'copy-deck',
  summary: 'Looks up, applies and checks the copy deck: the design\'s texts for every Shell screen (S1-S15) and every game, in en, de, fa and ckb, plus the Shell texts the deck lacks (assets/shell-extras.json).',
  usage: '<keys|apply|check> [repo-root] [--screen S4]... [--prefix home.]... [--key k]... [--all] [--extras] [--game <game-id>]',
  options: {
    screen: { type: 'string', multiple: true, value: 'id', help: 'Select the keys a screen uses (S1..S15, S11a..S11d, shared)' },
    prefix: { type: 'string', multiple: true, value: 'text', help: 'Select deck keys starting with this text' },
    key: { type: 'string', multiple: true, value: 'key', help: 'Select one deck key' },
    all: { type: 'boolean', help: 'Select every Shell key in the deck' },
    extras: { type: 'boolean', help: 'Also select the Shell texts the deck lacks (assets/shell-extras.json: score line, undo/hint labels, tap-then-tap announcements)' },
    game: { type: 'string', value: 'game-id', help: 'Also select one game\'s texts (line-siege, flock-tilt, scrap-shove)' },
    root: { type: 'string', value: 'dir', help: 'App repo root (apply, check); same as the positional repo-root (default .)' },
    overwrite: { type: 'boolean', help: 'apply: replace catalog texts that differ from the deck' },
    lang: { type: 'string', default: 'en', value: 'list', help: 'keys: languages to print, comma-separated, or "all"' },
    deck: { type: 'string', value: 'file', help: 'Use another copy-deck.json (default: this skill\'s assets/copy-deck.json)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 2 },
  details: [
    'Commands:',
    '  keys   print the selected keys and their texts (exit 0)',
    '  apply  add the selected texts to the catalogs, keys sorted; a catalog text that differs from',
    '         the deck is reported (exit 1) and kept unless --overwrite',
    '  check  every catalog key that is in the deck must equal the deck in all four languages',
    '         (deck-drift), and every selected key must exist (deck-key-missing). A Shell text the',
    '         deck lacks must equal assets/shell-extras.json (extra-drift; required with --extras:',
    '         extra-key-missing), and a retired Shell key such as result.win.moves-count fails (retired-key)',
    '',
    'Game texts map to game catalog keys like this (id = the game id, for example line-siege):',
    '  name -> id.name   tagline -> id.tagline   goal -> id.goal   progress -> id.progress',
    '  winTitle -> id.win-title   loseReason -> id.lose.<slug>   stats.fooBar -> id.stats.foo-bar',
    '  howToPlay[0] -> id.how-to-play.step-1   tutorial[0] -> id.tutorial.step-1   packs[0] -> id.pack-name.1',
    '  <slug> names what happened (every way of losing has its own id.lose.<slug> key):',
    '    line-siege -> broke-through   flock-tilt -> wolf-got-sheep   scrap-shove -> caught',
    '  A text the deck lacks (another lose reason, an endless HUD line, a continue) is written in all',
    '  four catalogs by hand, fa and ckb marked for native review; the deck itself is never edited.',
    '',
    'Examples:',
    '  node copy-deck.mjs keys --screen S4 --lang all',
    '  node copy-deck.mjs apply . --all --game line-siege',
    '  node copy-deck.mjs check . --screen S4 --game line-siege',
  ].join('\n'),
};

const kebab = (text) => text.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/**
 * The deck's one loseReason per game becomes '<id>.lose.<slug>', the slug naming what happened.
 * Every way of losing has its own key ('<id>.lose-reason' and '<id>.result.*' are retired).
 */
const LOSE_SLUGS = { 'line-siege': 'broke-through', 'flock-tilt': 'wolf-got-sheep', 'scrap-shove': 'caught' };

function loseKey(gameId) {
  const slug = LOSE_SLUGS[gameId];
  if (slug === undefined) fail(`no lose-reason slug for "${gameId}"`, `Add the game to LOSE_SLUGS in copy-deck.mjs (kebab words for what happened, for example 'out-of-moves') before applying its texts.`);
  return `lose.${slug}`;
}

/** Deck game entry -> [{ key, texts, source }] with the mapping printed in --help. */
function gameEntries(game, gameId) {
  const out = [];
  const add = (key, texts, source) => out.push({ key: `${gameId}.${key}`, texts, source });
  for (const [field, value] of Object.entries(game)) {
    if (field === 'id' || field === 'modes') continue;
    if (field === 'stats') {
      for (const [stat, texts] of Object.entries(value)) add(`stats.${kebab(stat)}`, texts, `games.<id>.stats.${stat}`);
    } else if (field === 'howToPlay' || field === 'tutorial') {
      value.forEach((texts, index) => add(`${kebab(field)}.step-${index + 1}`, texts, `games.<id>.${field}[${index}]`));
    } else if (field === 'packs') {
      value.forEach((texts, index) => add(`pack-name.${index + 1}`, texts, `games.<id>.packs[${index}]`));
    } else if (field === 'loseReason') {
      add(loseKey(gameId), value, 'games.<id>.loseReason');
    } else if (value && typeof value === 'object' && typeof value.en === 'string') {
      add(kebab(field), value, `games.<id>.${field}`);
    }
  }
  return out;
}

function expandRange(spec) {
  const match = /^(.*)\.(\d+)\.\.(\d+)$/.exec(spec);
  if (!match) return [spec];
  const keys = [];
  for (let n = Number(match[2]); n <= Number(match[3]); n += 1) keys.push(`${match[1]}.${n}`);
  return keys;
}

function loadDeck(path) {
  if (!existsSync(path)) fail(`copy deck not found: ${path}`, 'Run node skills/_library/sync-shared.mjs, or pass --deck <copy-deck.json>.');
  const deck = JSON.parse(readFileSync(path, 'utf8'));
  if (!deck.strings || !deck.meta?.screens || !deck.games) fail(`${path} is not a copy deck (needs meta.screens, games and strings)`, 'Pass the Pocket Arcade copy-deck.json.');
  return deck;
}

function loadExtras() {
  if (!existsSync(EXTRAS_FILE)) fail(`Shell extras table not found: ${EXTRAS_FILE}`, 'Restore assets/shell-extras.json in this skill.');
  const extras = JSON.parse(readFileSync(EXTRAS_FILE, 'utf8'));
  const entries = Object.entries(extras.strings ?? {}).map(([key, row]) => ({ key, texts: row, source: 'the Shell texts the deck lacks' }));
  return { entries, retired: new Map(Object.entries(extras.retired ?? {})) };
}

function findGame(deck, gameId) {
  const game = Object.values(deck.games).find((entry) => entry.id === gameId);
  if (!game) fail(`the copy deck has no game "${gameId}" (it has: ${Object.values(deck.games).map((g) => g.id).join(', ')})`, 'Pass one of those ids, or add the game to the deck first.');
  return game;
}

/** Selected entries: { shell: [{ key, texts, source }], game: [...], notes: [] }. */
function select(deck, options) {
  const shell = new Map();
  const notes = [];
  const addShell = (key, source) => {
    if (!Object.hasOwn(deck.strings, key)) fail(`deck key "${key}" (from ${source}) is not in the deck strings`, 'Check the spelling; run: node copy-deck.mjs keys --prefix <start of the key>.');
    shell.set(key, { key, texts: deck.strings[key], source });
  };
  let wantsGameTexts = false;
  for (const screenId of options.screen) {
    const screen = deck.meta.screens[screenId];
    if (!screen) fail(`unknown screen "${screenId}"`, `Use one of: ${Object.keys(deck.meta.screens).join(', ')}.`);
    for (const spec of screen.keys) {
      if (spec.startsWith('games.<id>.')) {
        wantsGameTexts = true;
        continue;
      }
      if (spec.startsWith('meta.') || spec === 'licenceEntries') {
        notes.push(`${screenId}: ${spec} is not a catalog text (autonyms and licence rows live in code)`);
        continue;
      }
      for (const key of expandRange(spec)) addShell(key, `screen ${screenId}`);
    }
  }
  for (const prefix of options.prefix) {
    const keys = Object.keys(deck.strings).filter((key) => key.startsWith(prefix));
    if (keys.length === 0) fail(`no deck key starts with "${prefix}"`, 'Run: node copy-deck.mjs keys --all to see every key.');
    for (const key of keys) addShell(key, `prefix ${prefix}`);
  }
  for (const key of options.key) addShell(key, 'key');
  if (options.all) for (const key of Object.keys(deck.strings)) addShell(key, 'all');
  let game = [];
  if (options.game) game = gameEntries(findGame(deck, options.game), options.game);
  else if (wantsGameTexts) notes.push('the screen also shows game texts: add --game <game-id> to include them');
  const extras = options.extras ? loadExtras().entries : [];
  return { shell: [...shell.values(), ...extras].sort((a, b) => (a.key < b.key ? -1 : 1)), game, notes };
}

function readCatalog(file) {
  if (!existsSync(file)) return { exists: false, data: {}, text: '' };
  const text = readFileSync(file, 'utf8');
  try {
    return { exists: true, data: JSON.parse(text), text };
  } catch (error) {
    fail(`${file} is not valid JSON: ${error.message}`, 'Fix the JSON first (run check-catalogs.mjs to see the problem).');
  }
  return { exists: false, data: {}, text: '' };
}

function writeCatalog(file, data) {
  const sorted = Object.fromEntries(Object.keys(data).sort().map((key) => [key, data[key]]));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
}

function shellDir(root) {
  return join(root, 'packages', 'shell', 'src', 'i18n', 'catalogs');
}

function gameDir(root, gameId) {
  return join(root, 'apps', gameId, 'src', 'i18n');
}

const codePoint = (char) => (char === undefined ? 'end of text' : `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);

/** Names the first differing character by code point: ZWNJ, dashes and apostrophes look alike. */
function firstDifference(actual, expected) {
  if (typeof actual !== 'string') return '';
  const a = [...actual];
  const b = [...expected];
  const at = a.findIndex((char, index) => char !== b[index]);
  const index = at === -1 ? a.length : at;
  return ` (first difference at character ${index + 1}: catalog ${codePoint(a[index])}, deck ${codePoint(b[index])})`;
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const command = positionals[0];
  if (!['keys', 'apply', 'check'].includes(command)) {
    fail(command === undefined ? 'no command given' : `unknown command "${command}"`, 'Run: node copy-deck.mjs keys|apply|check --help');
  }
  const deck = loadDeck(options.deck ? resolve(options.deck) : DEFAULT_DECK);
  const hasSelection = options.screen.length + options.prefix.length + options.key.length > 0 || options.all || options.extras || options.game;
  const report = createReporter({ name: `copy-deck ${command}`, json: options.json });
  const shown = (file) => toPosix(relative(process.cwd(), file)) || file;

  if (command === 'keys') {
    if (!hasSelection) fail('keys needs a selection', 'Pass --screen S4, --prefix home., --key <key>, --all, --extras or --game <game-id>.');
    const { shell, game, notes } = select(deck, options);
    const langs = options.lang === 'all' ? LANGUAGES : options.lang.split(',').map((l) => l.trim());
    for (const lang of langs) if (!LANGUAGES.includes(lang)) fail(`unknown language "${lang}"`, 'Use en, de, fa, ckb or all.');
    for (const screenId of options.screen) console.log(`# ${screenId}: ${deck.meta.screens[screenId].title}`);
    for (const entry of [...shell, ...game]) {
      console.log(entry.key);
      for (const lang of langs) console.log(`  ${lang.padEnd(3)} ${entry.texts[lang]}`);
    }
    for (const note of notes) console.log(`note: ${note}`);
    return report.finish({ checked: shell.length + game.length, unit: 'deck keys' });
  }

  const root = resolve(options.root ?? positionals[1] ?? '.');
  if (command === 'apply') {
    if (!hasSelection) fail('apply needs a selection', 'Pass --all, --extras, --screen S4, --prefix home., --key <key> and/or --game <game-id>.');
    const { shell, game, notes } = select(deck, options);
    const groups = [
      { dir: shellDir(root), entries: shell },
      ...(options.game ? [{ dir: gameDir(root, options.game), entries: game }] : []),
    ];
    let added = 0;
    let replaced = 0;
    for (const { dir, entries } of groups) {
      if (entries.length === 0) continue;
      for (const lang of LANGUAGES) {
        const file = join(dir, `${lang}.json`);
        const catalog = readCatalog(file);
        const data = { ...catalog.data };
        for (const { key, texts } of entries) {
          if (!Object.hasOwn(data, key)) {
            data[key] = texts[lang];
            added += 1;
          } else if (data[key] !== texts[lang]) {
            if (options.overwrite) {
              data[key] = texts[lang];
              replaced += 1;
            } else {
              report.problem({ file: shown(file), line: lineOfKey(catalog.text, key), rule: 'deck-conflict', message: `${key}: catalog says ${JSON.stringify(data[key])}, the deck says ${JSON.stringify(texts[lang])}${firstDifference(data[key], texts[lang])}`, fix: 'Keep the deck text (rerun with --overwrite) unless the owner approved the change; then update the deck first.' });
            }
          }
        }
        writeCatalog(file, data);
      }
    }
    for (const note of notes) console.log(`note: ${note}`);
    console.log(`copy-deck apply: ${added} texts added, ${replaced} replaced (4 languages each key)`);
    return report.finish({ checked: shell.length + game.length, unit: 'deck keys' });
  }

  // check
  const sDir = shellDir(root);
  const catalogsExist = LANGUAGES.some((lang) => existsSync(join(sDir, `${lang}.json`)));
  if (!catalogsExist && !options.game) fail(`nothing to check: no Shell catalogs in ${shown(sDir)}`, 'Run from the app repo root or pass it (node copy-deck.mjs check <repo-root> ...); create the catalogs with: node copy-deck.mjs apply <repo-root> --all');
  const { shell, game, notes } = hasSelection ? select(deck, options) : { shell: [], game: [], notes: [] };
  let compared = 0;
  const DECK_RULES = {
    missing: 'deck-key-missing',
    lacks: (key, source) => ({ message: `${key}: the design shows this text (${source}) but the catalog lacks it`, fix: `Run: node copy-deck.mjs apply --key ${key} (or the same --screen/--game selection).` }),
    drift: 'deck-drift',
    says: 'the deck (and the design) says',
    fix: 'Restore the deck text (copy-deck.mjs apply --overwrite ...). A reviewed wording change goes into the copy deck first, then into the catalogs.',
  };
  const EXTRA_RULES = {
    missing: 'extra-key-missing',
    lacks: (key) => ({ message: `${key}: a Shell text the deck lacks (assets/shell-extras.json) is not in the catalog`, fix: 'Run: node copy-deck.mjs apply . --extras (it writes all four Shell catalogs, keys sorted).' }),
    drift: 'extra-drift',
    says: 'the Shell texts the deck lacks (assets/shell-extras.json) say',
    fix: 'Restore the text with copy-deck.mjs apply . --extras --overwrite. A reviewed wording change goes into this skill\'s table first.',
  };
  const compare = (dir, deckTexts, required, rules = DECK_RULES) => {
    for (const lang of LANGUAGES) {
      const file = join(dir, `${lang}.json`);
      const catalog = readCatalog(file);
      for (const [key, texts] of deckTexts) {
        if (!Object.hasOwn(catalog.data, key)) {
          if (required.has(key)) report.problem({ file: shown(file), line: 1, rule: rules.missing, ...rules.lacks(key, required.get(key)) });
          continue;
        }
        compared += 1;
        if (catalog.data[key] !== texts[lang]) {
          report.problem({ file: shown(file), line: lineOfKey(catalog.text, key), rule: rules.drift, message: `${key}: catalog says ${JSON.stringify(catalog.data[key])}, ${rules.says} ${JSON.stringify(texts[lang])}${firstDifference(catalog.data[key], texts[lang])}`, fix: rules.fix });
        }
      }
    }
  };
  if (catalogsExist) {
    const en = readCatalog(join(sDir, 'en.json')).data;
    const selected = new Set(shell.map((e) => e.key));
    const deckTexts = new Map(Object.keys(deck.strings).filter((key) => Object.hasOwn(en, key) || selected.has(key)).map((key) => [key, deck.strings[key]]));
    compare(sDir, deckTexts, new Map(shell.filter((e) => Object.hasOwn(deck.strings, e.key)).map((e) => [e.key, e.source])));
    const { entries: extras, retired } = loadExtras();
    const extraTexts = new Map(extras.filter((e) => Object.hasOwn(en, e.key) || selected.has(e.key)).map((e) => [e.key, e.texts]));
    compare(sDir, extraTexts, new Map(extras.filter((e) => selected.has(e.key)).map((e) => [e.key, e.source])), EXTRA_RULES);
    for (const lang of LANGUAGES) {
      const file = join(sDir, `${lang}.json`);
      const catalog = readCatalog(file);
      for (const [key, why] of retired) {
        if (Object.hasOwn(catalog.data, key)) report.problem({ file: shown(file), line: lineOfKey(catalog.text, key), rule: 'retired-key', message: `${key} is a retired Shell key: ${why}`, fix: `Delete ${key} from all four Shell catalogs and the code that shows it; add the keys the change names (copy-deck.mjs apply . --extras).` });
      }
    }
  }
  if (options.game) {
    const dir = gameDir(root, options.game);
    compare(dir, new Map(game.map((e) => [e.key, e.texts])), new Map(game.map((e) => [e.key, e.source])));
  }
  for (const note of notes) console.log(`note: ${note}`);
  return report.finish({ checked: compared, unit: 'catalog texts' });
});
