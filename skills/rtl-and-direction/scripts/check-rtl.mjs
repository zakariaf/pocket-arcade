#!/usr/bin/env node
// check-rtl.mjs: checks that Pocket Arcade code stays right-to-left correct: logical style keys,
// one direction source, the restart wiring, unflipped boards, the directional-icon list, digits
// through the locale tag, no raw bidi controls, and the Vazirmatn font files.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-rtl.mjs [repo-root]   (the repo root is positional; default .)

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { REPO_SCAN_IGNORES, SHELL_DUE_TARGETS, UsageError, createReporter, dueSkipReason, fail, lineOf, parseArgs, run, toPosix, walk } from './check-lib.mjs';
import { findCalls, findClosing, findImports, findJsxTags, jsxAttributes, maskCode } from './lib/source-scan.mjs';

const SPEC = {
  name: 'check-rtl',
  summary: 'Checks Pocket Arcade source for right-to-left mistakes: physical left/right style keys, textAlign left/right, row-reverse, I18nManager outside direction.ts, scaleX flips, hand-set writingDirection, reloads outside the direction module, expo-localization RTL flags, Text imports, Intl.NumberFormat outside i18n, raw bidi controls, the directional-icon list, the LTR board wrapper, the startup direction check and the Vazirmatn files.',
  usage: '[options] [repo-root]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  physical-style-key      left/right/marginLeft/paddingRight/borderTopLeftRadius... in a style (StyleSheet.create,',
    '                          a *style prop, a *Style-typed variable, useAnimatedStyle)',
    '  text-align-literal      textAlign: \'left\' | \'right\' (AppText align="start|end" instead)',
    '  row-reverse             flexDirection: \'row-reverse\' (row already mirrors)',
    '  i18nmanager             I18nManager outside packages/shell/src/i18n/direction.ts',
    '  scale-x-flip            scaleX: -1 outside the Icon component (boards mirror in their layout)',
    '  writing-direction       writingDirection set outside use-localized-text-style.ts',
    '  reload-outside-direction reloadAppAsync outside direction.ts, or expo-updates at all',
    '  expo-localization-rtl   supportsRTL / forcesRTL in an app or Shell config',
    '  text-import             Text imported from react-native outside ui/app-text.tsx',
    '  number-format           Intl.NumberFormat with a literal, undefined or missing locale (use localeTagFor)',
    '  bidi-in-source          raw or escaped bidi controls / ALM outside i18n/bidi.ts (also an LRE/LRM put around a',
    '                          whole English label in an RTL row: that label takes textDirection="ltr" instead)',
    '  font-weight-with-family fontFamily and fontWeight in the same style object',
    '  nav-direction           navigation direction taken from the language instead of the layout',
    '  directional-icons       DIRECTIONAL_ICONS must be exactly the directional icons that exist',
    '  board-ltr               a BoardCanvas is rendered but nothing keeps the board LTR',
    '  direction-before-render start-shell.ts must plan the direction before it renders the app',
    '  cold-start-mark         once app/perf/cold-start.ts exists (Shell step 7), start-shell.ts calls markJsEntry()',
    '                          inside startShell, right after readParityLaunch() and before the direction plan (never',
    '                          at module scope: a direction reload re-runs every module)',
    '  root-direction-provider a root that renders text outside the navigator (app/create-startup-splash.tsx: the',
    '                          restart splash and the held parity splash) does not wrap itself in',
    '                          <DirectionProvider direction={directionOf(language)}>, so its Persian text is',
    '                          written left to right (the S1 tagline\'s full stop stood at the right end)',
    '  vazirmatn-files         every app ships assets/fonts/Vazirmatn-Regular.ttf and -Bold.ttf',
    '  direction-files         from Shell step 7 (start-shell.ts exists) the Shell has i18n/direction-context.tsx and',
    '                          game-host/board-direction-view.tsx with its test; they land at step 7, not step 6,',
    '                          because the test renders through renderWithShell (the theme of step 7); before step 7',
    '                          the rule prints SKIP "due at Shell step 7: packages/shell/src/app/start-shell.ts not yet created"',
    '',
    'Test files (*.test.ts[x]) may assert styles and mock modules; only the structural rules apply to them.',
  ].join('\n'),
};

