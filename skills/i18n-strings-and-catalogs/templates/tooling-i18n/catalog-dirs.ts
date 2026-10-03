// packages/tooling/src/i18n/catalog-dirs.ts
// Where the catalogs live: the Shell's folder, then apps/<game-id>/src/i18n for every game.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Namespace } from './catalog-lint-rules.ts';

export type CatalogDir = { readonly dir: string; readonly namespace: Namespace };

export const SHELL_CATALOGS = 'packages/shell/src/i18n/catalogs';

// The game id is the app folder name (apps/<game-id>), which is also the key prefix. The Shell
// comes first; review-sheet.ts merges the folders in this order.
export function catalogDirs(root: string): CatalogDir[] {
  const apps = join(root, 'apps');
  const gameIds = existsSync(apps) ? readdirSync(apps).sort() : [];
  const games = gameIds
    .map((gameId) => ({ gameId, dir: join(apps, gameId, 'src', 'i18n') }))
    .filter(({ dir }) => existsSync(dir))
    .map(({ gameId, dir }) => ({ dir, namespace: { kind: 'game', gameId } as const }));
  return [{ dir: join(root, SHELL_CATALOGS), namespace: { kind: 'shell', gameIds } }, ...games];
}
