// component-source.mjs: helpers for check-components.mjs and write-component-specs.mjs: the
// component catalogue, the numeric projection of the token file's components block, and small
// source scanners (StyleSheet ranges, prop types, imports).

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { UsageError, maskComments } from '../check-lib.mjs';

const SKILL_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export const UI_DIR = 'packages/shell/src/ui';
export const SPECS_JSON = `${UI_DIR}/component-specs.json`;
export const SPECS_TS = `${UI_DIR}/component-specs.ts`;

function readJson(path, what) {
  if (!existsSync(path)) throw new UsageError(`${what} not found at ${path}`, 'Reinstall the toybox-components skill; its assets/ folder is incomplete.');
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new UsageError(`${what} is not valid JSON: ${error.message}`, 'Restore the file from the skill.');
  }
}

export function loadCatalogue() {
  return readJson(join(SKILL_DIR, 'assets', 'component-catalogue.json'), 'component catalogue');
}

/** The Toybox token file: this skill's copy, or another file (a newer token file, a test fixture). */
export function loadTokens(path = join(SKILL_DIR, 'assets', 'toybox-tokens.json')) {
  return readJson(path, 'Toybox token file');
}

/** Keep only numbers and all-number arrays: the measurements a component can use as pt values. */
export function numericProjection(value) {
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) return value.every((item) => typeof item === 'number') ? value : undefined;
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      const projected = numericProjection(item);
      if (projected !== undefined) out[key] = projected;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return undefined;
}

/**
 * The width a CSS border is drawn with in the Toybox references. They are Chrome renders at
 * deviceScaleFactor 3, and Chrome floors a border of 1 px or more to whole CSS px (2.5 -> 2,
 * 1.5 -> 1): every .layout.json style says `2px solid` and the parity gates measure 2.0 pt.
 */
export function asRenderedBorder(width) {
  return width >= 1 ? Math.floor(width) : width;
}

/**
 * Keys of the components block that the mockup draws as a CSS border: `border`, `*Border`
 * (knob, track, mark, cap, thumb ...), `border*` (borderCurrent, borderDashed) and the fill's end
 * edge (`fillEdge`). Everything else keeps its token value: box-shadow rings (`ring`, the
 * sticker's 3.5), separators drawn as fills, icon and SVG strokes, Skia strokes, sizes and gaps.
 */
export function isBorderKey(key) {
  return /^border/.test(key) || /Border$/.test(key) || key === 'fillEdge';
}

/**
 * The places where the mockup CSS the references were rendered from differs from the token file.
 * Each entry is applied on top of the derived specs; `why` names the mockup rule. The fourth
 * difference, the strong row label (17 Bold, line height 1.32 / 1.5 from `.row.strong .rl` and
 * `.row.danger .rl`), is a text style, so it lives in TYPE_STYLES.rowLabelStrong (theme/type-styles.ts),
 * which ListRow uses for strong and danger rows.
 */
export const MOCKUP_OVERRIDES = [
  { path: 'groupTab.marginStart', value: 0, why: 'the reference draws the folder tab flush with the list\'s start edge (x = 20), not 14 in' },
  { path: 'groupTab.overlap', value: 0, why: 'the tab sits on the list\'s top edge, which stays unbroken under it (the list starts 27.5 below the tab\'s top)' },
  { path: 'segmentedControl.faceGap', value: 1, why: '`.seg>span { gap: 1px }`: 1 pt between the label line and the preview line' },
  { path: 'segmentedControl.labelColumnGap', value: 3, why: '`.sg-l { gap: 0 3px }`: 3 pt between the check and the label' },
];

function floorBorders(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = typeof item === 'number' && isBorderKey(key) ? asRenderedBorder(item) : floorBorders(item);
  }
  return out;
}

function setPath(target, path, value) {
  const keys = path.split('.');
  let node = target;
  for (const key of keys.slice(0, -1)) {
    if (node[key] === null || typeof node[key] !== 'object') throw new UsageError(`override ${path}: the token file has no ${key} block`, 'Fix MOCKUP_OVERRIDES in scripts/lib/component-source.mjs.');
    node = node[key];
  }
  node[keys.at(-1)] = value;
}

/**
 * The as-rendered component specs: the numeric projection of the token file's components block,
 * CSS borders floored as Chrome draws them, then the mockup overrides. The token file itself is
 * never edited; this derivation is what the app's component-specs.json must equal.
 */
