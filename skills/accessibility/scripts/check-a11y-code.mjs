#!/usr/bin/env node
// check-a11y-code.mjs: checks Pocket Arcade UI code for the accessibility rules a machine can see:
// role and name on every pressable, 44 pt boxes without hitSlop, state, translated labels, Dynamic
// Type left on, reduce motion and announcements through the Shell, modal overlays, the board as
// one labelled image, hold alternatives, adjustable controls, and screen tests that audit a11y.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-a11y-code.mjs [repo-root]

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

import { createReporter, fail, lineOf, parseArgs, run, toPosix, walk } from './check-lib.mjs';
import { findCalls, findClosing, findImports, findJsxTags, jsxAttributes, literalOf, maskCode } from './lib/source-scan.mjs';

const SPEC = {
  name: 'check-a11y-code',
  summary: 'Checks .tsx/.ts source under packages/shell/src and apps/*/src for accessibility mistakes that are visible in code.',
  usage: '[options] [repo-root]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  pressable-role      a Pressable/Touchable* without accessibilityRole (or role)',
    '  pressable-name      a Pressable/Touchable* without accessibilityLabel and without text inside',
    '                      (no AppText/T/Text child and no {expression} child: an icon-only button)',
    '  touch-target        a pressable whose own style box is smaller than 44 x 44 pt',
    '  hit-slop            hitSlop used to reach 44 pt (invisible in layout, overlaps neighbours)',
    '  disabled-state      disabled= without accessibilityState',
    '  literal-a11y-text   accessibilityLabel/Hint or aria-label with literal or built English text (use t())',
    '  font-scaling        allowFontScaling={false}, or maxFontSizeMultiplier other than 2',
    '  reduce-motion       Reanimated useReducedMotion, or AccessibilityInfo motion/reader reads outside',
    '                      app/system-a11y-store.ts (use useReduceMotion())',
    '  announce            announceForAccessibility outside app/use-announce.ts (use useAnnounce())',
    '  modal-overlay       a *dialog/*overlay/*sheet/pause-menu component that neither sets',
    '                      accessibilityViewIsModal nor renders a component that does (DialogCard, Modal)',
    '  board-image         board-canvas.tsx must expose one accessible image with a label',
    '  hold-alternative    a call to useHoldToConfirm(...) or onLongPress without accessibilityActions',
    '  adjustable          accessibilityRole="adjustable" without accessibilityValue, accessibilityActions',
    '                      (increment, decrement) and onAccessibilityAction',
    '  screen-test-audit   a screen test that renders but never calls findInaccessiblePressables',
  ].join('\n'),
};

const PRESSABLES = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback']);
const MIN_TOUCH = 44;
const LETTER = /\p{L}/u;

function collectFiles(root) {
  const files = [];
  const add = (dir) => {
    if (!existsSync(join(root, dir))) return;
    for (const rel of walk(join(root, dir), { include: ['*.ts', '*.tsx'], ignore: ['*.d.ts', 'ios', 'android', 'build', 'dist'] })) files.push(`${dir}/${rel}`);
  };
  add('packages/shell/src');
  const apps = join(root, 'apps');
  if (existsSync(apps)) for (const id of readdirSync(apps).sort()) if (statSync(join(apps, id)).isDirectory()) add(`apps/${id}/src`);
  return files;
}