const PHYSICAL_KEYS = ['left', 'right', 'marginLeft', 'marginRight', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth', 'borderLeftColor', 'borderRightColor', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'];
const LOGICAL = {
  left: 'start', right: 'end', marginLeft: 'marginStart', marginRight: 'marginEnd', paddingLeft: 'paddingStart', paddingRight: 'paddingEnd',
  borderLeftWidth: 'borderStartWidth', borderRightWidth: 'borderEndWidth', borderLeftColor: 'borderStartColor', borderRightColor: 'borderEndColor',
  borderTopLeftRadius: 'borderTopStartRadius', borderTopRightRadius: 'borderTopEndRadius', borderBottomLeftRadius: 'borderBottomStartRadius', borderBottomRightRadius: 'borderBottomEndRadius',
};
const DIRECTIONAL = ['back', 'chevron', 'forward', 'undo'];
const DIRECTION_FILE = 'packages/shell/src/i18n/direction.ts';
const TEXT_STYLE_FILE = 'packages/shell/src/i18n/use-localized-text-style.ts';
const ICON_FILE = 'packages/shell/src/ui/icons/icon.tsx';
const APP_TEXT_FILE = 'packages/shell/src/ui/app-text.tsx';
const BIDI_FILE = 'packages/shell/src/i18n/bidi.ts';
const COLD_START_FILE = 'packages/shell/src/app/perf/cold-start.ts';
/**
 * The direction files whose tests need the Shell wrapper (renderWithShell, which needs the theme):
 * copied at Shell step 7 with start-shell.ts, never at step 6 (tsc and the coverage gate fail there).
 */
const STEP7_DIRECTION_FILES = [
  'packages/shell/src/i18n/direction-context.tsx',
  'packages/shell/src/game-host/board-direction-view.tsx',
  'packages/shell/src/game-host/board-direction-view.test.tsx',
];
/** Roots registered outside the navigator: they set the direction of their own language. */
const OUTSIDE_ROOTS = ['packages/shell/src/app/create-startup-splash.tsx'];
const BIDI_ESCAPE = new RegExp(`${String.fromCharCode(92)}${String.fromCharCode(92)}u(061[cC]|200[eEfF]|202[a-eA-E]|206[6-9])`);
const BIDI_RAW = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/;
/** The case of a whole LTR text in an RTL row (S15's English labels in fa, L13): a direction, not controls. */
const LTR_TEXT_FIX =
  "A whole English text in an RTL row (S15's debug labels in fa and ckb) is laid as an LTR paragraph aligned to the row's start: AppText textDirection=\"ltr\" (ListRow labelDirection=\"ltr\"), which useLocalizedTextStyle turns into writingDirection 'ltr' (references/digits-bidi-and-fonts.md, \"An LTR text in an RTL row\").";

function isTest(rel) {
  return /\.test\.tsx?$/.test(rel) || rel.includes('__mocks__/');
}

function collectFiles(root) {
  const files = [];
  const add = (dir, include = ['*.ts', '*.tsx']) => {
    if (!existsSync(join(root, dir))) return;
    for (const rel of walk(join(root, dir), { include, ignore: [...REPO_SCAN_IGNORES, '*.d.ts', 'dist'] })) files.push(`${dir}/${rel}`);
  };
  add('packages/shell/src');
  add('packages/shell/plugins');
  add('packages/game-kit/src');
  const apps = join(root, 'apps');
  const appIds = [];
  if (existsSync(apps)) {
    for (const id of readdirSync(apps).sort()) {
      if (!statSync(join(apps, id)).isDirectory()) continue;
      appIds.push(id);
      add(`apps/${id}/src`);
      for (const file of ['index.ts', 'app.config.ts', 'app.json']) if (existsSync(join(apps, id, file))) files.push(`apps/${id}/${file}`);
    }
  }
  return { files, appIds };
}

