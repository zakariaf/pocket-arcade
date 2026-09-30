// fixture-tree.mjs: builds one self-test input tree in a temporary folder:
//   this skill's templates/  +  tests/fixtures/support/  +  the fixture folder on top.
// A bad-* fixture therefore holds only the file(s) with its planted bug (they replace the
// template copies) plus EXPECT.txt; REMOVE.txt lists app paths to delete from the tree. So the
// good case always runs on the current templates and never drifts from them.

import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';

import { makeTempDir, removeTempDir } from '../check-lib.mjs';

const NOT_APP_FILES = new Set(['EXPECT.txt', 'README.md', 'REMOVE.txt']);
const made = [];
process.on('exit', () => {
  for (const dir of made) removeTempDir(dir);
});

/** Copies every layer (in order) and the fixture folder into a new temp folder; returns it. */
export function buildFixtureTree(layers, fixtureDir) {
  const root = makeTempDir('pa-fixture-');
  made.push(root);
  for (const layer of [...layers, fixtureDir]) {
    if (!existsSync(layer)) continue;
    cpSync(layer, root, { recursive: true, filter: (src) => !NOT_APP_FILES.has(basename(src)) });
  }
  const removeList = join(fixtureDir, 'REMOVE.txt');
  if (existsSync(removeList)) {
    for (const rel of readFileSync(removeList, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean)) {
      rmSync(join(root, rel), { force: true });
    }
  }
  return root;
}
