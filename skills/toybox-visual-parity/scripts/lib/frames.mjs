// The frame catalogue: which design frames exist, what kind each is, which testIDs each shows, and
// what state the app must be in to match it. Built from two assets:
//   assets/screen-testids.json  (shared) screens, variants, frame selectors, testIDs, checks
//   assets/frames.json          (this skill) root testID, app state and launch notes per frame
import { existsSync, readFileSync } from 'node:fs';

import { fail } from '../check-lib.mjs';
import { DEFAULTS, readJson } from './paths.mjs';

export const THEMES = ['light', 'dark'];
export const LANGS = ['en', 'de', 'fa', 'ckb'];
export const RTL_LANGS = new Set(['fa', 'ckb']);
export const REQUIRED_LANGS = ['en', 'fa'];
export const KINDS = ['phone', 'phone-tall', 'state-card', 'mock-only'];
export const TESTID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/;

/** The copy deck embedded in the design HTML (<script id="pa-deck">). */
export function readDeck(designPath) {
  const html = readFileSync(designPath, 'utf8');
  const match = /<script[^>]*\bid=["']pa-deck["'][^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match) fail(`the design ${designPath} has no embedded copy deck (<script id="pa-deck">)`, 'Use the skill\'s design copy (assets/design/toybox.html).');
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    return fail(`the copy deck inside ${designPath} is not valid JSON: ${error.message}`, 'Re-import the design with import-design.mjs.');
  }
}

/**
 * Returns Map<frameKey, frame>, where frame = { key, kind, selector, entries: [{screen, variant}],
 * elements: [...map elements with screen id], root, state, notes }.
 */
export function loadCatalogue({ mapPath = DEFAULTS.map, framesPath = DEFAULTS.frames } = {}) {
  const map = readJson(mapPath, 'screen testID map');
  const extra = readJson(framesPath, 'frames manifest');
  if (!Array.isArray(map.screens)) fail(`${mapPath} has no "screens" list`, 'Restore the shared screen-testids.json (sync-shared.mjs).');
  const frames = new Map();
  for (const screen of map.screens) {
    for (const variant of screen.variants) {
      const key = screen.frameKeys?.[variant];
      if (!key) fail(`screen ${screen.id} variant ${variant} has no frame key in ${mapPath}`, 'Restore the shared screen-testids.json.');
      const kind = screen.variantKinds?.[variant] ?? 'phone';
      const selector = screen.frameSelectors?.[variant];
      if (!frames.has(key)) frames.set(key, { key, kind, selector, entries: [], elements: [] });
      const frame = frames.get(key);
      if (frame.selector !== selector || frame.kind !== kind) {
        fail(`frame ${key} is used by two screens with different selectors or kinds`, 'Fix screen-testids.json so one frame key means one frame.');
      }
      frame.entries.push({ screen: screen.id, variant });
      for (const el of screen.elements) {
        if (!(el.variants ?? screen.variants).includes(variant)) continue;
        frame.elements.push({ ...el, screen: screen.id, variant });
      }
    }
  }
  const { about: _about, ...declaredFacts } = extra.designFacts ?? {};
  const designFacts = checkFacts(declaredFacts, `${framesPath} designFacts`, { complete: true });
  const info = extra.frames ?? {};
  for (const key of Object.keys(info)) {
    if (!frames.has(key)) fail(`frames.json names frame "${key}", which screen-testids.json does not have`, 'Keep assets/frames.json in step with the testID map (one entry per frame key).');
  }
  for (const [key, frame] of frames) {
    const entry = info[key];
    if (!entry) fail(`frame "${key}" has no entry in frames.json`, 'Add its root testID and state to assets/frames.json.');
    frame.root = entry.root ?? null;
    frame.state = entry.state ?? '';
    frame.notes = entry.notes ?? '';
    frame.settleMs = entry.settleMs ?? null;
    if (frame.kind !== 'mock-only' && frame.root && !frame.elements.some((el) => el.testID === frame.root)) {
      fail(`frames.json gives frame ${key} the root "${frame.root}", which is not one of its testIDs`, 'Use a testID the frame lists (usually <scope>.screen).');
    }
    for (const el of frame.elements) if (el.when !== undefined) checkFacts(el.when, `screen-testids.json ${el.screen} ${el.testID} when`);
    frame.variants = checkVariants(key, entry.variants, designFacts, frame);
    frame.board = checkBoard(key, entry.board, frame);
    frame.modal = checkModal(key, entry.modal, frame);
  }
  checkGameFixture(extra);
  return { frames, map, manifest: extra, designFacts };
}

