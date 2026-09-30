// app-modules.mjs: imports the app repo's pure TypeScript modules straight from its root, so a
// checker can run the real rules and RNG code. Not an entry point.
//
// Node strips TypeScript types itself (Node 22.18+; the project pins Node 26). A resolve hook maps
// the workspace specifiers the code uses: '@e07/<name>/<path>' goes to packages/<name>/src/<path>
// when that package exists, else to apps/<name>/src/<path>. A load hook reads every .ts file under
// the root as an ES module and turns .json files into a default export, so the check works with or
// without package.json files. Modules that import React Native, Skia or Expo cannot load this way,
// which is exactly the purity the rules need.

import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { fail } from '../check-lib.mjs';

let registeredRoot = null;

export function enableAppImports(root) {
  const absRoot = resolve(root);
  if (registeredRoot !== null && registeredRoot !== absRoot) {
    fail(`app imports are already enabled for ${registeredRoot}`, 'Check one app repo per process.');
  }
  if (typeof registerHooks !== 'function' || !process.features?.typescript) {
    fail('this Node cannot load TypeScript modules (module.registerHooks and type stripping are needed)', 'Use Node 22.18 or newer; the project pins Node 26.');
  }
  const rootUrl = pathToFileURL(`${absRoot}/`).href;
  if (registeredRoot === null) {
    registerHooks({
      resolve(specifier, context, nextResolve) {
        const match = /^@e07\/([a-z0-9-]+)\/(.+)$/.exec(specifier);
        if (match === null) return nextResolve(specifier, context);
        const [, name, rest] = match;
        const base = existsSync(join(absRoot, 'packages', name)) ? `packages/${name}/src/` : `apps/${name}/src/`;
        return nextResolve(new URL(base + rest, rootUrl).href, context);
      },
      load(url, context, nextLoad) {
        if (!url.startsWith(rootUrl) || url.includes('/node_modules/')) return nextLoad(url, context);
        if (url.endsWith('.ts')) return nextLoad(url, { ...context, format: 'module-typescript' });
        if (url.endsWith('.json')) {
          const text = readFileSync(fileURLToPath(url), 'utf8');
          return { format: 'module', source: `export default ${text};`, shortCircuit: true };
        }
        return nextLoad(url, context);
      },
    });
    registeredRoot = absRoot;
  }
  return {
    exists: (rel) => existsSync(join(absRoot, rel)),
    load: (rel) => import(pathToFileURL(join(absRoot, rel)).href),
  };
}

/** One line for a load or run error: the message, without the stack. */
export function errorText(error) {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.split('\n')[0];
}
