// app-source.mjs: helpers to read the app repo's TypeScript: import a pure data module with Node's
// type stripping (Node 22.18 or newer), find StyleSheet blocks, and compare values.

import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { UsageError, maskComments } from '../check-lib.mjs';

let warningsSilenced = false;

/** Node warns about .ts files in packages without "type": "module"; that is expected for apps. */
function silenceModuleWarnings() {
  if (warningsSilenced) return;
  warningsSilenced = true;
  process.removeAllListeners('warning');
  process.on('warning', (warning) => {
    if (warning.code === 'MODULE_TYPELESS_PACKAGE_JSON' || warning.name === 'ExperimentalWarning') return;
    console.error(`${warning.name}: ${warning.message}`);
  });
}

/**
 * Import a TypeScript data module (only type imports, plain objects) and return its exports.
 * Returns { module } or { error } with a message a stranger can act on.
 */
export async function importTsModule(absPath) {
  silenceModuleWarnings();
  try {
    return { module: await import(pathToFileURL(absPath).href) };
  } catch (error) {
    if (error?.code === 'ERR_UNKNOWN_FILE_EXTENSION') {
      throw new UsageError(`Node ${process.versions.node} cannot load .ts files`, 'Use Node 22.18 or newer (type stripping is on by default there).');
    }
    const first = String(error?.message ?? error).split('\n')[0];
    return { error: first };
  }
}

export function readSource(absPath) {
  return existsSync(absPath) ? readFileSync(absPath, 'utf8') : null;
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

export function masked(source) {
  return maskComments(source);
}

/** Deep equality for JSON-like data; numbers compare within 1e-9. */
export function sameValue(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => sameValue(a[key], b[key]));
  }
  return a === b;
}

/** Lists the keys whose values differ: [{ key, actual, expected }]. */
export function diffObject(actual, expected) {
  const out = [];
  const keys = new Set([...Object.keys(expected ?? {}), ...Object.keys(actual ?? {})]);
  for (const key of keys) {
    if (!sameValue(actual?.[key], expected?.[key])) out.push({ key, actual: actual?.[key], expected: expected?.[key] });
  }
  return out;
}

export function show(value) {
  return value === undefined ? 'missing' : JSON.stringify(value);
}