// ---------------------------------------------------------------------------------------------
// Game facts and reference variants. A frame whose design state depends on what the game has
// (Music rows, the win line) gets reference variants next to its base reference. The base shows
// the design's own facts (designFacts in frames.json: Music on, a moves line with par); a variant
// is derived from the rendered mockup by a DOM change (derive) before it is measured and shot, and
// is named <frame>--<variant>. Captures pick the reference from the app's facts, read from
// parity/game-facts.json in the app repo; a missing or mismatched facts file stops (exit 2).
// ---------------------------------------------------------------------------------------------

/** The game facts a reference can depend on, and their allowed values. */
export const FACT_VALUES = Object.freeze({ hasMusic: [true, false], winLine: ['moves', 'score'] });
export const FACTS_FILE = 'parity/game-facts.json';
export const DESIGN_GAMES = ['lineSiege', 'flockTilt', 'scrapShove'];
const DERIVE_OPS = ['hide', 'style', 'text'];
const VARIANT_REASONS = ['L1', 'L3'];

/** Validates a facts object ({ hasMusic, winLine }); `complete` demands every fact. */
function checkFacts(facts, where, { complete = false } = {}) {
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) fail(`${where} must be an object of game facts`, `Use { ${Object.keys(FACT_VALUES).map((k) => `"${k}": ...`).join(', ')} }.`);
  for (const [key, value] of Object.entries(facts)) {
    if (!FACT_VALUES[key]) fail(`${where} names the unknown fact "${key}"`, `Game facts are ${Object.keys(FACT_VALUES).join(' and ')}.`);
    if (!FACT_VALUES[key].includes(value)) fail(`${where}: ${key} must be ${FACT_VALUES[key].map((v) => JSON.stringify(v)).join(' or ')}, not ${JSON.stringify(value)}`, 'Fix the value.');
  }
  if (complete) for (const key of Object.keys(FACT_VALUES)) if (!(key in facts)) fail(`${where} lacks the fact "${key}"`, 'List every fact the mockup draws.');
  return facts;
}

/** True when every fact the condition names has that value in `facts`. */
export function factsMatch(when, facts) {
  return Object.entries(when ?? {}).every(([key, value]) => facts[key] === value);
}

function checkVariants(key, variants, designFacts, frame) {
  if (variants === undefined) return {};
  const where = `frames.json ${key} variants`;
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) fail(`${where} must be an object keyed by variant id`, 'Use { "no-music": { "when": ..., "derive": [...], "reason": "L1" } }.');
  for (const [id, v] of Object.entries(variants)) {
    const at = `${where}.${id}`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) fail(`${at}: the variant id must be kebab-case`, 'The files are named <frame>--<variant>.png.');
    checkFacts(v?.when, `${at}.when`);
    if (Object.keys(v.when).length === 0 || factsMatch(v.when, designFacts)) fail(`${at}.when must name a fact value the mockup does not draw`, `The base reference already shows ${JSON.stringify(designFacts)}.`);
    if (!VARIANT_REASONS.includes(v.reason)) fail(`${at}.reason must be one of ${VARIANT_REASONS.join(', ')}`, 'Name the lead decision that asked for the variant.');
    if (!Array.isArray(v.derive) || v.derive.length === 0) fail(`${at}.derive must list the DOM changes`, 'Use { "hide": "<selector>" }, { "style": "<selector>", "css": {...} } or { "text": "<selector>", "key": "<shell key>", "values": {...} }.');
    for (const op of v.derive) {
      const kinds = DERIVE_OPS.filter((k) => typeof op?.[k] === 'string');
      if (kinds.length !== 1) fail(`${at}.derive: every step names exactly one of ${DERIVE_OPS.join(', ')} with a selector`, 'Split the step.');
      if (kinds[0] === 'style' && (!op.css || typeof op.css !== 'object')) fail(`${at}.derive: a style step needs "css": { "<property>": "<value>" }`, 'Add the CSS the app lays out the same way.');
      if (kinds[0] === 'text') {
        const texts = v.texts?.[op.key];
        if (typeof op.key !== 'string' || !texts || !LANGS.every((l) => typeof texts[l] === 'string')) fail(`${at}.derive: a text step needs "key" with its four texts in the variant's "texts" (${LANGS.join(', ')})`, 'Copy the Shell texts of the key into the variant.');
        if (!op.values || typeof op.values !== 'object') fail(`${at}.derive: a text step needs "values" for the key's placeholders`, 'Give the fixture numbers.');
      }
    }
    const facts = { ...designFacts, ...v.when };
    if (!frame.elements.some((el) => el.when !== undefined && factsMatch(el.when, facts) !== factsMatch(el.when, designFacts))) {
      fail(`${at}: no element of the frame changes with ${JSON.stringify(v.when)}`, 'Mark the elements that exist only for some facts with "when" in screen-testids.json.');
    }
  }
  const ids = Object.keys(variants);
  return Object.fromEntries(ids.map((id) => [id, { id, ...variants[id], facts: { ...designFacts, ...variants[id].when } }]));
}

