#!/usr/bin/env node
// check-rules-engine.mjs: checks the game-kit contract and RNG, and every game's pure rules engine,
// statically and by running the real rules modules over seeded games.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-rules-engine.mjs [root] [--game <id>]

import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createReporter, parseArgs, requireDir, run } from './check-lib.mjs';
import { enableAppImports } from './lib/app-modules.mjs';
import { runEngineContract } from './lib/engine-run.mjs';
import { checkKitFiles, checkRngGolden, checkRngSource, checkTestDependencies } from './lib/kit-checks.mjs';
import { checkAssembly, checkCatalogKeys, checkDeterminism, checkMoveHandling, checkPlaceholders, checkPurity, checkRuleFiles, checkRuleTests, checkStateTypes, sources } from './lib/rules-checks.mjs';

const SPEC = {
  name: 'check-rules-engine',
  summary: 'Checks the GameModule contract files and the sfc32 RNG (by running it against its golden values) in packages/game-kit, then each game\'s rules folder: pure imports, determinism, JSON-safe state, past-tense events, illegal moves throwing, catalog lose reasons and keys, property tests, a pinned golden, the engine and persistence assembly, and a seeded run of the real rules (an endless run is never won).',
  usage: '[options] [root]',
  options: {
    game: { type: 'string', multiple: true, help: 'Check only this game id (default: every apps/<id> with src/rules)', value: 'id' },
    'no-run': { type: 'boolean', help: 'Skip running code (RNG goldens and the seeded engine run)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  kit-file-missing / kit-export-missing  game-kit contract, difficulty, RNG and test-helper files and their exports',
    '  kit-member-missing     an older contract copy (no selectRegions, tap selection, solver final or endless check)',
    '  kit-test-dependency    the kit or rules tests import fast-check: the root package.json pins it exactly (devDependencies)',
    '  rng-worklet            sfc32.ts starts with the file-level worklet directive',
    '  rng-golden / rng-load  the real sfc32.ts matches the PractRand reference and the pinned golden values',
    '  rng-golden-test        sfc32.test.ts pins GOLDEN_SEED_1 and GOLDEN_DAILY_HASH',
    '  pure-import            game-kit and rules import no React, React Native, Expo, Skia, zustand, Shell, node:',
    '  determinism            no Math.random, Date, performance.now, Intl, ** or non-exact Math.* (tests: no clock/random)',
    '  rules-file-missing / rules-export-missing  <id>-types.ts, create.ts, list-moves.ts, apply-move.ts, outcome.ts',
    '  state-not-json         the types file uses Map, Set, Date, bigint, symbol or class',
    '  rng-not-in-state       rules draw after create() but the state holds no RngState',
    '  event-kind             <Pascal>Event kinds are past-tense kebab-case',
    '  illegal-move-throws    applyMove throws a RangeError for illegal moves',
    '  reason-key             lose reasons are <id>.* catalog keys',
    '  catalog-key-missing    every <id>.* key the rules name is in apps/<id>/src/i18n/{en,de,fa,ckb}.json',
    '  property-tests / pinned-golden  fast-check properties, a JSON round trip, a GOLDEN_* value',
    '  engine-missing / engine-typed / engine-contract-test / persistence-missing / persistence-members / stats-missing / stats-counters',
    '  pan-mode               the engine assembly sets panMode to a literal none, swipe, drag or aim',
    '  select-regions         the engine assembly sets selectRegions ([] or the regions whose taps only select)',
    '  placeholder-left       a __GAME_*__ template placeholder is still in a rules file',
    '  engine-load / engine-contract / persistence-roundtrip  the real rules over seeds 1-3 x difficulty 0, 50, 100,',
    '                         played with random moves and (once testing/<id>-testing.ts exists) the game\'s bot',
    '  testing-bot / testing-examples  the bot picks offered moves; examples start/middle/win/lose match their outcome',
    '  endless-won            a game with an endless mode (game.config.ts or levels) never wins at difficulty 100',
    '',
    'Example: node check-rules-engine.mjs . --game flock-tilt',
  ].join('\n'),
};

function gameIds(root, wanted) {
  const appsDir = join(root, 'apps');
  const all = existsSync(appsDir) ? readdirSync(appsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort() : [];
  const withRules = all.filter((id) => existsSync(join(appsDir, id, 'src', 'rules')));
  return wanted.length > 0 ? wanted : withRules;
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  const report = createReporter({ name: 'check-rules-engine', json: options.json });
  const hasKit = existsSync(join(root, 'packages', 'game-kit'));
  const games = gameIds(root, options.game);
  if (!hasKit && games.length === 0) {
    return report.finish({ checked: 0, unit: 'game-kit files and games' });
  }
  const repo = { root: resolve(root), exists: (rel) => existsSync(join(root, rel)) };
  const modules = options['no-run'] ? null : enableAppImports(root);
  let checked = checkKitFiles(repo, report);
  checkRngSource(repo, report);
  checkTestDependencies(repo, ['packages/game-kit/src', ...games.map((id) => `apps/${id}/src/rules`)], report);
  if (modules) checked += await checkRngGolden(repo, modules, report);
  if (existsSync(join(root, 'packages', 'game-kit', 'src'))) {
    const kitFiles = sources(root, 'packages/game-kit/src');
    checkPurity(kitFiles, ['game-kit'], report);
    checkDeterminism(kitFiles, report);
  }
  for (const gameId of games) {
    const folder = `apps/${gameId}/src/rules`;
    checked += 1;
    if (!repo.exists(folder)) {
      report.problem({ file: folder, rule: 'rules-file-missing', message: 'the game has no rules folder', fix: 'Create apps/<id>/src/rules from this skill\'s templates (types, create, list-moves, apply-move, outcome).' });
      continue;
    }
    const files = sources(root, folder);
    checkRuleFiles(repo, gameId, report);
    checkPlaceholders(files, report);
    checkPurity(files, ['game-kit', gameId], report);
    checkDeterminism(files, report);
    checkStateTypes(repo, gameId, files, report);
    checkMoveHandling(gameId, files, report);
    checkRuleTests(gameId, files, report);
    checkAssembly(repo, gameId, files, report);
    checkCatalogKeys(repo, gameId, files, report);
    if (modules) checked += await runEngineContract(modules, gameId, report, root);
  }
  return report.finish({ checked, unit: 'files, games and runs' });
});
