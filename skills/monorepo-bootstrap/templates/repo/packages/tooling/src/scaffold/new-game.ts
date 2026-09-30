// packages/tooling/src/scaffold/new-game.ts
// Usage: npm run new-game -- --app <game-id> --name "<Name>" [--bundle-id <id>] [--write]
// The root script "new-game" runs this file. It forwards every argument to scaffold-game.mjs, the
// generator of the new-game-scaffold skill (in the repo's skills folder, or the .claude/skills link
// to it), so the npm script and the skill write exactly the same app from the same templates.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const SKILL = 'new-game-scaffold';
const CANDIDATES = [
  join('skills', SKILL, 'scripts', 'scaffold-game.mjs'),
  join('.claude', 'skills', SKILL, 'scripts', 'scaffold-game.mjs'),
];
const generator = CANDIDATES.find((path) => existsSync(path));

if (generator === undefined) {
  console.error(`the ${SKILL} generator is missing (looked for ${CANDIDATES.join(', ')});`);
  console.error('run npm run new-game from the repo root.');
  process.exitCode = 2;
} else {
  const result = spawnSync(process.execPath, [generator, ...process.argv.slice(2)], {
    stdio: 'inherit',
  });
  process.exitCode = result.status ?? 2;
}