/** [start, end) ranges of style contexts in masked code. */
function styleRanges(source, masked, isTsx) {
  const ranges = [];
  for (const call of findCalls(masked, 'StyleSheet\\.create')) ranges.push([call.open, call.close]);
  // Reanimated animated styles are styles too: useAnimatedStyle(() => ({ marginStart: x.get() })).
  for (const call of findCalls(masked, 'useAnimatedStyle')) ranges.push([call.open, call.close]);
  for (const match of masked.matchAll(/:\s*(?:[A-Za-z]+\.)?[A-Za-z]*Style\b[^=;{]*=\s*\{/g)) {
    const open = match.index + match[0].length - 1;
    const close = findClosing(masked, open);
    if (close !== -1) ranges.push([open, close]);
  }
  if (isTsx) {
    for (const tag of findJsxTags(source, masked)) {
      for (const [name, attr] of jsxAttributes(source, tag, masked)) {
        if (attr.kind !== 'expr' || !/(^s|S)tyle$/.test(name)) continue;
        const open = masked.indexOf('{', attr.index);
        const close = findClosing(masked, open);
        if (close !== -1) ranges.push([open, close]);
      }
    }
  }
  return ranges;
}

/** An object literal's text with its nested objects blanked, so only its own keys remain. */
function ownLevel(text) {
  let depth = 0;
  let out = '';
  for (const ch of text) {
    if (ch === '{') depth += 1;
    out += depth <= 1 ? ch : ' ';
    if (ch === '}') depth -= 1;
  }
  return out;
}

/** Every object literal ({...}) inside a range, nested ones included. */
function objectLiterals(masked, [from, to]) {
  const out = [];
  const stack = [];
  for (let i = from; i <= to; i += 1) {
    if (masked[i] === '{') stack.push(i);
    else if (masked[i] === '}' && stack.length > 0) out.push({ start: stack.pop(), end: i });
  }
  return out;
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const rootArg = positionals[0] ?? '.';
  const root = resolve(rootArg);
  const { files, appIds } = collectFiles(root);
  if (files.length === 0) fail(`nothing to check: no source under ${rootArg}/packages/shell/src, packages/game-kit/src or apps/*`, 'Run from the app repo root, or pass it: node check-rtl.mjs <repo-root>.');
  const report = createReporter({ name: 'check-rtl', json: options.json });
  const shown = (rel) => toPosix(relative(process.cwd(), join(root, rel))) || rel;
  let boardCanvasAt = null;
  let hasBoardWrapper = false;

  for (const rel of files) {
    const source = readFileSync(join(root, rel), 'utf8');
    const test = isTest(rel);
    const problem = (index, rule, message, fix) => report.problem({ file: shown(rel), line: lineOf(source, index), rule, message, fix });

    if (rel.endsWith('.json')) {
      const match = /"(supportsRTL|forcesRTL)"/.exec(source);
      if (match) problem(match.index, 'expo-localization-rtl', `${match[1]} is set in the app config`, 'Give expo-localization supportedLocales only; the Shell owns direction (forceRTL + reload).');
      continue;
    }
    const masked = maskCode(source);
    const code = (regex, cb) => {
      for (const match of source.matchAll(regex)) {
        if (masked.slice(match.index, match.index + 1).trim() === '' && source[match.index].trim() !== '') continue; // in a comment or string
        cb(match);
      }
    };

    // Style contexts: physical keys and fontFamily + fontWeight together.
    if (!test) {
      for (const range of styleRanges(source, masked, rel.endsWith('.tsx'))) {
        const slice = masked.slice(range[0], range[1] + 1);
        for (const match of slice.matchAll(new RegExp(`(^|[{,]\\s*)(${PHYSICAL_KEYS.join('|')})\\s*:`, 'g'))) {
          const key = match[2];
          problem(range[0] + match.index + match[1].length, 'physical-style-key', `style key "${key}" is physical and does not mirror in fa/ckb`, `Use ${LOGICAL[key]} (logical start/end keys mirror automatically).`);
        }
        for (const object of objectLiterals(masked, range)) {
          const text = ownLevel(masked.slice(object.start, object.end + 1));
          if (/[{,]\s*fontFamily\s*:/.test(text) && /[{,]\s*fontWeight\s*:/.test(text)) {
            problem(object.start, 'font-weight-with-family', 'fontFamily and fontWeight are set together', 'Pick the weight\'s own family (Vazirmatn-Bold, not Vazirmatn-Regular + fontWeight 700); let AppText choose the font.');
          }
        }
      }
    }

    code(/textAlign\s*:\s*['"](left|right)['"]/g, (m) => problem(m.index, 'text-align-literal', `textAlign: '${m[1]}' is a physical side`, 'Pass align="start" | "end" to AppText; only use-localized-text-style.ts maps start/end to left/right.'));
    code(/flexDirection\s*:\s*['"]row-reverse['"]/g, (m) => problem(m.index, 'row-reverse', 'row-reverse fakes RTL and double-flips under an RTL layout', "Use flexDirection: 'row'; React Native mirrors it in fa/ckb."));
    if (rel !== DIRECTION_FILE) code(/\bI18nManager\b/g, (m) => problem(m.index, 'i18nmanager', 'I18nManager is read outside the direction module', 'Use useDirection() in components and readLayoutDirection() at the root; only direction.ts touches I18nManager.'));
    if (rel !== ICON_FILE && !test) code(/scaleX\s*:\s*-\s*1\b/g, (m) => problem(m.index, 'scale-x-flip', 'scaleX: -1 mirrors by transform', 'Directional icons flip inside Icon (DIRECTIONAL_ICONS); a mirrored board flips in its BoardLayout mapping (x -> width - x).'));
    if (rel !== TEXT_STYLE_FILE && !test) code(/\bwritingDirection\s*:/g, (m) => problem(m.index, 'writing-direction', 'writingDirection is set by hand', 'Render text with AppText (or T); useLocalizedTextStyle sets writingDirection from the layout direction, or from AppText textDirection for a whole text written the other way (S15\'s English labels in an RTL layout: textDirection="ltr").'));
    if (rel !== DIRECTION_FILE && !test) code(/\breloadAppAsync\b/g, (m) => problem(m.index, 'reload-outside-direction', 'reloadAppAsync is called outside the direction module', 'Call restartForDirection(direction, guard) from a mounted component; it records the guard before reloading.'));
    for (const imp of findImports(source, masked)) {
      if (imp.from === 'expo-updates') problem(imp.index, 'reload-outside-direction', 'expo-updates is imported', 'expo-updates is banned (no network); reload with reloadAppAsync from expo via restartForDirection.');
      if (imp.from === 'react-native' && rel !== APP_TEXT_FILE) {
        const names = /\{([^}]*)\}/.exec(imp.text)?.[1] ?? '';
        const isTypeOnly = /^import\s+type\b/.test(imp.text);
        if (!isTypeOnly && names.split(',').map((n) => n.trim().replace(/^type\s+/, '')).some((n) => n === 'Text' || n.startsWith('Text as '))) {
          problem(imp.index, 'text-import', 'Text is imported from react-native', 'Render text with AppText or <T>: it sets textAlign, writingDirection, the script font and the 200% cap.');
        }
      }
    }
    if (/(^|\/)(app\.config\.ts|plugins\/|config\/)/.test(rel) || rel.startsWith('packages/shell/src/config/')) {
      code(/\b(supportsRTL|forcesRTL)\b/g, (m) => problem(m.index, 'expo-localization-rtl', `${m[1]} is set for expo-localization`, 'Give expo-localization supportedLocales only; supportsRTL/forcesRTL would undo an in-app language choice at every launch.'));
    }
    if (!rel.startsWith('packages/shell/src/i18n/') && !test) {
      for (const call of findCalls(masked, '(?:new\\s+)?Intl\\.NumberFormat')) {
        const locale = source.slice(call.open + 1, call.close).split(',')[0].trim();
        if (locale === '' || locale === 'undefined' || /^['"`]/.test(locale)) {
          problem(call.start, 'number-format', `Intl.NumberFormat gets ${locale === '' ? 'no locale' : `the locale ${locale}`}, so the digits ignore the language and the Numbers setting`, 'Pass the tag from localeTagFor(language, digits), or use createNumberFormatter(localeTagFor(language, digits)).');
        }
      }
    }
    if (rel !== BIDI_FILE && !test) {
      const raw = BIDI_RAW.exec(source);
      if (raw) problem(raw.index, 'bidi-in-source', `raw bidi control U+${raw[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} in source`, `Remove it; t() isolates *Name/*Text values, and isolate() from i18n/bidi.ts wraps other free text. ${LTR_TEXT_FIX}`);
      const escaped = BIDI_ESCAPE.exec(source);
      if (escaped) problem(escaped.index, 'bidi-in-source', `bidi control escape ${escaped[0]} in source`, `Import FSI/PDI or isolate() from @e07/shell/i18n/bidi.ts instead of writing controls by hand. ${LTR_TEXT_FIX}`);
    }

    if (rel.endsWith('.tsx')) {
      for (const tag of findJsxTags(source, masked)) {
        if (tag.name === 'BoardCanvas' && !test) boardCanvasAt ??= { rel, index: tag.start };
        if (tag.name === 'BoardDirectionView') hasBoardWrapper = true;
        if (/^(Navigation|NavigationContainer)$/.test(tag.name)) {
          const direction = jsxAttributes(source, tag, masked).get('direction');
          if (direction && /directionOf\(|language/i.test(direction.value)) {
            problem(tag.start, 'nav-direction', `navigation direction comes from the language (${direction.value})`, 'Pass direction={readLayoutDirection()}: between a language change and the restart, text and layout disagree, and navigation must follow the layout.');
          }
        }
      }
    }
    if (!test && rel.startsWith('packages/shell/src/game-host/')) code(/\bdirection\s*:\s*['"]ltr['"]/g, () => { hasBoardWrapper = true; });

    if (rel === 'packages/shell/src/ui/icons/icon-paths.ts') checkDirectionalIcons(source, masked, (index, message) => problem(index, 'directional-icons', message, `DIRECTIONAL_ICONS = exactly the icons among ${DIRECTIONAL.join(', ')} that exist; play, clocks, stars, logos and pictures never flip.`));
    if (OUTSIDE_ROOTS.includes(rel)) {
      const provider = findJsxTags(source, masked).find((tag) => tag.name === 'DirectionProvider');
      const direction = provider === undefined ? null : jsxAttributes(source, provider, masked).get('direction');
      if (provider === undefined || direction === undefined || !/\bdirectionOf\s*\(/.test(masked)) {
        problem(provider?.start ?? 0, 'root-direction-provider', 'this root renders text outside the navigator without a DirectionProvider for its language, so Persian and Sorani text is written left to right', 'Wrap the root in <DirectionProvider direction={directionOf(language)}> (references/direction-switch.md, "Roots outside the navigator").');
      }
    }
    if (rel === 'packages/shell/src/app/start-shell.ts') {
      const plan = masked.search(/\bplanDirection\s*\(/);
      const render = masked.search(/\bcreateShellApp\s*\(/);
      if (plan === -1 || !/\breadLayoutDirection\s*\(/.test(masked)) problem(0, 'direction-before-render', 'start-shell.ts does not plan the layout direction', 'Call planDirection({ language, layout: readLayoutDirection(), pendingRestart }) before rendering anything.');
      else if (render !== -1 && render < plan) problem(render, 'direction-before-render', 'the app is created before the direction check', 'Run planDirection first; restart through the startup splash, and only then createShellApp.');
      if (existsSync(join(root, COLD_START_FILE))) checkColdStartMark(masked, plan, problem);
    }
  }

  if (boardCanvasAt && !hasBoardWrapper) {
    report.problem({ file: shown(boardCanvasAt.rel), line: lineOf(readFileSync(join(root, boardCanvasAt.rel), 'utf8'), boardCanvasAt.index), rule: 'board-ltr', message: 'a BoardCanvas is rendered but no BoardDirectionView (or direction: \'ltr\' wrapper in game-host/) keeps boards left-to-right', fix: 'Wrap the board area in BoardDirectionView with the game\'s isMirroredInRtl (templates/shell-game-host/).' });
  }
  checkDirectionFiles(report, root, shown);
  for (const id of appIds) {
    if (!existsSync(join(root, 'apps', id, 'app.config.ts'))) continue;
    for (const font of ['Vazirmatn-Regular.ttf', 'Vazirmatn-Bold.ttf']) {
      if (!existsSync(join(root, 'apps', id, 'assets', 'fonts', font))) {
        report.problem({ file: shown(`apps/${id}/app.config.ts`), line: 1, rule: 'vazirmatn-files', message: `apps/${id}/assets/fonts/${font} is missing`, fix: 'Copy Vazirmatn v33.003 Regular and Bold (with Vazirmatn-OFL.txt) into the app and list them in the expo-font plugin: Persian and Sorani text needs them from the first frame.' });
      }
    }
  }
  return report.finish({ checked: files.length, unit: 'files' });
});

/**
 * direction-files: the Shell wrapper's direction pieces arrive at Shell step 7 (with start-shell.ts);
 * until then the rule is not yet due and prints a SKIP line.
 */
function checkDirectionFiles(report, root, shown) {
  const reason = dueSkipReason(root, SHELL_DUE_TARGETS.boot);
  if (reason !== null) {
    report.skip({ file: shown(STEP7_DIRECTION_FILES[1]), rule: 'direction-files', message: reason });
    return;
  }
  for (const file of STEP7_DIRECTION_FILES) {
    if (existsSync(join(root, file))) continue;
    report.problem({ file: shown(file), line: 1, rule: 'direction-files', message: `${file} is missing although Shell step 7 has started (start-shell.ts exists)`, fix: 'Copy it from the skill (templates/shell-i18n/direction-context.tsx, templates/shell-game-host/) in the step-7 commit, each file with its test: the test renders through renderWithShell.' });
  }
}

/**
 * The cold-start clock's JS entry mark (performance-budgets' app/perf/ JS half, Shell step 7): inside
 * startShell, right after the parity read and before the direction plan. At module scope it would
 * be work at import time, and a missing mark leaves the E2E run with no cold-start entry.
 */
function checkColdStartMark(masked, plan, problem) {
  const fix = 'Call markJsEntry() (app/perf/cold-start.ts) inside startShell, right after readParityLaunch() and before planDirection, as templates/shell-app/start-shell.ts does.';
  const mark = masked.search(/\bmarkJsEntry\s*\(\s*\)/);
  const entry = masked.search(/\bexport\s+function\s+startShell\b/);
  const parityRead = masked.search(/\breadParityLaunch\s*\(/);
  if (mark === -1) problem(0, 'cold-start-mark', 'start-shell.ts never calls markJsEntry(), so cold start is never measured', fix);
  else if (entry === -1 || mark < entry) problem(mark, 'cold-start-mark', 'markJsEntry() runs at module scope, before startShell', fix);
  else if ((parityRead !== -1 && mark < parityRead) || (plan !== -1 && mark > plan)) problem(mark, 'cold-start-mark', 'markJsEntry() is not right after the parity read (or comes after the direction plan)', fix);
}

function checkDirectionalIcons(source, masked, problem) {
  const names = new Set();
  const pathsAt = masked.search(/ICON_PATHS\s*=\s*\{/);
  if (pathsAt !== -1) {
    const open = masked.indexOf('{', pathsAt);
    const close = findClosing(masked, open);
    for (const match of source.slice(open, close + 1).matchAll(/[{,]\s*(['"]?)([A-Za-z0-9-]+)\1\s*:/g)) {
      const at = open + match.index;
      let depth = 0;
      for (let i = open; i <= at; i += 1) depth += masked[i] === '{' ? 1 : masked[i] === '}' ? -1 : 0;
      if (depth === 1) names.add(match[2]);
    }
  }
  const setAt = masked.search(/DIRECTIONAL_ICONS\b[^=]*=/);
  if (setAt === -1) {
    if (DIRECTIONAL.some((name) => names.has(name))) problem(0, 'DIRECTIONAL_ICONS is missing although directional icons exist');
    return;
  }
  const open = masked.indexOf('[', setAt);
  const close = findClosing(masked, open);
  const listed = [...source.slice(open, close + 1).matchAll(/['"]([A-Za-z0-9-]+)['"]/g)].map((m) => m[1]);
  for (const name of listed.filter((n) => !DIRECTIONAL.includes(n))) problem(setAt, `"${name}" is in DIRECTIONAL_ICONS but is not a direction arrow`);
  for (const name of DIRECTIONAL.filter((n) => names.has(n) && !listed.includes(n))) problem(setAt, `"${name}" points along the reading direction but is not in DIRECTIONAL_ICONS`);
}
