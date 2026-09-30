// screen-map.mjs: reads the screen testID map and the copy deck, and knows where each screen
// lives in the app repo and which Toybox components derive which testID parts.
// Helper for check-screens.mjs and list-screen.mjs (not an entry point).

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fail } from '../check-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SKILL_DIR = resolve(HERE, '..', '..');
export const DEFAULT_MAP = join(SKILL_DIR, 'assets', 'screen-testids.json');
export const DEFAULT_DECK = join(SKILL_DIR, 'assets', 'copy-deck.json');
export const DEFAULT_REFERENCES = join(SKILL_DIR, 'assets', 'reference');

const SHELL = 'packages/shell/src';

/**
 * Where each screen's code lives. A path ending in "/" is a folder (every .ts/.tsx below it);
 * "/*" is a folder without its subfolders (S11's subfolders are the S11a-d screens).
 */
export const SCREEN_PATHS = {
  S1: [`${SHELL}/app/startup-splash.tsx`],
  S2: [`${SHELL}/screens/first-run/`],
  S3: [`${SHELL}/screens/consent/`],
  S4: [`${SHELL}/screens/home/`],
  S5: [`${SHELL}/screens/game/`, `${SHELL}/game-host/game-top-bar.tsx`],
  S6: [`${SHELL}/screens/pause/`],
  S7: [`${SHELL}/screens/result/`],
  S8: [`${SHELL}/screens/levels/`],
  S9: [`${SHELL}/screens/daily/`],
  S10: [`${SHELL}/screens/stats/`],
  S11: [`${SHELL}/screens/settings/*`],
  S11a: [`${SHELL}/screens/settings/language/`],
  S11b: [`${SHELL}/screens/settings/about/`],
  S11c: [`${SHELL}/screens/settings/privacy/`],
  S11d: [`${SHELL}/screens/settings/licences/`],
  S12: [`${SHELL}/screens/premium/`],
  S13: [`${SHELL}/screens/how-to-play/`],
  S14: [`${SHELL}/screens/dialogs/`, `${SHELL}/app/crash-screen.tsx`],
  S15: [`${SHELL}/screens/debug/`],
};

/**
 * The route files of each screen whose model lives in a hook (the model/view pattern): the route
 * component calls use<Screen>Model() and hands the result to the view. check-screens requires
 * every ./use-*.ts hook such a file imports to exist with its own test. S5's route opens the run
 * through the game host and builds the top bar and S7's result in use-game-screen-model.ts; S15
 * has two routes (the menu and the font test page); S1, S3, S7 and S14 have no route of their own.
 */
export const MODEL_HOOK_ROUTES = {
  S2: `${SHELL}/screens/first-run/language-choice-screen.tsx`,
  S4: `${SHELL}/screens/home/home-screen.tsx`,
  S5: `${SHELL}/screens/game/game-screen.tsx`,
  S6: `${SHELL}/screens/pause/pause-overlay.tsx`,
  S8: `${SHELL}/screens/levels/levels-screen.tsx`,
  S9: `${SHELL}/screens/daily/daily-screen.tsx`,
  S10: `${SHELL}/screens/stats/stats-screen.tsx`,
  S11: `${SHELL}/screens/settings/settings-screen.tsx`,
  S11a: `${SHELL}/screens/settings/language/language-screen.tsx`,
  S11b: `${SHELL}/screens/settings/about/about-screen.tsx`,
  S11c: `${SHELL}/screens/settings/privacy/privacy-policy-screen.tsx`,
  S11d: `${SHELL}/screens/settings/licences/licences-screen.tsx`,
  S12: `${SHELL}/screens/premium/premium-screen.tsx`,
  S13: `${SHELL}/screens/how-to-play/how-to-play-screen.tsx`,
  S15: [`${SHELL}/screens/debug/debug-screen.tsx`, `${SHELL}/screens/debug/font-test-screen.tsx`],
};

/**
 * S5 is the assembled Game screen: these calls prove the pieces game-host-integration and admob-ads
 * ship are wired in its folder (a screen that only renders BoardHost passes every other rule).
 */
export const GAME_SCREEN_CALLS = {
  topBarPropsOf: 'the top bar (mode line, goal, score, undo and the paid hint) from the run view',
  resultModelOf: 'S7 Result from the recorded run (win, lose, daily, endless), after the run-end save',
  perkOffer: 'paying for a hint or a continue (free, watch an ad, or hidden) before it is sent',
  showInterstitialIfDue: 'the interstitial after Next level, Replay or Try again, with the ad history saved',
};

