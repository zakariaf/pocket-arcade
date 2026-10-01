#!/usr/bin/env node
// check-flows.mjs: checks every Maestro flow of a Pocket Arcade repo without a simulator: where flows
// and sub-flows live, their names, headers and tags, id-only selectors that exist in the testID
// contract, debug-link queries with known parameters, launch with cleared state, smoke flows ending in
// the no-network assertion, quarantine rules, no AI commands, no env blocks shadowing -e variables.
// With --syntax it also runs Maestro's own `check-syntax` on each file.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-flows.mjs [repo-root]

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, fail, parseArgs, readShellSlice, REPO_SCAN_IGNORES, requireDir, run, sliceSkipReason, walk } from './check-lib.mjs';
import { commandOf, parseFlow } from './lib/maestro-yaml.mjs';

const SPEC = {
  name: 'check-flows',
  summary: 'Checks the Maestro flows, sub-flows and the screenshot matrix of the repo against the e2e-maestro rules (no simulator needed).',
  usage: '[options] [repo-root]',
  options: {
    today: { type: 'string', value: 'YYYY-MM-DD', help: 'The date quarantine ages are measured from (default: today)' },
    syntax: { type: 'boolean', help: 'Also run tools/maestro/bin/maestro check-syntax on every file (about 3 s per file)' },
    maestro: { type: 'string', default: 'tools/maestro/bin/maestro', value: 'path', help: 'The Maestro binary for --syntax, relative to the repo root' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Files: packages/shell/e2e/{flows/<area>/,subflows/,screenshots/,storekit/} and apps/<game-id>/e2e/{flows/<area>/,subflows/}.',
    'storekit/ holds the premium-purchase Tier 2 flows (tag storekit, no clearState: they keep the test transactions).',
    '',
    'Rules:',
    '  flow-location        a YAML file outside flows/<area>/, subflows/, screenshots/ or the Shell\'s storekit/ (Maestro would not run it, or would run it alone)',
    '  flow-name            a flow not named <nn>-<kebab-name>.yaml, or a game flow numbered below 10',
    '  flow-parse           the file is not a flow Maestro can read (no --- document, no list of steps)',
    '  flow-header          appId is not ${APP_ID}, or a flow lacks name: or tags:',
    '  flow-tags            an unknown tag, a Shell flow without shell, or a game flow without its game id',
    '  env-shadows-cli      a flow env: block sets APP_ID, APP_SCHEME, LANG or THEME (Maestro 2.10: env: beats -e)',
    '  ai-command           assertWithAI, assertNoDefectsWithAI or extractTextWithAI (uploads screenshots)',
    '  text-selector        a selector by visible text, not id (allowed only under a "# system-ui: <why>" comment)',
    '  retry-app-assertion  retry: around app steps (allowed only under a "# system-ui: <why>" comment)',
    '  first-step-launch    the first step of a flow or the matrix is not launchApp with clearState: true',
    '  raw-open-link        openLink in a flow; state is set only through subflows/debug-setup.yaml',
    '  debug-query          a debug-setup QUERY with an unknown parameter or value',
    '  testid-format        an id that is not <scope>.<element> in kebab-case segments, or an id pattern (a Maestro',
    '                       regular expression such as debug-setup\'s screen-root wait) that does not compile',
    '  unknown-testid       an id that is not in the screen testID contract, the E2E ids or apps/<id>/e2e/testids.json',
    '                       (ids whose last part counts something, result.stars-<n> and the level tiles\' .stars-<n>,',
    '                       take any count; an id pattern must match at least one known id)',
    '  unreachable-testid   an id the map marks crop-only (a part inside an accessible element, "parent", or a decorative',
    '                       part hidden from VoiceOver, "a11yHidden"): Maestro never lists it, so use its coveredBy element',
    '  win-stars            a game flow asserts result.stars-<n> that apps/<game-id>/e2e/testids.json does not list',
    '                       (print-level-line.ts prints the stars the example win earns on level 1)',
    '  mode-flows           a game mode without its flow, read from apps/<game-id>/game.config.ts: modes.daily needs a',
    '                       flow that taps daily.play-button and sends action=win-level (journeys/11-daily.yaml),',
    '                       isContinueAllowed a flow that sends action=lose-level and taps result.continue-premium-button',
    '                       (journeys/12-continue-premium.yaml; E2E builds run with ads off), modes.endless a flow that',
    '                       taps home.endless-card and sends action=lose-level (journeys/13-endless.yaml). With',
    '                       shell-slice.json a mode whose screen (S9 for daily, S7 for the others) is outside the slice is',
    '                       a SKIP line',
    '  progress-after-win   a game smoke flow wins a level (action=win-level) but never shows the stars reaching',
    '                       progress: after the win it must open screen=levels, assert levels.level-tile.1 with a text:',
    '                       filter (the stars in its label) and tap or assert levels.level-tile.2 (level 2 unlocked)',
    '  runflow-missing      runFlow points at a file that does not exist',
    '  subflow-in-flows     a file under flows/ is used as a sub-flow (it would also run on its own and fail)',
    '  smoke-network        a smoke flow does not end with runFlow .../subflows/assert-no-network.yaml',
    '  smoke-quarantine     a smoke flow is quarantined (smoke flows block the release instead)',
    '  quarantine-note      a quarantined flow without "# quarantine YYYY-MM-DD: <reason>", or older than 7 days',
    '  maestro-syntax       (--syntax) maestro check-syntax rejects the file',
    '  flows-missing        no flow exists although the whole Shell is built (no shell-slice.json): the end-to-end',
    '                       step is due. With shell-slice.json (a partial Shell) no flows is a SKIP line, not a problem',
    '  slice                (a SKIP line, never a problem) with shell-slice.json, a flow or the matrix that reaches a',
    '                       screen outside the slice (by its ids, WAIT_FOR, a debug QUERY screen= or its sub-flows) is',
    '                       not checked: "SKIP <flow> [slice] <S-id> not in shell-slice.json". Copy the Shell flows at',
    '                       Shell step 10, once every screen they reach is built',
  ].join('\n'),
};

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, '..', 'assets');
const SELECTOR_COMMANDS = new Set(['tapOn', 'doubleTapOn', 'longPressOn', 'assertVisible', 'assertNotVisible', 'copyTextFrom', 'scrollUntilVisible']);
const CLI_VARS = new Set(['APP_ID', 'APP_SCHEME', 'LANG', 'THEME']);
const BASE_TAGS = new Set(['smoke', 'shell', 'rtl', 'offline', 'a11y', 'quarantine', 'screenshots', 'daily', 'endless', 'premium']);
const TESTID = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/;
const FLOW_NAME = /^(\d{2})-[a-z0-9]+(-[a-z0-9]+)*\.ya?ml$/;
const SYSTEM_UI = /^system-ui:\s*\S.{5,}/;

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const shape = (id) => id.split('.').map((segment) => (/^\d+$/.test(segment) ? '#' : segment)).join('.');
/** A count suffix (result.stars-1, levels.level-tile.7.stars-2): the map says "the suffix is the ... count". */
const countShape = (id) => shape(id).replace(/-\d+$/, '-<n>');
/** Maestro matches id: as a regular expression; an id with these characters is a pattern, not a testID. */
const PATTERN_CHARS = /[()|*+?\\[\]^$]/;
/** Where each debug-link screen= value lands (the navigator route or the game host's example state). */
const DEBUG_SCREEN_IDS = { home: 'S4', levels: 'S8', daily: 'S9', stats: 'S10', settings: 'S11', premium: 'S12', 'how-to-play': 'S13', debug: 'S15', game: 'S5', 'game-start': 'S5', 'game-middle': 'S5', 'result-win': 'S7', 'result-lose': 'S7' };

