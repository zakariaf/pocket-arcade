#!/usr/bin/env node
// check-boundaries.mjs: checks the dependency direction of the Pocket Arcade monorepo on resolved
// imports: game-kit <- shell <- apps, pure rules and levels, game-facing Shell modules only, no
// app-to-app or tooling imports, vendor SDKs only in adapters, no Node-world code in the app,
// banned packages, the test-only gate, no "../" and no import cycles.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-boundaries.mjs [repo-root]

import { readFileSync } from 'node:fs';

import { createReporter, matchGlob, parseArgs, requireDir, run } from './check-lib.mjs';
import { buildGraph, findCycles, reachesNodeWorld } from './lib/import-graph.mjs';

const RULES = JSON.parse(readFileSync(new URL('../assets/architecture-rules.json', import.meta.url), 'utf8'));

const SPEC = {
  name: 'check-boundaries',
  summary:
    'Checks every import of the app repo after resolving it to a file or package: the dependency direction ' +
    '(game-kit <- shell <- apps, tooling imported by nothing), pure rules/levels, game-facing Shell modules only, ' +
    'vendor SDKs only in adapters, no Node-world code in app programs, banned packages, the test-only gate, ' +
    'no parent-relative imports and no import cycles.',
  usage: '[options] [repo-root]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  game-kit-pure      game-kit imports something other than game-kit (another workspace, React/RN/Expo/Skia,',
    '                     zustand, a Node built-in)',
    '  rules-pure         apps/<id>/src/{rules,levels} import something other than game-kit and their own rules/levels',
    '                     (a test there may also import its own app\'s other folders, and the engine assembly',
    '                     rules/<id>-engine.ts its board/build-timeline.ts; framework packages stay banned)',
    '  shell-direction    the Shell imports an app',
    '  app-to-app         an app imports another app',
    '  game-facing        game code imports a Shell module outside game-host/, art/,',
    '                     services/audio/audio-port.ts, services/audio/synth/, theme/theme-types.ts',
    '  no-tooling-import  a file outside packages/tooling and the root test/ imports tooling',
    '  node-world-import  app code imports a file that needs Node (directly or through its own imports)',
    '  node-builtin       app code imports a Node built-in',
    '  vendor-sdk         a vendor SDK is imported outside its adapter file (services/<port>/*-adapter.ts)',
    '  banned-package     a package replaced by a port or banned by the spec is imported',
    '  test-only-gate     require() outside app/test-only.ts, test-only-entry.ts imported elsewhere, or a gate',
    '                     that is not the literal process.env.EXPO_PUBLIC_APP_VARIANT === \'store\' comparison',
    '  parent-import      an import from "../"',
    '  unresolved-import  a workspace import that points to no file',
    '  import-cycle       files that import each other in a loop (type-only imports are ignored)',
    '',
    'Example: node check-boundaries.mjs .            (from the app repo root)',
  ].join('\n'),
};

const any = (value, globs) => globs.some((glob) => matchGlob(value, glob));
const isFramework = (name) => any(name, RULES.frameworkPackages);

