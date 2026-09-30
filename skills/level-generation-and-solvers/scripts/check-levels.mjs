#!/usr/bin/env node
// check-levels.mjs: checks the level kit (solvers, level tables, daily seed goldens) and every
// game's levels folder: pack tables, numbering, config match, quality metrics, modes, goldens,
// the contract test, and that the committed packs are exactly what the game's plan generates.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-levels.mjs [root] [--game <id>] [--report]

import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createReporter, parseArgs, requireDir, run } from './check-lib.mjs';
import { enableAppImports } from './lib/app-modules.mjs';
import { checkKit, checkPurityAndDeterminism, checkSaltsUnique, checkSpec, checkTable, checkTestDependencies, levelFiles, metrics, readGameConfig, readPacks } from './lib/level-checks.mjs';
import { checkDailySeed, checkPlan, checkStarRule } from './lib/level-run.mjs';

const SPEC = {
  name: 'check-levels',
  summary: 'Checks the level kit in packages/game-kit (solvers, witness solver, level tables, pack progress, the star rule and the daily seed run against their golden values) and each game\'s apps/<id>/src/levels: pack JSON, numbering, packs vs game.config.ts, duplicates, the difficulty and par curves, trivial levels, daily/endless modes, data goldens with committed snapshots, the levels contract test, the import zone, and a regeneration of the table from the game\'s plan compared value by value and byte by byte.',
  usage: '[options] [root]',
  options: {
    game: { type: 'string', multiple: true, help: 'Check only this game id (default: every apps/<id> with src/levels)', value: 'id' },
    report: { type: 'boolean', help: 'Also print per-pack metrics (levels, difficulty and par ranges)' },
    'no-run': { type: 'boolean', help: 'Skip running code (daily seed goldens and the plan regeneration)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  kit-file-missing / kit-export-missing  solver, levels, render-cells, dates files and the tooling generator',
    '  kit-test-dependency   the kit or levels tests import fast-check: the root package.json pins it exactly (devDependencies)',
    '  daily-seed-golden     the real dailySeed gives 2599028541 and 2582250922 for 2026-09-26/27, salt 17',
    '  star-rule             the real starsFor follows spec 8.1 (par: 3 / par + 2: 2 / finished: 1; score thresholds)',
    '  levels-file-missing   <id>-levels.ts, <id>-level-plan.ts, pack-1.json',
    '  pack-json / level-numbering / pack-size / pack-config / duplicate-level',
    '  difficulty-curve / trivial-level / par-curve   level quality metrics',
    '  solver-required / daily-mode / endless-mode / daily-salt-shared / levels-contract-test',
    '  level-golden / golden-snapshot-missing / daily-golden   data goldens pinned and committed',
    '  pure-import           levels import only @e07/game-kit/**, @e07/<id>/rules/** and @e07/<id>/levels/**',
    '  determinism           no Math.random, clocks, ** or transcendental Math',
    '  plan-run / plan-failure / pack-stale   the plan regenerates exactly the committed levels',
    '  pack-format           the pack bytes are what generate-levels.ts writes (the repo\'s Prettier, json parser)',
    '',
    'Example: node check-levels.mjs . --game flock-tilt --report',
  ].join('\n'),
};

function gameIds(root, wanted) {
  if (wanted.length > 0) return wanted;
  const appsDir = join(root, 'apps');
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(join(appsDir, entry.name, 'src', 'levels'))).map((entry) => entry.name).sort();
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  const report = createReporter({ name: 'check-levels', json: options.json });
  const games = gameIds(root, options.game);
  if (!existsSync(join(root, 'packages', 'game-kit')) && games.length === 0) return report.finish({ checked: 0, unit: 'level kit files and games' });
  const repo = { root: resolve(root), exists: (rel) => existsSync(join(root, rel)) };
  const modules = options['no-run'] ? null : enableAppImports(root);
  let checked = checkKit(repo, report);
  checkTestDependencies(repo, ['packages/game-kit/src', ...games.map((id) => `apps/${id}/src/levels`)], report);
  if (modules) checked += await checkDailySeed(modules, report);
  if (modules) checked += await checkStarRule(modules, report);
  for (const gameId of games) {
    checked += 1;
    if (!repo.exists(`apps/${gameId}/src/levels`)) {
      report.problem({ file: `apps/${gameId}/src/levels`, rule: 'levels-file-missing', message: 'the game has no levels folder', fix: 'Create it from this skill\'s templates (plan, solver, LevelsSpec, tests), then generate the packs.' });
      continue;
    }
    const files = levelFiles(root, gameId);
    const config = readGameConfig(root, gameId);
    const packs = readPacks(root, gameId, report);
    const entries = checkTable(packs, config, report).map(({ entry }) => entry);
    checkSpec(root, gameId, files, entries, config, report);
    checkPurityAndDeterminism(gameId, files, report);
    if (modules) checked += await checkPlan(root, modules, gameId, report);
    if (options.report) for (const line of metrics(packs)) report.note(`${gameId} ${line}`);
  }
  checkSaltsUnique(root, games, report);
  return report.finish({ checked, unit: 'kit files, games and runs' });
});