function knownTestIds(root) {
  const ids = new Set();
  // Crop-only parts: VoiceOver merges them into an accessible ancestor or hides them, so the
  // accessibility tree Maestro reads never holds them (the parity check judges their pixels).
  const unreachable = new Map();
  // Ids whose last part is a count: any count is the same element (result.stars-<n>).
  const counts = new Set();
  // Which screen (S-id) an id or a scope belongs to, for the partial-Shell SKIP.
  const screenOfId = new Map();
  const screenOfScope = new Map();
  const map = readJson(join(ASSETS, 'screen-testids.json'));
  for (const screen of map.screens ?? []) {
    for (const scope of screen.scopes ?? []) if (!screenOfScope.has(scope)) screenOfScope.set(scope, screen.id);
    for (const element of screen.elements ?? []) {
      ids.add(element.testID);
      screenOfId.set(element.testID, screen.id);
      if (/the suffix is the [a-z ]*count/.test(String(element.state ?? ''))) counts.add(countShape(element.testID));
      if (element.parent || element.a11yHidden === true) {
        unreachable.set(element.testID, { why: element.parent ? `a part inside ${element.parent}` : 'hidden from VoiceOver (decorative)', use: element.coveredBy ?? element.parent ?? null });
        // Any count of a crop-only count part is crop-only too; its parent is the id minus the count part.
        if (counts.has(countShape(element.testID)) && element.parent) unreachable.set(countShape(element.testID), { isCountPart: true });
      }
    }
  }
  for (const entry of map.notDrawn ?? []) {
    ids.add(entry.testID);
    if (entry.screen) screenOfId.set(entry.testID, entry.screen);
    const reason = String(entry.reason ?? '').replace(/\([^)]*\)/g, ' ');
    for (const match of reason.matchAll(/([a-z0-9-]+(?:\.[a-z0-9-]+)*)\.\{([a-z0-9,\s-]+)\}/g)) for (const part of match[2].split(',')) ids.add(`${match[1]}.${part.trim()}`);
    for (const match of reason.replace(/[a-z0-9.-]+\.\{[^}]*\}/g, ' ').matchAll(/\b[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+\b/g)) ids.add(match[0]);
  }
  for (const id of Object.keys(readJson(join(ASSETS, 'e2e-testids.json')).testIDs ?? {})) ids.add(id);
  const apps = join(root, 'apps');
  const appIds = new Map();
  if (existsSync(apps)) {
    for (const app of readdirSync(apps)) {
      const extra = join(apps, app, 'e2e', 'testids.json');
      if (!existsSync(extra)) continue;
      const data = readJson(extra);
      const listed = Array.isArray(data) ? data : Object.keys(data.testIDs ?? data);
      appIds.set(app, new Set(listed));
      for (const id of listed) ids.add(id);
    }
  }
  return { ids, shapes: new Set([...ids].map(shape)), counts, unreachable, screenOfId, screenOfScope, appIds };
}

/** A literal testID the contract knows: exactly, by its numbered shape, or as a count id. */
function isKnownId(known, id) {
  return known.ids.has(id) || known.shapes.has(shape(id)) || known.counts.has(countShape(id));
}

