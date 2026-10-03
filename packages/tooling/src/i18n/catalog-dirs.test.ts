// packages/tooling/src/i18n/catalog-dirs.test.ts
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { SHELL_CATALOGS, catalogDirs } from './catalog-dirs.ts';

describe('catalogDirs', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'catalog-dirs-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('lists the Shell folder first, then each game with an i18n folder, by game id', () => {
    for (const gameId of ['line-siege', 'flock-tilt'])
      mkdirSync(path.join(root, 'apps', gameId, 'src', 'i18n'), { recursive: true });
    mkdirSync(path.join(root, 'apps', 'scrap-shove', 'src'), { recursive: true });
    expect(catalogDirs(root)).toStrictEqual([
      {
        dir: path.join(root, SHELL_CATALOGS),
        namespace: { kind: 'shell', gameIds: ['flock-tilt', 'line-siege', 'scrap-shove'] },
      },
      {
        dir: path.join(root, 'apps', 'flock-tilt', 'src', 'i18n'),
        namespace: { kind: 'game', gameId: 'flock-tilt' },
      },
      {
        dir: path.join(root, 'apps', 'line-siege', 'src', 'i18n'),
        namespace: { kind: 'game', gameId: 'line-siege' },
      },
    ]);
  });

  it('keeps the Shell folder, which the linter must read, when no app exists yet', () => {
    expect(catalogDirs(root)).toStrictEqual([
      {
        dir: path.join(root, 'packages/shell/src/i18n/catalogs'),
        namespace: { kind: 'shell', gameIds: [] },
      },
    ]);
  });
});
