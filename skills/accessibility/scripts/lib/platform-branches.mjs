// platform-branches.mjs: finds platform-only code in TypeScript/TSX source, so a rule can judge each
// platform's own value. Not an entry point; check-a11y-code.mjs imports it.
//
// platformExpressions(source, masked)  every Platform.select({ ... }) call and every
//                                      Platform.OS === / !== '<os>' ? a : b ternary:
//                                      { from, to, branch: { android, ios } } where each branch is
//                                      { from, to } or null (no value on that platform).
// androidOnlySpans(source, masked)     [from, to) ranges whose code runs only on Android.
// resolvePlatform(text, platform)      the text with every platform expression replaced by the
//                                      branch that platform takes ('undefined' when it has none).
// styleSizesFor(objectText)            { width, height, minWidth, minHeight } of a style object
//                                      literal: top-level keys and object spreads, the last one
//                                      wins; a number, 44 for MIN_TOUCH, null when computed.

import { findClosing, maskCode } from './source-scan.mjs';

const MIN_TOUCH = 44;
const CLOSERS = new Set([')', '}', ']']);

/** The end (exclusive) of an expression starting at `from`: a depth-0 comma, semicolon or closer. */
function expressionEnd(masked, from, stopAtColon) {
  let depth = 0;
  let pendingTernaries = 0;
  for (let i = from; i < masked.length; i += 1) {
    const ch = masked[i];
    if (ch === '(' || ch === '{' || ch === '[') depth += 1;
    else if (CLOSERS.has(ch)) {
      if (depth === 0) return i;
      depth -= 1;
    } else if (depth === 0 && (ch === ',' || ch === ';')) return i;
    else if (depth === 0 && ch === '?' && masked[i + 1] !== '?' && masked[i + 1] !== '.' && masked[i - 1] !== '?') pendingTernaries += 1;
    else if (depth === 0 && ch === ':') {
      if (pendingTernaries > 0) pendingTernaries -= 1;
      else if (stopAtColon) return i;
    }
  }
  return masked.length;
}

/** Trimmed [from, to) of the slice. */
function trimmed(text, from, to) {
  let a = from;
  let b = to;
  while (a < b && /\s/.test(text[a])) a += 1;
  while (b > a && /\s/.test(text[b - 1])) b -= 1;
  return { from: a, to: b };
}

function selectExpressions(masked) {
  const found = [];
  // Not findCalls: its look-behind skips a call after "." and so the spread ...Platform.select(...).
  const calls = [...masked.matchAll(/(?<![\w$])Platform\.select\s*\(/g)].map((m) => {
    const open = m.index + m[0].length - 1;
    return { start: m.index, open, close: findClosing(masked, open) };
  });
  for (const call of calls.filter((found) => found.close !== -1)) {
    const open = masked.indexOf('{', call.open);
    if (open === -1 || open > call.close) continue;
    const close = findClosing(masked, open);
    const values = {};
    for (const key of masked.slice(open, close).matchAll(/[{,]\s*(android|ios|native|default)\s*:/g)) {
      const at = open + key.index + key[0].length;
      let depth = 0;
      for (let i = open; i < at; i += 1) depth += '({['.includes(masked[i]) ? 1 : ')}]'.includes(masked[i]) ? -1 : 0;
      if (depth !== 1) continue;
      values[key[1]] = trimmed(masked, at, expressionEnd(masked, at, false));
    }
    const pick = (os) => values[os] ?? values.native ?? values.default ?? null;
    found.push({ from: call.start, to: call.close + 1, branch: { android: pick('android'), ios: pick('ios') } });
  }
  return found;
}

function ternaryExpressions(source, masked) {
  const found = [];
  for (const m of masked.matchAll(/Platform\.OS\s*([!=]==?)\s*(['"])/g)) {
    const quote = m.index + m[0].length - 1;
    const end = source.indexOf(source[quote], quote + 1);
    if (end === -1) continue;
    const os = source.slice(quote + 1, end);
    let i = end + 1;
    while (i < masked.length && /\s/.test(masked[i])) i += 1;
    if (masked[i] !== '?' || !['android', 'ios'].includes(os)) continue;
    const whenTrue = trimmed(masked, i + 1, expressionEnd(masked, i + 1, true));
    const colon = masked.indexOf(':', whenTrue.to);
    const whenFalse = trimmed(masked, colon + 1, expressionEnd(masked, colon + 1, false));
    const isAndroid = (os === 'android') === m[1].startsWith('=');
    found.push({ from: m.index, to: whenFalse.to, branch: { android: isAndroid ? whenTrue : whenFalse, ios: isAndroid ? whenFalse : whenTrue } });
  }
  return found;
}

/** Every platform expression, sorted by position (nested ones included). */
export function platformExpressions(source, masked = maskCode(source)) {
  return [...selectExpressions(masked), ...ternaryExpressions(source, masked)].sort((a, b) => a.from - b.from);
}

/** [from, to) ranges that run only on Android: the android branch of each platform expression. */
export function androidOnlySpans(source, masked = maskCode(source)) {
  return platformExpressions(source, masked)
    .filter((expr) => expr.branch.android !== null && expr.branch.android !== expr.branch.ios)
    .map((expr) => expr.branch.android);
}

/** The text as `platform` runs it: each outermost platform expression becomes its branch. */
export function resolvePlatform(text, platform) {
  const masked = maskCode(text);
  let out = '';
  let at = 0;
  for (const expr of platformExpressions(text, masked)) {
    if (expr.from < at) continue; // nested: resolved with its outer branch
    const branch = expr.branch[platform];
    out += text.slice(at, expr.from) + (branch === null ? 'undefined' : `(${resolvePlatform(text.slice(branch.from, branch.to), platform)})`);
    at = expr.to;
  }
  return out + text.slice(at);
}

/** Strips wrapping parentheses: "(({ a: 1 }))" -> "{ a: 1 }". */
function unwrap(text) {
  let value = text.trim();
  while (value.startsWith('(') && findClosing(maskCode(value), 0) === value.length - 1) value = value.slice(1, -1).trim();
  return value;
}

function readValue(raw) {
  const value = unwrap(raw);
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value === 'MIN_TOUCH') return MIN_TOUCH;
  return null;
}

/** The size keys of a style object literal (its own keys and its object spreads, last one wins). */
export function styleSizesFor(objectText) {
  const sizes = { width: undefined, height: undefined, minWidth: undefined, minHeight: undefined };
  const text = unwrap(objectText);
  if (!text.startsWith('{')) return sizes;
  const masked = maskCode(text);
  const close = findClosing(masked, 0);
  let i = 1;
  while (i < close) {
    const end = expressionEnd(masked, i, false);
    const entry = trimmed(masked, i, end);
    const body = text.slice(entry.from, entry.to);
    if (body.startsWith('...')) {
      const inner = styleSizesFor(body.slice(3));
      for (const key of Object.keys(sizes)) if (inner[key] !== undefined) sizes[key] = inner[key];
    } else {
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(body);
      if (m && m[1] in sizes) sizes[m[1]] = readValue(body.slice(m[0].length));
    }
    i = end + 1;
  }
  return sizes;
}
