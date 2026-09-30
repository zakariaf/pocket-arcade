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

/** Every repo root whose modules may load, as file URLs ending in '/'. */
const rootUrls = [];

/** The registered root a module URL lives in (the newest root when the importer is outside all). */
function rootOf(url) {
  return rootUrls.find((root) => typeof url === 'string' && url.startsWith(root)) ?? rootUrls.at(-1);
}

/**
 * Lets this process import the repo's TypeScript from `root`. Several roots may be enabled (the
 * self-test builds more than one repo); '@e07/...' resolves inside the root of the importing file.
 */
export function enableAppImports(root) {
  const absRoot = resolve(root);
  if (typeof registerHooks !== 'function' || !process.features?.typescript) {
    fail('this Node cannot load TypeScript modules (module.registerHooks and type stripping are needed)', 'Use Node 22.18 or newer; the project pins Node 26.');
  }
  const rootUrl = pathToFileURL(`${absRoot}/`).href;
  if (rootUrls.length === 0) {
    registerHooks({
      resolve(specifier, context, nextResolve) {
        const match = /^@e07\/([a-z0-9-]+)\/(.+)$/.exec(specifier);
        if (match === null) return nextResolve(specifier, context);
        const [, name, rest] = match;
        const base = rootOf(context.parentURL);
        const folder = existsSync(new URL(`packages/${name}`, base)) ? `packages/${name}/src/` : `apps/${name}/src/`;
        return nextResolve(new URL(folder + rest, base).href, context);
      },
      load(url, context, nextLoad) {
        if (!rootUrls.some((root) => url.startsWith(root)) || url.includes('/node_modules/')) return nextLoad(url, context);
        if (url.endsWith('.ts')) return nextLoad(url, { ...context, format: 'module-typescript' });
        if (url.endsWith('.json')) {
          const text = readFileSync(fileURLToPath(url), 'utf8');
          return { format: 'module', source: `export default ${text};`, shortCircuit: true };
        }
        return nextLoad(url, context);
      },
    });
  }
  if (!rootUrls.includes(rootUrl)) rootUrls.push(rootUrl);
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