/**
 * The board of a Game-route frame: each game brings its own board, so the design has none to
 * compare (L6). capture-app reads the board rectangle the game reports (probe=board), check-parity
 * masks it; the elements named in "above" are drawn over the board and stay fully gated.
 */
function checkBoard(key, board, frame) {
  if (board === undefined) return null;
  const at = `frames.json ${key} board`;
  if (!board || !Array.isArray(board.above)) fail(`${at} must be { "above": [<testIDs drawn over the board>] }`, 'Name the overlay elements (the Pause dialog, the Result screen).');
  for (const id of board.above) if (!frame.elements.some((el) => el.testID === id)) fail(`${at}.above names ${id}, which is not a testID of the frame`, 'Use a testID the frame lists.');
  return { above: [...board.above] };
}

/**
 * A frame whose front layer is modal for VoiceOver (the Pause dialog): Maestro lists only that
 * layer, so the frame is reached through `reachedBy`, and the elements behind it (`hidden`) are
 * compared as crop-only parts of the screen root.
 */
function checkModal(key, modal, frame) {
  if (modal === undefined) return null;
  const at = `frames.json ${key} modal`;
  const ids = new Set(frame.elements.map((el) => el.testID));
  if (!modal || typeof modal.reachedBy !== 'string' || !ids.has(modal.reachedBy)) fail(`${at}.reachedBy must be a testID of the frame (the modal layer's element)`, 'Name the dialog that proves the frame is on screen.');
  if (!Array.isArray(modal.hidden) || modal.hidden.length === 0) fail(`${at}.hidden must list the testIDs behind the modal layer`, 'List the elements VoiceOver cannot reach while the dialog is up.');
  for (const id of modal.hidden) {
    if (!ids.has(id)) fail(`${at}.hidden names ${id}, which is not a testID of the frame`, 'Use testIDs of the frame.');
    if (id === frame.root || id === modal.reachedBy) fail(`${at}.hidden may not name the root or reachedBy (${id})`, 'The root is placed at its full-screen position; reachedBy must be listed.');
  }
  return { reachedBy: modal.reachedBy, hidden: [...modal.hidden] };
}

/**
 * A reference layout seen through the frame's modal layer: the hidden elements become crop-only
 * parts of the root (never paired with Maestro, never "missing"; their pixels are compared in the
 * root's crop). Frames without a modal layer are returned unchanged.
 */
export function withModal(layout, frame) {
  if (!frame?.modal) return layout;
  const hidden = new Set(frame.modal.hidden);
  return {
    ...layout,
    elements: layout.elements.map((el) => (hidden.has(el.testID)
      ? { ...el, a11yHidden: true, coveredBy: layout.root, checks: (el.checks ?? []).some((c) => ['crop', 'fill', 'text', 'bounds'].includes(c)) ? ['crop'] : [], behindModal: frame.modal.reachedBy }
      : el)),
  };
}