export function specsFromTokens(tokens) {
  const projected = numericProjection(tokens.components);
  if (projected === undefined) throw new UsageError('the token file has no numeric components block', 'Restore assets/toybox-tokens.json from the library.');
  const specs = floorBorders(projected);
  for (const { path, value } of MOCKUP_OVERRIDES) setPath(specs, path, value);
  return specs;
}

/** Why a derived spec value differs from the raw token value (for problem messages), or null. */
export function specNote(tokens, path) {
  const override = MOCKUP_OVERRIDES.find((entry) => entry.path === path);
  if (override) return `mockup override: ${override.why}`;
  const key = path.split('.').at(-1);
  const raw = path.split('.').reduce((node, part) => (node === null || node === undefined ? undefined : node[part]), tokens.components);
  if (typeof raw === 'number' && isBorderKey(key) && asRenderedBorder(raw) !== raw) return `a CSS border: the token's ${raw} renders as ${asRenderedBorder(raw)} (Chrome floors borders of 1 px or more)`;
  if (typeof raw === 'number' && !isBorderKey(key) && !Number.isInteger(raw)) return `not a CSS border (a ring, stroke or ratio): it keeps the token value ${raw}`;
  return null;
}

/** The exact text component-specs.json must hold. */
export function specsJsonText(tokens) {
  const specs = specsFromTokens(tokens);
  // Prettier-stable: objects expanded, all-number arrays on one line.
  const text = JSON.stringify(specs, null, 2).replace(/\[\s*(-?[\d.]+(?:,\s*-?[\d.]+)*)\s*\]/g, (_, items) => `[${items.split(/,\s*/).join(', ')}]`);
  return `${text}\n`;
}

/** First difference between two JSON values as a dotted path, or null when equal. */
export function firstDifference(expected, actual, path = '') {
  if (typeof expected !== typeof actual || Array.isArray(expected) !== Array.isArray(actual)) {
    return { path: path || '(root)', expected, actual };
  }
  if (expected === null || typeof expected !== 'object') {
    return expected === actual ? null : { path: path || '(root)', expected, actual };
  }
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of [...keys].sort()) {
    const next = path ? `${path}.${key}` : key;
    if (!(key in expected)) return { path: next, expected: undefined, actual: actual[key] };
    if (!(key in actual)) return { path: next, expected: expected[key], actual: undefined };
    const diff = firstDifference(expected[key], actual[key], next);
    if (diff) return diff;
  }
  return null;
}

/** Character ranges of every `StyleSheet.create({...})` argument in comment-masked source. */
export function styleSheetRanges(masked) {
  const ranges = [];
  const re = /StyleSheet\.create\s*\(/g;
  let match;
  while ((match = re.exec(masked)) !== null) {
    let depth = 0;
    let start = -1;
    for (let i = match.index + match[0].length; i < masked.length; i += 1) {
      const ch = masked[i];
      if (ch === '{') {
        if (depth === 0) start = i;
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          ranges.push([start, i + 1]);
          break;
        }
      } else if (ch === ')' && depth === 0) {
        break;
      }
    }
  }
  return ranges;
}

export function inRanges(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index < end);
}

/** Comment-masked source with string contents kept (masking keeps offsets, so lines still match). */
export function masked(source) {
  return maskComments(source);
}

/** The body of `export type <Name>Props = { ... };` (generic parameters allowed), or null. */
export function propsBody(source, name) {
  const re = new RegExp(`export type ${name}Props(?:<[^>]*>)?\\s*=\\s*\\{`);
  const match = re.exec(source);
  if (!match) return null;
  let depth = 0;
  for (let i = match.index + match[0].length - 1; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(match.index, i + 1);
    }
  }
  return null;
}

/** Does this source import the given module file (relative or through the @e07/shell/ui alias)? */
export function importsUiFile(source, file) {
  const stem = file.replace(/\.tsx?$/, '');
  const escaped = stem.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return new RegExp(`from\\s+['"](?:\\./|(?:\\.\\./)+ui/|@e07/shell/ui/)${escaped}\\.tsx?['"]`).test(source);
}

const IDENT = /[\w$]/;

/** Skips a quoted string or template literal starting at `i` (the quote); returns the index after it. */
function skipString(text, i) {
  const quote = text[i];
  for (let j = i + 1; j < text.length; j += 1) {
    if (text[j] === '\\') j += 1;
    else if (text[j] === quote) return j + 1;
  }
  return text.length;
}

