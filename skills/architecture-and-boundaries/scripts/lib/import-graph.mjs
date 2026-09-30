// import-graph.mjs: reads every TypeScript file of the app repo, extracts its imports and resolves
// each one to a repo file, an npm package or a Node built-in (no dependencies, no tsc).

import { existsSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, posix } from 'node:path';

import { REPO_SCAN_IGNORES, walk } from '../check-lib.mjs';
import { importsOf, scanSource } from './source-scan.mjs';
import { workspacePackages } from './workspaces.mjs';

// Generated or local-only folders. Root folders and app build output are anchored, so area folders
// such as packages/tooling/src/build/ are still read.
/** REPO_SCAN_IGNORES (the in-repo skills/ library, .claude/, node_modules, Pods, .expo, each app's generated
 * ios/, android/, build/, out/) plus the folders these checkers also skip. */
export const IGNORE = [...REPO_SCAN_IGNORES, '.git', 'ios', 'android', 'apps/*/dist/', 'apps/*/sfx-preview/', 'coverage/', 'reports/', 'dist-audit/', 'tools/', '.stryker-tmp/', 'expo-env.d.ts'];

const BUILTINS = new Set(builtinModules);
/** Paths that hold monorepo code; anything else at the top level is pre-existing material. */
export const MONOREPO_CODE = /^((apps|packages|test|__mocks__)\/|[^/]+$)/;

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

/** The npm package name of a bare specifier: 'expo-iap' or '@scope/name'. */
export function packageName(spec) {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** A repo-relative path for an import target, trying the usual extensions for extensionless specs. */
function resolveFile(root, rel) {
  const clean = posix.normalize(rel);
  const candidates = [clean, `${clean}.ts`, `${clean}.tsx`, `${clean}/index.ts`, `${clean}/index.tsx`];
  return candidates.find((candidate) => isFile(join(root, candidate))) ?? null;
}

/**
 * Resolve one specifier from a repo file.
 * Returns { kind: 'file', rel } | { kind: 'builtin', name } | { kind: 'package', name } |
 *         { kind: 'workspace-missing', name, rel } (a workspace path that does not exist).
 */
export function resolveSpec(root, fromRel, spec, workspaces) {
  if (spec.startsWith('node:') || BUILTINS.has(spec) || BUILTINS.has(packageName(spec))) return { kind: 'builtin', name: spec.replace(/^node:/, '') };
  if (spec.startsWith('.')) {
    const rel = posix.join(posix.dirname(fromRel), spec);
    const file = resolveFile(root, rel);
    return file ? { kind: 'file', rel: file } : { kind: 'workspace-missing', name: spec, rel };
  }
  const workspace = workspaces.find((entry) => entry.name && (spec === entry.name || spec.startsWith(`${entry.name}/`)));
  if (workspace) {
    const sub = spec.slice(workspace.name.length + 1);
    const exportsMap = workspace.manifest?.exports ?? {};
    const base = sub.startsWith('plugins/') && exportsMap['./plugins/*'] !== undefined ? '' : 'src/';
    const rel = `${workspace.dir}/${base}${sub}`;
    const file = resolveFile(root, rel);
    return file ? { kind: 'file', rel: file } : { kind: 'workspace-missing', name: spec, rel };
  }
  return { kind: 'package', name: packageName(spec) };
}

/**
 * Read the repo: [{ rel, text, scan, imports: [{ spec, line, form, typeOnly, target }] }] and a
 * map rel -> node, plus the workspaces.
 */
export function buildGraph(root) {
  const workspaces = workspacePackages(root);
  // Only monorepo code: pre-existing top-level folders (knowledge, design exports, notes) are not part of the graph.
  const files = walk(root, { include: ['*.ts', '*.tsx'], ignore: IGNORE }).filter((rel) => MONOREPO_CODE.test(rel));
  const nodes = new Map();
  for (const rel of files) {
    const text = readFileSync(join(root, rel), 'utf8');
    const scan = scanSource(text);
    const imports = importsOf(scan).map((entry) => ({ ...entry, target: resolveSpec(root, rel, entry.spec, workspaces) }));
    nodes.set(rel, { rel, text, scan, imports });
  }
  return { nodes, workspaces, files };
}

/**
 * Does a file (or anything it imports, transitively, inside the repo) need Node? The config
 * composer files (`nodeWorldFiles`) are Node world by definition even when they import nothing
 * from Node: they build the Expo config and name config plugins by path string.
 */
export function reachesNodeWorld(graph, startRel, markers, nodeWorldFiles = []) {
  const seen = new Set();
  const stack = [startRel];
  while (stack.length > 0) {
    const rel = stack.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (/^packages\/shell\/plugins\//.test(rel) || /^packages\/tooling\//.test(rel) || /^apps\/[^/]+\/app\.config\.ts$/.test(rel)) return rel;
    if (nodeWorldFiles.includes(rel)) return `${rel} (the config composer)`;
    const node = graph.nodes.get(rel);
    if (!node) continue;
    // Config code that reads Node's global process (env, argv, exitCode) needs @types/node too.
    if (/^packages\/shell\/src\/config\//.test(rel) && /(?<![\w$.])process\.(env|argv|exitCode|cwd|platform)\b/.test(node.scan.code)) return `${rel} (uses Node's process global)`;
    for (const entry of node.imports) {
      if (entry.target.kind === 'builtin') return `${rel} (imports node:${entry.target.name})`;
      if (entry.target.kind === 'package' && markers.some((marker) => entry.spec === marker)) return `${rel} (imports ${entry.spec})`;
      if (entry.target.kind === 'file') stack.push(entry.target.rel);
    }
  }
  return null;
}

/** Cycles among value imports: each returned once as a list of files. */
export function findCycles(graph) {
  const cycles = [];
  const seenKeys = new Set();
  const state = new Map();
  const path = [];
  const visit = (rel) => {
    state.set(rel, 'active');
    path.push(rel);
    const node = graph.nodes.get(rel);
    for (const entry of node?.imports ?? []) {
      if (entry.typeOnly || entry.target.kind !== 'file' || !graph.nodes.has(entry.target.rel)) continue;
      const next = entry.target.rel;
      if (state.get(next) === 'active') {
        const cycle = path.slice(path.indexOf(next));
        const key = [...cycle].sort().join('|');
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          cycles.push(cycle);
        }
      } else if (!state.has(next)) {
        visit(next);
      }
    }
    path.pop();
    state.set(rel, 'done');
  };
  for (const rel of graph.nodes.keys()) if (!state.has(rel)) visit(rel);
  return cycles;
}
