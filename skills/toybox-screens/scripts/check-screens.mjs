#!/usr/bin/env node
// check-screens.mjs: proves the Shell's screen code sets EXACTLY the testIDs of the Toybox
// screen map (none missing, none invented, none from another screen), uses the copy-deck keys
// the design shows, keeps the banner on Home, Levels and Statistics, has one hero key per file,
// has a test for every built screen that audits it for inaccessible pressables, and gives every
// route its model hook with a test. A partial Shell (shell-slice.json) is checked for its screens.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-screens.mjs . [--screen S4] [--all]

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createReporter, fail, parseArgs, readShellSlice, run, sliceSkipReason, toPosix, walk } from './check-lib.mjs';
import {
  BANNER_SCREENS,
  COMPONENT_IDS,
  DEFAULT_DECK,
  DEFAULT_MAP,
  GAME_SCREEN_CALLS,
  ID_PROPS,
  MODEL_HOOK_ROUTES,
  RETIRED_KEYS,
  SCREEN_PATHS,
  SHELL_CATALOGS_DIR,
  SHELL_EXTRA_KEYS,
  TESTID_SHAPE,
  findScreen,
  isDerived,
  isExternalText,
  loadContract,
  structuralParent,
} from './lib/screen-map.mjs';
import {
  bannerUses,
  countHeroKeys,
  scanIdProps,
  scanStrings,
  scanTKeys,
  suffixRegExp,
  templateRegExp,
  testBlocks,
} from './lib/source-scan.mjs';

