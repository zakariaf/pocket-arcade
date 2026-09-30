// packages/tooling/src/audit/bundle-modules.ts
// Reads the source map of `npx expo export --platform ios --no-bytecode --source-maps true`
// and answers "which shipped module contains X". Shared by audit:network (layer B),
// the release audit and audit:licenses.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type BundleModule = { readonly source: string; readonly content: string };

export function readBundleModules(exportDir: string): BundleModule[] {
  const dir = join(exportDir, '_expo', 'static', 'js', 'ios');
  const mapFile = readdirSync(dir).find((file) => file.endsWith('.js.map'));
  if (mapFile === undefined) throw new Error(`no source map in ${dir}`);
  const map = JSON.parse(readFileSync(join(dir, mapFile), 'utf8')) as {
    sources: string[];
    sourcesContent?: (string | null)[];
  };
  return map.sources.map((source, index) => ({
    source,
    content: map.sourcesContent?.[index] ?? '',
  }));
}

// 'node_modules/@scope/name/...' -> '@scope/name'; first-party files -> null.
export function packageOf(source: string): string | null {
  const match = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(source);
  return match?.[1] ?? null;
}

export function modulesMatching(modules: readonly BundleModule[], pattern: RegExp): string[] {
  return modules.filter((m) => pattern.test(m.content)).map((m) => m.source);
}
