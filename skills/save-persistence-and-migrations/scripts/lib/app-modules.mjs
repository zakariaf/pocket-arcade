// app-modules.mjs: import the app's pure TypeScript modules straight from an app repo root.
//
// Node strips the types (Node 22.18+ does it by default; the project runs Node 26). A resolve
// hook maps the workspace specifiers the app uses: '@e07/<package>/<path>' goes to
// packages/<package>/src/<path>, or apps/<package>/src/<path> for a game. A load hook reads every
// .ts file under the root as an ES module, so the check works with or without package.json files.
// Only modules whose imports are pure (types, other pure modules) can be loaded this way.

import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { fail } from '../check-lib.mjs';

export function enableAppImports(root) {
  if (typeof registerHooks !== 'function') {
    fail('this Node has no module.registerHooks()', 'Use Node 22.15 or newer (the project pins Node 26).');
  }
  if (!process.features?.typescript) {
    fail('this Node cannot strip TypeScript types', 'Use Node 22.18 or newer (the project pins Node 26).');
  }
  const absRoot = resolve(root);
  const rootUrl = pathToFileURL(`${absRoot}/`).href;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const match = /^@e07\/([a-z0-9-]+)\/(.+)$/.exec(specifier);
      if (match === null) return nextResolve(specifier, context);
      const [, name, rest] = match;
      const base = existsSync(join(absRoot, 'packages', name)) ? `packages/${name}/src/` : `apps/${name}/src/`;
      return nextResolve(new URL(base + rest, rootUrl).href, context);
    },
    load(url, context, nextLoad) {
      if (url.startsWith(rootUrl) && url.endsWith('.ts') && !url.includes('/node_modules/')) {
        return nextLoad(url, { ...context, format: 'module-typescript' });
      }
      return nextLoad(url, context);
    },
  });
  return {
    exists: (rel) => existsSync(join(absRoot, rel)),
    load: (rel) => import(pathToFileURL(join(absRoot, rel)).href),
  };
}

/** Deep-freezes a value so a reducer that mutates its input throws in strict mode. */
export function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/** 1-based line of the first "function <name>" or "const <name>" in a source text, else 1. */
export function lineOfExport(source, name) {
  const match = new RegExp(`(function\\s+${name}\\b|const\\s+${name}\\b)`).exec(source ?? '');
  if (!match) return 1;
  return source.slice(0, match.index).split('\n').length;
}

const shortJson = (value) => {
  const text = JSON.stringify(value);
  if (text === undefined) return String(value);
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
};

/** One-line reason for a failed check; Node's generated assert messages become "expected X, got Y". */
export function reasonOf(error) {
  const first = String(error?.message ?? error).split('\n')[0];
  if (error?.generatedMessage !== true || !('actual' in error)) return first;
  return `expected ${shortJson(error.expected)}, got ${shortJson(error.actual)}`;
}
