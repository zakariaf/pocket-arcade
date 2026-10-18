// packages/tooling/src/release/bump-build-number.ts
// CLI: node packages/tooling/src/release/bump-build-number.ts --app <game-id>
// Adds 1 to the single `buildNumber: <int>,` line of apps/<game>/game.config.ts and prints the
// new number. release:ios calls the same function and commits; run this by hand only to recover.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { bumpBuildNumber } from '@e07/tooling/release/build-number.ts';

const [flag, game] = process.argv.slice(2);

if (flag !== '--app' || game === undefined || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(game)) {
  console.error('usage: node packages/tooling/src/release/bump-build-number.ts --app <game-id>');
  process.exitCode = 1;
} else {
  const file = join('apps', game, 'game.config.ts');
  const bump = bumpBuildNumber(readFileSync(file, 'utf8'));
  writeFileSync(file, bump.text);
  console.log(`${file}: buildNumber ${String(bump.previous)} -> ${String(bump.next)}`);
}