/** A Maestro id pattern as a JavaScript regular expression (whole-id match), or null if it does not compile. */
function patternOf(id) {
  try {
    return new RegExp(`^(?:${id})$`);
  } catch {
    return null;
  }
}

/** The screen an id belongs to: its map entry, else its scope (the part before the first dot). */
function screenOf(known, id) {
  return known.screenOfId.get(id) ?? known.screenOfId.get([...known.ids].find((knownId) => shape(knownId) === shape(id)) ?? '') ?? known.screenOfScope.get(id.split('.')[0]) ?? null;
}

function classify(rel) {
  const match = /^(packages\/shell|apps\/([^/]+))\/e2e\/(.+)$/.exec(rel);
  if (!match) return null;
  const [, workspace, game = null, rest] = match;
  const parts = rest.split('/');
  if (parts[0] === 'flows' && parts.length === 3) return { kind: 'flow', workspace, game, area: parts[1], name: parts[2] };
  if (parts[0] === 'subflows' && parts.length === 2) return { kind: 'subflow', workspace, game };
  if (parts[0] === 'screenshots' && parts.length === 2 && game === null) return { kind: 'screenshots', workspace, game };
  // The premium-purchase skill's Tier 2 StoreKit flows: run only by its harness on an armed build,
  // never by e2e:ios, and never with clearState (that would delete the test transactions).
  if (parts[0] === 'storekit' && parts.length === 2 && game === null) return { kind: 'storekit', workspace, game };
  return { kind: 'misplaced', workspace, game, parts };
}

/** Walk a parsed value and call visit(key, value, parentKey) for every map entry, depth first. */
function visitMaps(value, visit, parentKey = null) {
  if (Array.isArray(value)) {
    for (const item of value) visitMaps(item, visit, parentKey);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      visit(key, child, parentKey, value);
      visitMaps(child, visit, key);
    }
  }
}

function hasSystemUiComment(comments, line) {
  return comments.some((comment) => comment.line < line && comment.line >= line - 6 && SYSTEM_UI.test(comment.text));
}

function checkQuery(rel, line, query, params, report) {
  for (const pair of String(query).split('&')) {
    if (pair.trim() === '' || pair.includes('${')) continue;
    const [name, value = ''] = pair.split('=');
    const spec = params[name];
    const problem = (message) => report.problem({ file: rel, line, rule: 'debug-query', message, fix: 'Use only the parameters and values of the debug deep link (references/debug-deep-link.md); add a new one to the Shell\'s debug module and this skill together.' });
    if (!spec) problem(`unknown debug parameter "${name}"`);
    else if (spec.values && !spec.values.includes(value)) problem(`${name}=${value} is not one of ${spec.values.join(', ')}`);
    else if (spec.kind === 'integer' && !/^\d+$/.test(value)) problem(`${name}=${value} is not an integer`);
    else if (spec.kind === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) problem(`${name}=${value} is not a YYYY-MM-DD date`);
    else if (spec.kind === 'stars' && !/^(demo|\d+:[0-3](,\d+:[0-3])*)$/.test(value)) problem(`${name}=${value} is not demo or <level>:<stars>,...`);
  }
}

function checkIds(rel, parsed, known, report) {
  const seen = [];
  visitMaps(parsed.steps, (key, value, parentKey, owner) => {
    if (key === 'id' && typeof value === 'string') seen.push({ id: value, line: owner.lines?.[key] ?? 0 });
    if (key === 'WAIT_FOR' && typeof value === 'string') seen.push({ id: value, line: owner.lines?.[key] ?? 0 });
  });
  for (const { id, line } of seen) {
    if (id.includes('${')) continue;
    if (PATTERN_CHARS.test(id)) {
      checkIdPattern(rel, line, id, known, report);
      continue;
    }
    const unreachable = known.unreachable?.get(id) ?? countPartOf(known, id);
    if (!TESTID.test(id)) report.problem({ file: rel, line, rule: 'testid-format', message: `id "${id}" is not <scope>.<element> in kebab-case`, fix: 'Use the screen\'s testID: <screen>.<element>[.<key>], every segment [a-z0-9]+(-[a-z0-9]+)*.' });
    else if (!isKnownId(known, id)) report.problem({ file: rel, line, rule: 'unknown-testid', message: `id "${id}" is not in the testID contract`, fix: 'Use an id from assets/screen-testids.json or assets/e2e-testids.json; a game-only id goes into apps/<game-id>/e2e/testids.json together with the code that renders it.' });
    else if (unreachable !== undefined) {
      const { why, use } = unreachable;
      report.problem({ file: rel, line, rule: 'unreachable-testid', message: `id "${id}" is crop-only (${why}), so Maestro never finds it`, fix: `Select ${use === null ? 'its accessible ancestor' : `"${use}"`} instead (assert its text through that element's label); crop-only parts are judged by the parity check, not by flows.` });
    }
  }
}

/** A crop-only count part not listed by number (levels.level-tile.12.stars-1): inside its parent. */
function countPartOf(known, id) {
  if (known.unreachable?.get(countShape(id))?.isCountPart !== true) return undefined;
  const parent = id.split('.').slice(0, -1).join('.');
  return { why: `a part inside ${parent}`, use: parent };
}

/** An id: pattern (debug-setup's screen-root wait) must compile and match at least one known id. */
function checkIdPattern(rel, line, id, known, report) {
  const pattern = patternOf(id);
  if (pattern === null) report.problem({ file: rel, line, rule: 'testid-format', message: `id pattern "${id}" is not a valid regular expression`, fix: 'Fix the pattern (Maestro matches id: as a regular expression over the whole testID), or select one testID.' });
  else if (![...known.ids].some((knownId) => pattern.test(knownId))) report.problem({ file: rel, line, rule: 'unknown-testid', message: `id pattern "${id}" matches no testID of the contract`, fix: 'Match real testIDs (screen roots are <scope>.screen); check assets/screen-testids.json.' });
}