/** Keys a screen must no longer use, with the key that replaced each. */
export const RETIRED_KEYS = {
  'result.win.moves-count': 'result.win.score-line (the score-rated win line: "Score 1,840 – best 2,010")',
};

/**
 * Shell texts the design's copy deck lacks. The deck is never edited, so these are written by hand
 * in all four Shell catalogs (packages/shell/src/i18n/catalogs/<lang>.json) with exactly these
 * texts; fa and ckb wait for a native speaker's review. check-screens accepts them as copy keys
 * and fails a screen that uses one while a Shell catalog lacks it.
 */
export const SHELL_EXTRA_KEYS = {
  // S7 win line on a level rated by score (par is null): the score and the level's best after
  // this run, with the deck's own words for "score" and "best".
  'result.win.score-line': {
    en: 'Score {score, number} – best {bestScore, number}',
    de: 'Punkte {score, number} – Rekord {bestScore, number}',
    fa: 'امتیاز {score, number} – رکورد {bestScore, number}',
    ckb: 'خاڵ {score, number} – باشترین {bestScore, number}',
  },
  // S5 top bar: the undo and hint keys' VoiceOver labels (topBarPropsOf labels).
  'game-screen.undo-button.a11y-label': { en: 'Undo', de: 'Rückgängig', fa: 'واگرد', ckb: 'گەڕانەوە' },
  'game-screen.hint-button.a11y-label': { en: 'Hint', de: 'Tipp', fa: 'راهنمایی', ckb: 'ئاماژە' },
};

export const SHELL_CATALOGS_DIR = `${SHELL}/i18n/catalogs`;

/** Only these screens may render the banner slot (spec 8.8: Home, Levels, Statistics). */
export const BANNER_SCREENS = new Set(['S4', 'S8', 'S10']);

/**
 * Parts a Toybox component draws itself from the one testID it is given, keyed by the component
 * name the MAP records for the parent element. A map element <parent>.<part> whose parent is
 * one of these needs no literal. (The map calls the hold key "Button"; the app draws it with
 * HoldButton, which derives `.fill`.)
 */
export const DERIVED_PARTS = {
  TopBar: ['back-button', 'title'],
  ListGroup: ['tab', 'list'],
  ListRow: ['icon', 'label', 'description', 'value', 'toggle', 'radio'],
  SubRow: ['label'],
  RowButton: ['icon', 'label', 'description'],
  ToggleKey: ['icon', 'label', 'state'],
  OptionCard: ['label', 'radio'],
  SegmentedControl: ['label', 'preview'],
  StatGrid: ['label', 'value'],
  StatList: ['label', 'value'],
  NotePanel: ['icon', 'label'],
  CalendarTile: ['month', 'day'],
  Slider: ['fill'],
  Button: ['fill'],
};

/**
 * How each Toybox component (toybox-components) derives testIDs from the id props a screen passes
 * it, keyed by the APP component name. `parts`: fixed segments appended to the prop's value.
 * `keyed`: a repeated child `<value>.<key>` with these parts; `key: 'position'` = 1..n (week
 * days, bars, pager dots), `key: 'data'` = a data key (stat id, segment value) that must appear
 * as a string in the screen's code, unless the map marks it `requires: game:<id>` (game data).
 * check-screens reads these props from the JSX, so a screen that passes the right base gets
 * every derived id counted, and a typo in the base leaves them missing.
 */
