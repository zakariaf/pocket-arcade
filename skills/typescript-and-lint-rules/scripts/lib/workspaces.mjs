// workspaces.mjs: reads the npm workspace packages of the app repo (packages/* and apps/*).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** [{ dir: 'packages/shell', name: '@e07/shell', manifest }] for every workspace with a package.json. */
export function workspacePackages(root) {
  const out = [];
  for (const parent of ['packages', 'apps']) {
    const base = join(root, parent);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const file = join(base, entry.name, 'package.json');
      if (!existsSync(file)) continue;
      let manifest = null;
      try {
        manifest = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        manifest = null;
      }
      out.push({ dir: `${parent}/${entry.name}`, name: typeof manifest?.name === 'string' ? manifest.name : '', manifest });
    }
  }
  return out.sort((a, b) => (a.dir < b.dir ? -1 : 1));
}

/** The workspace package names, longest first, so "@e07/shell" matches before "@e07/s". */
export function workspacePackageNames(root) {
  return workspacePackages(root)
    .map((entry) => entry.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}
