#!/usr/bin/env node
// check-components.mjs: proves an app repo has the Toybox components: every component file of the
// catalogue exists, exports its component, takes a testID and has a test; component-specs.json holds
// the token file's measurements exactly; and Shell UI keeps the Toybox component rules (one press
// implementation, no opacity presses, no hitSlop, tilt only on printed parts, no literal sizes in
// component styles, flat information parts, a hold timer that ignores Reduce motion).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-components.mjs [repo-root]

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_SCAN_IGNORES, createReporter, fail, lineOf, parseArgs, requireDir, run, walk } from './check-lib.mjs';
import {
  SPECS_JSON, SPECS_TS, UI_DIR, firstDifference, importsUiFile, inRanges, loadCatalogue, loadTokens, masked,
  propsBody, specNote, specsFromTokens, styleSheetRanges, testIdsOnInnerText,
} from './lib/component-source.mjs';

const SPEC = {
  name: 'check-components',
  summary: 'Checks that the app repo has every Toybox component (file, export, testID, test), that component-specs.json equals the token file, and that Shell UI keeps the component rules.',
  usage: '[options] [repo-root]',
  options: {
    only: { type: 'string', multiple: true, value: 'Component', help: 'Check only these catalogue components for existence, export, testID and test (while building a subset)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  prerequisite-missing   a theme, AppText, RaisedSurface or Icon module the components build on is missing',
    '  specs-missing          packages/shell/src/ui/component-specs.json or component-specs.ts is missing',
    '  specs-mismatch         component-specs.json differs from the as-rendered specs write-component-specs.mjs derives',
    '                         from the token file (CSS borders floored as Chrome draws them, plus the mockup overrides)',
    '  component-missing      a catalogue component file is missing',
    '  component-export       the file does not export `function <Name>` and `type <Name>Props`',
    '  testid-required        the props type lacks a required testID (or testIDBase) string',
    '  component-untested     no test file imports the component',
    '  press-outside-raised   Pressable, Touchable* or a gesture-handler button outside raised-surface, quiet-button and list-row',
    '  pressed-opacity        a pressed style fades with opacity (pressed style, pressed && {opacity}, opacity: pressed ? ...)',
    '  no-hitslop             hitSlop anywhere in app code (make the box 44 pt instead)',
    '  tilt-outside-printed   rotate in Shell UI outside stickers, flags, art, logos, calendar and stars',
    '  measurement-literal    a numeric size literal inside a component StyleSheet',
    '  flat-part-shadow       hardShadow on a part that lies flat (panels, lists, rows, chips, toasts, stickers)',
    '  hold-reduce-motion     the hold-to-confirm timer lacks reduceMotion: ReduceMotion.Never',
    '  decorative-not-hidden  a decorative part (icon and art tiles, Premium art, confetti, calendar, pager dots, radio',
    '                         mark, toggle graphic; unlabelled stars, marks and loaders; logo, hazard strip, empty-stats',
    '                         picture) does not hide itself from VoiceOver (accessibilityElementsHidden and',
    '                         importantForAccessibility="no-hide-descendants"); parity then compares it by crop only',
    '  testid-on-inner-text   a testID on an AppText that is the only labelled child (the rest are icons) of a View',
    '                         or Animated.View that draws the box (padding, edge or fill) and has no testID itself:',
    '                         Maestro and the parity bounds then measure the text instead of the tab, chip or sticker',
    '  press-feedback         a press host (raised-surface, quiet-button, list-row) never runs usePressFeedback(),',
    '                         so its taps are silent',
    '  locked-pack-edge       Panel tone "locked" paints its own edge colour: the design draws the locked pack',
    '                         with a 3 pt dashed ink edge on sunken, so the locked style keeps the default ink border',
    '  pair-cell-flex         a key the screens put in a pair-layout cell (KeyButton, ToggleKey) passes',
    '                         RaisedSurface a layoutStyle with flex: 1 (or flexBasis 0): a zero vertical basis in',
    '                         the column cell, so the row measured 0 pt on the device; use { flexGrow: 1 }',
    '',
    'Example: node check-components.mjs .   (from the app repo root)',
  ].join('\n'),
};

const SOURCE_EXCLUDES = ['*.test.ts', '*.test.tsx', '*.d.ts', '__generated__'];
const SIZE_KEYS = [
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'flexBasis', 'gap', 'rowGap', 'columnGap',
  'top', 'bottom', 'start', 'end', 'inset', 'insetBlock', 'insetInline',
  'padding', 'paddingBlock', 'paddingInline', 'paddingTop', 'paddingBottom', 'paddingStart', 'paddingEnd',
  'paddingVertical', 'paddingHorizontal', 'margin', 'marginBlock', 'marginInline', 'marginTop', 'marginBottom',
  'marginStart', 'marginEnd', 'marginVertical', 'marginHorizontal', 'borderRadius', 'borderWidth',
  'borderTopWidth', 'borderBottomWidth', 'borderStartWidth', 'borderEndWidth', 'borderTopStartRadius',
  'borderTopEndRadius', 'borderBottomStartRadius', 'borderBottomEndRadius',
];
const SIZE_LITERAL = new RegExp(`\\b(${SIZE_KEYS.join('|')})\\s*:\\s*(-?\\d+(?:\\.\\d+)?)\\s*(?=[,}\\n])`, 'g');
const SHADOW_ALLOWED = new Set(['dialog-card.tsx', 'toggle.tsx', 'slider.tsx']);
const FIX_TEMPLATE = 'Copy the file from this skill\'s templates/packages/shell/src/ui/, then rerun.';
// The reach policy: these parts hide themselves from VoiceOver (always, or when they carry no label),
// so Maestro never lists them and the screen map marks them crop-only (a11yHidden or parent).
const HIDES_ITSELF = ['icon-tile.tsx', 'art-tile.tsx', 'premium-art.tsx', 'confetti.tsx', 'calendar-tile.tsx', 'pager-dots.tsx', 'radio-mark.tsx', 'toggle.tsx', 'rating-stars.tsx', 'busy-blocks.tsx', 'week-mark.tsx', 'logo-tile.tsx', 'hazard-strip.tsx', 'empty-stats-picture.tsx'];
const PRESS_HOSTS = ['raised-surface.tsx', 'quiet-button.tsx', 'list-row.tsx'];

/** Repo files, skipping the skill library, native projects, build output and Pods (REPO_SCAN_IGNORES). */
function repoFiles(root, include, ignore = []) {
  return walk(root, { include, ignore: [...REPO_SCAN_IGNORES, ...ignore] });
}

function sourceFiles(root) {
  return repoFiles(root, ['*.ts', '*.tsx'], SOURCE_EXCLUDES).filter((path) => /^(packages\/[^/]+|apps\/[^/]+)\/src\//.test(path));
}

function testFiles(root) {
  return repoFiles(root, ['*.test.ts', '*.test.tsx']).filter((path) => /^(packages|apps|test)\//.test(path));
}

function scan(report, file, text, rule, pattern, { message, fix, when = () => true }) {
  for (const match of text.matchAll(pattern)) {
    if (when(match)) report.problem({ file, line: lineOf(text, match.index), rule, message: message(match), fix });
  }
}

function checkSpecs(report, root, tokens) {
  for (const file of [SPECS_JSON, SPECS_TS]) {
    if (!existsSync(join(root, file))) report.problem({ file, rule: 'specs-missing', message: 'component measurements module is missing', fix: `Run write-component-specs.mjs (JSON) or copy ${file.split('/').at(-1)} from the templates.` });
  }
  if (existsSync(join(root, SPECS_TS)) && !/component-specs\.json/.test(readFileSync(join(root, SPECS_TS), 'utf8'))) {
    report.problem({ file: SPECS_TS, rule: 'specs-mismatch', message: 'component-specs.ts does not import component-specs.json', fix: FIX_TEMPLATE });
  }
  if (!existsSync(join(root, SPECS_JSON))) return;
  let actual;
  try {
    actual = JSON.parse(readFileSync(join(root, SPECS_JSON), 'utf8'));
  } catch (error) {
    report.problem({ file: SPECS_JSON, rule: 'specs-mismatch', message: `not valid JSON (${error.message.split('\n')[0]})`, fix: 'Run write-component-specs.mjs to rewrite it.' });
    return;
  }
  const diff = firstDifference(specsFromTokens(tokens), actual);
  if (diff) {
    const note = specNote(tokens, diff.path);
    report.problem({ file: SPECS_JSON, rule: 'specs-mismatch', message: `${diff.path} is ${diff.actual === undefined ? 'missing' : JSON.stringify(diff.actual)}, the as-rendered Toybox spec is ${JSON.stringify(diff.expected)}${note ? ` (${note})` : ''}`, fix: 'Run write-component-specs.mjs; never edit the JSON by hand.' });
  }
}

function checkComponent(report, root, entry, tests) {
  const file = `${UI_DIR}/${entry.file}`;
  if (!existsSync(join(root, file))) {
    report.problem({ file, rule: 'component-missing', message: `${entry.name} (Toybox ${entry.section}) is missing`, fix: FIX_TEMPLATE });
    return;
  }
  const source = readFileSync(join(root, file), 'utf8');
  if (!new RegExp(`export function ${entry.name}\\b`).test(source) || !new RegExp(`export type ${entry.name}Props\\b`).test(source)) {
    report.problem({ file, rule: 'component-export', message: `does not export function ${entry.name} and type ${entry.name}Props`, fix: `One component per file, named after the file: export function ${entry.name}(props: ${entry.name}Props): ReactNode.` });
  }
  const body = propsBody(source, entry.name) ?? '';
  const prop = entry.testID === 'testIDBase' ? 'testIDBase' : 'testID';
  if ((entry.testID === 'testID' || entry.testID === 'testIDBase') && !new RegExp(`readonly ${prop}: string;`).test(body)) {
    report.problem({ file, rule: 'testid-required', message: `${entry.name}Props needs a required \`readonly ${prop}: string;\``, fix: `Take ${prop} as a required prop and derive the parts (${entry.parts.join(' ') || 'none'}) from it.` });
  }
  if (entry.inPairCell === true) checkPairCellFlex(report, file, masked(source), entry.name);
  if (entry.name === 'Panel') checkLockedPackEdge(report, file, masked(source));
  if (!tests.some((test) => importsUiFile(test.source, entry.file))) {
    report.problem({ file, rule: 'component-untested', message: `no test file imports ${entry.file}`, fix: `Copy its test from the templates, or write one that renders ${entry.name} with renderWithShell and asserts role, name and parts.` });
  }
}

/**
 * A key that sits in a usePairLayout cell (a column View) must keep its content height there:
 * `flex: 1` is `flexBasis: 0` on the cell's vertical axis, which measured the Pause toggle row at
 * 0 pt on the device (unit tests have no layout engine). The layout style grows instead.
 */
function checkPairCellFlex(report, file, text, name) {
  const passed = /\blayoutStyle=\{\s*(?:styles\.(\w+)|(\{[^}]*\}))\s*\}/.exec(text);
  if (passed === null) return;
  let body = passed[2] ?? null;
  let index = passed.index;
  if (body === null) {
    const entry = new RegExp(`\\b${passed[1]}\\s*:\\s*\\{([^}]*)\\}`).exec(text);
    if (entry === null) return;
    body = entry[1];
    index = entry.index;
  }
  if (/\bflex\s*:\s*1\b/.test(body) || /\bflexBasis\s*:\s*0\b/.test(body)) {
    report.problem({ file, line: lineOf(text, index), rule: 'pair-cell-flex', message: `${name}'s layoutStyle has a zero flex basis (flex: 1): inside a pair-layout cell the row measures 0 pt on the device and the keys spill over what follows`, fix: 'Use { flexGrow: 1 }: the key grows into its cell and keeps its content height (never flex: 1 inside a pair-layout cell).' });
  }
}

/** The locked pack (S8) is a dashed ink edge on sunken: the locked tone never recolours the edge. */
function checkLockedPackEdge(report, file, text) {
  const locked = /\blocked\s*:\s*\{([^}]*)\}/.exec(text);
  if (locked === null || !/\bborderColor\s*:/.test(locked[1])) return;
  report.problem({ file, line: lineOf(text, locked.index), rule: 'locked-pack-edge', message: 'the locked tone paints its own edge colour, but the design draws the locked pack with a dashed ink edge (a textMuted edge failed every S8 levels.pack.2 edge check)', fix: 'Drop borderColor from the locked style so the panel\'s ink edge applies (dashed, sunken fill), as the template does.' });
}

/** Decorative parts hide themselves; the three press hosts run the Shell's tap feedback. */
function checkReachAndFeedback(report, root) {
  for (const name of HIDES_ITSELF) {
    const file = `${UI_DIR}/${name}`;
    if (!existsSync(join(root, file))) continue;
    const text = masked(readFileSync(join(root, file), 'utf8'));
    if (!/\baccessibilityElementsHidden\b/.test(text) || !/no-hide-descendants/.test(text)) {
      report.problem({ file, rule: 'decorative-not-hidden', message: 'a decorative part is left in the accessibility tree', fix: 'Set accessibilityElementsHidden and importantForAccessibility="no-hide-descendants" on its root (only when unlabelled for stars, marks and loaders), as the template does.' });
    }
  }
  for (const name of PRESS_HOSTS) {
    const file = `${UI_DIR}/${name}`;
    if (!existsSync(join(root, file))) continue;
    const text = masked(readFileSync(join(root, file), 'utf8'));
    if (!/\busePressFeedback\s*\(/.test(text) || !/\bonPressFeedback\s*\(\s*\)/.test(text)) {
      report.problem({ file, rule: 'press-feedback', message: 'the press never runs the Shell\'s tap feedback, so taps are silent', fix: "const onPressFeedback = usePressFeedback(); (app/press-feedback-context.tsx) and call onPressFeedback() before props.onPress(), except for a switch (its handler plays the toggle feedback)." });
    }
  }
}

function checkUiRules(report, file, source, catalogue) {
  const text = masked(source);
  const name = file.slice(UI_DIR.length + 1);
  const isUi = file.startsWith(`${UI_DIR}/`);
  if (!catalogue.allowPressable.includes(name) || !isUi) {
    scan(report, file, text, 'press-outside-raised', /import\s*\{[^}]*\b(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|TouchableNativeFeedback)\b[^}]*\}\s*from\s*['"]react-native['"]/g, { message: (m) => `${m[1]} is a second press implementation`, fix: 'Compose RaisedSurface (raised keys) or use Button / ListRow / QuietButton.' });
    scan(report, file, text, 'press-outside-raised', /import\s*\{[^}]*\b(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|RectButton|BorderlessButton|BaseButton)\b[^}]*\}\s*from\s*['"]react-native-gesture-handler['"]/g, { message: (m) => `${m[1]} from react-native-gesture-handler is a second press implementation`, fix: 'Compose RaisedSurface (raised keys) or use Button / ListRow / QuietButton; gesture-handler is for boards only.' });
  }
  // A pressed style object with opacity, `pressed && { opacity }`, or `opacity: pressed ? 0.6 : 1`.
  scan(report, file, text, 'pressed-opacity', /\bpressed\w*\s*:\s*\{[^}]*\bopacity\s*:|\bpressed\s*&&\s*\{[^}]*\bopacity\s*:|\bopacity\s*:\s*\(?\s*(?:[\w.]*\.)?(?:is)?[pP]ressed\b|\bactiveOpacity\b/g, { message: () => 'the pressed state fades with opacity', fix: 'Toybox keys sink into their hard shadow (RaisedSurface); quiet presses scale to 0.97 on sunken.' });
  scan(report, file, text, 'no-hitslop', /\bhitSlop\b/g, { message: () => 'hitSlop stretches the target invisibly', fix: 'Make the pressable box itself at least 44 x 44 pt (MIN_TOUCH).' });
  if (text.includes('HOLD_TO_CONFIRM_MS') && /withTiming\s*\(/.test(text) && !/reduceMotion\s*:\s*ReduceMotion\.Never/.test(text)) {
    report.problem({ file, rule: 'hold-reduce-motion', message: 'the hold timer would finish instantly under Reduce motion', fix: 'Pass reduceMotion: ReduceMotion.Never to the hold withTiming: it is a safety timer, not decoration.' });
  }
  if (!isUi || name.startsWith('icons/')) return;
  if (!catalogue.allowTilt.includes(name)) {
    scan(report, file, text, 'tilt-outside-printed', /\brotate\s*:/g, { message: () => 'a tilted Shell part that is not printed', fix: 'Only stickers, flags, art and logo tiles, the calendar and result stars tilt; keys, panels and rows stay square.' });
  }
  if (!SHADOW_ALLOWED.has(name) && catalogue.components.some((entry) => entry.file === name)) {
    scan(report, file, text, 'flat-part-shadow', /\bhardShadow\s*\(/g, { message: () => 'a static hard shadow on a part that lies flat', fix: 'Panels, lists, rows, chips, toasts and stickers have no shadow; raised means pressable (RaisedSurface).' });
  }
  if (file.endsWith('.tsx')) {
    for (const found of testIdsOnInnerText(text)) {
      report.problem({ file, line: lineOf(text, found.index), rule: 'testid-on-inner-text', message: `the testID sits on the text inside the ${found.parent} that draws the box and has none, so Maestro and the parity bounds measure only the text`, fix: 'Put testID, accessible, accessibilityRole and accessibilityLabel on that View and drop the testID from the AppText (as group-tab.tsx, chip.tsx and sticker.tsx do); part ids (.label, .value) stay on text in plain layout Views.' });
    }
  }
  const sheets = styleSheetRanges(text);
  scan(report, file, text, 'measurement-literal', SIZE_LITERAL, { when: (m) => Number(m[2]) !== 0 && inRanges(m.index, sheets), message: (m) => `${m[1]}: ${m[2]} is a literal size`, fix: 'Take it from COMPONENT_SPECS or the theme tokens (or a named constant that cites the Toybox value).' });
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  if (!existsSync(join(root, UI_DIR))) fail(`nothing to check: ${join(root, UI_DIR)} does not exist`, 'Run from the app repo root (the folder with packages/shell), or pass it as the argument.');
  const catalogue = loadCatalogue();
  const known = new Set(catalogue.components.map((entry) => entry.name));
  const unknown = options.only.filter((name) => !known.has(name));
  if (unknown.length > 0) fail(`--only names unknown components: ${unknown.join(', ')}`, `Use catalogue names: ${[...known].join(', ')}.`);
  const report = createReporter({ name: 'check-components', json: options.json });
  let checked = 0;
  for (const { file, owner, mustContain, why } of catalogue.prerequisites) {
    checked += 1;
    if (!existsSync(join(root, file))) {
      report.problem({ file, rule: 'prerequisite-missing', message: 'a module the components build on is missing', fix: `Set it up first (${owner} ships it), then rerun.` });
    } else if (mustContain && !readFileSync(join(root, file), 'utf8').includes(mustContain)) {
      report.problem({ file, rule: 'prerequisite-missing', message: `an older version: it lacks ${mustContain} (${why})`, fix: `Update it from ${owner}'s template first, then rerun.` });
    }
  }
  checkSpecs(report, root, loadTokens());
  const tests = testFiles(root).map((file) => ({ file, source: readFileSync(join(root, file), 'utf8') }));
  const selected = options.only.length > 0 ? catalogue.components.filter((entry) => options.only.includes(entry.name)) : catalogue.components;
  for (const entry of selected) {
    checked += 1;
    checkComponent(report, root, entry, tests);
  }
  checkReachAndFeedback(report, root);
  for (const file of sourceFiles(root)) {
    checked += 1;
    checkUiRules(report, file, readFileSync(join(root, file), 'utf8'), catalogue);
  }
  return report.finish({ checked, unit: 'components and files' });
});
