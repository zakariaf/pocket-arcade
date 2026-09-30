// source-scan.mjs: small, dependency-free helpers for scanning TypeScript/TSX source text.
// Not an entry point. The checkers in ../ import it.
//
// maskCode(source)            blanks comments AND the insides of string/template literals, keeping
//                             quotes, newlines and every character position (so indexes and line
//                             numbers stay valid). Use it to find structure (braces, tags, calls).
// findClosing(masked, index)  index of the bracket that closes the one at `index` ((, {, [).
// findJsxTags(source, masked) every JSX opening/self-closing tag: { name, start, end, attrs, selfClosing }.
// jsxAttributes(source, tag)  Map of attribute name -> { kind: 'string'|'expr'|'bool', value, index }.
// findCalls(masked, pattern)  every call matching `pattern` (a RegExp ending just before "("): { start, open, close }.
// literalText(source, start, end) the raw text of a slice.

const OPENERS = { '(': ')', '{': '}', '[': ']' };

/** Blank comments and literal contents; keep delimiters, newlines and positions. */
export function maskCode(source) {
  const out = source.split('');
  const n = source.length;
  let i = 0;
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k += 1) if (out[k] !== '\n') out[k] = ' ';
  };
  // Template literals can nest `${ ... }` expressions that contain more code.
  const templateStack = [];
  let braceDepth = 0;
  let lastSignificant = '';
  // '<' is left out: "</View>" is a closing tag, not a regex. "/>" is always a self-closing tag.
  const regexAllowedAfter = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '>', '~', '^', 'kw']);
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && source[j] !== ch && source[j] !== '\n') {
        if (source[j] === '\\') j += 1;
        j += 1;
      }
      blank(i + 1, j);
      i = j + 1;
      lastSignificant = 'x';
      continue;
    }
    if (ch === '`' || (ch === '}' && templateStack.length > 0 && templateStack.at(-1) === braceDepth)) {
      // Start of a template, or the end of a ${ } expression that resumes the template.
      if (ch === '}') templateStack.pop();
      let j = i + 1;
      let resumed = false;
      while (j < n) {
        if (source[j] === '\\') {
          j += 2;
          continue;
        }
        if (source[j] === '`') break;
        if (source[j] === '$' && source[j + 1] === '{') {
          blank(i + 1, j);
          templateStack.push(braceDepth);
          i = j + 2;
          resumed = true;
          break;
        }
        j += 1;
      }
      if (resumed) {
        lastSignificant = '{';
        continue;
      }
      blank(i + 1, j);
      i = j + 1;
      lastSignificant = 'x';
      continue;
    }
    if (ch === '/' && next !== '>' && regexAllowedAfter.has(lastSignificant)) {
      let j = i + 1;
      let inClass = false;
      while (j < n && source[j] !== '\n') {
        if (source[j] === '\\') j += 1;
        else if (source[j] === '[') inClass = true;
        else if (source[j] === ']') inClass = false;
        else if (source[j] === '/' && !inClass) break;
        j += 1;
      }
      if (j < n && source[j] === '/') {
        blank(i + 1, j);
        i = j + 1;
        lastSignificant = 'x';
        continue;
      }
    }
    if (ch === '{') braceDepth += 1;
    else if (ch === '}') braceDepth -= 1;
    if (!/\s/.test(ch)) {
      if (/[A-Za-z_$]/.test(ch) && (i === 0 || !/[A-Za-z0-9_$]/.test(source[i - 1]))) {
        const word = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(i))[0];
        lastSignificant = ['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await'].includes(word) ? 'kw' : 'x';
        i += word.length;
        continue;
      }
      lastSignificant = /[A-Za-z0-9_$)\]]/.test(ch) ? 'x' : ch;
    }
    i += 1;
  }
  return out.join('');
}

