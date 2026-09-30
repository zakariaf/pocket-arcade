#!/usr/bin/env node
// selftest.mjs: proves both scripts of this skill.
//   scaffold-game.mjs: plans a new app in tests/fixtures/scaffold-game/good (a repo with one app),
//     and fails on a file conflict and on apps that are not in dependency lockstep; --add-missing
//     completes a partial pilot (scaffold-game-add-missing/good) and fails without a single set.
//   check-game-app.mjs --stage scaffold: passes an app the scaffold just wrote (so the templates
//     and the generator are tested together, next to ios/Pods, build/ and out/ noise) and fails each
//     check-game-app-scaffold/bad-* bug; passes the pilot completed by --add-missing (canonical Line
//     Siege catalogs) and a game outside the copy deck (template keys, lose slug), each with a bug.
//   check-game-app.mjs --stage complete: passes that app plus check-game-app-complete/base (stubs
//     for every module part and the evidence files) and fails each check-game-app-complete/bad-*.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeTempDir, runSelftest } from './check-lib.mjs';
import { assembleFixtures } from './lib/assemble-fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'tests', 'fixtures');
const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');
const DECISIONS = ['--hints', 'none', '--continue', 'once'];

function scaffold(dir, args) {
  const result = spawnSync(process.execPath, [join(here, 'scaffold-game.mjs'), '--root', dir, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`scaffold-game.mjs ${args.join(' ')} failed while building the fixture:\n${result.stdout}${result.stderr}`);
}

function writeFile(dir, rel, content) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), content);
}

/** What a first simulator build leaves in an app: C macros in Pods, build/ and out/ (never placeholders). */
function generatedNoise(dir, app) {
  writeFile(dir, `apps/${app}/ios/Pods/Headers/Public/React-Core/React/RCTDefines.h`, '#if defined(__OBJC__) && __LINE__ > 0\n#define RCT_DEV __DEV__\n#endif\n');
  writeFile(dir, `apps/${app}/build/Build/Intermediates.noindex/main.m`, '// __FILE__ __APPLE__ __GLOBAL__\n');
  writeFile(dir, `apps/${app}/out/main.jsbundle`, 'var __DEV__=false;global.__BUNDLE_START_TIME__=0;\n');
}

/** A repo with one existing app, then the scaffold writes apps/flock-tilt into it. */
function scaffolded(dir) {
  cpSync(join(fixtures, 'scaffold-game', 'good'), dir, { recursive: true });
  scaffold(dir, ['--app', 'flock-tilt', ...DECISIONS, '--write']);
  generatedNoise(dir, 'flock-tilt');
}

function completed(dir) {
  scaffolded(dir);
  cpSync(join(fixtures, 'check-game-app-complete', 'base'), dir, { recursive: true });
}

/** The bootstrap's pilot with the owner's own game.config.ts, completed by --add-missing. */
function pilot(dir) {
  cpSync(join(fixtures, 'scaffold-game-add-missing', 'good'), dir, { recursive: true });
  scaffold(dir, ['--app', 'line-siege', '--add-missing']);
}

/** A game outside the copy deck: the template keys, with the lose key <id>.lose.caught. */
function outsideDeck(dir) {
  cpSync(join(fixtures, 'scaffold-game', 'good'), dir, { recursive: true });
  scaffold(dir, ['--app', 'bank-shot', '--name', 'Bank Shot', '--hints', 'solver', '--continue', 'once', '--lose-reason', 'caught', '--write']);
  const ids = ['hud.moves', 'continue.more-moves', 'lose.caught', 'board.summary', 'stats.cells-flipped', 'tutorial.step-2', 'how-to-play.step-3', 'pack-name.3', 'win-title', 'tagline'];
  writeFile(dir, 'apps/bank-shot/src/rules/bank-shot-engine.ts', `// apps/bank-shot/src/rules/bank-shot-engine.ts\nexport const MESSAGE_IDS = [\n${ids.map((id) => `  'bank-shot.${id}',`).join('\n')}\n] as const;\n`);
}

/** --add-missing writes, so it runs on a temporary copy of its fixtures, never on the skill's own files. */
function copied(name) {
  const dir = makeTempDir('scaffold-add-missing-');
  cpSync(join(fixtures, name), dir, { recursive: true });
  return dir;
}

const suites = {
  addMissing: () => copied('scaffold-game-add-missing'),
  scaffold: () => assembleFixtures(join(fixtures, 'check-game-app-scaffold'), scaffolded),
  complete: () => assembleFixtures(join(fixtures, 'check-game-app-complete'), completed),
  pilot: () => assembleFixtures(join(fixtures, 'check-game-app-pilot'), pilot),
  templateKeys: () => assembleFixtures(join(fixtures, 'check-game-app-template-keys'), outsideDeck),
};
const built = wantsHelp ? Object.fromEntries(Object.keys(suites).map((key) => [key, fixtures])) : Object.fromEntries(Object.entries(suites).map(([key, build]) => [key, build()]));
const scaffoldArgs = (app) => (dir) => [dir, '--app', app, '--stage', 'scaffold'];
try {
  await runSelftest(import.meta.url, [
    { script: 'scaffold-game.mjs', fixtures: '../tests/fixtures/scaffold-game', args: (dir) => ['--root', dir, '--app', 'flock-tilt', ...DECISIONS] },
    { script: 'scaffold-game.mjs', fixtures: built.addMissing, args: (dir) => ['--root', dir, '--app', 'line-siege', '--add-missing'] },
    { script: 'check-game-app.mjs', fixtures: built.scaffold, args: scaffoldArgs('flock-tilt') },
    { script: 'check-game-app.mjs', fixtures: built.pilot, args: scaffoldArgs('line-siege') },
    { script: 'check-game-app.mjs', fixtures: built.templateKeys, args: scaffoldArgs('bank-shot') },
    { script: 'check-game-app.mjs', fixtures: built.complete, args: (dir) => [dir, '--app', 'flock-tilt', '--stage', 'complete'] },
  ]);
} finally {
  if (!wantsHelp) for (const dir of Object.values(built)) rmSync(dir, { recursive: true, force: true });
}