export const COMPONENT_IDS = {
  TopBar: { testID: { parts: ['back-button', 'title'] } },
  ListGroup: { testID: { parts: ['tab', 'list'] } },
  ListRow: { testID: { parts: ['icon', 'label', 'description', 'value', 'toggle', 'radio'] } },
  SubRow: { testID: { parts: ['label'] } },
  RowButton: { testID: { parts: ['icon', 'label', 'description'] } },
  ToggleKey: { testID: { parts: ['icon', 'label', 'state'] } },
  OptionCard: { testID: { parts: ['label', 'radio'] } },
  NotePanel: { testID: { parts: ['icon', 'label'] } },
  Slider: { testID: { parts: ['fill'] } },
  HoldButton: { testID: { parts: ['fill'] } },
  CalendarTile: { testID: { parts: ['month', 'day'] } },
  WeekLegend: { testID: { parts: ['done', 'missed'] } },
  LevelTile: { testID: { parts: ['number', 'flag'], patterns: [/^stars-[0-3]$/] } },
  PagerDots: { testID: { keyed: { key: 'position', parts: [] } } },
  DialogCard: { testIDBase: { parts: ['card', 'title', 'body'] } },
  GameTopBar: {
    testIDBase: {
      parts: ['top-bar', 'pause-button', 'mode-label', 'progress-label', 'score', 'undo-button', 'hint-button'],
    },
  },
  ScorePanel: {
    testIDBase: { parts: ['label', 'value', 'new-best', 'progress-line', 'moves-line', 'score-line'] },
  },
  EmptyState: { testIDBase: { parts: ['picture', 'title', 'body'] } },
  StatGrid: { testIDBase: { keyed: { key: 'data', parts: ['value', 'label'] } } },
  StatList: { testIDBase: { parts: ['list'], keyed: { key: 'data', parts: ['label', 'value'] } } },
  SegmentedControl: { segmentTestIDBase: { keyed: { key: 'data', parts: ['label', 'preview'] } } },
  WeekStrip: { dayTestIDBase: { keyed: { key: 'position', parts: ['letter', 'mark', 'today-tag'] } } },
  WeekBars: { barTestIDBase: { keyed: { key: 'position', parts: ['value', 'bar', 'day'] } } },
};

/** { Component: [id props] } for the JSX scanner. */
export const ID_PROPS = Object.fromEntries(
  Object.entries(COMPONENT_IDS).map(([name, props]) => [name, Object.keys(props)]),
);

/**
 * Text the screen folder does not write itself: game texts, autonyms, dates from the Shell date
 * formatter, and the mode line the game host formats ("Level 12", "Daily – 26 Sep").
 */
export const EXTERNAL_TEXT = [/^games\./, /^meta\./, /^date\./, /^game-screen\.mode\./];

export const TESTID_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/;

function readJson(path, what) {
  if (!existsSync(path)) fail(`${what} not found: ${path}`, `Pass --${what} <file>, or re-sync the skill's shared files (sync-shared).`);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return fail(`${what} is not valid JSON: ${path} (${error.message})`, 'Restore the file from the library copy (sync-shared.mjs).');
  }
}

/** Expand "scope.{a,b}" into "scope.a", "scope.b". */
function expandBraces(token) {
  const match = /^(.*)\{([^}]*)\}(.*)$/.exec(token);
  if (!match) return [token];
  return match[2].split(',').flatMap((part) => expandBraces(`${match[1]}${part.trim()}${match[3]}`));
}

/** testIDs named in a notDrawn reason, outside parentheses (those hold copy keys). */
function idsInReason(reason) {
  const text = reason.replace(/\([^)]*\)/g, ' ');
  const tokens = text.match(/[a-z0-9-]+(\.[a-z0-9{},-]+)+/g) ?? [];
  return tokens.flatMap(expandBraces).map((token) => token.replace(/[.,]+$/, ''));
}

/** Load the map and deck and index them. */
export function loadContract({ mapPath = DEFAULT_MAP, deckPath = DEFAULT_DECK } = {}) {
  const map = readJson(mapPath, 'map');
  const deck = readJson(deckPath, 'deck');
  if (!Array.isArray(map.screens)) fail(`the map has no screens array: ${mapPath}`, 'Use the library screen-testids.json.');
  const deckKeys = new Set([...Object.keys(deck.strings ?? {}), ...Object.keys(SHELL_EXTRA_KEYS)]);
  const screens = new Map();
  const scopeOwner = new Map();
  for (const screen of map.screens) {
    const byId = new Map();
    for (const element of screen.elements) if (!byId.has(element.testID)) byId.set(element.testID, element);
    screens.set(screen.id, { ...screen, byId, extraIds: new Set(), extraScopes: new Set() });
    for (const scope of screen.scopes) scopeOwner.set(scope, screen.id);
  }
  // notDrawn entries name testIDs the design does not draw. Their reasons also mention copy
  // keys (common.best-score); only tokens whose first segment is a testID scope are testIDs.
  const idScopes = new Set([...scopeOwner.keys(), ...(map.notDrawn ?? []).map((entry) => entry.testID.split('.')[0])]);
  for (const entry of map.notDrawn ?? []) {
    const screen = screens.get(entry.screen);
    if (!screen) continue;
    const ids = [entry.testID, ...idsInReason(entry.reason ?? '')].filter(
      (id) => TESTID_SHAPE.test(id) && idScopes.has(id.split('.')[0]),
    );
    for (const id of ids) {
      screen.extraIds.add(id);
      screen.extraScopes.add(id.split('.')[0]);
    }
  }
  for (const screen of screens.values()) {
    for (const scope of screen.extraScopes) if (!scopeOwner.has(scope)) scopeOwner.set(scope, screen.id);
  }
  return { map, deck, deckKeys, screens, scopeOwner };
}