/** The design's game-frame numbers (fixture) and their save-terms copy (fixtureSave.gameFrame) agree. */
function checkGameFixture(manifest) {
  const f = manifest.fixture;
  const g = manifest.fixtureSave?.gameFrame;
  if (!f || !g) return;
  const same = [['currentLevel', 'level'], ['score', 'score'], ['movesCount', 'movesCount'], ['par', 'par']];
  for (const [a, b] of same) if (f[a] !== g[b]) fail(`frames.json fixture.${a} (${f[a]}) differs from fixtureSave.gameFrame.${b} (${g[b]})`, 'Keep the two descriptions of the design player equal.');
  for (const game of DESIGN_GAMES) {
    const d = f.games?.[game];
    const s = g.games?.[game];
    if (!d || !s) fail(`frames.json has no game-frame fixture for ${game}`, 'Give fixture.games and fixtureSave.gameFrame.games every design game.');
    for (const [part, text] of [['progressMid', d.progressMid], ['progressFull', d.progressFull]]) {
      const values = Object.values(s[part] ?? {});
      if (values.join(' / ') !== text) fail(`frames.json fixtureSave.gameFrame.games.${game}.${part} ${JSON.stringify(s[part])} does not draw "${text}"`, 'Keep the params equal to the design numbers.');
      if (JSON.stringify(d[`${part}Params`]) !== JSON.stringify(s[part])) fail(`frames.json fixture.games.${game}.${part}Params differs from fixtureSave.gameFrame.games.${game}.${part}`, 'Keep the two copies equal.');
    }
    if (d.loseReasonId !== s.loseReasonId) fail(`frames.json fixture.games.${game}.loseReasonId differs from fixtureSave.gameFrame.games.${game}.loseReasonId`, 'Keep the two copies equal.');
  }
}

/** Elements of a frame that exist for these facts (an element's "when" must match). */
export function elementsForFacts(elements, facts) {
  return elements.filter((el) => el.when === undefined || factsMatch(el.when, facts));
}

/** The variant of a frame the facts select, or null for the base reference. */
export function variantFor(frame, facts) {
  const matching = Object.values(frame.variants ?? {}).filter((v) => factsMatch(v.when, facts));
  if (matching.length > 1) fail(`frame ${frame.key}: the facts ${JSON.stringify(facts)} select several variants (${matching.map((v) => v.id).join(', ')})`, 'Make the variants\' "when" conditions exclusive in frames.json.');
  return matching[0] ?? null;
}

/** The reference file stem: <frame> for the base, <frame>--<variant> for a variant. */
export function referenceName(frameKey, variantId) {
  return variantId ? `${frameKey}--${variantId}` : frameKey;
}

/**
 * The app's game facts from parity/game-facts.json:
 *   { "version": 1, "games": { "<app id>": { "designGame": "lineSiege", "hasMusic": false, "winLine": "score" } } }
 * `app` picks the entry (needed when the file lists several apps); `game` is the design game the run
 * uses and must equal the entry's designGame. Anything missing or mismatched stops with exit 2: a
 * reference is never guessed.
 */
