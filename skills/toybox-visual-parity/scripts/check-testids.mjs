#!/usr/bin/env node
// check-testids.mjs: proves the screen testID contract (screen-testids.json) against the Toybox
// design HTML. Every frame selector and every element selector must match exactly ONE element
// in its frame, each text key must be the text that element shows, and parts must sit inside the
// accessible element named as their parent. 0 or more than 1 match is a failure. It also proves the
// reach policy: an element Maestro cannot list (inside an accessible parent, or a decorative part
// its component hides from VoiceOver: a11yHidden) is checked only by the aligned crop of the
// reachable ancestor named in coveredBy.
//
// Static checks (shape, names, copy-deck keys) need only Node. The DOM checks render the design in
// Chrome through Playwright (loaded at run time; see --help for where it is looked up).

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createReporter, fail, parseArgs, requireFile, run } from './check-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const NAME = 'check-testids';

const SPEC = {
  name: NAME,
  summary:
    'Checks the screen testID map against the design HTML: exactly one match per frame and per element, ' +
    'text keys that match the element text, correct parent links, the reach policy (bounds only for elements ' +
    'Maestro lists; crop-only parts named with a11yHidden or parent, each coveredBy its nearest compared ancestor), ' +
    'valid names and copy-deck keys.',
  usage: '[--map <file>] [--design <file>] [options]',
  options: {
    map: { type: 'string', value: 'file', help: 'The testID map (default: the skill\'s assets/screen-testids.json, or screen-testids.json beside the scripts folder)' },
    design: { type: 'string', value: 'file', help: 'The design HTML (default: the skill\'s assets/design/toybox.html or assets/toybox.html, or toybox.html beside the scripts folder)' },
    games: { type: 'string', value: 'ids', help: 'Comma-separated game ids to render (default: every game in the design deck)' },
    langs: { type: 'string', value: 'codes', help: 'Comma-separated languages to render (default: the map defaultRender.lang)' },
    themes: { type: 'string', value: 'names', help: 'Comma-separated themes to render: light, dark (default: the map defaultRender.theme)' },
    matrix: { type: 'boolean', help: 'Render every game x every language x light and dark (slower)' },
    static: { type: 'boolean', help: 'Only the static checks (no browser)' },
    playwright: { type: 'string', value: 'dir', help: 'A folder whose node_modules holds playwright (or set PLAYWRIGHT_DIR)' },
    list: { type: 'string', value: 'screen', help: 'Print one screen\'s contract (e.g. S4) as a table after the static checks; no DOM checks' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Playwright is looked up in: --playwright <dir>, $PLAYWRIGHT_DIR, this script\'s own node_modules chain,',
    'then the working directory. The owning skill pins it (playwright 1.63.0) in scripts/package.json and',
    'installs it with: npm ci --prefix <skill>/scripts. The browser is the installed Google Chrome',
    '(channel "chrome"), falling back to Playwright\'s bundled Chromium.',
    '',
    'The design is rendered with localStorage pa-toybox.lang / .theme / .game set before load.',
    'Parent links are verified in the default render (map defaultRender); counts and texts in every render.',
    '',
    'Reach policy (what Maestro\'s hierarchy can list, so what can be bounds-checked):',
    '  reachable   the frame root, containers, texts and accessible elements: any checks',
    '  crop-only   parts inside an accessible element ("parent") and decorative parts their component',
    '              hides from VoiceOver ("a11yHidden": true, for example IconTile, LogoTile, ArtTile):',
    '              "checks" is ["crop"] (or []) and "coveredBy" names the nearest reachable ancestor whose',
    '              crop is compared ("crop" or "fill" in its checks, or the frame root)',
    '',
    'Examples:',
    '  node check-testids.mjs --map assets/screen-testids.json --design assets/design/toybox.html',
    '  node check-testids.mjs --design assets/design/toybox.html --matrix',
    '  node check-testids.mjs --static',
    '  node check-testids.mjs --list S11     (the testIDs a builder must give Settings)',
  ].join('\n'),
};

const TESTID = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/;
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COPY_KEY = /^[a-z0-9<>]+([.-][a-zA-Z0-9<>]+)*$/;
const SCREEN_ID = /^S\d{1,2}[a-d]?$/;
const ROLES = ['none', 'button', 'header', 'text', 'image', 'switch', 'radio', 'radiogroup', 'adjustable', 'progressbar', 'alert'];
const ACCESSIBLE = ['button', 'switch', 'radio', 'adjustable', 'image', 'alert'];
const CHECKS = ['bounds', 'text', 'fill', 'crop'];
const PRESENTATIONS = ['route', 'overlay', 'dialog', 'startup', 'consent'];
const KINDS = ['phone', 'phone-tall', 'state-card', 'mock-only'];
const ELEMENT_KEYS = ['testID', 'role', 'component', 'kind', 'text', 'a11yLabel', 'designSelector', 'checks', 'variants', 'requires', 'when', 'parent', 'a11yHidden', 'coveredBy', 'state', 'mask', 'note'];
// Game facts an element can depend on ("when"), and the facts the mockup itself draws: Music rows
// and keys, and a moves-rated win line. An element whose "when" the mockup does not draw exists only
// in a reference variant that toybox-visual-parity derives from the rendered mockup (its text is a
// Shell text of that variant), so the default render skips it.
const FACT_VALUES = { hasMusic: [true, false], winLine: ['moves', 'score'] };
const DESIGN_FACTS = { hasMusic: true, winLine: 'moves' };
const isDesignDrawn = (el) => Object.entries(el.when ?? {}).every(([key, value]) => DESIGN_FACTS[key] === value);
// Components that hide themselves from VoiceOver when they carry no accessible role and label
// (decorative art, marks and graphics): Maestro cannot list them, so they are crop-only.
const DECORATIVE = ['IconTile', 'ArtTile', 'CalendarTile', 'LogoTile', 'PagerDots', 'PremiumArt', 'RadioMark', 'Toggle', 'Confetti', 'HazardStrip', 'Picture', 'RatingStars', 'BusyBlocks'];
const isCropOnly = (el) => el.parent !== undefined || el.a11yHidden === true;
/** An element whose aligned crop the parity gates compare: reachable, and crop or fill checked (or the root). */
const isCoverCandidate = (el) => !isCropOnly(el) && (el.designSelector === ':scope' || (el.checks ?? []).includes('crop') || (el.checks ?? []).includes('fill'));
const STORAGE_PREFIX = 'pa-toybox.';

function firstExisting(paths) {
  return paths.find((path) => existsSync(path)) ?? null;
}

/** The JSON copy deck embedded in the design as <script type="application/json" id="pa-deck">. */
function readDeck(html, designPath) {
  const match = /<script[^>]*\bid=["']pa-deck["'][^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match) fail(`the design ${designPath} has no <script id="pa-deck"> copy deck`, 'Pass the Toybox design HTML (it embeds the copy deck).');
  try {
    const deck = JSON.parse(match[1]);
    if (!deck.strings || !deck.games) throw new Error('missing "strings" or "games"');
    return deck;
  } catch (error) {
    return fail(`the copy deck in ${designPath} is not valid: ${error.message}`, 'Restore the design HTML from its source.');
  }
}

const pick = (value, lang) => (value !== null && typeof value === 'object' && !Array.isArray(value) ? (value[lang] ?? value.en) : value);

/**
 * Resolve a copy key to its message in one language and game.
 * Returns { message } or { error }. Forms: a deck string key; games.<id>.<field>[.<index>|.<statKey>];
 * meta.languageNames.<lang>.
 */
function resolveKey(deck, key, lang, game) {
  if (deck.strings[key]) return { message: pick(deck.strings[key], lang) };
  if (key.startsWith('meta.languageNames.')) {
    const code = key.slice('meta.languageNames.'.length);
    const name = deck.meta?.languageNames?.[code];
    return name ? { message: name } : { error: `no autonym for "${code}" in meta.languageNames` };
  }
  if (key.startsWith('games.<id>.')) {
    const [field, sub] = key.slice('games.<id>.'.length).split('.');
    const entry = deck.games[game];
    if (!entry) return { error: `no game "${game}" in the deck` };
    let value = entry[field];
    if (value === undefined) return { error: `games.${game} has no field "${field}"` };
    if (sub !== undefined) {
      value = Array.isArray(value) ? value[Number(sub)] : value[sub];
      if (value === undefined) return { error: `games.${game}.${field} has no entry "${sub}"` };
    }
    const message = pick(value, lang);
    return typeof message === 'string' ? { message } : { error: `games.${game}.${field}${sub ? `.${sub}` : ''} is not a text` };
  }
  return { error: 'not in the copy deck' };
}

/** ICU message -> regex source that finds the rendered text inside an element's text. */
function messagePattern(message) {
  const literal = (text) =>
    text
      .split(/\s+/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s*');
  let out = '';
  let buffer = '';
  let i = 0;
  const flush = () => {
    if (buffer) out += literal(buffer);
    buffer = '';
  };
  while (i < message.length) {
    if (message[i] === '{') {
      flush();
      let depth = 0;
      do {
        if (message[i] === '{') depth += 1;
        else if (message[i] === '}') depth -= 1;
        i += 1;
      } while (i < message.length && depth > 0);
      out += '[\\s\\S]*?';
      continue;
    }
    buffer += message[i];
    i += 1;
  }
  flush();
  return out;
}

function lineFinder(text) {
  return (testID) => {
    const match = new RegExp(`"testID"\\s*:\\s*"${testID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).exec(text);
    if (!match) return 0;
    const index = match.index;
    let line = 1;
    for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
    return line;
  };
}

// ---------------------------------------------------------------------------------------------
// Static checks
// ---------------------------------------------------------------------------------------------

function checkStatic(map, deck, problem) {
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (map.version !== 1) problem('map-version', 'version must be 1', 'Set "version": 1.');
  const device = map.device;
  if (!isObj(device) || typeof device.name !== 'string') problem('map-device', 'device must be an object with a name', 'Add "device": {"name": ..., "pointsWidth": ...}.');
  else for (const key of ['pointsWidth', 'pointsHeight', 'scale', 'safeTop', 'safeBottom']) {
    if (typeof device[key] !== 'number' || device[key] <= 0) problem('map-device', `device.${key} must be a positive number`, `Set device.${key}.`);
  }
  if (!Array.isArray(map.screens) || map.screens.length === 0) {
    problem('map-screens', 'screens must be a non-empty array', 'List every screen of the design.');
    return;
  }
  const screenIds = new Set();
  const owner = new Map(); // testID -> screen id
  for (const screen of map.screens) {
    const sid = screen?.id;
    const at = `screen ${sid ?? '?'}`;
    if (!isObj(screen) || typeof sid !== 'string' || !SCREEN_ID.test(sid)) {
      problem('screen-id', `${at}: id must look like S4 or S11a`, 'Use the spec screen id.');
      continue;
    }
    if (screenIds.has(sid)) problem('screen-id', `${at}: id used twice`, 'Merge the two entries; variants belong in "variants".');
    screenIds.add(sid);
    if (screen.route !== null && (typeof screen.route !== 'string' || !/^[A-Z][A-Za-z]+$/.test(screen.route))) {
      problem('screen-route', `${at}: route must be a PascalCase route name or null`, 'Use the navigator route (Home, SettingsLanguage) or null.');
    }
    if (!PRESENTATIONS.includes(screen.presentation)) problem('screen-presentation', `${at}: presentation "${screen.presentation}" is not one of ${PRESENTATIONS.join(', ')}`, 'Pick one of the listed values.');
    const scopes = screen.scopes;
    if (!Array.isArray(scopes) || scopes.length === 0 || !scopes.every((s) => typeof s === 'string' && KEBAB.test(s))) {
      problem('screen-scopes', `${at}: scopes must be a non-empty array of kebab-case testID scopes`, 'Add "scopes": ["home"].');
      continue;
    }
    const variants = screen.variants;
    if (!Array.isArray(variants) || variants.length === 0 || new Set(variants).size !== variants.length || !variants.every((v) => typeof v === 'string' && KEBAB.test(v))) {
      problem('screen-variants', `${at}: variants must be a non-empty list of unique kebab-case names`, 'Add "variants": ["normal"].');
      continue;
    }
    for (const field of ['frameSelectors', 'frameKeys', 'variantKinds']) {
      const value = screen[field];
      if (!isObj(value)) {
        problem('screen-frames', `${at}: ${field} must be an object keyed by variant`, `Add "${field}": {"${variants[0]}": ...}.`);
        continue;
      }
      const keys = Object.keys(value).sort();
      if (keys.join() !== [...variants].sort().join()) problem('screen-frames', `${at}: ${field} keys [${keys.join(', ')}] differ from variants [${variants.join(', ')}]`, `Give ${field} exactly one entry per variant.`);
      for (const [variant, v] of Object.entries(value)) {
        if (typeof v !== 'string' || v.trim() === '') problem('screen-frames', `${at}: ${field}.${variant} must be a non-empty string`, `Fill ${field}.${variant}.`);
        else if (field === 'variantKinds' && !KINDS.includes(v)) problem('screen-frames', `${at}: variantKinds.${variant} "${v}" is not one of ${KINDS.join(', ')}`, 'Pick one of the listed kinds.');
      }
    }
    if (!Array.isArray(screen.elements)) {
      problem('screen-elements', `${at}: elements must be an array`, 'Add "elements": [].');
      continue;
    }
    const seen = new Set();
    const byId = new Map();
    for (const el of screen.elements) {
      if (!isObj(el)) {
        problem('element-shape', `${at}: every element must be an object`, 'Remove the stray value.');
        continue;
      }
      const id = el.testID;
      const where = `${sid} ${id ?? '?'}`;
      const extra = Object.keys(el).filter((key) => !ELEMENT_KEYS.includes(key));
      if (extra.length) problem('element-shape', `${where}: unknown keys ${extra.join(', ')}`, `Use only: ${ELEMENT_KEYS.join(', ')}.`);
      if (typeof id !== 'string' || !TESTID.test(id)) {
        problem('testid-format', `${where}: testID must be <scope>.<element> in kebab-case (e.g. home.play-button)`, 'Rename it: lower-case kebab segments joined by dots, at least two segments.');
        continue;
      }
      if (!scopes.includes(id.split('.')[0])) problem('testid-scope', `${where}: first segment "${id.split('.')[0]}" is not a scope of ${sid} (${scopes.join(', ')})`, 'Start the testID with the screen\'s scope, or add the scope to "scopes".');
      if (!ROLES.includes(el.role)) problem('element-role', `${where}: role "${el.role}" is not one of ${ROLES.join(', ')}`, 'Use an accessibilityRole from the list (none for containers).');
      if (typeof el.component !== 'string' || el.component === '') problem('element-component', `${where}: component must name the building component`, 'Set "component" (Button, ListRow, AppText, ...).');
      if (!('text' in el) || (el.text !== null && (typeof el.text !== 'string' || !COPY_KEY.test(el.text)))) problem('element-text', `${where}: text must be a copy-deck key or null`, 'Set "text" to the key of the visible text, or null for data.');
      if (el.a11yLabel !== undefined && el.a11yLabel !== null && (typeof el.a11yLabel !== 'string' || !COPY_KEY.test(el.a11yLabel))) problem('element-a11y', `${where}: a11yLabel must be a copy-deck key or null`, 'Set it to the key of the accessible label.');
      if (typeof el.designSelector !== 'string' || el.designSelector.trim() === '') problem('element-selector', `${where}: designSelector must be a non-empty CSS selector`, 'Write a selector that matches exactly one element in the frame.');
      if (!Array.isArray(el.checks) || !el.checks.every((c) => CHECKS.includes(c)) || new Set(el.checks).size !== el.checks.length) problem('element-checks', `${where}: checks must be unique values from ${CHECKS.join(', ')}`, 'Fix the list (an empty list means presence only).');
      const elVariants = el.variants ?? variants;
      if (!Array.isArray(elVariants) || elVariants.length === 0 || !elVariants.every((v) => variants.includes(v))) {
        problem('element-variants', `${where}: variants [${elVariants}] must be a non-empty subset of [${variants.join(', ')}]`, 'List only variants the screen has.');
        continue;
      }
      if (el.requires !== undefined && !/^(endless|no-endless|game:[a-zA-Z]+)$/.test(el.requires)) problem('element-requires', `${where}: requires "${el.requires}" must be endless, no-endless or game:<id>`, 'Use one of the three forms.');
      if (typeof el.requires === 'string' && el.requires.startsWith('game:') && !deck.games[el.requires.slice(5)]) problem('element-requires', `${where}: requires names game "${el.requires.slice(5)}", which the deck does not have`, 'Use a game id from the design deck.');
      if (el.when !== undefined) {
        const entries = isObj(el.when) ? Object.entries(el.when) : [];
        if (entries.length === 0 || !entries.every(([key, value]) => FACT_VALUES[key]?.includes(value))) {
          problem('element-when', `${where}: when must be an object of game facts (${Object.entries(FACT_VALUES).map(([k, v]) => `${k}: ${v.map((x) => JSON.stringify(x)).join(' | ')}`).join('; ')})`, 'Use for example "when": {"hasMusic": true} for a part only a game with music shows.');
        }
      }
      for (const key of ['kind', 'state', 'note']) if (el[key] !== undefined && typeof el[key] !== 'string') problem('element-shape', `${where}: ${key} must be a string`, `Write ${key} as text.`);
      if (el.mask !== undefined && typeof el.mask !== 'boolean') problem('element-shape', `${where}: mask must be true or false`, 'Use a boolean.');
      checkReach(el, where, problem);
      for (const v of elVariants) {
        if (screen.variantKinds?.[v] === 'state-card' && el.checks?.includes('bounds')) problem('element-checks', `${where}: variant "${v}" is a state card, so "bounds" cannot be compared`, 'Drop "bounds" for state-card variants.');
        if (screen.variantKinds?.[v] === 'mock-only') problem('element-variants', `${where}: variant "${v}" is mock-only and must have no elements`, 'Remove the element from that variant.');
        const key = `${v}|${id}`;
        if (seen.has(key)) problem('testid-duplicate', `${where}: duplicate testID in variant "${v}"`, 'Rename one of them, or give the entries disjoint variants.');
        seen.add(key);
      }
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push({ ...el, variants: elVariants });
      const prev = owner.get(id);
      if (prev && prev !== sid) problem('testid-duplicate', `${where}: testID is also used by screen ${prev}`, 'A testID belongs to one screen; rename one of them.');
      owner.set(id, sid);
      for (const [field, key] of [['text', el.text], ['a11yLabel', el.a11yLabel]]) {
        if (typeof key !== 'string') continue;
        // A part only a reference variant draws may carry a Shell text the deck lacks.
        if (!isDesignDrawn(el) && resolveKey(deck, key, 'en', Object.keys(deck.games)[0]).error) continue;
        const games = el.requires?.startsWith('game:') ? [el.requires.slice(5)] : Object.keys(deck.games);
        for (const game of games) {
          const resolved = resolveKey(deck, key, 'en', game);
          if (resolved.error) {
            problem('copy-key', `${where}: ${field} key "${key}" ${resolved.error}${key.startsWith('games.') ? ` (game ${game})` : ''}`, 'Use a key that exists in the copy deck, or null.');
            break;
          }
        }
      }
    }
    for (const v of variants) {
      if (screen.variantKinds?.[v] !== 'mock-only' && !screen.elements.some((el) => (el?.variants ?? variants).includes(v))) {
        problem('screen-elements', `${at}: variant "${v}" has no elements`, 'Map its elements, or mark the variant mock-only.');
      }
    }
    for (const [id, entries] of byId) {
      for (const el of entries) checkCover(el, `${sid} ${id}`, byId, problem);
      for (const el of entries) {
        if (el.parent === undefined) continue;
        const parents = byId.get(el.parent) ?? [];
        if (!parents.length) problem('element-parent', `${sid} ${id}: parent "${el.parent}" is not a testID of this screen`, 'Point parent at the accessible element that contains this one.');
        else if (!el.variants.every((v) => parents.some((p) => p.variants.includes(v)))) problem('element-parent', `${sid} ${id}: parent "${el.parent}" is missing in some of this element's variants`, 'Give the parent the same variants.');
        else if (!parents.every((p) => ACCESSIBLE.includes(p.role))) problem('element-parent', `${sid} ${id}: parent "${el.parent}" has no accessible role (${ACCESSIBLE.join(', ')})`, 'parent names only accessible ancestors; remove it or fix the role.');
      }
    }
  }
  if (map.notDrawn !== undefined) {
    if (!Array.isArray(map.notDrawn)) problem('not-drawn', 'notDrawn must be an array', 'Use a list of {screen, testID, text, reason}.');
    else for (const item of map.notDrawn) {
      const id = item?.testID;
      if (typeof id !== 'string' || !TESTID.test(id)) problem('testid-format', `notDrawn ${id ?? '?'}: testID must be <scope>.<element> in kebab-case`, 'Rename it.');
      else if (owner.has(id)) problem('testid-duplicate', `notDrawn ${id}: already mapped in screen ${owner.get(id)}`, 'Remove it from notDrawn.');
      if (!screenIds.has(item?.screen)) problem('not-drawn', `notDrawn ${id}: screen "${item?.screen}" is not in the map`, 'Use a screen id from "screens".');
      if (typeof item?.reason !== 'string' || item.reason === '') problem('not-drawn', `notDrawn ${id}: needs a reason`, 'Say why it is not drawn.');
      if (item?.role !== undefined && !ROLES.includes(item.role)) problem('not-drawn', `notDrawn ${id}: role "${item.role}" is not one of ${ROLES.join(', ')}`, 'Use an accessibilityRole from the list (none for a container or a text field).');
      if (typeof item?.text === 'string' && resolveKey(deck, item.text, 'en', Object.keys(deck.games)[0]).error) problem('copy-key', `notDrawn ${id}: text key "${item.text}" is not in the copy deck`, 'Use an existing key or null.');
    }
  }
}

/** Reach policy, static part: crop-only elements carry only "crop" and name their cover. */
function checkReach(el, where, problem) {
  if (el.a11yHidden !== undefined && el.a11yHidden !== true) problem('element-shape', `${where}: a11yHidden must be true or absent`, 'Use "a11yHidden": true, or remove the key.');
  if (el.a11yHidden === true && el.parent !== undefined) problem('element-reach', `${where}: has both parent and a11yHidden`, 'Keep "parent" only: inside an accessible element the part is hidden anyway.');
  const isDecorative = DECORATIVE.includes(el.component) && el.role === 'none' && !el.a11yLabel;
  if (isDecorative && !isCropOnly(el)) {
    problem('element-reach', `${where}: ${el.component} hides itself from VoiceOver, so Maestro cannot list it`, 'Set "a11yHidden": true, "checks": ["crop"] and "coveredBy": "<nearest compared ancestor>".');
  }
  if (!isCropOnly(el)) {
    if (el.coveredBy !== undefined) problem('element-cover', `${where}: a reachable element is measured itself; coveredBy is only for crop-only parts`, 'Remove "coveredBy".');
    return;
  }
  const extra = (el.checks ?? []).filter((check) => check !== 'crop');
  if (extra.length) problem('element-reach', `${where}: Maestro cannot list it (${el.parent !== undefined ? `inside ${el.parent}` : 'hidden from VoiceOver'}), so "${extra.join('", "')}" cannot be checked`, 'Set "checks": ["crop"]: its pixels are compared inside the aligned crop of its coveredBy element.');
  if ((el.checks ?? []).length > 0 && typeof el.coveredBy !== 'string') problem('element-cover', `${where}: a crop-only part needs "coveredBy"`, 'Name the nearest reachable ancestor whose crop is compared (crop or fill in its checks, or the frame root).');
}

/** Reach policy, per screen: the cover exists in every variant of the part, is reachable and compared. */
function checkCover(el, where, byId, problem) {
  if (typeof el.coveredBy !== 'string') return;
  const covers = byId.get(el.coveredBy) ?? [];
  if (!covers.length) problem('element-cover', `${where}: coveredBy "${el.coveredBy}" is not a testID of this screen`, 'Name the nearest reachable ancestor whose crop is compared.');
  else if (!el.variants.every((v) => covers.some((c) => c.variants.includes(v)))) problem('element-cover', `${where}: coveredBy "${el.coveredBy}" is missing in some of this element's variants`, 'Pick an ancestor present in every variant of the part.');
  else if (!covers.every(isCoverCandidate)) problem('element-cover', `${where}: coveredBy "${el.coveredBy}" is not a compared, reachable element`, 'The cover needs "crop" or "fill" in its checks (or is the frame root) and no parent or a11yHidden.');
}

// ---------------------------------------------------------------------------------------------
// DOM checks (runs inside the page)
// ---------------------------------------------------------------------------------------------

/* eslint-disable no-undef */
function inspectPage({ screens, checkParents, accessible }) {
  const norm = (text) => (text ?? '').replace(/\s+/g, ' ').trim();
  const slug = (text) => text.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  const out = [];
  const nodeOwners = new Map(); // node -> Set of "screen testID"
  for (const screen of screens) {
    for (const variant of screen.variants) {
      const frameSel = screen.frameSelectors[variant];
      let frames;
      try {
        frames = [...document.querySelectorAll(frameSel)];
      } catch (error) {
        out.push({ kind: 'frame', screen: screen.id, variant, error: `invalid selector: ${error.message}` });
        continue;
      }
      if (frames.length !== 1) {
        out.push({ kind: 'frame', screen: screen.id, variant, count: frames.length });
        continue;
      }
      const frame = frames[0];
      const holder = frame.closest('.pg-fig, .mini-w');
      const tag = holder?.querySelector('.pg-tag');
      const caption = tag ? slug(`${tag.querySelector('b')?.textContent ?? ''}-${tag.querySelector('span:not(.pg-hole)')?.textContent ?? ''}`) : null;
      out.push({ kind: 'frame', screen: screen.id, variant, count: 1, caption });
      const els = screen.elements.filter((el) => el.variants.includes(variant) && el.expect !== 'skip');
      const nodes = els.map((el) => {
        try {
          return { list: el.designSelector === ':scope' ? [frame] : [...frame.querySelectorAll(el.designSelector)] };
        } catch (error) {
          return { list: [], error: error.message };
        }
      });
      els.forEach((el, i) => {
        const { list, error } = nodes[i];
        const result = { kind: 'element', screen: screen.id, variant, testID: el.testID, count: list.length, expected: el.expect === 'absent' ? 0 : 1, error };
        if (list.length === 1) {
          const node = list[0];
          const rect = node.getBoundingClientRect();
          result.visible = rect.width > 0 && rect.height > 0;
          result.text = norm(node.textContent);
          if (el.textPattern) result.textOk = new RegExp(el.textPattern).test(result.text);
          const aria = node.getAttribute('aria-label');
          if (aria !== null && el.a11yPattern) {
            result.aria = aria;
            result.ariaOk = new RegExp(el.a11yPattern).test(norm(aria));
          }
          if (!nodeOwners.has(node)) nodeOwners.set(node, new Set());
          nodeOwners.get(node).add(`${screen.id} ${el.testID}`);
          if (checkParents) {
            let best = null;
            let bestDepth = -1;
            els.forEach((p, j) => {
              if (j === i || !accessible.includes(p.role) || nodes[j].list.length !== 1) return;
              const pn = nodes[j].list[0];
              if (pn !== node && pn.contains(node)) {
                let depth = 0;
                for (let n = pn; n; n = n.parentElement) depth += 1;
                if (depth > bestDepth) {
                  bestDepth = depth;
                  best = p.testID;
                }
              }
            });
            result.computedParent = best;
            let cover = null;
            let coverDepth = -1;
            let hidden = null;
            let hiddenDepth = -1;
            els.forEach((p, j) => {
              if (j === i || nodes[j].list.length !== 1) return;
              const pn = nodes[j].list[0];
              if (pn === node || !pn.contains(node)) return;
              let depth = 0;
              for (let n = pn; n; n = n.parentElement) depth += 1;
              if (p.coverCandidate && depth > coverDepth) {
                coverDepth = depth;
                cover = p.testID;
              }
              if (p.a11yHidden && depth > hiddenDepth) {
                hiddenDepth = depth;
                hidden = p.testID;
              }
            });
            result.computedCover = cover;
            result.hiddenAncestor = hidden;
            if (el.parent) {
              const pIndex = els.findIndex((p) => p.testID === el.parent);
              result.parentContains = pIndex !== -1 && nodes[pIndex].list.length === 1 && nodes[pIndex].list[0] !== node && nodes[pIndex].list[0].contains(node);
            }
          }
        }
        out.push(result);
      });
    }
  }
  const shared = [];
  for (const owners of nodeOwners.values()) if (owners.size > 1) shared.push([...owners]);
  out.push({ kind: 'shared', shared });
  return out;
}
/* eslint-enable no-undef */

async function loadPlaywright(dirOption) {
  const attempts = [];
  for (const dir of [dirOption, process.env.PLAYWRIGHT_DIR].filter(Boolean)) {
    const base = resolve(dir);
    attempts.push(() => createRequire(join(base, 'package.json'))('playwright'));
    attempts.push(() => createRequire(join(base, 'index.js'))(base));
  }
  attempts.push(async () => import('playwright'));
  attempts.push(() => createRequire(join(process.cwd(), 'package.json'))('playwright'));
  for (const attempt of attempts) {
    try {
      const mod = await attempt();
      const pw = mod?.chromium ? mod : mod?.default;
      if (pw?.chromium) return pw;
    } catch {
      // try the next place
    }
  }
  return null;
}

async function launch(pw) {
  const args = ['--force-color-profile=srgb', '--hide-scrollbars'];
  try {
    const browser = await pw.chromium.launch({ channel: 'chrome', headless: true, args });
    return { browser, label: `Google Chrome ${browser.version()}` };
  } catch (chromeError) {
    try {
      const browser = await pw.chromium.launch({ headless: true, args });
      return { browser, label: `Playwright Chromium ${browser.version()} (Google Chrome did not launch)` };
    } catch {
      return fail(`no browser: Google Chrome could not be launched (${String(chromeError.message).split('\n')[0]})`, 'Install Google Chrome, or run "npx playwright install chromium" in the folder that holds playwright.');
    }
  }
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const mapPath = options.map ? requireFile(resolve(options.map), 'testID map') : firstExisting([join(HERE, '../assets/screen-testids.json'), join(HERE, '../screen-testids.json')]);
  if (!mapPath) fail('nothing to check: no testID map found next to this script', 'Pass --map <path to screen-testids.json>.');
  const designPath = options.design
    ? requireFile(resolve(options.design), 'design HTML')
    : firstExisting([join(HERE, '../assets/design/toybox.html'), join(HERE, '../assets/toybox.html'), join(HERE, '../toybox.html')]);
  if (!designPath) fail('nothing to check: no design HTML found next to this script', 'Pass --design <path to the Toybox design HTML>.');

  const mapText = readFileSync(mapPath, 'utf8');
  let map;
  try {
    map = JSON.parse(mapText);
  } catch (error) {
    fail(`the map ${mapPath} is not valid JSON: ${error.message}`, 'Fix the JSON syntax.');
  }
  const deck = readDeck(readFileSync(designPath, 'utf8'), designPath);
  const shownMap = relative(process.cwd(), mapPath) || mapPath;
  const lineOf = lineFinder(mapText);
  const report = createReporter({ name: NAME, json: options.json });
  const problem = (rule, message, fix, testID) => report.problem({ file: shownMap, line: testID ? lineOf(testID) : 0, rule, message, fix });

  checkStatic(map, deck, (rule, message, fix) => problem(rule, message, fix, /^S\S* ([a-z0-9.-]+)/.exec(message)?.[1]));
  const elementCount = Array.isArray(map.screens) ? map.screens.reduce((sum, s) => sum + (Array.isArray(s?.elements) ? s.elements.length : 0), 0) : 0;
  if (elementCount === 0 && report.count === 0) fail('nothing to check: the map lists no elements', 'Map the design\'s elements.');

  if (report.count > 0) {
    report.note('DOM checks skipped: fix the static problems first.');
    return report.finish({ checked: elementCount, unit: 'elements' });
  }

  if (options.list) {
    const screen = map.screens.find((s) => s.id.toLowerCase() === options.list.toLowerCase());
    if (!screen) fail(`no screen "${options.list}" in the map (${map.screens.map((s) => s.id).join(', ')})`, 'Pass a screen id such as S4.');
    report.note(`${screen.id} ${screen.name}  route ${screen.route ?? '(none)'}  ${screen.presentation}  variants: ${screen.variants.map((v) => `${v} (${screen.variantKinds[v]})`).join(', ')}`);
    for (const el of screen.elements) {
      const bits = [el.role, el.component + (el.kind ? ` (${el.kind})` : ''), el.text ? `text ${el.text}` : '', el.a11yLabel ? `a11y ${el.a11yLabel}` : '',
        el.variants ? `only ${el.variants.join('+')}` : '', el.requires ? `requires ${el.requires}` : '', el.parent ? `in ${el.parent}` : '', el.a11yHidden ? 'hidden from VoiceOver' : '', el.coveredBy ? `crop-only, compared in ${el.coveredBy}` : '', el.state ? `state ${el.state}` : '', el.mask ? 'masked' : '', el.when ? `only when ${Object.entries(el.when).map(([k, v]) => `${k} ${v}`).join(', ')}` : ''];
      report.note(`  ${el.testID.padEnd(48)} ${bits.filter(Boolean).join(' | ')}`);
    }
    for (const item of (map.notDrawn ?? []).filter((n) => n.screen === screen.id)) report.note(`  (not drawn) ${item.testID}${item.role ? ` [${item.role}]` : ''}: ${item.reason}`);
    return report.finish({ checked: screen.elements.length, unit: 'elements' });
  }

  if (!options.static) {
    const pw = await loadPlaywright(options.playwright);
    if (!pw) fail('Playwright is not installed where this script can find it', 'Install it (npm ci --prefix <skill>/scripts, playwright 1.63.0), or pass --playwright <dir> / set PLAYWRIGHT_DIR.');
    const def = { lang: map.defaultRender?.lang ?? 'en', theme: map.defaultRender?.theme ?? 'light', game: map.defaultRender?.game ?? Object.keys(deck.games)[0] };
    const split = (value) => value.split(',').map((s) => s.trim()).filter(Boolean);
    const games = options.games ? split(options.games) : Object.keys(deck.games);
    const langs = options.matrix ? (deck.meta?.languages ?? [def.lang]) : options.langs ? split(options.langs) : [def.lang];
    const themes = options.matrix ? ['light', 'dark'] : options.themes ? split(options.themes) : [def.theme];
    for (const game of games) if (!deck.games[game]) fail(`game "${game}" is not in the design deck (${Object.keys(deck.games).join(', ')})`, 'Pass game ids from the deck.');
    const renders = [];
    for (const game of games) for (const lang of langs) for (const theme of themes) renders.push({ game, lang, theme });
    renders.sort((a, b) => Number(b.game === def.game && b.lang === def.lang && b.theme === def.theme) - Number(a.game === def.game && a.lang === def.lang && a.theme === def.theme));

    const { browser, label } = await launch(pw);
    report.note(`browser: ${label}`);
    try {
      for (const render of renders) {
        const isDefault = render.game === def.game && render.lang === def.lang && render.theme === def.theme;
        const hasEndless = (deck.games[render.game].modes ?? []).includes('endless');
        const tagRender = `[${render.lang}/${render.theme}/${render.game}]`;
        const screens = map.screens.map((screen) => ({
          id: screen.id,
          variants: screen.variants,
          frameSelectors: screen.frameSelectors,
          elements: screen.elements.map((el) => {
            let expect = 'present';
            if (el.requires === 'endless') expect = hasEndless ? 'present' : 'absent';
            else if (el.requires === 'no-endless') expect = hasEndless ? 'absent' : 'present';
            else if (el.requires?.startsWith('game:') && el.requires.slice(5) !== render.game) expect = 'skip';
            if (!isDesignDrawn(el)) expect = 'skip';
            const text = el.text && expect === 'present' ? resolveKey(deck, el.text, render.lang, render.game) : null;
            const a11y = el.a11yLabel && expect === 'present' ? resolveKey(deck, el.a11yLabel, render.lang, render.game) : null;
            return {
              testID: el.testID,
              role: el.role,
              parent: el.parent,
              a11yHidden: el.a11yHidden === true,
              coverCandidate: isCoverCandidate(el),
              designSelector: el.designSelector,
              variants: el.variants ?? screen.variants,
              expect,
              textPattern: text?.message ? messagePattern(text.message) : null,
              a11yPattern: a11y?.message ? messagePattern(a11y.message) : null,
            };
          }),
        }));
        const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, colorScheme: render.theme, reducedMotion: 'reduce' });
        await context.addInitScript(({ prefix, r }) => {
          try {
            localStorage.setItem(`${prefix}theme`, r.theme);
            localStorage.setItem(`${prefix}lang`, r.lang);
            localStorage.setItem(`${prefix}game`, r.game);
          } catch {
            // storage blocked: the design falls back to its defaults
          }
        }, { prefix: STORAGE_PREFIX, r: render });
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(String(error.message ?? error)));
        await page.goto(pathToFileURL(designPath).href, { waitUntil: 'load' });
        const results = await page.evaluate(inspectPage, { screens, checkParents: isDefault, accessible: ACCESSIBLE });
        await context.close();
        for (const message of pageErrors) problem('design-error', `${tagRender} the design threw: ${message}`, 'Use an intact copy of the design HTML.');
        const badFrames = new Set();
        for (const r of results) {
          const screen = map.screens.find((s) => s.id === r.screen);
          if (r.kind === 'frame') {
            const where = `${r.screen}/${r.variant} ${tagRender}`;
            const before = report.count;
            if (r.error) problem('frame-selector', `${where}: frame selector ${r.error}`, 'Fix frameSelectors.');
            else if (r.count !== 1) problem('frame-selector', `${where}: frame selector matched ${r.count} elements`, 'frameSelectors must match exactly one phone frame; the design may have reordered its frames.');
            else if (r.caption !== screen.frameKeys[r.variant]) problem('frame-caption', `${where}: frame caption is "${r.caption}", expected "${screen.frameKeys[r.variant]}" (element checks for this frame skipped)`, 'The selector points at another frame: fix frameSelectors (or frameKeys if the caption changed).');
            if (report.count > before) badFrames.add(`${r.screen}|${r.variant}`);
            continue;
          }
          if (r.kind === 'element' && badFrames.has(`${r.screen}|${r.variant}`)) continue;
          if (r.kind === 'shared') {
            for (const ids of r.shared) problem('testid-shared-node', `${tagRender} one design element carries several testIDs: ${ids.join(', ')}`, 'Give each testID its own element (a part needs a narrower selector).');
            continue;
          }
          const where = `${r.screen}/${r.variant} ${r.testID} ${tagRender}`;
          const el = screen.elements.find((e) => e.testID === r.testID && (e.variants ?? screen.variants).includes(r.variant));
          if (r.error) {
            problem('element-selector', `${where}: invalid designSelector "${el.designSelector}": ${r.error}`, 'Fix the CSS syntax.', r.testID);
            continue;
          }
          if (r.count !== r.expected) {
            const fix = r.expected === 0
              ? `The element must be absent for this game (requires ${el.requires}); fix "requires" or narrow the selector.`
              : r.count === 0 ? `Correct the selector so it matches the element in frame ${screen.frameKeys[r.variant]}.` : 'Narrow the selector so it matches exactly one element.';
            problem('exactly-one-match', `${where}: designSelector "${el.designSelector}" matched ${r.count} elements (expected ${r.expected})`, fix, r.testID);
            continue;
          }
          if (r.count === 0) continue;
          if (!r.visible) problem('element-visible', `${where}: the matched element has no size`, 'Point the selector at a rendered element.', r.testID);
          if (r.textOk === false) problem('text-key', `${where}: text key "${el.text}" does not match the element text "${r.text.slice(0, 80)}"`, 'Fix the selector (wrong element) or the text key.', r.testID);
          if (r.ariaOk === false) problem('a11y-key', `${where}: a11yLabel "${el.a11yLabel}" does not match aria-label "${r.aria}"`, 'Fix the a11yLabel key.', r.testID);
          if (isDefault && (r.computedParent ?? undefined) !== el.parent) {
            problem('element-parent', `${where}: parent is ${el.parent ? `"${el.parent}"` : 'unset'}, but the nearest accessible listed ancestor is ${r.computedParent ? `"${r.computedParent}"` : 'none'}`, r.computedParent ? `Set "parent": "${r.computedParent}".` : 'Remove "parent".', r.testID);
          } else if (isDefault && el.parent && r.parentContains === false) {
            problem('element-parent', `${where}: parent "${el.parent}" does not contain this element`, 'Fix parent or the selectors.', r.testID);
          }
          if (isDefault && r.hiddenAncestor && !isCropOnly(el)) {
            problem('element-reach', `${where}: it sits inside "${r.hiddenAncestor}", which its component hides from VoiceOver, so Maestro cannot list it`, 'Set "a11yHidden": true, "checks": ["crop"] and "coveredBy".', r.testID);
          }
          if (isDefault && typeof el.coveredBy === 'string' && r.computedCover !== el.coveredBy) {
            problem('element-cover', `${where}: coveredBy is "${el.coveredBy}", but the nearest reachable ancestor whose crop is compared is ${r.computedCover ? `"${r.computedCover}"` : 'none'}`, r.computedCover ? `Set "coveredBy": "${r.computedCover}".` : 'Add "crop" or "fill" to an ancestor\'s checks.', r.testID);
          }
        }
        report.note(`rendered ${tagRender}${isDefault ? ' (default: parents checked)' : ''}`);
      }
    } finally {
      await browser.close();
    }
  } else {
    report.note('--static: DOM checks not run.');
  }

  for (const screen of map.screens) {
    const ids = new Set(screen.elements.map((el) => el.testID));
    report.note(`${screen.id.padEnd(5)} ${String(screen.name ?? '').padEnd(28)} variants ${String(screen.variants.length).padStart(2)}  entries ${String(screen.elements.length).padStart(4)}  testIDs ${String(ids.size).padStart(4)}`);
  }
  return report.finish({ checked: elementCount, unit: 'elements' });
});