const SPEC = {
  name: 'check-screens',
  summary:
    'Checks the Shell screens against the Toybox screen map: every testID of a built screen is set ' +
    '(directly, or derived by a Toybox component from the id prop the screen passes it), no testID is ' +
    'invented or borrowed from another screen, the design copy keys are used and exist, the banner stays ' +
    'on Home, Levels and Statistics, one hero key per file, a test per screen that audits accessibility, ' +
    'and every route\'s model hook with its test. Screens outside shell-slice.json print SKIP lines.',
  usage: '[repo-root...] [--screen <id>]... [--all] [options]',
  options: {
    screen: { type: 'string', multiple: true, value: 'id', help: 'Only this screen: S4, S11a, or a scope such as home' },
    all: { type: 'boolean', help: 'Every screen must be built: S1-S15, or every screen of shell-slice.json' },
    map: { type: 'string', value: 'file', help: 'The screen testID map (default: the skill assets/screen-testids.json)' },
    deck: { type: 'string', value: 'file', help: 'The copy deck (default: the skill assets/copy-deck.json)' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: Infinity },
  details: [
    'The repo root is the positional argument (default "."); files of several roots are merged.',
    '',
    'Rules:',
    '  missing-testid       a map testID of a built screen is set nowhere in its files',
    '  unknown-testid       a testID (or testID pattern) that the map does not list (string literal types,',
    '                       get()/set() storage keys and *_KEY constants are not testIDs)',
    '  testid-wrong-screen  a testID of another screen used in this screen\'s files',
    '  missing-copy-key     a copy key the design shows on this screen is not used in its files',
    '  unknown-copy-key     t() is called with a key the copy deck does not have',
    '  banner-not-allowed   the banner slot outside Home, Levels and Statistics',
    '  one-hero-per-screen  more than one size="hero" key in one file',
    '  screen-test-missing  a built screen without a test that finds its testIDs',
    '  screen-test-audit    the screen\'s tests never call findInaccessiblePressables, or a block of its view test',
    '                       (<name>-view/-page/-overlay/-screen.test.tsx, dialogs.test.tsx) renders without it',
    '  overlay-not-modal    an overlay drawn over the Game board (S6 Pause, S7 Result) does not keep',
    '                       VoiceOver inside it (accessibilityViewIsModal, or a DialogCard, which sets it)',
    '  screen-not-built     a screen named with --screen (or any, with --all, or any in shell-slice.json) has no code',
    '  route-model-hook     a route file (home-screen.tsx, pause-overlay.tsx, ...) calls no use-<screen>-model hook',
    '  model-hook-missing   a route file imports ./use-<name>.ts, which does not exist',
    '  model-hook-test      a model hook the route file imports has no use-<name>.test.ts(x) next to it',
    '  extra-key-catalog    a screen uses a Shell text the copy deck lacks (result.win.score-line, the undo',
    '                       and hint labels) and a Shell catalog (packages/shell/src/i18n/catalogs/<lang>.json)',
    '                       lacks it or differs',
    '  retired-copy-key     a screen still uses a retired key (result.win.moves-count: the score line replaced it)',
    '  game-screen-wiring   S5 (screens/game/) never calls topBarPropsOf, resultModelOf, perkOffer or',
    '                       showInterstitialIfDue: the Game screen is only half assembled',
    '',
    'Partial Shell: with shell-slice.json at the repo root ({ "screens": ["S4", "S11"], "why": "..." }),',
    'every rule of a screen outside the slice prints "SKIP <folder> [screen] <S-id> not in shell-slice.json"',
    '(not a problem); a slice screen is checked strictly and must be built. --all means every slice screen.',
    '',
    'A screen is built when its folder holds .ts/.tsx code (see references/screen-frame-and-rules.md',
    'for the folder of each screen). Tests (*.test.ts, *.test.tsx) never count as screen code.',
    '',
    'Examples:',
    '  node check-screens.mjs .                    every screen built so far (and every slice screen)',
    '  node check-screens.mjs . --screen S4        Home only',
    '  node check-screens.mjs . --all              the finished Shell (or the whole slice)',
  ].join('\n'),
};

/** Extra scopes a folder may hold: the tutorial route lives in first-run (navigation). */
const FOLDER_EXTRA_SCOPES = { S2: ['tutorial'] };
/** Exact ids of another screen a folder may use: the tutorial's board host keeps the game's id. */
const FOLDER_EXTRA_IDS = { S2: ['game.board-canvas'] };
/** A line that declares string literal types (`type Key = 'a.b' | 'c.d'`, or a `| 'x'` member). */
const LITERAL_TYPE_LINE = /^\s*(export\s+)?type\s|^\s*\|\s*'/;
/** A constant that names a storage key (`const PENDING_KEY = 'debug.pending-screen'`). */
const STORAGE_KEY_LINE = /\bconst\s+[A-Z0-9_]*KEY[A-Z0-9_]*\s*=/;

function isTestFile(rel) {
  return /\.test\.tsx?$/.test(rel);
}

/** Every .ts/.tsx file of one screen, merged across roots: { rel, abs }. */
function screenFiles(roots, screenId) {
  const files = new Map();
  for (const root of roots) {
    for (const entry of SCREEN_PATHS[screenId]) {
      const isShallow = entry.endsWith('/*');
      const path = isShallow ? entry.slice(0, -1) : entry;
      const abs = join(root, path);
      if (!existsSync(abs)) continue;
      if (statSync(abs).isFile()) {
        files.set(path, abs);
        const test = path.replace(/\.tsx?$/, '.test.tsx');
        if (existsSync(join(root, test))) files.set(test, join(root, test));
        continue;
      }
      for (const rel of walk(abs, { include: ['*.ts', '*.tsx'] })) {
        if (isShallow && rel.includes('/')) continue;
        files.set(toPosix(join(path, rel)), join(abs, rel));
      }
    }
  }
  return [...files.entries()].map(([rel, abs]) => ({ rel, abs }));
}

/** What one screen's code sets: literals, patterns, suffix patterns, t() keys, component id props. */
function indexCode(files) {
  const code = { literals: new Map(), patterns: [], suffixes: [], tKeys: [], idProps: [], files };
  for (const file of files.filter((entry) => !isTestFile(entry.rel))) {
    const raw = readFileSync(file.abs, 'utf8');
    const { plain, templates, source } = scanStrings(raw);
    for (const hit of scanIdProps(raw, ID_PROPS)) code.idProps.push({ ...hit, file: file.rel });
    file.source = source;
    const lines = source.split('\n');
    for (const { value, line, index } of plain) {
      // A string literal type ('debug.overrides' in a union of storage keys), a storage key passed
      // to get()/set() or held in a *_KEY constant is never a testID.
      if (LITERAL_TYPE_LINE.test(lines[line - 1] ?? '') || STORAGE_KEY_LINE.test(lines[line - 1] ?? '')) continue;
      if (/\.(?:get|set)\(\s*$/.test(source.slice(Math.max(0, index - 12), index))) continue;
      if (!code.literals.has(value)) code.literals.set(value, { file: file.rel, line });
    }
    for (const { parts, line } of templates) {
      if (parts[0] === '') {
        const regex = suffixRegExp(parts);
        if (regex) code.suffixes.push({ regex, file: file.rel, line });
      } else if (parts[0].includes('.')) {
        code.patterns.push({ regex: templateRegExp(parts), source: parts.map((p) => p ?? '${…}').join(''), file: file.rel, line });
      }
    }
    for (const key of scanTKeys(source)) code.tKeys.push({ ...key, file: file.rel });
  }
  return code;
}

const ID_SEGMENTS = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*$/;
const POSITION = /^[1-9][0-9]*$/;

/**
 * The bases the screen passes to Toybox components through their id props, as matchers:
 * { rule, test(base) }. A dynamic prop ({scope}) accepts any id-shaped string the screen's code
 * holds (the dialog frame gets 'reset-progress-dialog' from each dialog file).
 */
function baseMatchers(code) {
  const candidates = [...code.literals.keys()].filter((value) => ID_SEGMENTS.test(value));
  return code.idProps.map((hit) => {
    const rule = COMPONENT_IDS[hit.component][hit.prop];
    if (hit.kind === 'literal') return { rule, bases: (id) => (id === hit.value ? [id] : []) };
    if (hit.kind === 'template') {
      const regex = hit.parts[0] === '' ? null : templateRegExp(hit.parts);
      return { rule, bases: (id) => (regex !== null && regex.test(id) ? [id] : []) };
    }
    return { rule, bases: (id) => (candidates.includes(id) ? [id] : []) };
  });
}

/** True when `rest` (the id after "<base>.") is a part the component derives from that base. */
function derivesRest(rule, rest, element, code) {
  if (rule.parts?.includes(rest)) return true;
  if (rule.patterns?.some((pattern) => pattern.test(rest))) return true;
  if (!rule.keyed) return false;
  const [key, ...tail] = rest.split('.');
  if (tail.length > 1) return false;
  if (tail.length === 1 && !rule.keyed.parts.includes(tail[0])) return false;
  if (rule.keyed.key === 'position') return POSITION.test(key);
  const isGameKey = typeof element.requires === 'string' && element.requires.startsWith('game:');
  return isGameKey || code.literals.has(key);
}

/** A map element drawn by a Toybox component from an id prop the screen passes it. */
function isDerivedByProp(element, matchers, code) {
  const segments = element.testID.split('.');
  for (let cut = segments.length - 1; cut >= 1; cut -= 1) {
    const base = segments.slice(0, cut).join('.');
    const rest = segments.slice(cut).join('.');
    for (const matcher of matchers) {
      if (matcher.bases(base).length > 0 && derivesRest(matcher.rule, rest, element, code)) return true;
    }
  }
  return false;
}

function makePresence(screen, code) {
  const memo = new Map();
  const matchers = baseMatchers(code);
  const isBase = (base) => code.literals.has(base) || code.patterns.some((p) => p.regex.test(base)) || present(base);
  function present(testID) {
    if (memo.has(testID)) return memo.get(testID);
    memo.set(testID, false);
    let found = code.literals.has(testID) || code.patterns.some((p) => p.regex.test(testID));
    if (!found) {
      for (const suffix of code.suffixes) {
        const match = suffix.regex.exec(testID);
        if (match && match.index > 0 && isBase(testID.slice(0, match.index))) found = true;
      }
    }
    if (!found && isDerived(screen, testID)) found = present(structuralParent(screen, testID).element.testID);
    const element = screen.byId.get(testID);
    if (!found && element !== undefined) found = isDerivedByProp(element, matchers, code);
    memo.set(testID, found);
    return found;
  }
  return present;
}

function describe(element) {
  const kind = element.kind ? ` (${element.kind})` : '';
  const text = element.text ? `; text ${element.text}` : '';
  return `${element.component}${kind}${text}`;
}

function checkTestIds(ctx, screen, code, report) {
  const present = makePresence(screen, code);
  const where = SCREEN_PATHS[screen.id].join(', ');
  for (const element of screen.byId.values()) {
    if (present(element.testID)) continue;
    report.problem({
      file: SCREEN_PATHS[screen.id][0].replace(/\/\*$/, '/'),
      rule: 'missing-testid',
      message: `${screen.id} ${element.testID} [${describe(element)}] is not set anywhere in ${where}`,
      fix: `Set testID="${element.testID}" on that element (or pass it to the component that derives it), as the skill's template for ${screen.id} does.`,
    });
  }
  const allowedScopes = new Set([...screen.scopes, ...screen.extraScopes, ...(FOLDER_EXTRA_SCOPES[screen.id] ?? [])]);
  // Placement is the wrong-screen rule's job; here any map or Chosen id of an allowed scope is known.
  const known = (id) => [...ctx.screens.values()].some((each) => each.byId.has(id) || each.extraIds.has(id));
  const tKeys = new Set(code.tKeys.map((entry) => entry.key));
  for (const [value, at] of code.literals) {
    if (!TESTID_SHAPE.test(value) || ctx.deckKeys.has(value) || tKeys.has(value)) continue;
    if ((FOLDER_EXTRA_IDS[screen.id] ?? []).includes(value)) continue;
    const scope = value.split('.')[0];
    const owner = ctx.scopeOwner.get(scope);
    if (owner === undefined) continue;
    if (!allowedScopes.has(scope)) {
      report.problem({ ...at, rule: 'testid-wrong-screen', message: `"${value}" belongs to ${owner}, not to ${screen.id}`, fix: `Use this screen's own testID (scope ${screen.scopes.join(' or ')}); another screen's id makes E2E flows and parity checks find the wrong element.` });
    } else if (!known(value) && !isScopeOrPrefix(screen, value)) {
      report.problem({ ...at, rule: 'unknown-testid', message: `"${value}" is not in the screen map for ${screen.id}`, fix: 'Use exactly the map\'s testIDs (list-screen.mjs prints them). If the design really needs a new one, ask for the library map to change; never invent one.' });
    }
  }
  for (const pattern of code.patterns) {
    const scope = pattern.source.split('.')[0];
    if (!ctx.scopeOwner.has(scope)) continue;
    const hits = [...screen.byId.keys(), ...screen.extraIds].some((id) => pattern.regex.test(id));
    const isCopyKeyPattern = [...ctx.deckKeys].some((key) => pattern.regex.test(key));
    if (!hits && !isCopyKeyPattern && !isPrefixPattern(screen, pattern)) {
      report.problem({ file: pattern.file, line: pattern.line, rule: 'unknown-testid', message: `pattern \`${pattern.source}\` matches no testID of ${screen.id}`, fix: 'Check the spelling against the map (list-screen.mjs); a pattern that matches nothing hides a missing testID.' });
    }
  }
}

/** A scope name or a prefix that the code extends with `${base}.part` (dialog scopes, panel ids). */
function isScopeOrPrefix(screen, value) {
  return [...screen.byId.keys(), ...screen.extraIds].some((id) => id.startsWith(`${value}.`));
}

function isPrefixPattern(screen, pattern) {
  const prefix = new RegExp(`${pattern.regex.source.slice(0, -1)}\\.`);
  return [...screen.byId.keys(), ...screen.extraIds].some((id) => prefix.test(id));
}

/** S5 assembles the host's pieces: a screen that only renders the board passes every other rule. */
function checkGameWiring(screen, code, report) {
  if (screen.id !== 'S5') return;
  const sources = code.files.filter((file) => !isTestFile(file.rel)).map((file) => file.source ?? '');
  for (const [call, what] of Object.entries(GAME_SCREEN_CALLS)) {
    if (sources.some((source) => new RegExp(`\\b${call}\\s*\\(`).test(source))) continue;
    report.problem({
      file: SCREEN_PATHS.S5[0],
      rule: 'game-screen-wiring',
      message: `S5 never calls ${call}(): ${what} is missing from the Game screen`,
      fix: `Copy the S5 set from the skill's templates (screens/game/: game-screen.tsx, use-game-screen-model.ts, use-perk-payment.ts, use-result-actions.ts, use-result-extras.ts, use-run-text.ts, game-moves-probe.tsx, each with its test); references/s05-game.md says where ${call} goes.`,
    });
  }
}

function checkCopyKeys(ctx, screen, code, report) {
  const keys = new Set();
  for (const element of screen.byId.values()) {
    for (const key of [element.text, element.a11yLabel]) if (typeof key === 'string' && ctx.deckKeys.has(key) && !isExternalText(key)) keys.add(key);
  }
  for (const key of keys) {
    if (code.literals.has(key) || code.patterns.some((p) => p.regex.test(key))) continue;
    report.problem({ file: SCREEN_PATHS[screen.id][0].replace(/\/\*$/, '/'), rule: 'missing-copy-key', message: `${screen.id} never uses the copy key "${key}" (${JSON.stringify(ctx.deck.strings[key]?.en ?? '')}) that the design shows`, fix: `Render t('${key}') where the design shows it (the reference for ${screen.id} names the element).` });
  }
  for (const { key, file, line } of code.tKeys) {
    if (key in RETIRED_KEYS) {
      report.problem({ file, line, rule: 'retired-copy-key', message: `t('${key}') is retired`, fix: `Use ${RETIRED_KEYS[key]}; the retired text is gone from the Shell catalogs.` });
      continue;
    }
    if (ctx.deckKeys.has(key)) continue;
    report.problem({ file, line, rule: 'unknown-copy-key', message: `t('${key}') is not a copy-deck key`, fix: 'Use the exact key from the copy deck (list-screen.mjs shows each element\'s key); a new text needs a deck and catalog change first.' });
  }
}

function checkFiles(screen, code, report) {
  for (const file of code.files.filter((entry) => !isTestFile(entry.rel))) {
    if (!BANNER_SCREENS.has(screen.id)) {
      for (const line of bannerUses(file.source)) report.problem({ file: file.rel, line, rule: 'banner-not-allowed', message: `${screen.id} renders or imports the banner slot`, fix: 'Banners belong only at the bottom of Home, Levels and Statistics (never Game, Pause, Result, dialogs, Premium); remove it.' });
    }
    const heroes = countHeroKeys(file.source);
    if (heroes.length > 1) report.problem({ file: file.rel, line: heroes[1], rule: 'one-hero-per-screen', message: `${heroes.length} hero keys (size="hero") in one file`, fix: 'One 80 pt hero key per screen: pick its props from the state (see premium-hero.ts) and make the others 54 pt buttons.' });
  }
  const tests = code.files.filter((entry) => isTestFile(entry.rel));
  const ids = [...screen.byId.keys(), ...screen.extraIds];
  const isTested = tests.some((test) => {
    const source = readFileSync(test.abs, 'utf8');
    return ids.some((id) => source.includes(id)) || screen.scopes.some((scope) => source.includes(`${scope}.`));
  });
  if (!isTested) report.problem({ file: SCREEN_PATHS[screen.id][0].replace(/\/\*$/, '/'), rule: 'screen-test-missing', message: `${screen.id} has no test that finds its testIDs`, fix: 'Copy the screen\'s template test (<name>-view.test.tsx) and render the view through renderWithShell.' });
  if (isTested) checkTestAudits(screen, tests, report);
  checkOverlayModal(screen, code, report);
}

const RENDERS = /\brender(?:WithShell)?\s*\(/;
const AUDITS = /\bfindInaccessiblePressables\s*\(/;
/** The screen's own view tests (the templates' names); helper tests elsewhere in the folder need one audit per file. */
const VIEW_TEST = /(?:-view|-page|-overlay|-screen|-splash|-top-bar|\/dialogs)\.test\.tsx$/;

/** Every view-test block that renders the screen also audits it: each state and variant is its own screen for VoiceOver. */
function checkTestAudits(screen, tests, report) {
  const fix = 'End the test with expect(findInaccessiblePressables(screen.container)).toStrictEqual([]) (@e07/shell/testing/find-inaccessible-pressables.ts).';
  let isAudited = false;
  for (const test of tests) {
    if (!VIEW_TEST.test(test.rel)) continue;
    for (const block of testBlocks(readFileSync(test.abs, 'utf8'))) {
      if (!RENDERS.test(block.body)) continue;
      if (AUDITS.test(block.body)) isAudited = true;
      else report.problem({ file: test.rel, line: block.line, rule: 'screen-test-audit', message: `${screen.id} test "${block.name}" renders the screen but never audits it for inaccessible pressables`, fix });
    }
  }
  if (!isAudited && !tests.some((test) => AUDITS.test(readFileSync(test.abs, 'utf8')))) report.problem({ file: tests[0].rel, rule: 'screen-test-audit', message: `${screen.id}'s tests never audit the rendered screen for inaccessible pressables`, fix });
}

/** Overlays that cover the Game board keep VoiceOver inside them. */
const OVERLAY_SCREENS = new Set(['S6', 'S7']);

function checkOverlayModal(screen, code, report) {
  if (!OVERLAY_SCREENS.has(screen.id)) return;
  const views = code.files.filter((entry) => !isTestFile(entry.rel));
  if (views.some((file) => /\baccessibilityViewIsModal\b|<DialogCard\b/.test(file.source ?? ''))) return;
  report.problem({ file: SCREEN_PATHS[screen.id][0].replace(/\/\*$/, '/'), rule: 'overlay-not-modal', message: `${screen.id} covers the Game board but never sets accessibilityViewIsModal, so VoiceOver can wander onto the board underneath`, fix: 'Set accessibilityViewIsModal on the overlay\'s full-screen View (result-overlay.tsx does), or draw it in a DialogCard, which sets it.' });
}


const HOOK_IMPORT = /from\s+'\.\/(use-[a-z0-9-]+)\.ts'/g;
const MODEL_HOOK_CALL = /\buse[A-Z][A-Za-z0-9]*Model\s*\(/;

/** Every route calls its model hook, and every ./use-*.ts it imports exists with a test next to it. */
function checkModelHooks(roots, screen, report) {
  const routes = MODEL_HOOK_ROUTES[screen.id];
  if (routes === undefined) return;
  for (const route of Array.isArray(routes) ? routes : [routes]) checkRouteHooks(roots, screen, route, report);
}

function checkRouteHooks(roots, screen, route, report) {
  const found = roots.map((root) => join(root, route)).find((abs) => existsSync(abs));
  if (found === undefined) return;
  const source = readFileSync(found, 'utf8');
  if (!MODEL_HOOK_CALL.test(source)) report.problem({ file: route, rule: 'route-model-hook', message: `${screen.id}'s route file calls no use<Screen>Model() hook`, fix: 'Keep the route file to "const model = use<Screen>Model(); return <<Screen>View model={model} />": copy the screen\'s use-<screen>-model.ts and its test from the skill\'s templates.' });
  const folder = route.slice(0, route.lastIndexOf('/'));
  for (const match of source.matchAll(HOOK_IMPORT)) {
    const hook = `${folder}/${match[1]}`;
    const exists = (suffix) => roots.some((root) => existsSync(join(root, `${hook}${suffix}`)));
    if (!exists('.ts')) {
      report.problem({ file: route, rule: 'model-hook-missing', message: `${screen.id} imports ./${match[1]}.ts, which does not exist`, fix: `Copy ${hook}.ts and its test from the skill's templates (never a no-op stand-in; in a partial Shell a route outside the slice points at NotBuiltScreen instead).` });
    } else if (!exists('.test.ts') && !exists('.test.tsx')) {
      report.problem({ file: `${hook}.ts`, rule: 'model-hook-test', message: `${screen.id}'s model hook ${match[1]}.ts has no test next to it`, fix: `Copy ${match[1]}.test.tsx from the skill's templates (renderHook through createHostWrapper or createShellWrapper).` });
    }
  }
}

/** Shell texts the deck lacks must be in all four Shell catalogs, exactly (when the repo has them). */
function checkExtraKeys(roots, code, report) {
  const used = new Set(code.tKeys.map((entry) => entry.key).filter((key) => key in SHELL_EXTRA_KEYS));
  for (const literal of code.literals.keys()) if (literal in SHELL_EXTRA_KEYS) used.add(literal);
  if (used.size === 0) return;
  const root = roots.find((each) => existsSync(join(each, SHELL_CATALOGS_DIR, 'en.json')));
  if (root === undefined) return;
  for (const lang of ['en', 'de', 'fa', 'ckb']) {
    const file = `${SHELL_CATALOGS_DIR}/${lang}.json`;
    const abs = join(root, file);
    const catalog = existsSync(abs) ? JSON.parse(readFileSync(abs, 'utf8')) : {};
    for (const key of used) {
      if (catalog[key] === SHELL_EXTRA_KEYS[key][lang]) continue;
      report.problem({ file, rule: 'extra-key-catalog', message: `${key} is ${key in catalog ? 'different' : 'missing'} in the ${lang} Shell catalog`, fix: `Write "${key}": ${JSON.stringify(SHELL_EXTRA_KEYS[key][lang])} into ${file} (keys sorted; the deck lacks this text, so copy-deck.mjs never writes it; fa and ckb await a native review).` });
    }
  }
}

/** The first root's shell-slice.json (a merged run reads each root; the first file wins). */
function sliceOf(roots) {
  for (const root of roots) {
    const slice = readShellSlice(root);
    if (slice !== null) return slice;
  }
  return null;
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const roots = (positionals.length > 0 ? positionals : ['.']).map((root) => resolve(root));
  for (const root of roots) if (!existsSync(root)) fail(`app root ${root} does not exist`, 'Run from the app repo root: node check-screens.mjs . [--screen S4]');
  const slice = sliceOf(roots);
  const ctx = loadContract({ mapPath: options.map ?? DEFAULT_MAP, deckPath: options.deck ?? DEFAULT_DECK });
  const report = createReporter({ name: 'check-screens', json: options.json });
  const wanted = options.screen.map((arg) => findScreen(ctx, arg) ?? fail(`unknown screen "${arg}"`, 'Use S1-S15, S11a-S11d or a scope such as home.'));
  const targets = wanted.length > 0 ? wanted : [...ctx.screens.values()];
  let checked = 0;
  for (const screen of targets) {
    const skipReason = sliceSkipReason(slice, screen.id);
    if (skipReason !== null) {
      report.skip({ file: SCREEN_PATHS[screen.id][0], rule: 'screen', message: skipReason });
      continue;
    }
    const isRequired = options.all || wanted.length > 0 || slice !== null;
    const files = screenFiles(roots, screen.id);
    if (!files.some((file) => !isTestFile(file.rel))) {
      if (isRequired) report.problem({ file: SCREEN_PATHS[screen.id][0], rule: 'screen-not-built', message: `${screen.id} ${screen.name} has no code at ${SCREEN_PATHS[screen.id].join(', ')}`, fix: `Build it from the skill's template and reference for ${screen.id}.` });
      continue;
    }
    checked += 1;
    const code = indexCode(files);
    checkTestIds(ctx, screen, code, report);
    checkCopyKeys(ctx, screen, code, report);
    checkFiles(screen, code, report);
    checkModelHooks(roots, screen, report);
    checkGameWiring(screen, code, report);
    checkExtraKeys(roots, code, report);
  }
  if (checked === 0 && report.count === 0 && slice === null) fail('no screen code found under packages/shell/src', 'Run from the app repo root (node check-screens.mjs .), after building at least one screen.');
  return report.finish({ checked, unit: 'screens' });
});
