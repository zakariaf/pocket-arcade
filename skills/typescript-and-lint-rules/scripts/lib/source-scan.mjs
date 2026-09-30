// source-scan.mjs: a small, dependency-free lexer for TypeScript and TSX source.
//
// scanSource(text) returns:
//   code         the source with comments AND string/template contents blanked (quotes kept),
//                same length and same line breaks, so regexes on it never match inside text
//   codeKeep     the source with only comments blanked (strings kept), for line counting
//   comments     [{ index, end, text, line }]
//   strings      [{ index, end, quote, value, parts, line }]   quote is ' " or `; for templates
//                `parts` holds the static chunks and `value` joins them with ${}
//   lineOf(i)    1-based line of a character index
//
// Heuristics (good enough for lint-style checks, not a full parser):
//   - a quote directly after a letter or digit is JSX text (an apostrophe), not a string;
//   - "/" starts a regex literal after an operator, an opening bracket or a keyword.

const IDENT = /[A-Za-z0-9_$]/;
const REGEX_AFTER = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'else', 'do']);

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

export function makeLineOf(text) {
  const starts = lineStarts(text);
  return (index) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

export function scanSource(text) {
  const n = text.length;
  const code = text.split('');
  const keep = text.split('');
  const comments = [];
  const strings = [];
  const lineOf = makeLineOf(text);
  const blank = (arr, from, to) => {
    for (let k = from; k < to && k < n; k += 1) if (arr[k] !== '\n') arr[k] = ' ';
  };
  // Stack of open template literals; each entry counts the braces opened inside its ${ }.
  const templates = [];
  let last = '';
  let i = 0;

  const readTemplate = (start, entry) => {
    // Reads template text from `start` until the closing backtick or the next "${".
    let j = start;
    while (j < n && text[j] !== '`') {
      if (text[j] === '\\') {
        j += 2;
        continue;
      }
      if (text[j] === '$' && text[j + 1] === '{') break;
      j += 1;
    }
    entry.parts.push(text.slice(start, Math.min(j, n)));
    blank(code, start, j);
    if (j >= n || text[j] === '`') {
      entry.end = Math.min(j + 1, n);
      entry.value = entry.parts.join('${}');
      strings.push(entry);
      last = 'x';
      return { next: j + 1, open: false };
    }
    templates.push({ entry, depth: 0 });
    last = '{';
    return { next: j + 2, open: true };
  };

  while (i < n) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '/' && next === '/') {
      const stop = text.indexOf('\n', i) === -1 ? n : text.indexOf('\n', i);
      comments.push({ index: i, end: stop, text: text.slice(i, stop), line: lineOf(i) });
      blank(code, i, stop);
      blank(keep, i, stop);
      i = stop;
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = text.indexOf('*/', i + 2);
      const stop = close === -1 ? n : close + 2;
      comments.push({ index: i, end: stop, text: text.slice(i, stop), line: lineOf(i) });
      blank(code, i, stop);
      blank(keep, i, stop);
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (i > 0 && IDENT.test(text[i - 1])) {
        i += 1;
        continue;
      }
      let j = i + 1;
      while (j < n && text[j] !== ch && text[j] !== '\n') {
        if (text[j] === '\\') j += 1;
        j += 1;
      }
      const raw = text.slice(i + 1, Math.min(j, n));
      strings.push({ index: i, end: Math.min(j + 1, n), quote: ch, value: raw.replace(/\\(.)/g, '$1'), parts: [raw], line: lineOf(i) });
      blank(code, i + 1, j);
      i = j + 1;
      last = 'x';
      continue;
    }
    if (ch === '`') {
      const entry = { index: i, end: i, quote: '`', value: '', parts: [], line: lineOf(i) };
      i = readTemplate(i + 1, entry).next;
      continue;
    }
    if (templates.length > 0) {
      const top = templates[templates.length - 1];
      if (ch === '{') top.depth += 1;
      if (ch === '}') {
        if (top.depth === 0) {
          templates.pop();
          i = readTemplate(i + 1, top.entry).next;
          continue;
        }
        top.depth -= 1;
      }
    }
    // JSX: "</Tag>" and "{...} />" are tags, never regex literals.
    const isJsxSlash = last === '<' || (last === '}' && next === '>');
    if (ch === '/' && REGEX_AFTER.has(last) && !isJsxSlash) {
      let j = i + 1;
      let inClass = false;
      while (j < n && text[j] !== '\n') {
        if (text[j] === '\\') j += 1;
        else if (text[j] === '[') inClass = true;
        else if (text[j] === ']') inClass = false;
        else if (text[j] === '/' && !inClass) break;
        j += 1;
      }
      // A regex literal closes on its own line; otherwise this "/" was an operator.
      if (j < n && text[j] === '/') {
        blank(code, i + 1, j);
        i = j + 1;
        last = 'x';
        continue;
      }
    }
    if (!/\s/.test(ch)) {
      if (IDENT.test(ch)) {
        if (i === 0 || !IDENT.test(text[i - 1])) {
          const word = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(text.slice(i, i + 40));
          if (word && REGEX_KEYWORDS.has(word[0])) {
            i += word[0].length;
            last = '(';
            continue;
          }
        }
        last = 'x';
      } else {
        last = ch === ')' || ch === ']' ? 'x' : ch;
      }
    }
    i += 1;
  }
  const stringAt = new Map(strings.map((entry) => [entry.index, entry]));
  return { code: code.join(''), codeKeep: keep.join(''), comments, strings, stringAt, lineOf };
}