/**
 * A game flow's star count is a fact of the game (the stars testing.examples.win() earns on level 1
 * through action=win-level, or the stars a tapped line earns): the game's e2e/testids.json lists
 * that result.stars-<n>, with why, so a changed example or star rule is seen in review.
 */
function checkWinStars(rel, info, parsed, known, report) {
  if (info.kind !== 'flow' || info.game === null) return;
  const listed = known.appIds.get(info.game) ?? new Set();
  visitMaps(parsed.steps, (key, value, parentKey, owner) => {
    if (key !== 'id' || typeof value !== 'string' || !/^result\.stars-\d+$/.test(value) || listed.has(value)) return;
    report.problem({ file: rel, line: owner.lines?.[key] ?? 0, rule: 'win-stars', message: `asserts ${value}, which apps/${info.game}/e2e/testids.json does not list`, fix: `Run print-level-line.ts --app ${info.game} --level 1 (it prints the stars the example win earns), then list "${value}" with that reason in apps/${info.game}/e2e/testids.json, or assert the count it prints.` });
  });
}

const VARIABLE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** A value with every ${NAME} replaced from env, or null when a name is not known here. */
function substitute(value, env) {
  if (value === null || value === undefined || typeof value === 'object') return null;
  let isComplete = true;
  const text = String(value).replace(VARIABLE, (whole, name) => {
    if (Object.hasOwn(env, name)) return env[name];
    isComplete = false;
    return whole;
  });
  return isComplete ? text : null;
}

/**
 * Follows a runFlow that passes literal env values into the sub-flows it reaches (Maestro sub-flows see
 * their callers' variables) and checks every id, WAIT_FOR and debug QUERY those sub-flows build from
 * ${...}: shoot-screen.yaml with SCREEN=game-start would otherwise wait 15 s for a testID that never exists.
 */
function checkPassedValues(ctx, fileRel, env, depth, origin) {
  if (depth > 4 || Object.keys(env).length === 0) return;
  const parsed = ctx.parse(fileRel);
  if (parsed === null) return;
  const passed = Object.entries(origin.env).map(([key, value]) => `${key}=${value}`).join(', ');
  visitMaps(parsed.steps, (key, value) => {
    if ((key !== 'id' && key !== 'WAIT_FOR') || typeof value !== 'string' || !value.includes('${')) return;
    const id = substitute(value, env);
    if (id === null || origin.checked.has(id) || (TESTID.test(id) && isKnownId(ctx.known, id))) return;
    origin.checked.add(id);
    ctx.report.problem({ file: ctx.rel, line: origin.line, rule: 'unknown-testid', message: `runFlow ${origin.file} with ${passed} makes ${posix.basename(fileRel)} use id "${id}", which is not in the testID contract`, fix: 'Pass values that build real testIDs (screen roots are <route>.screen: game.screen, result.screen), or pass the id itself; check assets/screen-testids.json.' });
  });
  for (const target of runFlowTargets(parsed)) {
    if (target.file.includes('${')) continue;
    const next = posix.normalize(posix.join(posix.dirname(fileRel), target.file));
    if (!existsSync(join(ctx.root, next))) continue;
    const childEnv = { ...env };
    const derived = {};
    for (const [key, value] of Object.entries(target.env ?? {})) {
      const resolved = substitute(value, env);
      if (resolved === null) delete childEnv[key];
      else {
        childEnv[key] = resolved;
        if (String(value).includes('${')) derived[key] = resolved;
      }
    }
    if (derived.QUERY !== undefined && /debug-setup\.ya?ml$/.test(next)) checkQuery(ctx.rel, origin.line, derived.QUERY, ctx.params, ctx.report);
    checkPassedValues(ctx, next, childEnv, depth + 1, origin);
  }
}

function checkSelectors(rel, parsed, report) {
  visitMaps(parsed.steps, (key, value, parentKey, owner) => {
    const line = owner.lines?.[key] ?? 0;
    const isTextScalar = typeof value === 'string' && (SELECTOR_COMMANDS.has(key) || key === 'visible' || key === 'notVisible');
    const isTextMap = value && typeof value === 'object' && !Array.isArray(value) && (SELECTOR_COMMANDS.has(key) || key === 'visible' || key === 'notVisible') && typeof value.text === 'string' && value.id === undefined && value.point === undefined;
    if ((isTextScalar || isTextMap) && !hasSystemUiComment(parsed.comments, line)) report.problem({ file: rel, line, rule: 'text-selector', message: `${key} selects by visible text ("${String(isTextScalar ? value : value.text).slice(0, 40)}")`, fix: 'Select by id (testID): flows run unchanged in four languages. Only OS-owned UI may use text, under a "# system-ui: <why>" comment.' });
    if (key === 'retry' && !hasSystemUiComment(parsed.comments, line)) report.problem({ file: rel, line, rule: 'retry-app-assertion', message: 'retry: wraps steps', fix: 'Fix the wait (extendedWaitUntil on an id) or the setup instead; retry only around OS-owned UI, under a "# system-ui: <why>" comment.' });
  });
}

