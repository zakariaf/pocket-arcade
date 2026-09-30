// source-scan.mjs: small text helpers for the store checks (no TypeScript parser needed).
// Every function works on comment-masked source (check-lib maskComments), so line numbers stay right.

/** Index just after the parenthesis that closes the one at `open`, or -1. Skips strings. */
export function closingParen(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipString(source, i);
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function skipString(source, start) {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length && source[i] !== quote) {
    if (source[i] === '\\') i += 1;
    i += 1;
  }
  return i;
}

/** Splits the text between two parentheses into top-level arguments. */
export function splitArgs(inner) {
  const args = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipString(inner, i);
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if (ch === ',' && depth === 0) {
      args.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = inner.slice(start).trim();
  if (last !== '') args.push(last);
  return args;
}

/** Every call of a callee pattern: [{ index, callee, args: string[] }]. */
export function findCalls(source, calleePattern) {
  const calls = [];
  const re = new RegExp(`\\b(${calleePattern})\\s*\\(`, 'g');
  for (const match of source.matchAll(re)) {
    const open = match.index + match[0].length - 1;
    const close = closingParen(source, open);
    if (close === -1) continue;
    calls.push({ index: match.index, callee: match[1], args: splitArgs(source.slice(open + 1, close - 1)) });
  }
  return calls;
}

/** Patterns that make a new object or array on every call (the "Maximum update depth" trap). */
const BUILDS_NEW = [
  /=>\s*\(\s*\{/, // (s) => ({ ... })
  /=>\s*\[/, // (s) => [ ... ]
  /\breturn\s*\{/, // return { ... }
  /\breturn\s*\[/, // return [ ... ]
  /\.(map|filter|slice|concat|flatMap|toSorted|toReversed)\s*\(/,
  /\bObject\.(entries|keys|values|fromEntries|assign)\s*\(/,
  /\bArray\.from\s*\(/,
  /\{\s*\.\.\./,
  /\[\s*\.\.\./,
];

export function buildsNewValue(text) {
  return BUILDS_NEW.some((re) => re.test(text));
}

/**
 * Exported selector functions of a *-selectors.ts file that build a new value:
 * Map<name, line>. Such a selector must be read through useShallow.
 */
export function objectBuildingSelectors(source) {
  const found = new Map();
  const starts = [...source.matchAll(/export\s+(?:function\s+(select\w+)|const\s+(select\w+)\s*=)/g)];
  starts.forEach((match, n) => {
    const name = match[1] ?? match[2];
    const end = n + 1 < starts.length ? starts[n + 1].index : source.length;
    const body = source.slice(match.index, end);
    // Skip the signature: the body starts at the first "=>" or "{" after the parameter list.
    const signatureEnd = body.search(/\)\s*(?::[^=]*?)?(=>|\{)/);
    const bodyText = signatureEnd === -1 ? body : body.slice(signatureEnd);
    if (buildsNewValue(bodyText)) found.set(name, source.slice(0, match.index).split('\n').length);
  });
  return found;
}