/** styleName -> { width, height, minWidth, minHeight } (numbers, or undefined when unknown). */
function styleSizes(source, masked) {
  const sizes = new Map();
  for (const call of findCalls(masked, 'StyleSheet\\.create')) {
    const open = masked.indexOf('{', call.open);
    if (open === -1 || open > call.close) continue;
    const close = findClosing(masked, open);
    for (const match of masked.slice(open, close).matchAll(/[{,]\s*([A-Za-z_$][\w$]*)\s*:\s*\{/g)) {
      const valueOpen = open + match.index + match[0].length - 1;
      let depth = 0;
      for (let i = open; i < valueOpen; i += 1) depth += masked[i] === '{' ? 1 : masked[i] === '}' ? -1 : 0;
      if (depth !== 1) continue;
      const valueClose = findClosing(masked, valueOpen);
      const text = source.slice(valueOpen, valueClose + 1);
      const read = (key) => {
        const m = new RegExp(`[{,]\\s*${key}\\s*:\\s*([^,}\\n]+)`).exec(text);
        if (!m) return undefined;
        const value = m[1].trim();
        if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
        if (/^MIN_TOUCH$/.test(value)) return MIN_TOUCH;
        return null; // computed: unknown
      };
      sizes.set(match[1], { width: read('width'), height: read('height'), minWidth: read('minWidth'), minHeight: read('minHeight') });
    }
  }
  return sizes;
}

function boxTooSmall(size) {
  const axis = (a, b) => {
    const known = [a, b].filter((v) => typeof v === 'number');
    if ([a, b].includes(null) || known.length === 0) return null;
    return Math.max(...known);
  };
  const w = axis(size.width, size.minWidth);
  const h = axis(size.height, size.minHeight);
  if (w !== null && w < MIN_TOUCH) return `${w} pt wide`;
  if (h !== null && h < MIN_TOUCH) return `${h} pt tall`;
  return null;
}

/**
 * English words built into an accessibility text: a template literal with letters outside ${},
 * or a literal branch of ?: / ?? ('On' in isOn ? 'On' : t('x')). Call arguments are ignored.
 */
function builtText(attr) {
  if (!attr || attr.kind !== 'expr') return null;
  const value = attr.value.trim();
  if (/^`[\s\S]*`$/.test(value) && LETTER.test(value.replace(/\$\{[^}]*\}/g, ''))) return value;
  let depth = 0;
  let blanked = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    blanked += depth > 0 ? ' ' : char;
    if (char === ')') depth = Math.max(0, depth - 1);
  }
  const match = /(?:[?:]|\?\?|\|\|)\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/u.exec(blanked);
  return match && LETTER.test(match[2]) && !/\$\{/.test(match[2]) ? value : null;
}

/**
 * True when a pressable element may render text itself: VoiceOver then reads that text as the
 * name (a settings row reads its label, description and value in order). Self-closing, or only
 * non-text elements inside (an Icon), means an icon-only control that needs accessibilityLabel.
 */
function mayHoldText(masked, tag) {
  if (tag.selfClosing) return false;
  const closeTag = `</${tag.name}>`;
  let depth = 1;
  let i = tag.end + 1;
  let bodyEnd = masked.length;
  const opener = new RegExp(`<${tag.name.replace('.', '\\.')}[\\s>/]`, 'y');
  while (i < masked.length) {
    if (masked.startsWith(closeTag, i)) {
      depth -= 1;
      if (depth === 0) {
        bodyEnd = i;
        break;
      }
    } else {
      opener.lastIndex = i;
      if (opener.test(masked)) depth += 1;
    }
    i += 1;
  }
  const body = masked.slice(tag.end + 1, bodyEnd);
  if (/<(AppText|T|Text)[\s>/]/.test(body)) return true;
  // An {expression} child may be text ({label}, {content}); braces inside child tags are props.
  let children = body;
  for (const child of findJsxTags(body, body)) {
    children = children.slice(0, child.start) + ' '.repeat(child.end - child.start + 1) + children.slice(child.end + 1);
  }
  return children.includes('{');
}

/**
 * Files whose components are modal: they set accessibilityViewIsModal (or render <Modal>), or
 * render a component exported by such a file (DialogFrame -> DialogCard), followed to a fixed point.
 */
function findModalFiles(root, files) {
  const sources = files
    .filter((rel) => rel.endsWith('.tsx') && !/\.test\.tsx$/.test(rel))
    .map((rel) => {
      const source = readFileSync(join(root, rel), 'utf8');
      const masked = maskCode(source);
      return { rel, masked, tags: new Set(findJsxTags(source, masked).map((tag) => tag.name)) };
    });
  const modalNames = new Set();
  const modalFiles = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const file of sources) {
      if (modalFiles.has(file.rel)) continue;
      const isModal = /\baccessibilityViewIsModal\b|<Modal\b/.test(file.masked) || [...file.tags].some((name) => modalNames.has(name));
      if (!isModal) continue;
      modalFiles.add(file.rel);
      changed = true;
      for (const m of file.masked.matchAll(/export\s+(?:function|const)\s+([A-Z][\w$]*)/g)) modalNames.add(m[1]);
    }
  }
  return modalFiles;
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const rootArg = positionals[0] ?? '.';
  const root = resolve(rootArg);
  const files = collectFiles(root);
  if (files.length === 0) fail(`nothing to check: no .ts/.tsx files under ${rootArg}/packages/shell/src or apps/*/src`, 'Run from the app repo root, or pass it as the argument.');
  const report = createReporter({ name: 'check-a11y-code', json: options.json });
  const modalFiles = findModalFiles(root, files);
  const shown = (rel) => toPosix(relative(process.cwd(), join(root, rel))) || rel;

  for (const rel of files) {
    const source = readFileSync(join(root, rel), 'utf8');
    const masked = maskCode(source);
    const isTest = /\.test\.tsx?$/.test(rel);
    const problem = (index, rule, message, fix) => report.problem({ file: shown(rel), line: lineOf(source, index), rule, message, fix });
    const inCode = (regex, cb) => {
      for (const match of masked.matchAll(regex)) cb(match);
    };

    if (isTest) {
      const isScreenTest = /(^|\/)screens\//.test(rel) && rel.endsWith('.test.tsx');
      if (isScreenTest && /\brender(WithShell)?\s*\(/.test(masked) && !/\bfindInaccessiblePressables\s*\(/.test(masked)) {
        problem(0, 'screen-test-audit', 'this screen test renders UI but never audits it', 'End the test with expect(findInaccessiblePressables(screen.container)).toStrictEqual([]).');
      }
      continue;
    }

    for (const imp of findImports(source, masked)) {
      if (imp.from === 'react-native-reanimated' && /\buseReducedMotion\b/.test(imp.text)) {
        problem(imp.index, 'reduce-motion', "Reanimated's useReducedMotion is a module-load constant that ignores the Settings row", 'Use useReduceMotion() from @e07/shell/app/use-reduce-motion.ts.');
      }
    }
    if (!rel.endsWith('app/system-a11y-store.ts')) {
      inCode(/AccessibilityInfo\.(isReduceMotionEnabled|isScreenReaderEnabled|addEventListener)\b/g, (m) => problem(m.index, 'reduce-motion', `AccessibilityInfo.${m[1]} is read outside the system accessibility store`, 'Read systemA11yStore (useReduceMotion(), useStore(systemA11yStore, …)); one subscription serves the whole app.'));
    }
    if (!rel.endsWith('app/use-announce.ts')) {
      inCode(/AccessibilityInfo\.announceForAccessibility\b/g, (m) => problem(m.index, 'announce', 'announceForAccessibility is called directly', 'Use useAnnounce(): it speaks only while VoiceOver runs, one short announcement per move.'));
    }
    // A call site of the hold hook (not its own definition) or a long press.
    const holdUse = /(?<!function\s+)\buseHoldToConfirm\s*\(|\bonLongPress\b/;
    if (holdUse.test(masked) && !/\baccessibilityActions\b/.test(masked)) {
      const at = masked.search(holdUse);
      problem(at, 'hold-alternative', 'a hold or long-press action has no screen-reader alternative', 'Add accessibilityActions (for example { name: \'activate\' }) with onAccessibilityAction, or confirm through a dialog.');
    }
    if (!rel.endsWith('.tsx')) continue;

    const sizes = styleSizes(source, masked);
    for (const tag of findJsxTags(source, masked)) {
      const attrs = jsxAttributes(source, tag, masked);
      // A spread can supply an attribute when it spreads a whole object ({...props}) or names it.
      const spreads = [...attrs].filter(([k]) => k.startsWith('...')).map(([, v]) => v.value.replace(/^\.\.\./, '').trim());
      // A spread of opaque data ({...props}, {...a11yProps(props, isOff)}) may supply any
      // attribute; one built from object literals ({...(hint ? { accessibilityHint: hint } : {})})
      // supplies only the names it spells out.
      const spreadGives = (name) => spreads.some((text) => !text.includes('{') || text.includes(name));
      for (const name of ['accessibilityLabel', 'accessibilityHint', 'aria-label']) {
        const attr = attrs.get(name);
        const literal = literalOf(attr);
        const built = literal === null ? builtText(attr) : null;
        if ((literal !== null && LETTER.test(literal)) || built !== null) problem(attr.index, 'literal-a11y-text', `${name}=${literal !== null ? `"${literal}"` : `{${built}}`} is not translated`, `Pass ${name}={t('area.element.a11y-label', { … })} from the catalog (all four languages); numbers go in as values, never glued into the text.`);
      }
      const scaling = attrs.get('allowFontScaling');
      if (scaling && /false/.test(scaling.value)) problem(scaling.index, 'font-scaling', 'allowFontScaling={false} turns Dynamic Type off', 'Remove it; AppText caps growth at 2x with maxFontSizeMultiplier={2}.');
      const multiplier = attrs.get('maxFontSizeMultiplier');
      if (multiplier && /^\d+(\.\d+)?$/.test(multiplier.value) && Number(multiplier.value) !== 2) problem(multiplier.index, 'font-scaling', `maxFontSizeMultiplier={${multiplier.value}}`, 'The product cap is 2 (200 %): only AppText sets it, to 2.');
      const role = literalOf(attrs.get('accessibilityRole')) ?? literalOf(attrs.get('role'));
      const missing = ['accessibilityValue', 'accessibilityActions', 'onAccessibilityAction'].filter((name) => !attrs.has(name) && !spreadGives(name));
      if (role === 'adjustable' && missing.length > 0) {
        problem(tag.start, 'adjustable', `an adjustable control lacks ${missing.join(', ')}`, "Give sliders accessibilityValue={{ min, max, now }}, accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} and onAccessibilityAction that handles both; without the declared actions VoiceOver's swipe up/down does nothing.");
      }
      if (!PRESSABLES.has(tag.name)) continue;
      if (!attrs.has('accessibilityRole') && !attrs.has('role') && !spreadGives('accessibilityRole') && !spreadGives('role')) {
        problem(tag.start, 'pressable-role', `<${tag.name}> has no accessibilityRole`, "Add accessibilityRole=\"button\" (or 'switch', 'tab', 'link', 'radio' where true); VoiceOver and getByRole need it.");
      }
      if (!attrs.has('accessibilityLabel') && !attrs.has('aria-label') && !spreadGives('accessibilityLabel') && !mayHoldText(masked, tag)) {
        problem(tag.start, 'pressable-name', `<${tag.name}> has no accessibilityLabel and no text inside`, 'Pass accessibilityLabel={label} (translated by t() in the screen); icon-only buttons take a required label prop.');
      }
      if (attrs.has('hitSlop')) problem(attrs.get('hitSlop').index, 'hit-slop', 'hitSlop is used to enlarge the target', 'Make the pressable\'s own box at least 44 x 44 pt (minWidth/minHeight = MIN_TOUCH).');
      if (attrs.has('disabled') && !attrs.has('accessibilityState') && !spreadGives('accessibilityState')) problem(attrs.get('disabled').index, 'disabled-state', 'disabled is set without accessibilityState', 'Also pass accessibilityState={{ disabled, busy }} so VoiceOver reads the state.');
      const style = attrs.get('style');
      if (style) {
        for (const ref of style.value.matchAll(/\bstyles\.([A-Za-z_$][\w$]*)/g)) {
          const size = sizes.get(ref[1]);
          const small = size ? boxTooSmall(size) : null;
          if (small) problem(style.index, 'touch-target', `<${tag.name}> style styles.${ref[1]} is only ${small}`, 'Give the pressable itself at least 44 x 44 pt (MIN_TOUCH) and centre the smaller glyph inside it.');
        }
      }
    }

    if (/(dialog|overlay|sheet|pause-menu)\.tsx$/.test(basename(rel)) && !modalFiles.has(rel)) {
      problem(0, 'modal-overlay', `${basename(rel)} is an overlay without accessibilityViewIsModal`, 'Set accessibilityViewIsModal on the overlay container so VoiceOver cannot wander into the screen behind it.');
    }
    if (basename(rel) === 'board-canvas.tsx') {
      const text = source;
      if (!/accessibilityRole=["']image["']/.test(text) || !/\baccessibilityLabel=/.test(text) || !/\baccessible\b/.test(masked)) {
        problem(0, 'board-image', 'the board canvas is not one accessible image with a label', 'Give the Canvas accessible, accessibilityRole="image" and accessibilityLabel = t() of board.describe(view).');
      }
    }
  }
  return report.finish({ checked: files.length, unit: 'source files' });
});
