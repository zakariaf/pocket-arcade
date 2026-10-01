#!/usr/bin/env node
// check-game-app.mjs: verifies a game app is complete. --stage scaffold (right after
// scaffold-game.mjs): every config file, lockstep dependencies, the variant cache key, the
// withShell app config, a valid game.config.ts, the fonts and four catalogs. --stage complete
// (the default; a finished game): additionally every GameModule part, the assembly, the 3-line
// entry, catalog keys for every game key used, the config contract, goldens, sims and E2E flows.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-game-app.mjs . --app <game-id> [--stage scaffold|complete]

import { dirname, join, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createReporter, fail, parseArgs, requireDir, run } from './check-lib.mjs';
import { enableAppImports } from './lib/app-modules.mjs';
import { appIds, checkAssembly, checkCatalogs, checkCompleteness, checkDeckTexts, checkConfigContract, checkConfigFiles, checkEntry, checkFiles, checkFonts, checkGameConfig, checkNewGameScript, checkPackage, checkParityFacts, checkPlaceholders, checkShellSlice, checkUsedKeys, listFiles } from './lib/app-checks.mjs';

const SPEC = {
  name: 'check-game-app',
  summary: 'Verifies that apps/<game-id> is complete: at --stage scaffold the app skeleton the scaffold writes, at --stage complete (default) a finished game with every module part, its assembly and evidence.',
  usage: '[options] [root]',
  options: {
    app: { type: 'string', multiple: true, help: 'Game id to check (default: every folder in apps/)', value: 'id' },
    stage: { type: 'string', default: 'complete', help: 'scaffold or complete', value: 'stage' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules (both stages): app-file-missing, package-json, deps-lockstep, tsconfig, metro-cache, app-config, gitignore,',
    '  entry, fonts, catalogs, catalog-keys, catalog-missing-key (every <id>.* key the copied templates and the',
    '  game code use is in all four catalogs), deck-text (a game in the copy deck keeps the deck\'s words in every',
    '  deck key its catalogs hold), placeholder-left (the templates\' own placeholder names, outside',
    '  ios/, android/, build/, out/, Pods and node_modules), game-config, new-game-script, bundle-id (always',
    '  io.applander.<game id without hyphens>) and premium-id (<bundle id>.premium)',
    'Rules (complete): module-part-missing, evidence-missing, module-assembly, types-bag, config-contract,',
    '  pan-mode (engine.panMode is none, swipe, drag or aim), shell-slice (a repo with shell-slice.json never',
    '  ships), entry = the 3-line startShell entry, owner-placeholder (each scaffold placeholder by name:',
    '  com.example.*, the AdMob app and unit ids of step G5, the privacy host example.com and',
    '  support@example.com of step G3), parity-game-facts (the game\'s parity/game-facts.json entry with',
    '  designGame, hasMusic, winLine and hasHints; hasHints agrees with hints.freePerDay)',
    '',
    'Examples:',
    '  node check-game-app.mjs . --app flock-tilt --stage scaffold',
    '  node check-game-app.mjs . --app flock-tilt',
  ].join('\n'),
};

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  if (!['scaffold', 'complete'].includes(options.stage)) fail(`--stage ${options.stage} is not scaffold or complete`, 'Pass --stage scaffold or --stage complete.');
  const ids = options.app.length > 0 ? options.app : appIds(root);
  const report = createReporter({ name: 'check-game-app', json: options.json });
  const repo = { root: resolve(root), exists: (rel) => existsSync(join(root, rel)), files: listFiles(root) };
  const modules = ids.length > 0 ? enableAppImports(root) : null;
  const deck = JSON.parse(readFileSync(join(skillDir, 'assets', 'copy-deck.json'), 'utf8'));
  checkNewGameScript(repo, report);
  if (options.stage === 'complete') checkShellSlice(repo, report);
  for (const id of ids) {
    if (!repo.exists(`apps/${id}`)) {
      report.problem({ file: `apps/${id}`, rule: 'app-file-missing', message: 'the app folder does not exist', fix: `Scaffold it: node <this skill>/scripts/scaffold-game.mjs --app ${id} --name "<Name>" --hints none|solver --continue once|none --write` });
      continue;
    }
    checkFiles(repo, id, report);
    checkPackage(repo, id, report);
    checkConfigFiles(repo, id, report);
    checkEntry(repo, id, options.stage, report);
    checkFonts(repo, id, skillDir, report);
    const catalogs = checkCatalogs(repo, id, report);
    checkDeckTexts(repo, id, catalogs, deck, report);
    checkPlaceholders(repo, id, report);
    const config = await checkGameConfig(modules, repo, id, options.stage, report);
    checkUsedKeys(repo, id, catalogs, report);
    if (options.stage === 'complete') {
      checkCompleteness(repo, id, report);
      checkAssembly(repo, id, report);
      await checkConfigContract(modules, repo, id, config, report);
      checkParityFacts(repo, id, config, report);
    }
  }
  return report.finish({ checked: ids.length, unit: 'apps' });
});