/** True when `<` at `i` opens a JSX tag rather than a TypeScript generic or a comparison. */
function opensJsx(text, i) {
  if (!/[A-Za-z>/]/.test(text[i + 1] ?? '')) return false;
  let p = i - 1;
  while (p >= 0 && /\s/.test(text[p])) p -= 1;
  if (p < 0) return true;
  if (/[)\]]/.test(text[p])) return false;
  if (!IDENT.test(text[p])) return true;
  let start = p;
  while (start > 0 && IDENT.test(text[start - 1])) start -= 1;
  return text.slice(start, p + 1) === 'return';
}

/** The end of a tag's attributes: the index after `>` or `/>`, and whether it closes itself. */
function tagEnd(text, from) {
  let depth = 0;
  for (let j = from; j < text.length; j += 1) {
    const ch = text[j];
    if (ch === '"' || ch === "'" || ch === '`') {
      j = skipString(text, j) - 1;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
    } else if (depth === 0 && ch === '/' && text[j + 1] === '>') {
      return { end: j + 2, isSelfClosing: true };
    } else if (depth === 0 && ch === '>') {
      return { end: j + 1, isSelfClosing: false };
    }
  }
  return { end: text.length, isSelfClosing: true };
}

/**
 * The JSX elements of a comment-masked .tsx source, in order: { name, start, attrs, parent,
 * children } (parent and children are indexes; fragments have the name ''). A small scanner, not a
 * parser: enough for the component templates' JSX, which Prettier keeps regular.
 */
export function jsxElements(text) {
  const elements = [];
  const stack = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = stack.length === 0 ? skipString(text, i) : i + 1;
      continue;
    }
    if (ch !== '<' || !opensJsx(text, i)) {
      i += 1;
      continue;
    }
    if (text[i + 1] === '/') {
      const close = /^<\/\s*([\w$.]*)\s*>/.exec(text.slice(i));
      const name = close ? close[1] : '';
      while (stack.length > 0) {
        const top = stack.pop();
        if (elements[top].name === name) break;
      }
      i += close ? close[0].length : 2;
      continue;
    }
    const nameMatch = /^<([\w$.]*)/.exec(text.slice(i));
    const name = nameMatch[1];
    const { end, isSelfClosing } = tagEnd(text, i + 1 + name.length);
    const index = elements.length;
    const parent = stack.length > 0 ? stack.at(-1) : null;
    elements.push({ name, start: i, attrs: text.slice(i + 1 + name.length, end), parent, children: [] });
    if (parent !== null) elements[parent].children.push(index);
    if (!isSelfClosing) stack.push(index);
    i = end;
  }
  return elements;
}

const BOX_KEYS = /\b(padding\w*|border\w*Width|backgroundColor)\s*:/;

/** Does a View's style attribute draw a box (padding, an edge or a fill), inline or through `styles.x`? */
function drawsBox(attrs, text, sheets) {
  const style = /\bstyle\s*=\s*\{/.exec(attrs);
  if (!style) return false;
  const value = attrs.slice(style.index);
  if (BOX_KEYS.test(value)) return true;
  for (const [, name] of value.matchAll(/\bstyles\.(\w+)/g)) {
    for (const match of text.matchAll(new RegExp(`\\b${name}\\s*:\\s*\\{([^{}]*)\\}`, 'g'))) {
      if (inRanges(match.index, sheets) && BOX_KEYS.test(match[1])) return true;
    }
  }
  return false;
}

/**
 * AppTexts that carry the component's own testID (`testID={testID}` or `testID={props.testID}`)
 * while their parent View (or Animated.View) draws the box and has no testID of its own, and the
 * AppText is its only labelled child (the rest are icons). Maestro and the parity bounds then
 * measure the text, not the tab, chip or sticker the design measures. Part ids (`${id}.label`) on
 * text stay fine, and so does text in a plain layout View (a label row, a text column).
 */
export function testIdsOnInnerText(text) {
  const elements = jsxElements(text);
  const sheets = styleSheetRanges(text);
  const hasTestId = (element) => /\btestID\s*=/.test(element.attrs);
  const hasOwnTestId = (element) => /\btestID\s*=\s*\{\s*(?:props\.)?testID\s*\}/.test(element.attrs);
  const found = [];
  for (const element of elements) {
    if (element.name !== 'AppText' || !hasOwnTestId(element) || element.parent === null) continue;
    const parent = elements[element.parent];
    if (!['View', 'Animated.View'].includes(parent.name) || hasTestId(parent)) continue;
    const siblings = parent.children.filter((index) => elements[index] !== element).map((index) => elements[index]);
    if (siblings.some((sibling) => hasTestId(sibling) || sibling.name === 'AppText')) continue;
    if (drawsBox(parent.attrs, text, sheets)) found.push({ index: element.start, parent: parent.name });
  }
  return found;
}
