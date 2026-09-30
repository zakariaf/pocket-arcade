// packages/tooling/src/i18n/verify-catalogs.ts
// `npm run i18n:verify`: FormatJS parity check + our catalog linter, for the Shell and every game.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { lintDirectory } from './catalog-lint.ts';

import type { Namespace } from './catalog-lint-rules.ts';

type CatalogDir = { readonly dir: string; readonly namespace: Namespace };

// The game id is the app folder name (apps/<game-id>), which is also the key prefix.
function catalogDirs(root: string): CatalogDir[] {
  const apps = join(root, 'apps');
  const gameIds = existsSync(apps) ? readdirSync(apps) : [];
  const games = gameIds
    .map((gameId) => ({ gameId, dir: join(apps, gameId, 'src', 'i18n') }))
    .filter(({ dir }) => existsSync(dir))
    .map(({ gameId, dir }) => ({ dir, namespace: { kind: 'game', gameId } as const }));
  const shellDir = join(root, 'packages', 'shell', 'src', 'i18n', 'catalogs');
  return [{ dir: shellDir, namespace: { kind: 'shell', gameIds } }, ...games];
}

// Exits non-zero on a missing/extra key or a placeholder/structure mismatch.
function formatjsVerify(dir: string): boolean {
  const args = ['formatjs', 'verify', '--source-locale', 'en', '--missing-keys', '--extra-keys'];
  try {
    execFileSync('npx', [...args, '--structural-equality', join(dir, '*.json')], {
      stdio: 'inherit',
    });
    return true;
  } catch {
    return false;
  }
}

function main(root: string): void {
  let failures = 0;
  for (const { dir, namespace } of catalogDirs(root)) {
    const problems = lintDirectory(dir, namespace);
    for (const line of problems) console.error(line);
    if (!formatjsVerify(dir) || problems.length > 0) failures += 1;
  }
  console.error(`i18n:verify: ${String(failures)} catalog dir(s) failing`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main(process.cwd());