function checkAiCommands(rel, text, report) {
  text.split('\n').forEach((line, index) => {
    const match = /^\s*-\s*(assertWithAI|assertNoDefectsWithAI|extractTextWithAI)\b/.exec(line);
    if (match) report.problem({ file: rel, line: index + 1, rule: 'ai-command', message: `${match[1]} uploads screenshots to a third-party service`, fix: 'Assert by id and text; review screenshots with the Read tool.' });
  });
}

const SCREEN_ORDER = (id) => {
  const match = /^S(\d+)([a-z]?)$/.exec(id);
  return match ? Number(match[1]) * 10 + (match[2] ? match[2].charCodeAt(0) - 96 : 0) : 999;
};

/**
 * The screens a flow reaches: its literal ids and WAIT_FOR/ROOT values, the screen= of its debug
 * QUERYs and SCREEN values, and the same inside every sub-flow it runs (assert-no-network opens S15).
 */
function screensOf(ctx, fileRel, seen = new Set()) {
  const screens = new Set();
  if (seen.has(fileRel) || seen.size > 20) return screens;
  seen.add(fileRel);
  const parsed = ctx.parse(fileRel);
  if (parsed === null) return screens;
  const addId = (value) => {
    if (typeof value !== 'string' || !TESTID.test(value)) return;
    const screen = screenOf(ctx.known, value);
    if (screen !== null) screens.add(screen);
  };
  const addScreen = (value) => {
    if (Object.hasOwn(DEBUG_SCREEN_IDS, value)) screens.add(DEBUG_SCREEN_IDS[value]);
  };
  visitMaps(parsed.steps, (key, value) => {
    if (key === 'id' || key === 'WAIT_FOR' || key === 'ROOT') addId(value);
    if (key === 'SCREEN') addScreen(String(value));
    if (key === 'QUERY') for (const pair of String(value).split('&')) if (pair.startsWith('screen=')) addScreen(pair.slice('screen='.length));
  });
  for (const target of runFlowTargets(parsed)) {
    const next = posix.normalize(posix.join(posix.dirname(fileRel), target.file));
    if (!target.file.includes('${') && existsSync(join(ctx.root, next))) for (const screen of screensOf(ctx, next, seen)) screens.add(screen);
  }
  return screens;
}

/** With shell-slice.json: why a flow cannot run yet (the first screen it reaches outside the slice), or null. */
function sliceReasonOf(ctx, rel, slice) {
  if (slice === null) return null;
  const screens = [...screensOf(ctx, rel)].sort((a, b) => SCREEN_ORDER(a) - SCREEN_ORDER(b));
  return screens.map((screen) => sliceSkipReason(slice, screen)).find((reason) => reason !== null) ?? null;
}

function runFlowTargets(parsed) {
  const targets = [];
  visitMaps(parsed.steps, (key, value, parentKey, owner) => {
    if (key !== 'runFlow') return;
    const line = owner.lines?.[key] ?? 0;
    if (typeof value === 'string') targets.push({ file: value, env: {}, line });
    else if (value && typeof value === 'object' && typeof value.file === 'string') targets.push({ file: value.file, env: value.env ?? {}, line });
  });
  return targets;
}

function checkHeader(rel, info, parsed, gameIds, report) {
  const header = parsed.header ?? {};
  const line = (key) => header.lines?.[key] ?? 1;
  if (header.appId !== '${APP_ID}') report.problem({ file: rel, line: line('appId'), rule: 'flow-header', message: `appId is ${JSON.stringify(header.appId ?? null)}, not \${APP_ID}`, fix: 'Write appId: ${APP_ID}; the runner passes the bundle id with -e.' });
  const env = header.env && typeof header.env === 'object' ? Object.keys(header.env) : [];
  for (const name of env.filter((key) => CLI_VARS.has(key))) report.problem({ file: rel, line: line('env'), rule: 'env-shadows-cli', message: `env: sets ${name}, which the runner passes with -e`, fix: `Remove ${name} from env:; in Maestro 2.10 the flow's env: value wins over -e, so every run would use the flow's value.` });
  if (info.kind === 'subflow') return;
  if (info.kind === 'flow' && (typeof header.name !== 'string' || header.name.trim() === '')) report.problem({ file: rel, line: 1, rule: 'flow-header', message: 'has no name:', fix: 'Add name: <what the journey proves, in a sentence> (it becomes the JUnit test name).' });
  const tags = Array.isArray(header.tags) ? header.tags.map(String) : [];
  if (tags.length === 0) {
    report.problem({ file: rel, line: 1, rule: 'flow-header', message: 'has no tags:', fix: info.game ? `Add tags: [smoke, ${info.game}] (or without smoke).` : 'Add tags: [smoke, shell] (or [shell, rtl], ...).' });
    return;
  }
  for (const tag of tags) if (!BASE_TAGS.has(tag) && !gameIds.has(tag) && !(info.kind === 'storekit' && tag === 'storekit')) report.problem({ file: rel, line: line('tags'), rule: 'flow-tags', message: `unknown tag "${tag}"`, fix: 'Use smoke, shell, rtl, offline, a11y, quarantine, screenshots, daily, endless, premium or a game id.' });
  if (info.kind === 'flow' && info.game === null && !tags.includes('shell')) report.problem({ file: rel, line: line('tags'), rule: 'flow-tags', message: 'a Shell flow without the shell tag', fix: 'Add shell to tags.' });
  if (info.kind === 'flow' && info.game !== null && !tags.includes(info.game)) report.problem({ file: rel, line: line('tags'), rule: 'flow-tags', message: `a ${info.game} flow without the ${info.game} tag`, fix: `Add ${info.game} to tags.` });
  return tags;
}

