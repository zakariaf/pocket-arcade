// source-scan.mjs: pulls string literals, template-literal patterns, t() keys and the id props passed
// to Toybox components out of TypeScript sources, without a parser. Helper for check-screens.mjs.

import { lineOf, maskComments } from '../check-lib.mjs';

/** One dynamic segment of a testID or key: `${level}` in levels.level-tile.${level}. */
const SEGMENT = '[a-z0-9-]+';

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Read a template literal starting at `start` (the backtick); returns its parts and end index. */
function readTemplate(source, start) {
  const parts = [''];
  let i = start + 1;
  while (i < source.length && source[i] !== '`') {
    if (source[i] === '\\') {
      parts[parts.length - 1] += source.slice(i, i + 2);
      i += 2;
    } else if (source[i] === '$' && source[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      while (j < source.length && depth > 0) {
        if (source[j] === '{') depth += 1;
        else if (source[j] === '}') depth -= 1;
        j += 1;
      }
      parts.push(null, '');
      i = j;
    } else {
      parts[parts.length - 1] += source[i];
      i += 1;
    }
  }
  return { parts, end: i + 1 };
}

/**
 * Every string in a file:
 *   plain:    { value, line }                      'home.screen', "home.screen", `home.screen`
 *   template: { parts: ['levels.pack.', null, '.heading'], line }  (null = an interpolation)
 */
export function scanStrings(rawSource) {
  const source = maskComments(rawSource);
  const plain = [];
  const templates = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== ch && source[j] !== '\n') j += source[j] === '\\' ? 2 : 1;
      plain.push({ value: source.slice(i + 1, j), line: lineOf(source, i), index: i });
      i = j + 1;
    } else if (ch === '`') {
      const { parts, end } = readTemplate(source, i);
      if (parts.length === 1) plain.push({ value: parts[0], line: lineOf(source, i), index: i });
      else templates.push({ parts, line: lineOf(source, i), index: i });
      i = end;
    } else {
      i += 1;
    }
  }
  return { plain, templates, source };
}

/** A template that starts with literal text: a full pattern (levels.level-tile.${n}.number). */
export function templateRegExp(parts) {
  return new RegExp(`^${parts.map((part) => (part === null ? SEGMENT : escapeRegExp(part))).join('')}$`);
}

/**
 * A template that starts with an interpolation (`${testID}.label`): the literal tail after the
 * first interpolation, as a suffix pattern (\.label$). Returns null when there is no tail.
 */
export function suffixRegExp(parts) {
  const tail = parts.slice(2);
  if (tail.length === 0 || tail.every((part) => part === null || part === '')) return null;
  const body = tail.map((part) => (part === null ? SEGMENT : escapeRegExp(part))).join('');
  if (!body.startsWith('\\.')) return null;
  return new RegExp(`${body}$`);
}

/** String literals passed to t(...): `t('a.b')`, `t(isX ? 'a.b' : 'c.d', { … })`. */
export function scanTKeys(source) {
  const keys = [];
  const call = /(^|[^A-Za-z0-9_$.])t\(/g;
  for (const match of source.matchAll(call)) {
    let depth = 1;
    let j = match.index + match[0].length;
    const start = j;
    while (j < source.length && depth > 0) {
      if (source[j] === '(') depth += 1;
      else if (source[j] === ')') depth -= 1;
      j += 1;
    }
    const args = source.slice(start, j - 1);
    // Only the key argument: everything before the values object.
    const keyPart = args.split('{')[0];
    for (const literal of keyPart.matchAll(/['"]([a-z0-9]+(?:[.-][a-z0-9]+)+)['"]/g)) {
      keys.push({ key: literal[1], line: lineOf(source, start + literal.index) });
    }
  }
  return keys;
}

/** The opening JSX tag starting at `start` ("<Name ..."), up to its closing ">" outside braces. */
function openingTag(source, start) {
  let depth = 0;
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

/**
 * The id props a file passes to Toybox components: `<StatGrid testIDBase="stats.overview-card"`.
 * `idProps` is { Component: ['testIDBase', ...] }. Each hit is
 *   { component, prop, line, kind: 'literal', value }          "x", {'x'}
 *   { component, prop, line, kind: 'template', parts }         {`levels.pack.${n}`} (null = ${…})
 *   { component, prop, line, kind: 'dynamic' }                 {scope}, {props.testID}
 */
export function scanIdProps(rawSource, idProps) {
  const source = maskComments(rawSource);
  const hits = [];
  // `import { GameTopBar as ToyboxGameTopBar } from '@e07/shell/ui/game-top-bar.tsx'`: the alias
  // is still the Toybox component.
  const aliases = new Map();
  for (const imp of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@e07\/shell\/ui\/[^'"]+['"]/g)) {
    for (const part of imp[1].split(',')) {
      const alias = /^\s*([A-Z]\w*)\s+as\s+([A-Z]\w*)\s*$/.exec(part);
      if (alias) aliases.set(alias[2], alias[1]);
    }
  }
  for (const match of source.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)) {
    const component = aliases.get(match[1]) ?? match[1];
    const props = idProps[component];
    if (!props) continue;
    const tag = openingTag(source, match.index);
    const line = lineOf(source, match.index);
    for (const prop of props) {
      const at = new RegExp(`(?:^|\\s)${prop}=`).exec(tag);
      if (!at) continue;
      const rest = tag.slice(at.index + at[0].length);
      const literal = /^(?:"([^"]*)"|\{\s*'([^']*)'\s*\}|\{\s*"([^"]*)"\s*\})/.exec(rest);
      if (literal) {
        hits.push({ component, prop, line, kind: 'literal', value: literal[1] ?? literal[2] ?? literal[3] });
      } else if (/^\{\s*`/.test(rest)) {
        const start = rest.indexOf('`');
        hits.push({ component, prop, line, kind: 'template', parts: readTemplate(rest, start).parts });
      } else {
        hits.push({ component, prop, line, kind: 'dynamic' });
      }
    }
  }
  return hits;
}

/** How many hero keys a file renders: size="hero" or size={'hero'}. */
export function countHeroKeys(source) {
  return [...source.matchAll(/\bsize=(?:"hero"|\{\s*['"]hero['"]\s*\})/g)].map((match) => lineOf(source, match.index));
}

/** Where the file renders or imports the banner slot. */
export function bannerUses(source) {
  return [...source.matchAll(/<AdBannerSlot\b|from\s+['"][^'"]*ad-banner-slot(?:\.tsx)?['"]/g)].map((match) =>
    lineOf(source, match.index),
  );
}

/**
 * Every it()/test() block of a test file: { name, line, body } (body = the callback's braces).
 * Comments are masked first, so a commented-out audit does not count.
 */
export function testBlocks(rawSource) {
  const source = maskComments(rawSource);
  const blocks = [];
  const start = /\b(?:it|test)(?:\.each\([^)]*\))?\(\s*(['"`])((?:\\.|(?!\1).)*)\1\s*,/g;
  for (const match of source.matchAll(start)) {
    const arrow = source.indexOf('=>', match.index);
    const open = arrow === -1 ? -1 : source.indexOf('{', arrow);
    if (open === -1) continue;
    let depth = 0;
    let close = open;
    for (; close < source.length; close += 1) {
      if (source[close] === '{') depth += 1;
      else if (source[close] === '}' && (depth -= 1) === 0) break;
    }
    blocks.push({ name: match[2], line: lineOf(source, match.index), body: source.slice(open, close + 1) });
  }
  return blocks;
}
