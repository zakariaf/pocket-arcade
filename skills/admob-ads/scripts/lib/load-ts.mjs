// load-ts.mjs: imports the app repo's own TypeScript modules into a checker through Node's built-in
// type stripping (Node 22.18+), so behaviour checks run the real code without Jest or a build.
// Workspace imports ('@e07/<package>/<path>') resolve to <root>/packages/<package>/src/<path> or
// <root>/apps/<package>/src/<path>, like the repo's Jest moduleNameMapper. setModuleStubs() maps
// native packages (the ads SDK, expo-iap, react, expo-constants) to Node stand-ins so adapters run.
// Not an entry point.

import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { fail } from '../check-lib.mjs';

let registeredRoot = null;
const stubs = new Map();

/** Resolve these bare specifiers to local stand-in files ({ 'react': '/abs/stub.mjs' }). Call before importing. */
export function setModuleStubs(map) {
  for (const [specifier, file] of Object.entries(map)) stubs.set(specifier, pathToFileURL(file).href);
}

function requireTypeStripping() {
  if (!process.features?.typescript) {
    fail(`Node ${process.version} cannot strip TypeScript types`, 'Use Node 22.18 or newer (type stripping on by default), then rerun.');
  }
}

function registerWorkspaceAliases(root) {
  if (registeredRoot === root) return;
  if (registeredRoot !== null) fail('load-ts: one repo root per process', 'Run the checker once per repo.');
  registeredRoot = root;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (stubs.has(specifier)) return { url: stubs.get(specifier), shortCircuit: true };
      const match = /^@e07\/([^/]+)\/(.+)$/.exec(specifier);
      if (match) {
        const inPackage = join(root, 'packages', match[1], 'src', match[2]);
        const inApp = join(root, 'apps', match[1], 'src', match[2]);
        const target = existsSync(inPackage) ? inPackage : inApp;
        return { url: pathToFileURL(target).href, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
}

/**
 * Import <root>/<rel> (a .ts module of the app repo). Returns { module } or { error } with a
 * one-line reason, so a checker can report a missing or broken module as a problem.
 */
export async function importRepoModule(root, rel) {
  requireTypeStripping();
  const abs = resolve(root, rel);
  registerWorkspaceAliases(resolve(root));
  if (!existsSync(abs)) return { error: `${rel} does not exist` };
  try {
    return { module: await import(pathToFileURL(abs).href) };
  } catch (error) {
    const first = String(error?.message ?? error).split('\n')[0];
    return { error: `${rel} could not be loaded: ${first}` };
  }
}