function checkQuarantine(rel, tags, parsed, today, report) {
  if (!tags.includes('quarantine')) return;
  if (tags.includes('smoke')) report.problem({ file: rel, line: parsed.header?.lines?.tags ?? 1, rule: 'smoke-quarantine', message: 'a smoke flow is quarantined', fix: 'Fix it now: a failing smoke flow blocks the release; quarantine is only for non-smoke flows.' });
  const note = parsed.comments.map((comment) => /^quarantine (\d{4}-\d{2}-\d{2}):\s*(\S.*)$/.exec(comment.text)).find(Boolean);
  if (!note) {
    report.problem({ file: rel, line: 1, rule: 'quarantine-note', message: 'quarantined without a "# quarantine YYYY-MM-DD: <reason>" comment', fix: 'Add the comment with today\'s date and the reason, report it, and fix the flow within 7 days.' });
    return;
  }
  const age = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${note[1]}T00:00:00Z`)) / 86_400_000;
  if (age > 7) report.problem({ file: rel, line: 1, rule: 'quarantine-note', message: `quarantined since ${note[1]} (${Math.round(age)} days)`, fix: 'Fix the flow (the wait, the setup or the app) and remove quarantine from its tags; the limit is 7 days.' });
}

function checkSteps(rel, info, parsed, tags, params, report) {
  const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
  if (info.kind !== 'subflow' && info.kind !== 'storekit') {
    const first = commandOf(steps[0]);
    if (first.name !== 'launchApp' || first.arg?.clearState !== true) report.problem({ file: rel, line: steps.lines?.[0] ?? 1, rule: 'first-step-launch', message: `starts with ${first.name || 'nothing'} instead of launchApp with clearState: true`, fix: 'Begin with - launchApp: { clearState: true } so every run starts from the same state.' });
  }
  if (info.kind === 'flow') {
    visitMaps(steps, (key, value, parentKey, owner) => {
      if (key === 'openLink') report.problem({ file: rel, line: owner.lines?.[key] ?? 0, rule: 'raw-open-link', message: 'opens a link directly', fix: 'Set state through runFlow: { file: <...>/subflows/debug-setup.yaml, env: { QUERY, WAIT_FOR } }.' });
    });
  }
  for (const target of runFlowTargets(parsed)) {
    if (target.env && typeof target.env === 'object' && typeof target.env.QUERY === 'string' && /debug-setup\.ya?ml$/.test(target.file)) checkQuery(rel, target.line, target.env.QUERY, params, report);
  }
  if (tags.includes('smoke')) {
    const last = commandOf(steps[steps.length - 1]);
    const file = typeof last.arg === 'string' ? last.arg : last.arg?.file;
    if (last.name !== 'runFlow' || typeof file !== 'string' || !file.endsWith('subflows/assert-no-network.yaml')) report.problem({ file: rel, line: steps.lines?.[steps.length - 1] ?? 1, rule: 'smoke-network', message: 'a smoke flow does not end with the no-network assertion', fix: 'End it with - runFlow: <relative path>/subflows/assert-no-network.yaml (spec N3: the JS guard counted zero attempts).' });
  }
}

/** The debug QUERYs a flow sends through debug-setup.yaml, in step order, and the ids it taps or asserts. */
function flowActions(parsed) {
  const events = [];
  visitMaps(parsed.steps, (key, value, parentKey, owner) => {
    if (key === 'runFlow' && value && typeof value === 'object' && typeof value.env?.QUERY === 'string') events.push({ kind: 'query', query: value.env.QUERY });
    if (SELECTOR_COMMANDS.has(key) && value && typeof value === 'object' && typeof value.id === 'string') events.push({ kind: key, id: value.id, text: value.text, line: owner.lines?.[key] ?? 0 });
  });
  return events;
}

const hasQuery = (events, pattern) => events.some((event) => event.kind === 'query' && pattern.test(event.query));
const tapped = (events, id) => events.some((event) => event.kind === 'tapOn' && event.id === id);

/** The game modes of apps/<game>/game.config.ts (null when there is no config to read). */
function gameModes(root, game) {
  const rel = `apps/${game}/game.config.ts`;
  if (!existsSync(join(root, rel))) return null;
  const text = readFileSync(join(root, rel), 'utf8').replace(/\/\/[^\n]*/g, '');
  const flag = (pattern) => pattern.exec(text)?.[1] === 'true';
  return { rel, daily: flag(/\bdaily\s*:\s*(true|false)/), endless: flag(/\bendless\s*:\s*(true|false)/), continues: flag(/\bisContinueAllowed\s*:\s*(true|false)/) };
}

const MODE_FLOWS = [
  { key: 'daily', screen: 'S9', template: 'journeys/11-daily.yaml', what: 'plays today\'s daily (tap daily.play-button, then action=win-level)', found: (events) => tapped(events, 'daily.play-button') && hasQuery(events, /(^|&)action=win-level(&|$)/) },
  { key: 'continues', screen: 'S7', template: 'journeys/12-continue-premium.yaml', what: 'continues after a loss (action=lose-level, then tap result.continue-premium-button; E2E builds run with ads off)', found: (events) => hasQuery(events, /(^|&)action=lose-level(&|$)/) && tapped(events, 'result.continue-premium-button') },
  { key: 'endless', screen: 'S7', template: 'journeys/13-endless.yaml', what: 'plays an endless run to its end (tap home.endless-card, then action=lose-level)', found: (events) => tapped(events, 'home.endless-card') && hasQuery(events, /(^|&)action=lose-level(&|$)/) },
];

/** Each mode the game has needs a flow that plays it (spec: the daily, continue and endless journeys). */
function checkModeFlows(root, flowsByGame, slice, report) {
  for (const [game, flows] of flowsByGame) {
    const modes = gameModes(root, game);
    if (modes === null) continue;
    for (const mode of MODE_FLOWS) {
      if (!modes[mode.key]) continue;
      const skip = sliceSkipReason(slice, mode.screen);
      if (skip !== null) {
        report.skip({ file: modes.rel, rule: 'mode-flows', message: skip });
        continue;
      }
      if (flows.some((events) => mode.found(events))) continue;
      const flag = mode.key === 'continues' ? 'isContinueAllowed' : `modes.${mode.key}`;
      report.problem({ file: modes.rel, line: 0, rule: 'mode-flows', message: `${flag} is true, but no flow of apps/${game}/e2e/flows/ ${mode.what}`, fix: `Copy this skill's templates/apps/__GAME_ID__/e2e/flows/${mode.template} to apps/${game}/e2e/flows/${mode.template} and fill __GAME_ID__ and __GAME_NAME__ (references/flows.md, "A game's mode flows").` });
    }
  }
}