export function readGameFacts(path, { app = null, game = null } = {}) {
  if (!existsSync(path)) fail(`the game facts file ${path} does not exist, so the reference of a frame with variants cannot be chosen`, `Copy the skill's templates/parity/game-facts.json to parity/game-facts.json in the app repo and fill in each app's facts (its test, apps/<id>/src/parity-game-facts.test.ts, pins them to the game module); pass --facts <file> when the repo root is not the working directory.`);
  const json = readJson(path, 'game facts file');
  if (json.version !== 1 || !json.games || typeof json.games !== 'object' || Array.isArray(json.games)) fail(`${path} must be { "version": 1, "games": { "<app id>": { ... } } }`, "Start from the skill's templates/parity/game-facts.json.");
  const ids = Object.keys(json.games);
  for (const id of ids) {
    const entry = json.games[id];
    const at = `${path} games.${id}`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) fail(`${at}: the key must be the app id (kebab-case, as in apps/<id>)`, 'Use the app folder name.');
    if (!entry || !DESIGN_GAMES.includes(entry.designGame)) fail(`${at}.designGame must be one of ${DESIGN_GAMES.join(', ')}`, 'Name the design game whose references this app is compared with.');
    const extra = Object.keys(entry).filter((k) => k !== 'designGame' && !FACT_VALUES[k]);
    if (extra.length) fail(`${at} has unknown fields ${extra.join(', ')}`, `An entry holds designGame, ${Object.keys(FACT_VALUES).join(' and ')}.`);
    const { designGame: _designGame, ...facts } = entry;
    checkFacts(facts, at, { complete: true });
  }
  let id = app;
  if (id === null) {
    const candidates = game ? ids.filter((k) => json.games[k].designGame === game) : ids;
    if (candidates.length === 0 && ids.length > 0 && game) {
      fail(`${path} compares ${ids.map((k) => `app ${k} with design game ${json.games[k].designGame}`).join(', ')}, none with design game ${game}`, `Pass --game ${json.games[ids[0]].designGame} (the design game of the app), or fix the facts file.`);
    }
    if (candidates.length !== 1) fail(`${path} lists ${candidates.length === 0 ? 'no app' : `the apps ${candidates.join(', ')}`}${game ? ` for design game ${game}` : ''}, so the app cannot be chosen`, 'Pass --app <app id>.');
    id = candidates[0];
  }
  const entry = json.games[id];
  if (!entry) fail(`${path} has no entry for app "${id}" (it lists ${ids.join(', ') || 'none'})`, 'Add the app\'s facts, or pass the right --app.');
  if (game && entry.designGame !== game) fail(`${path} says app ${id} is compared with design game ${entry.designGame}, but this run uses ${game}`, `Pass --game ${entry.designGame}, or fix the facts file.`);
  const { designGame, ...facts } = entry;
  return { path, app: id, designGame, facts };
}

/** "s11-settings--no-music (hasMusic false)" or "s11-settings (base)". */
export function describeReference(frameKey, variant) {
  if (!variant) return `${frameKey} (base)`;
  return `${referenceName(frameKey, variant.id)} (${Object.entries(variant.when).map(([k, v]) => `${k} ${v}`).join(', ')}; ${variant.reason})`;
}

/**
 * Element fields a reference layout.json copies from the testID map when it is rendered. They are
 * the map's, not the render's: check-parity reads them from the current map (withMapMetadata), and
 * shoot-design --check does not compare them, so a metadata fix in the map (a component name, a
 * check) needs no re-render. Everything else in a layout is measured from the design.
 */
export const MAP_METADATA_KEYS = ['role', 'component', 'kind', 'checks', 'mask', 'parent', 'a11yHidden', 'coveredBy', 'a11yLabel', 'state', 'when'];

/** The metadata of one map element as a layout records it (see shoot-design.mjs). */
export function mapMetadataOf(el) {
  return {
    role: el.role,
    component: el.component,
    kind: el.kind ?? null,
    checks: el.checks ?? [],
    mask: el.mask === true,
    parent: el.parent ?? null,
    a11yHidden: el.a11yHidden === true,
    coveredBy: el.coveredBy ?? null,
    a11yLabel: typeof el.a11yLabel === 'string',
    state: el.state ?? null,
    when: el.when ?? null,
  };
}

/**
 * A reference layout with each element's metadata taken from the current map (by testID, within
 * the layout's frame). Elements the map no longer lists keep what the layout recorded.
 */
export function withMapMetadata(layout, frame) {
  if (!frame) return layout;
  const byId = new Map(frame.elements.map((el) => [el.testID, el]));
  return {
    ...layout,
    elements: layout.elements.map((el) => {
      const mapped = byId.get(el.testID);
      return mapped ? { ...el, ...mapMetadataOf(mapped) } : el;
    }),
  };
}

/** Elements that exist for one game: `requires` resolved against the game's modes. */
export function elementsForGame(frame, deck, game) {
  const modes = deck.games?.[game]?.modes ?? [];
  const endless = modes.includes('endless');
  return frame.elements.filter((el) => {
    if (!el.requires) return true;
    if (el.requires === 'endless') return endless;
    if (el.requires === 'no-endless') return !endless;
    if (el.requires.startsWith('game:')) return el.requires.slice(5) === game;
    return true;
  });
}

/** Split "a,b" and repeated options into a clean list. */
export function listOption(values, fallback) {
  const list = (Array.isArray(values) ? values : [values]).filter(Boolean).flatMap((v) => String(v).split(',')).map((v) => v.trim()).filter(Boolean);
  return list.length ? [...new Set(list)] : fallback;
}