function zoneOf(rel) {
  if (/^packages\/game-kit\/src\//.test(rel)) return 'game-kit';
  if (/^packages\/shell\/(src\/config|plugins)\//.test(rel)) return 'shell-node';
  if (/^packages\/shell\/src\//.test(rel)) return 'shell';
  if (/^packages\/tooling\//.test(rel)) return 'tooling';
  const app = /^apps\/[^/]+\/(.*)$/.exec(rel);
  if (app) {
    if (app[1] === 'app.config.ts') return 'app-config';
    if (app[1] === 'game.config.ts') return 'game-config';
    if (app[1] === 'index.ts') return 'app-entry';
    if (/^src\/(rules|levels)\//.test(app[1])) return 'app-pure';
    return 'app-game';
  }
  return 'tests';
}

const appOf = (rel) => /^apps\/([^/]+)\//.exec(rel)?.[1] ?? null;
const shellPath = (rel) => /^packages\/shell\/src\/(.*)$/.exec(rel)?.[1] ?? null;
const APP_ZONES = new Set(['app-pure', 'app-game', 'app-entry', 'game-config']);
const RUNTIME_ZONES = new Set(['game-kit', 'shell', ...APP_ZONES]);

/** Problems for one resolved import, as [rule, message, fix] triples. */
function importProblems(graph, rel, entry) {
  const zone = zoneOf(rel);
  const out = [];
  const target = entry.target;
  if (target.kind === 'builtin') {
    if (RUNTIME_ZONES.has(zone)) out.push(['node-builtin', `imports the Node built-in "${entry.spec}"`, 'App code runs on Hermes: move Node code to packages/tooling or packages/shell/src/config.']);
    return out;
  }
  if (target.kind === 'package') {
    const banned = RULES.bannedPackages[target.name];
    if (banned) out.push(['banned-package', `imports ${target.name}: ${banned}`, 'Use the decided port or Shell API instead.']);
    const port = RULES.vendorSdks[target.name];
    const onlyFiles = RULES.vendorSdkFiles?.[target.name];
    if (port && RUNTIME_ZONES.has(zone) && !any(rel, RULES.adapterGlobs)) {
      out.push(['vendor-sdk', `imports the vendor SDK ${target.name} outside its adapter`, `Only the ${port} adapter (packages/shell/src/services/<port>/<vendor>-<port>-adapter.ts) imports it; take the port from useServices() or a factory argument.`]);
    } else if (Array.isArray(onlyFiles) && RUNTIME_ZONES.has(zone) && !onlyFiles.includes(rel)) {
      out.push(['vendor-sdk', `imports ${target.name}, which only ${onlyFiles.join(', ')} may import`, `Ask through the ${port} (useServices()); only ${onlyFiles.join(', ')} imports ${target.name}.`]);
    }
    if ((zone === 'game-kit' || zone === 'app-pure') && isFramework(target.name)) {
      out.push([zone === 'game-kit' ? 'game-kit-pure' : 'rules-pure', `imports ${target.name}`, 'Rules, levels and game-kit are pure TypeScript: no React, React Native, Expo, Skia or zustand; they run headless for bots, solvers and replays.']);
    }
    return out;
  }
  if (target.kind === 'workspace-missing') {
    if (!entry.spec.startsWith('../')) out.push(['unresolved-import', `"${entry.spec}" resolves to no file (${target.rel})`, 'Fix the path; workspace imports are @scope/<package>/<path under src>.ts(x) with the extension.']);
    return out;
  }
  const to = target.rel;
  const toZone = zoneOf(to);
  const fromApp = appOf(rel);
  const toApp = appOf(to);
  // Root tests (Node world, never bundled) may call tooling helpers such as a sim report writer.
  if (toZone === 'tooling' && zone !== 'tooling' && zone !== 'tests') out.push(['no-tooling-import', `imports tooling (${to})`, 'Tooling is Node-only build code; nothing imports it. Move shared logic to game-kit or the Shell.']);
  if (toApp && fromApp && toApp !== fromApp) out.push(['app-to-app', `app ${fromApp} imports app ${toApp} (${to})`, 'Apps never import each other; move shared code to the Shell or game-kit.']);
  if (toApp && (zone === 'shell' || zone === 'shell-node' || zone === 'game-kit')) {
    out.push([zone === 'game-kit' ? 'game-kit-pure' : 'shell-direction', `imports the app file ${to}`, 'The Shell and game-kit never import an app (spec N5): the game reaches the Shell only through its GameModule.']);
  }
  if (zone === 'game-kit' && !to.startsWith('packages/game-kit/') && !toApp) out.push(['game-kit-pure', `imports ${to}`, 'game-kit is the bottom layer: it imports only itself.']);
  if (zone === 'app-pure') {
    // A test next to the rules may drive the game's own board or timeline code (a replay check);
    // the rules themselves stay pure. Levels, tests included, stay in the zone check-levels
    // enforces (game-kit and the game's own rules/ and levels/), because the level generator and
    // the witness run the same files headless in tooling.
    const isRulesTest = /\.test\.tsx?$/.test(rel) && /^apps\/[^/]+\/src\/rules\//.test(rel);
    const ownPure = fromApp && new RegExp(`^apps/${fromApp}/src/${isRulesTest ? '' : '(rules|levels)/'}`).test(to);
    // The engine assembly (rules/<id>-engine.ts, game-rules-engine) names the game's pure
    // buildTimeline next to its rules; nothing else in rules/ may reach into board/.
    const isEngineAssembly = fromApp && rel === `apps/${fromApp}/src/rules/${fromApp}-engine.ts` && to === `apps/${fromApp}/src/board/build-timeline.ts`;
    if (!to.startsWith('packages/game-kit/') && !ownPure && !isEngineAssembly) out.push(['rules-pure', `rules/levels import ${to}`, 'Rules and levels import only game-kit and their own rules/levels files; pass anything else in as a value.']);
  }
  const inShell = shellPath(to) !== null || /^packages\/shell\/plugins\//.test(to);
  if (inShell && APP_ZONES.has(zone)) {
    const sub = shellPath(to) ?? to;
    const allowed = zone === 'app-entry' ? RULES.appEntryShellImports : zone === 'game-config' ? RULES.gameConfigShellImports : zone === 'app-game' ? RULES.gameFacing : [];
    if (zone !== 'app-pure' && !allowed.some((prefix) => sub === prefix || (prefix.endsWith('/') && sub.startsWith(prefix)))) {
      out.push(['game-facing', `game code imports the Shell module ${sub}`, `Game code may use only ${RULES.gameFacing.join(', ')} (the entry file: app/start-shell.ts).`]);
    }
  }
  if (RUNTIME_ZONES.has(zone) && ['shell-node', 'app-config', 'tooling'].includes(toZone)) {
    const reason = reachesNodeWorld(graph, to, RULES.nodeWorldMarkers, RULES.nodeWorldFiles);
    if (reason) out.push(['node-world-import', `imports ${to}, which needs Node (${reason})`, 'App code never imports Node-world files, not even with import type; move the shared type to a neutral file that imports nothing from Node.']);
  }
  if (/\/test-only-entry\.tsx?$/.test(to) && !/\/app\/test-only\.ts$/.test(rel) && zone !== 'tests' && !/\.test\.tsx?$/.test(rel)) {
    out.push(['test-only-gate', `imports ${to} directly`, 'Reach test-only code only through TEST_ONLY from packages/shell/src/app/test-only.ts, so store bundles drop it.']);
  }
  return out;
}

function checkTestOnly(graph, report) {
  for (const node of graph.nodes.values()) {
    const zone = zoneOf(node.rel);
    if (!RUNTIME_ZONES.has(zone) || /\.test\.tsx?$/.test(node.rel)) continue;
    const isGateFile = /^packages\/shell\/src\/app\/test-only\.ts$/.test(node.rel);
    for (const match of node.scan.code.matchAll(/(?<![\w$.])require\s*\(/g)) {
      if (!isGateFile) report.problem({ file: node.rel, line: node.scan.lineOf(match.index), rule: 'test-only-gate', message: 'require() in app code', fix: "Import statically; only packages/shell/src/app/test-only.ts may require() test-only code behind the variant gate." });
    }
    if (isGateFile && !/process\.env\.EXPO_PUBLIC_APP_VARIANT\s*===\s*'store'[\s\S]{0,80}require\s*\(/.test(node.scan.codeKeep)) {
      report.problem({ file: node.rel, line: 1, rule: 'test-only-gate', message: "the gate is not the literal process.env.EXPO_PUBLIC_APP_VARIANT === 'store' comparison around require()", fix: 'Write the comparison inline in the same expression as require(); an imported IS_TEST_BUILD constant keeps test code in store bundles (verified).' });
    }
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const report = createReporter({ name: 'check-boundaries', json: options.json });
  const graph = buildGraph(root);
  for (const node of graph.nodes.values()) {
    for (const entry of node.imports) {
      if (entry.spec.startsWith('../')) {
        report.problem({ file: node.rel, line: entry.line, rule: 'parent-import', message: `import from "${entry.spec}"`, fix: 'Same folder or below: ./x.ts; any other folder: @scope/<package>/<path-under-src>.ts.' });
      }
      for (const [rule, message, fix] of importProblems(graph, node.rel, entry)) report.problem({ file: node.rel, line: entry.line, rule, message, fix });
    }
  }
  checkTestOnly(graph, report);
  for (const cycle of findCycles(graph)) {
    report.problem({ file: cycle[0], line: 1, rule: 'import-cycle', message: `import cycle: ${[...cycle, cycle[0]].join(' -> ')}`, fix: 'Break the loop: move the shared piece (usually a type) down into its own file that both import.' });
  }
  return report.finish({ checked: graph.files.length, unit: 'TypeScript files' });
});