/** A game smoke flow that wins a level shows the stars reaching Levels and level 2 opening. */
function checkProgressAfterWin(rel, info, parsed, tags, report) {
  if (info.kind !== 'flow' || info.game === null || !tags.includes('smoke')) return;
  const events = flowActions(parsed);
  const win = events.findIndex((event) => event.kind === 'query' && /(^|&)action=win-level(&|$)/.test(event.query));
  if (win === -1) return;
  const after = events.slice(win + 1);
  const opensLevels = hasQuery(after, /(^|&)screen=levels(&|$)/);
  const stars = after.some((event) => event.kind === 'assertVisible' && event.id === 'levels.level-tile.1' && typeof event.text === 'string');
  const unlocked = after.some((event) => (event.kind === 'tapOn' || event.kind === 'assertVisible') && event.id === 'levels.level-tile.2');
  if (opensLevels && stars && unlocked) return;
  const missing = [opensLevels ? null : 'open screen=levels', stars ? null : "assert levels.level-tile.1 with text: (the stars in its label)", unlocked ? null : 'tap levels.level-tile.2 (level 2 unlocked)'].filter(Boolean).join(', ');
  report.problem({ file: rel, line: 1, rule: 'progress-after-win', message: `wins a level but never proves the stars reached progress: after action=win-level it does not ${missing}`, fix: "Add the Levels steps of this skill's templates/apps/__GAME_ID__/e2e/flows/smoke/10-level-1.yaml after the win: screen=levels, levels.level-tile.1 with text: '.*[^0-9]<stars> .*', then tap levels.level-tile.2 and wait for game.screen." });
}

const FLOWS_DIR = 'packages/shell/e2e/flows';

/**
 * No flow at all. While shell-slice.json says the Shell is partial, the flows are not due yet (they
 * come after every screen): SKIP. Without the file the whole Shell exists and the end-to-end step
 * is due: a problem (exit 1), never a silent pass. A folder that is no repo stays bad input (exit 2).
 */
function noFlows(root, report) {
  if (!existsSync(join(root, 'package.json'))) fail(`nothing to check: ${root} has no package.json and no Maestro flows`, 'Run from the repo root or pass the repo root.');
  const slice = readShellSlice(root);
  if (slice !== null) {
    report.skip({ file: FLOWS_DIR, rule: 'flows-missing', message: `no Maestro flows yet: ${slice.file} marks a partial Shell (${slice.why}); the flows are due at the Shell build order's end-to-end step, after every screen` });
  } else {
    report.problem({ file: FLOWS_DIR, line: 0, rule: 'flows-missing', message: 'no Maestro flow exists, but the whole Shell is built (no shell-slice.json), so the end-to-end step of the Shell build order is due', fix: "Copy this skill's Shell flows (templates/packages/shell/e2e/flows/: smoke/01-first-launch.yaml, journeys/02-core-journey-offline.yaml, rtl/03-language-switch.yaml), each game's apps/<game-id>/e2e/flows/smoke/10-level-1.yaml and the sub-flows, then rerun." });
  }
  return report.finish({ checked: 0, unit: 'flow files' });
}