/** Index of the bracket that closes the one at `open` in blanked code, or -1. */
export function matchBracket(code, open) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const want = pairs[code[open]];
  if (!want) return -1;
  const stack = [want];
  for (let j = open + 1; j < code.length; j += 1) {
    const c = code[j];
    if (c === '(' || c === '[' || c === '{') stack.push(pairs[c]);
    else if (c === ')' || c === ']' || c === '}') {
      if (stack.pop() !== c) return -1;
      if (stack.length === 0) return j;
    }
  }
  return -1;
}

/**
 * Import specifiers of a scanned file:
 *   [{ spec, index, line, form: 'import' | 'export' | 'side-effect' | 'dynamic' | 'require', typeOnly }]
 */
export function importsOf(scan) {
  const { code, stringAt, lineOf } = scan;
  const found = [];
  const add = (quoteIndex, form, typeOnly, at) => {
    const entry = stringAt.get(quoteIndex);
    if (entry && entry.quote !== '`') found.push({ spec: entry.value, index: quoteIndex, line: lineOf(at), form, typeOnly });
  };
  const statement = /(^|[;\n}])(\s*)(import|export)(\s+type)?\b([^;'"`]*?)\bfrom\s*(['"])/g;
  for (const match of code.matchAll(statement)) {
    const at = match.index + match[1].length + match[2].length;
    const quoteIndex = match.index + match[0].length - 1;
    add(quoteIndex, match[3], Boolean(match[4]), at);
  }
  for (const match of code.matchAll(/(^|[;\n])(\s*)import\s*(['"])/g)) {
    add(match.index + match[0].length - 1, 'side-effect', false, match.index + match[1].length + match[2].length);
  }
  for (const match of code.matchAll(/(?<![\w$.])(import|require)\s*\(\s*(['"])/g)) {
    add(match.index + match[0].length - 1, match[1] === 'import' ? 'dynamic' : 'require', false, match.index);
  }
  return found.sort((a, b) => a.index - b.index);
}

/** Count lines that hold code (not blank, not only comments) between two indexes of codeKeep. */
export function codeLineCount(codeKeep, from = 0, to = codeKeep.length) {
  let count = 0;
  for (const line of codeKeep.slice(from, to).split('\n')) if (line.trim() !== '') count += 1;
  return count;
}

/**
 * Functions with a parenthesised parameter list: `function name(...)` and arrow functions
 * `(...) =>` / `(...): Type =>`. Methods are not listed. Returns
 * [{ name, kind, index, line, params, bodyStart, bodyEnd }]; the body range is -1 when there is
 * no block body (an expression-bodied arrow or an overload signature).
 */
export function functionsOf(scan) {
  const { code, lineOf } = scan;
  const skipSpace = (j) => {
    let k = j;
    while (k < code.length && /\s/.test(code[k])) k += 1;
    return k;
  };
  // What follows a parameter list: { arrow: true, at } for "=>", { arrow: false, at } for a body
  // brace, or null when the parentheses are not a parameter list.
  // `isDeclaration`: after `function name(...)` an arrow can only belong to a function type in
  // the return annotation, so the scan continues to the body brace.
  const afterParams = (close, isDeclaration) => {
    const j = skipSpace(close + 1);
    if (code[j] === '=' && code[j + 1] === '>') return isDeclaration ? null : { arrow: true, at: j + 2 };
    if (code[j] === '{') return { arrow: false, at: j };
    if (code[j] !== ':') return null;
    let k = skipSpace(j + 1);
    if (code[k] === '{') {
      const end = matchBracket(code, k);
      if (end === -1) return null;
      k = end + 1;
    }
    let depth = 0;
    for (; k < code.length; k += 1) {
      const c = code[k];
      if (c === '(' || c === '[' || c === '<') depth += 1;
      else if (c === ')' || c === ']' || (c === '>' && code[k - 1] !== '=')) depth -= 1;
      if (depth < 0) return null;
      if (depth > 0) continue;
      if (c === '=' && code[k + 1] === '>') {
        if (!isDeclaration) return { arrow: true, at: k + 2 };
        k += 1;
        continue;
      }
      if (c === '{') return { arrow: false, at: k };
      if (c === ';' || c === ',' || c === '}' || c === '?') return null;
    }
    return null;
  };
  const bodyAt = (at) => {
    const j = skipSpace(at);
    if (code[j] !== '{') return { bodyStart: -1, bodyEnd: -1 };
    return { bodyStart: j, bodyEnd: matchBracket(code, j) };
  };
  // Regions that hold types, not values: a function type there is not a function.
  const typeRegions = typeRegionsOf(code);
  const inType = (index) => typeRegions.some(([from, to]) => index > from && index < to);
  const candidates = [];
  for (let open = code.indexOf('('); open !== -1; open = code.indexOf('(', open + 1)) {
    const close = matchBracket(code, open);
    if (close === -1) continue;
    const before = code.slice(Math.max(0, open - 120), open);
    const declared = /\bfunction\b\s*\*?\s*([A-Za-z_$][\w$]*)?\s*(<[^()]*>)?\s*$/.exec(before);
    const follow = afterParams(close, Boolean(declared));
    if (!declared && !follow?.arrow) continue;
    let name = declared?.[1] ?? '';
    if (!name) {
      const assigned = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^;]*)?=\s*(?:async\s*)?(?:<[^()]*>\s*)?$/.exec(before);
      name = assigned?.[1] ?? '(anonymous)';
    }
    const body = follow ? bodyAt(follow.at) : { bodyStart: -1, bodyEnd: -1 };
    // The parameter list and the return type annotation hold types too.
    typeRegions.push([open, close]);
    if (follow) typeRegions.push([close, follow.arrow ? follow.at - 2 : follow.at]);
    candidates.push({ name, kind: declared ? 'function' : 'arrow', index: open, line: lineOf(open), params: countParams(code.slice(open + 1, close)), ...body });
  }
  return candidates.filter((fn) => !inType(fn.index));
}

const NOT_METHODS = new Set(['if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'typeof', 'await', 'function', 'super', 'import', 'require']);

/**
 * Every parameter list ESLint's max-params sees: function declarations and expressions, arrow
 * functions, function TYPES (`(a: A, b: B) => R`) and method shorthand (`name(a, b) {`).
 * Returns [{ name, index, line, params }].
 */
export function paramListsOf(scan) {
  const { code, lineOf } = scan;
  const skipSpace = (j) => {
    let k = j;
    while (k < code.length && /\s/.test(code[k])) k += 1;
    return k;
  };
  const out = [];
  for (let open = code.indexOf('('); open !== -1; open = code.indexOf('(', open + 1)) {
    const close = matchBracket(code, open);
    if (close === -1) continue;
    const before = code.slice(Math.max(0, open - 120), open);
    const declared = /\bfunction\b\s*\*?\s*([A-Za-z_$][\w$]*)?\s*(<[^()]*>)?\s*$/.exec(before);
    const j = skipSpace(close + 1);
    const isArrow = code[j] === '=' && code[j + 1] === '>';
    const method = /(?:^|[{,;\s])((?:(?:async|static|get|set|public|private|protected|readonly|override)\s+)*)([A-Za-z_$][\w$]*)\s*(<[^()]*>)?\s*$/.exec(before);
    let isMethod = false;
    if (!declared && !isArrow && method && !NOT_METHODS.has(method[2]) && !/[.\w$]\s*$/.test(before.slice(0, before.length - method[0].length + 1).slice(-1))) {
      let k = j;
      if (code[k] === ':') {
        k = skipSpace(k + 1);
        let depth = 0;
        for (; k < code.length; k += 1) {
          const c = code[k];
          if (c === '(' || c === '[' || c === '<') depth += 1;
          else if (c === ')' || c === ']' || (c === '>' && code[k - 1] !== '=')) depth -= 1;
          if (depth < 0 || (depth === 0 && (c === ';' || c === ',' || c === '}' || c === '?' || c === '='))) break;
          if (depth === 0 && c === '{') break;
        }
      }
      isMethod = code[k] === '{';
    }
    let hasArrowAfterType = false;
    if (!declared && !isArrow && !isMethod && code[j] === ':') {
      // `(a: A): R => ...` arrow with a return type.
      let depth = 0;
      for (let k = skipSpace(j + 1); k < code.length; k += 1) {
        const c = code[k];
        if (c === '(' || c === '[' || c === '<' || c === '{') depth += 1;
        else if (c === ')' || c === ']' || c === '}' || (c === '>' && code[k - 1] !== '=')) depth -= 1;
        if (depth < 0) break;
        if (depth === 0 && c === '=' && code[k + 1] === '>') {
          hasArrowAfterType = true;
          break;
        }
        if (depth === 0 && (c === ';' || c === ',' || c === '?' || (c === '=' && code[k + 1] !== '>'))) break;
      }
    }
    if (!declared && !isArrow && !isMethod && !hasArrowAfterType) continue;
    const name = declared?.[1] ?? (isMethod ? method[2] : '(anonymous)');
    out.push({ name, index: open, line: lineOf(open), params: countParams(code.slice(open + 1, close)) });
  }
  return out;
}

/** [from, to] ranges of `type X = ...;` statements and `const x: Type =` annotations. */
export function typeRegionsOf(code) {
  const regions = [];
  const untilDepthZero = (from, stops) => {
    let depth = 0;
    for (let k = from; k < code.length; k += 1) {
      const c = code[k];
      if (c === '(' || c === '[' || c === '{' || c === '<') depth += 1;
      else if (c === ')' || c === ']' || c === '}' || (c === '>' && code[k - 1] !== '=')) depth -= 1;
      if (depth < 0) return k;
      if (depth === 0 && stops.includes(c) && !(c === '=' && (code[k + 1] === '>' || code[k + 1] === '='))) return k;
    }
    return code.length;
  };
  for (const match of code.matchAll(/(?<![\w$.])type\s+[A-Za-z_$][\w$]*\s*(?:<[^=;{}]*>)?\s*=/g)) {
    const from = match.index + match[0].length;
    regions.push([match.index, untilDepthZero(from, [';'])]);
  }
  for (const match of code.matchAll(/(?<![\w$.])(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*:/g)) {
    const from = match.index + match[0].length;
    regions.push([match.index, untilDepthZero(from, ['=', ';'])]);
  }
  return regions;
}

/** Number of top-level parameters in a parameter list (without the parentheses). */
export function countParams(list) {
  if (list.trim() === '') return 0;
  let depth = 0;
  let count = 1;
  for (let k = 0; k < list.length; k += 1) {
    const c = list[k];
    if (c === '(' || c === '[' || c === '{' || c === '<') depth += 1;
    else if (c === ')' || c === ']' || c === '}' || (c === '>' && list[k - 1] !== '=')) depth -= 1;
    else if (c === ',' && depth === 0) count += 1;
  }
  // A trailing comma (Prettier adds one to wrapped lists) is not a parameter.
  if (/,\s*$/.test(list)) count -= 1;
  const first = list.trim();
  // `this: Type` is a type annotation for `this`, not a parameter.
  if (/^this\s*:/.test(first)) count -= 1;
  return count;
}