/** The nearest map element of the same screen whose testID is a segment prefix of `testID`. */
export function structuralParent(screen, testID) {
  const segments = testID.split('.');
  for (let cut = segments.length - 1; cut >= 2; cut -= 1) {
    const candidate = screen.byId.get(segments.slice(0, cut).join('.'));
    if (candidate) return { element: candidate, part: segments.slice(cut).join('.') };
  }
  return null;
}

/** True when a Toybox component draws this element from its parent's testID. */
export function isDerived(screen, testID) {
  const parent = structuralParent(screen, testID);
  if (!parent) return false;
  const parts = DERIVED_PARTS[parent.element.component];
  return Array.isArray(parts) && parts.includes(parent.part);
}

/** The base-style id prop of a Toybox component (testIDBase, dayTestIDBase ...), if it has one. */
function baseProp(component) {
  return Object.keys(COMPONENT_IDS[component] ?? {}).find((prop) => prop !== 'testID');
}

const POSITION_KEY = /^[1-9][0-9]*$/;

/** Is this element itself a child the component derives from its base prop (a cell, a column)? */
function isOwnDerived(rule, testID) {
  const segments = testID.split('.');
  const last = segments.at(-1);
  if (rule.parts?.includes(last)) return true;
  if (!rule.keyed) return false;
  if (rule.keyed.key === 'position') return POSITION_KEY.test(last);
  return segments.length >= 3;
}

/** The map names `component` on the element that anchors `rest` under `base`. */
function isAnchored(screen, component, rule, { base, rest }) {
  const isOwn = (id) => screen.byId.get(id)?.component === component;
  if (rule.parts?.includes(rest)) return isOwn(base) || rule.parts.some((part) => isOwn(`${base}.${part}`));
  if (!rule.keyed) return false;
  const [key, ...tail] = rest.split('.');
  if (tail.length > 1 || (tail.length === 1 && !rule.keyed.parts.includes(tail[0]))) return false;
  if (rule.keyed.key === 'position' && !POSITION_KEY.test(key)) return false;
  // Data-keyed series (stat cells, segments) sit under a full id, never directly under a scope.
  if (rule.keyed.key === 'data' && !base.includes('.')) return false;
  const child = `${base}.${key}`;
  return isOwn(child) || rule.keyed.parts.some((part) => isOwn(`${child}.${part}`));
}

/**
 * Who draws a map element, for the screen references and list-screen: "drawn by TopBar from
 * home.top-bar", "drawn by DialogCard from testIDBase=\"restart-dialog\"", or '' (the screen sets it).
 */
export function describeDerivation(screen, element) {
  const parent = structuralParent(screen, element.testID);
  if (isDerived(screen, element.testID)) return `drawn by ${parent.element.component} from ${parent.element.testID}`;
  for (const owner of [element, parent?.element]) {
    const prop = owner === undefined ? undefined : baseProp(owner.component);
    if (prop !== undefined && isOwnDerived(COMPONENT_IDS[owner.component][prop], owner.testID)) {
      return `drawn by ${owner.component} from its ${prop}`;
    }
  }
  const segments = element.testID.split('.');
  for (let cut = segments.length - 1; cut >= 1; cut -= 1) {
    const base = segments.slice(0, cut).join('.');
    const rest = segments.slice(cut).join('.');
    for (const component of Object.keys(COMPONENT_IDS)) {
      const prop = baseProp(component);
      if (prop === undefined) continue;
      if (isAnchored(screen, component, COMPONENT_IDS[component][prop], { base, rest })) {
        return `drawn by ${component} from ${prop}="${base}"`;
      }
    }
  }
  return '';
}

export function isExternalText(key) {
  return EXTERNAL_TEXT.some((pattern) => pattern.test(key));
}

/** Resolve a screen argument: "S4", "s4", or a scope ("home"). */
export function findScreen(contract, arg) {
  const upper = arg.toUpperCase();
  for (const screen of contract.screens.values()) {
    if (screen.id.toUpperCase() === upper || screen.scopes.includes(arg)) return screen;
  }
  return null;
}