function checkSyntax(root, rels, maestro, report) {
  const bin = join(root, maestro);
  if (!existsSync(bin)) fail(`--syntax needs Maestro at ${maestro}`, 'Run bash packages/tooling/scripts/install-maestro.sh first (or pass --maestro <path>).');
  const javaHome = process.env.JAVA_HOME ?? '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
  const env = { ...process.env, JAVA_HOME: javaHome, MAESTRO_CLI_NO_ANALYTICS: 'true', MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true', MAESTRO_DISABLE_UPDATE_CHECK: 'true' };
  for (const rel of rels) {
    const result = spawnSync(bin, ['check-syntax', join(root, rel)], { encoding: 'utf8', env, timeout: 120000 });
    if (result.status !== 0) report.problem({ file: rel, line: 1, rule: 'maestro-syntax', message: `maestro check-syntax: ${`${result.stdout}${result.stderr}`.trim().split('\n').pop()}`, fix: 'Fix the command or property name (Maestro 2.10 commands only).' });
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) fail(`--today ${today} is not YYYY-MM-DD`, 'Pass a date like 2026-09-28.');
  const report = createReporter({ name: SPEC.name, json: options.json });
  const rels = walk(root, { include: ['*.yaml', '*.yml'], ignore: [...REPO_SCAN_IGNORES, 'reports', 'tools/**'] }).filter((rel) => /^(packages\/shell|apps\/[^/]+)\/e2e\//.test(rel));
  if (rels.length === 0) return noFlows(root, report);
  const known = knownTestIds(root);
  const params = readJson(join(ASSETS, 'debug-link-params.json')).params;
  const gameIds = new Set(existsSync(join(root, 'apps')) ? readdirSync(join(root, 'apps')) : []);
  const usedAsSubflow = new Map();
  const parsedFiles = new Map();
  const parseCached = (fileRel) => {
    if (!parsedFiles.has(fileRel)) {
      const flow = parseFlow(readFileSync(join(root, fileRel), 'utf8'));
      parsedFiles.set(fileRel, flow.error || !Array.isArray(flow.steps) ? null : flow);
    }
    return parsedFiles.get(fileRel);
  };
  const slice = readShellSlice(root);
  const flowsByGame = new Map();
  for (const rel of rels) {
    const info = classify(rel);
    if (info === null) continue;
    if (info.kind === 'misplaced') {
      report.problem({ file: rel, line: 1, rule: 'flow-location', message: 'is not in flows/<area>/, subflows/, screenshots/ or (Shell only) storekit/', fix: 'Move it: journeys to <workspace>/e2e/flows/<area>/<nn>-<name>.yaml, shared steps to packages/shell/e2e/subflows/, the matrix to packages/shell/e2e/screenshots/, Tier 2 StoreKit flows to packages/shell/e2e/storekit/.' });
      continue;
    }
    // A partial Shell: a flow that reaches a screen outside the slice cannot run yet (Shell step 10).
    const sliceReason = info.kind === 'flow' || info.kind === 'screenshots' ? sliceReasonOf({ root, known, parse: parseCached }, rel, slice) : null;
    if (sliceReason !== null) {
      report.skip({ file: rel, rule: 'slice', message: sliceReason });
      continue;
    }
    if (info.kind === 'flow') {
      const name = FLOW_NAME.exec(info.name);
      if (!name) report.problem({ file: rel, line: 1, rule: 'flow-name', message: `"${info.name}" is not <nn>-<kebab-name>.yaml`, fix: 'Rename it, for example 02-core-journey-offline.yaml (two digits, then kebab-case).' });
      else if (info.game !== null && Number(name[1]) < 10) report.problem({ file: rel, line: 1, rule: 'flow-name', message: `a game flow numbered ${name[1]}`, fix: 'Game flows start at 10 (Shell flows own 01-09), so the combined run keeps a stable order.' });
    }
    const text = readFileSync(join(root, rel), 'utf8');
    checkAiCommands(rel, text, report);
    const parsed = parseFlow(text);
    if (parsed.error || !Array.isArray(parsed.steps) || (info.kind !== 'subflow' && parsed.header === null)) {
      report.problem({ file: rel, line: 1, rule: 'flow-parse', message: parsed.error ? `cannot be read: ${parsed.error}` : 'has no header, --- line and list of steps', fix: 'Write appId/name/tags, a line ---, then the steps as a YAML list.' });
      continue;
    }
    const tags = checkHeader(rel, info, parsed, gameIds, report) ?? [];
    checkQuarantine(rel, tags, parsed, today, report);
    checkSteps(rel, info, parsed, tags, params, report);
    checkSelectors(rel, parsed, report);
    checkIds(rel, parsed, known, report);
    checkWinStars(rel, info, parsed, known, report);
    checkProgressAfterWin(rel, info, parsed, tags, report);
    if (info.kind === 'flow' && info.game !== null) flowsByGame.set(info.game, [...(flowsByGame.get(info.game) ?? []), flowActions(parsed)]);
    for (const target of runFlowTargets(parsed)) {
      if (target.file.includes('${')) continue;
      const resolved = posix.normalize(posix.join(posix.dirname(rel), target.file));
      if (!existsSync(join(root, resolved))) {
        report.problem({ file: rel, line: target.line, rule: 'runflow-missing', message: `runFlow ${target.file} does not exist (${resolved})`, fix: 'Fix the relative path; from a game flow the Shell sub-flows are five levels up: packages/shell/e2e/subflows/<name>.yaml.' });
        continue;
      }
      if (!usedAsSubflow.has(resolved)) usedAsSubflow.set(resolved, { from: rel, line: target.line });
      if (info.kind === 'subflow') continue;
      const env = {};
      for (const [key, value] of Object.entries(target.env ?? {})) {
        const literal = substitute(value, {});
        if (literal !== null) env[key] = literal;
      }
      const checked = new Set(['WAIT_FOR', 'id'].map((key) => env[key]).filter((value) => value !== undefined));
      checkPassedValues({ root, rel, known, params, report, parse: parseCached }, resolved, env, 1, { line: target.line, file: target.file, env, checked });
    }
  }
  for (const [target, { from, line }] of usedAsSubflow) {
    if (/\/e2e\/flows\//.test(target)) report.problem({ file: from, line, rule: 'subflow-in-flows', message: `uses ${target} as a sub-flow, but it sits under flows/`, fix: 'Move shared steps to packages/shell/e2e/subflows/ (files under flows/ run on their own).' });
  }
  checkModeFlows(root, flowsByGame, slice, report);
  if (options.syntax) checkSyntax(root, rels, options.maestro, report);
  return report.finish({ checked: rels.length, unit: 'flow files' });
});
