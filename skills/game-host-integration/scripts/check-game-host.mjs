#!/usr/bin/env node
// check-game-host.mjs: checks that games are wired into the Shell through the one generic seam:
// the game-host files and their tests, the parts other skills provide, the seam's invariants
// (save before publish, one run-end update, intents through intentToMove, one continue, play
// time from the clock, stars from the level rule, no casts, type-erased screens), the
// composition root (host order, provider) and the Game screen (controls, pause on background,
// board), and each game's assembly (module, types bag, 3-line entry, contract test, save policy,
// teaching run headless against the game's own rules and catalogs, game.config against the rules).
// A partial Shell (shell-slice.json) turns the rules of screens outside the slice into SKIP lines.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-game-host.mjs [root] [--game <id>]

import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createReporter, parseArgs, readShellSlice, requireDir, run } from './check-lib.mjs';
import { enableAppImports } from './lib/app-modules.mjs';
import { checkConfigRules, checkGameAssembly, checkHostFiles, checkHostWiring, checkRootFiles, checkShellWiring, checkTeaching, checkTypeErasure } from './lib/host-checks.mjs';

const SPEC = {
  name: 'check-game-host',
  summary: 'Checks the game host in packages/shell/src/game-host and every game\'s assembly in apps/<id>: files, prerequisites from other skills, the seam\'s invariants, the composition root, the Game screen, the module, the 3-line entry, the contract test, the save policy and the teaching script.',
  usage: '[options] [root]',
  options: {
    game: { type: 'string', multiple: true, help: 'Check only this game (default: every apps/<id> with src/index.ts or src/rules)', value: 'id' },
    'no-shell': { type: 'boolean', help: 'Skip the Shell side (check only the games)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules (Shell): host-file-missing, host-export-missing, host-test-missing, prerequisite-missing,',
    '  root-file-missing, tutorial-screen, save-before-publish, run-end-once, result-feedback, intent-legality,',
    '  continue-once, play-time, stars-from-table, saved-run-validated, unsafe-cast, screens-type-erased,',
    '  host-not-created, host-order, continue-from-config, run-end-publish, host-deps, host-not-provided,',
    '  game-screen-wiring, debug-controls, debug-run-end, game-facts, score-line, parity-frame-openers,',
    '  parity-board-probe',
    'Rules (game): assembly-file-missing, module-assembly, types-bag, entry, contract-test, save-policy,',
    '  config-rules, teaching, teaching-keys',
    '',
    'Partial Shell (shell-slice.json at the root): the Game screen wiring (S5) prints a SKIP line while S5',
    'is outside the slice. The Shell core is checked in every slice: the host with its S5 top bar and S7',
    'result model, the composition root and the Tutorial route (D36). With "screens": [] the composition',
    'root and Tutorial rules skip too. SKIP lines count as a pass.',
    '',
    'Example: node check-game-host.mjs . --game flock-tilt',
  ].join('\n'),
};

function gameIds(root, wanted) {
  if (wanted.length > 0) return wanted;
  const appsDir = join(root, 'apps');
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && (existsSync(join(appsDir, entry.name, 'src', 'index.ts')) || existsSync(join(appsDir, entry.name, 'src', 'rules')))).map((entry) => entry.name).sort();
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  const report = createReporter({ name: 'check-game-host', json: options.json });
  const repo = { root: resolve(root), exists: (rel) => existsSync(join(root, rel)), slice: readShellSlice(root) };
  const hasShell = existsSync(join(root, 'packages', 'shell'));
  const games = gameIds(root, options.game);
  if ((!hasShell || options['no-shell']) && games.length === 0) return report.finish({ checked: 0, unit: 'host files and games' });
  let checked = 0;
  if (hasShell && !options['no-shell']) {
    checked += checkHostFiles(repo, report);
    checked += checkRootFiles(repo, report);
    checkHostWiring(repo, report);
    checkTypeErasure(repo, report);
    checkShellWiring(repo, report);
  }
  const modules = games.length > 0 ? enableAppImports(root) : null;
  for (const id of games) {
    checked += 1;
    checkGameAssembly(repo, id, report);
    checkConfigRules(repo, id, report);
    checked += await checkTeaching(modules, repo, id, report);
  }
  return report.finish({ checked, unit: 'host files, games and runs' });
});