/** Index of the bracket closing the one at `index` in masked source, or -1. */
export function findClosing(masked, index) {
  const open = masked[index];
  const close = OPENERS[open];
  if (!close) return -1;
  let depth = 0;
  for (let i = index; i < masked.length; i += 1) {
    const ch = masked[i];
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * JSX opening and self-closing tags (capitalised component names) in a .tsx file. A "<" glued to
 * an identifier, ")" or "]" is a generic (useState<T>(), Array<T>) and is skipped.
 */
export function findJsxTags(source, masked = maskCode(source)) {
  const tags = [];
  const re = /<([A-Z][A-Za-z0-9_.]*)/g;
  for (const match of masked.matchAll(re)) {
    const start = match.index;
    const before = start > 0 ? masked[start - 1] : '';
    if (/[A-Za-z0-9_$)\].]/.test(before)) continue;
    let i = start + match[0].length;
    let depth = 0;
    let end = -1;
    let selfClosing = false;
    while (i < masked.length) {
      const ch = masked[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      else if (depth === 0 && ch === '>') {
        end = i;
        selfClosing = masked[i - 1] === '/';
        break;
      } else if (depth === 0 && ch === '<') break;
      i += 1;
    }
    if (end === -1) continue;
    const attrsFrom = start + match[0].length;
    tags.push({ name: match[1], start, end, attrsFrom, attrsTo: selfClosing ? end - 1 : end, selfClosing });
  }
  return tags;
}

/** Attributes of one tag from findJsxTags. Values keep their original (unmasked) text. */
export function jsxAttributes(source, tag, masked = maskCode(source)) {
  const attrs = new Map();
  let i = tag.attrsFrom;
  const to = tag.attrsTo;
  while (i < to) {
    while (i < to && /\s/.test(masked[i])) i += 1;
    if (i >= to) break;
    if (masked[i] === '{') {
      // Spread attribute {...props}: skip it.
      const close = findClosing(masked, i);
      if (close === -1) break;
      attrs.set(`...${i}`, { kind: 'spread', value: source.slice(i + 1, close), index: i });
      i = close + 1;
      continue;
    }
    const nameMatch = /^[A-Za-z_][A-Za-z0-9_:-]*/.exec(masked.slice(i, to));
    if (!nameMatch) {
      i += 1;
      continue;
    }
    const name = nameMatch[0];
    const index = i;
    i += name.length;
    while (i < to && /\s/.test(masked[i])) i += 1;
    if (masked[i] !== '=') {
      attrs.set(name, { kind: 'bool', value: 'true', index });
      continue;
    }
    i += 1;
    while (i < to && /\s/.test(masked[i])) i += 1;
    const quote = masked[i];
    if (quote === '"' || quote === "'") {
      const close = masked.indexOf(quote, i + 1);
      attrs.set(name, { kind: 'string', value: source.slice(i + 1, close), index });
      i = close + 1;
    } else if (quote === '{') {
      const close = findClosing(masked, i);
      attrs.set(name, { kind: 'expr', value: source.slice(i + 1, close).trim(), index });
      i = close + 1;
    } else {
      i += 1;
    }
  }
  return attrs;
}

/** String value of an attribute expression when it is a plain literal: "x", 'x', `x` (no ${}). */
export function literalOf(attr) {
  if (!attr) return null;
  if (attr.kind === 'string') return attr.value;
  if (attr.kind !== 'expr') return null;
  const m = /^(['"`])([\s\S]*)\1$/.exec(attr.value);
  if (!m) return null;
  if (m[1] === '`' && m[2].includes('${')) return null;
  return m[2];
}

/** Calls whose callee matches `callee` (a RegExp source without the "("), e.g. 'StyleSheet\\.create'. */
export function findCalls(masked, callee) {
  const calls = [];
  const re = new RegExp(`(?<![A-Za-z0-9_$.])${callee}\\s*\\(`, 'g');
  for (const match of masked.matchAll(re)) {
    const open = match.index + match[0].length - 1;
    const close = findClosing(masked, open);
    if (close !== -1) calls.push({ start: match.index, open, close });
  }
  return calls;
}

/** The first-level import specifiers of a module: [{ from, index, text }]. */
export function findImports(source, masked = maskCode(source)) {
  const imports = [];
  const re = /(^|\n)\s*import\s[^;]*?from\s*(['"])([^'"]*)\2|(^|\n)\s*import\s*(['"])([^'"]*)\5/g;
  // Match on the original text: module specifiers are blanked in the masked copy.
  for (const match of source.matchAll(re)) {
    const index = match.index + match[0].search(/import/);
    if (masked.slice(index, index + 6) !== 'import') continue; // inside a comment or a string
    const from = match[3] ?? match[6];
    imports.push({ from, index, text: match[0].trim() });
  }
  return imports;
}
