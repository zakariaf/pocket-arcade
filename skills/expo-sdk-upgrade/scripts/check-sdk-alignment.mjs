#!/usr/bin/env node
// check-sdk-alignment.mjs: proves the app repo is consistent with ONE Expo SDK: every app on the same
// SDK, every Expo-managed package at the module map's specifier, root overrides and SDK-tracking dev
// tools (jest-expo, eslint-config-expo, @react-native/*, @types/react, test-renderer) on the same line,
// held-back tools unchanged, one version of every native module, the Jest config the SDK needs,
// Gesture Handler API matching its major, config plugin imports the SDK resolves, no React Native API
// the SDK removed, scene support only where Xcode and the SDK need it, no stale Skia approval.
// With --target-sdk it also scans for the next SDK: code to fix before the move fails the check, and
// changes that can only land in the move commit are printed as "todo" lines.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-sdk-alignment.mjs . [--target-sdk 58]

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { appsSdk, bare, compareVersions, depsOf, loadSdkLines, majorOf, moduleMapFor, onLine, readJsonSafe, readRepo, satisfies } from './lib/sdk.mjs';
import { createReporter, fail, lineOf, maskComments, parseArgs, requireDir, run, walk } from './check-lib.mjs';

const SPEC = {
  name: 'check-sdk-alignment',
  summary: 'Checks that every app, the Shell and the root tooling of the Pocket Arcade repo sit on one Expo SDK line (module map specifiers, overrides, SDK-tracking dev tools, held-back tools), that source code uses only APIs that line supports (Gesture Handler major, removed React Native APIs), and that Xcode scene support is set exactly when needed. --target-sdk <n> adds a readiness scan: the code to change for the next SDK.',
  usage: '[repo-root] [options]',
  options: {
    root: { type: 'string', value: 'dir', help: 'The app repo root (same as the positional argument; default ".")' },
    'target-sdk': { type: 'string', value: 'n', help: 'Also scan the code against this next SDK (readiness before the move)' },
    xcode: { type: 'string', value: 'version', help: 'The Xcode version builds use (default: XCODE_VERSION in packages/tooling/src/ios/toolchain.ts)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules: sdk-unknown sdk-lockstep app-lockstep module-map core-pins overrides sdk-tooling',
    '  rn-tooling react-line held-back duplicate-native jest-config gesture-api config-plugin-import',
    '  removed-rn-api scene-support xcode skia-approval',
  ].join('\n'),
};

const GESTURE_BUILDER = /\bGesture\.(Tap|Pan|LongPress|Fling|Pinch|Rotation|Hover|Manual|Native|ForceTouch|Race|Simultaneous|Exclusive)\s*\(/g;
const GESTURE_IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]react-native-gesture-handler['"]/g;
const V3_HOOK = /^use\w*Gestures?$/;
const SOURCE = /^(packages\/[^/]+\/(src|plugins)\/.+|apps\/[^/]+\/(src\/.+|index|app\.config|game\.config))\.tsx?$/;
const CONFIG_PLUGINS_IMPORT = /\bfrom\s*['"](expo\/config-plugins(?:\.js)?)['"]/g;
const SCENE_ON = /enableSceneSupport\s*:\s*true/;
const SCENE_CALLS = /\bwithSceneSupport\s*\(/g;
const SCENE_DEFINITION = /\bfunction\s+withSceneSupport\s*\(/;

function sourceFiles(root) {
  const found = [];
  for (const top of ['packages', 'apps']) {
    if (!existsSync(join(root, top))) continue;
    for (const rel of walk(join(root, top), { include: ['*.ts', '*.tsx'], ignore: ['ios', 'android', 'build', 'dist', '.expo'] })) {
      const path = `${top}/${rel}`;
      if (SOURCE.test(path) && !path.endsWith('.d.ts')) found.push(path);
    }
  }
  return found.sort();
}

function checkLockstep(repo, add) {
  const specs = new Map();
  for (const app of repo.apps) {
    for (const [name, spec] of Object.entries(depsOf(app.manifest))) {
      if (!name.startsWith('@e07/')) specs.set(name, [...(specs.get(name) ?? []), [app.ws, spec]]);
    }
  }
  for (const [name, list] of specs) {
    if (new Set(list.map(([, spec]) => spec)).size < 2) continue;
    const rule = name === 'expo' || name === 'react-native' ? 'sdk-lockstep' : 'app-lockstep';
    add(`${list[0][0]}/package.json`, 1, rule, `${name} differs between apps: ${list.map(([ws, spec]) => `${ws}=${spec}`).join(', ')}`, 'Every app moves to the new SDK in the same commit: run the same npx expo install commands in every app.');
  }
}

function checkModuleMap(repo, map, source, add) {
  for (const app of repo.apps) {
    const deps = depsOf(app.manifest);
    for (const core of ['react', 'react-native']) if (!(core in deps)) add(`${app.ws}/package.json`, 1, 'core-pins', `lacks ${core}`, `Run npx expo install ${core} inside ${app.ws}.`);
    for (const [name, spec] of Object.entries(deps)) {
      if (name === 'expo' || !(name in map) || spec === map[name]) continue;
      add(`${app.ws}/package.json`, 1, 'module-map', `${name} is "${spec}" but the SDK's module map (${source}) expects "${map[name]}"`, `Run npx expo install --fix inside ${app.ws} (every app), and never edit an Expo-managed specifier by hand.`);
    }
  }
}

function checkRoot(repo, context, add) {
  const { map, line, appReact, appRn, appDeps } = context;
  const root = repo.rootManifest ?? {};
  for (const [name, used] of [['react', appReact], ['react-native', appRn]]) {
    if (used && root.overrides?.[name] !== used) add('package.json', 1, 'overrides', `overrides.${name} is ${root.overrides?.[name] ?? 'missing'} but the apps use ${used}`, `Set "overrides": { "${name}": "${used}" } in the same commit as the apps; npm ls react react-native must show one version each.`);
  }
  for (const [name, value] of Object.entries(root.overrides ?? {})) {
    const used = appDeps[name];
    // An override pins the version the apps install (4.26.2 for "~4.26.0"): fine while it lies in the apps' range.
    if (name === 'react' || name === 'react-native' || used === undefined || value === used || satisfies(bare(value), used)) continue;
    add('package.json', 1, 'overrides', `overrides.${name} is ${value} but the apps use ${used}; a stale override forces the old version on every app`, `Set overrides.${name} to the version npx expo install --fix installed in the apps (npm ls ${name}; it lies in ${used}), npm install, then npx expo-doctor must report no duplicate native modules.`);
  }
  const dev = depsOf(root);
  for (const name of ['jest-expo', 'eslint-config-expo']) {
    if (dev[name] && map?.[name] && !satisfies(dev[name], map[name])) add('package.json', 1, 'sdk-tooling', `${name} is ${dev[name]} but this SDK expects ${map[name]}`, `npm install -D ${name}@${bare(map[name])} at the root (exact; it lies inside Expo's range).`);
  }
  for (const name of ['@react-native/jest-preset', '@react-native/eslint-plugin']) {
    if (dev[name] && appRn && bare(dev[name]) !== bare(appRn)) add('package.json', 1, 'rn-tooling', `${name} is ${dev[name]} but react-native is ${appRn}; they must be equal`, `npm install -D ${name}@${bare(appRn)} at the root.`);
  }
  if (!line) return;
  if (appReact && !onLine(appReact, line.react)) add('package.json', 1, 'core-pins', `the apps use react ${appReact}, but SDK ${context.sdk} ships React ${line.react}`, 'Run npx expo install --fix in every app; React moves only with the SDK.');
  const lines = [['@types/react', line.typesReact], ['test-renderer', line.testRenderer]];
  for (const [name, want] of lines) {
    if (dev[name] && !onLine(dev[name], want)) add('package.json', 1, 'react-line', `${name} is ${dev[name]}, but SDK ${context.sdk} (React ${line.react}) needs the ${want}.x line`, `npm install -D ${name}@${want} at the root; save-exact writes the exact version.`);
  }
  const held = [['typescript', line.typescript], ['jest', line.jest]];
  for (const [name, want] of held) {
    if (dev[name] && !onLine(dev[name], want)) add('package.json', 1, 'held-back', `${name} is ${dev[name]}; SDK ${context.sdk} keeps the ${want}.x line`, `Stay on ${name} ${want}.x (Expo's related packages); a major move needs its own trigger (dependency-management).`);
  }
  if (dev['@types/jest'] && line.typesJest && bare(dev['@types/jest']) !== line.typesJest) add('package.json', 1, 'held-back', `@types/jest is ${dev['@types/jest']}; SDK ${context.sdk} pins ${line.typesJest}`, `npm install -D @types/jest@${line.typesJest}.`);
}

/** In a readiness scan, changes that can only happen together with the move are listed, not failed. */
function moveTimeReporter(readiness, add) {
  if (!readiness) return add;
  return (file, line, rule, message, fix) => console.log(`todo     ${file}:${line} [${rule}] ${message} Fix: ${fix}`);
}

function scanSources(repo, files, context, add) {
  const { gestureMajor, apiLine, apiSdk, readiness } = context;
  const when = readiness ? ` (change it in the move commit to SDK ${apiSdk})` : '';
  const atMove = moveTimeReporter(readiness, add);
  for (const rel of files) {
    const text = maskComments(readFileSync(join(repo.root, rel), 'utf8'));
    if (gestureMajor !== null && gestureMajor >= 3) {
      for (const match of text.matchAll(GESTURE_BUILDER)) atMove(rel, lineOf(text, match.index), 'gesture-api', `uses the Gesture Handler builder Gesture.${match[1]}(), deprecated in v3${when}; hook and builder gestures cannot be related`, 'Move every board gesture to the v3 hooks together (useTapGesture, usePanGesture, useExclusiveGestures; onStart->onActivate, onEnd->onDeactivate), in use-board-gestures.ts as a whole.');
    }
    if (gestureMajor !== null && gestureMajor < 3) {
      for (const match of text.matchAll(GESTURE_IMPORT)) {
        const hooks = match[1].split(',').map((part) => part.trim().split(/\s+as\s+/)[0]).filter((name) => V3_HOOK.test(name));
        if (hooks.length) add(rel, lineOf(text, match.index), 'gesture-api', `imports ${hooks.join(', ')}, which Gesture Handler ${gestureMajor} does not have`, 'Use the builder API (Gesture.Tap() ...) until the SDK move brings Gesture Handler 3.');
      }
    }
    if (apiLine?.configPluginsImport) {
      for (const match of text.matchAll(CONFIG_PLUGINS_IMPORT)) {
        if (match[1] === apiLine.configPluginsImport) continue;
        const isTypeOnly = /^import\s+type\b/.test(text.slice(text.lastIndexOf('import', match.index)));
        if (isTypeOnly && apiLine.configPluginsImport.endsWith('.js')) continue;
        atMove(rel, lineOf(text, match.index), 'config-plugin-import', `imports '${match[1]}', but on SDK ${apiSdk} config plugins import '${apiLine.configPluginsImport}'${when}`, apiLine.configPluginsImport.endsWith('.js') ? "SDK 57's expo has no exports map: Node ESM needs the file extension, so write 'expo/config-plugins.js'." : "From SDK 58 expo has an exports map (\"./*\" -> \"./*.js\"), so 'expo/config-plugins.js' resolves to config-plugins.js.js; write 'expo/config-plugins' in the same commit as the move.");
      }
    }
    for (const api of apiLine?.removedReactNativeApis ?? []) {
      for (const match of text.matchAll(new RegExp(api.pattern, 'g'))) add(rel, lineOf(text, match.index), 'removed-rn-api', `uses ${api.id}, removed from the React Native of SDK ${apiSdk}${readiness ? ' (replace it now, before the move)' : ''}`, api.fix);
    }
  }
}

/**
 * Where scene support is switched on: a config file that sets enableSceneSupport: true itself, or
 * that calls withSceneSupport(...). The helper file (templates/shell-config/scene-support.ts) and
 * tests only define it, so they count as "on" only through a call; on SDK 58 they are leftovers.
 */
function sceneFiles(repo, files) {
  const active = [];
  const leftovers = [];
  const configFiles = files.filter((file) => /^(packages\/shell\/(src\/config|plugins)\/|apps\/[^/]+\/app\.config\.ts$)/.test(file));
  for (const rel of configFiles) {
    const text = maskComments(readFileSync(join(repo.root, rel), 'utf8'));
    const definition = SCENE_DEFINITION.exec(text);
    const definedAt = definition ? definition.index + definition[0].indexOf('withSceneSupport') : -1;
    const call = [...text.matchAll(SCENE_CALLS)].find((match) => match.index !== definedAt);
    // Inside the helper, enableSceneSupport: true is the definition, not a switch.
    const hit = (definition ? null : SCENE_ON.exec(text)) ?? call;
    const isTest = /\.test\.tsx?$/.test(rel);
    if (hit && !isTest) active.push({ rel, line: lineOf(text, hit.index) });
    else if (definition || (isTest && (hit || SCENE_ON.test(text)))) leftovers.push({ rel, line: lineOf(text, (definition ?? hit ?? SCENE_ON.exec(text)).index) });
  }
  return { active, leftovers };
}

function readXcode(root, option) {
  if (option) return { version: option, source: '--xcode' };
  const file = join(root, 'packages', 'tooling', 'src', 'ios', 'toolchain.ts');
  if (!existsSync(file)) return { version: null, source: null };
  const match = /XCODE_VERSION\s*=\s*['"](\d+(?:\.\d+)*)['"]/.exec(readFileSync(file, 'utf8'));
  return { version: match?.[1] ?? null, source: 'packages/tooling/src/ios/toolchain.ts' };
}

function checkScene(repo, files, context, add) {
  const { line, sdk, xcode, appExpo, targetLine, target } = context;
  const { active: hits, leftovers } = sceneFiles(repo, files);
  if (xcode.version === null) {
    console.log('xcode    no XCODE_VERSION found (packages/tooling/src/ios/toolchain.ts) and no --xcode: scene-support and xcode rules skipped');
  } else if (line) {
    const xcodeMajor = majorOf(xcode.version);
    const needsScene = line.xcodeMaxWithoutSceneSupport !== null && xcodeMajor > Number(line.xcodeMaxWithoutSceneSupport);
    const helpers = leftovers.filter((entry) => !/\.test\.tsx?$/.test(entry.rel)).map((entry) => entry.rel);
    const notWired = helpers.length ? ` (${helpers.join(', ')} defines it, but nothing calls withSceneSupport)` : '';
    if (needsScene && hits.length === 0) add(xcode.source, 1, 'scene-support', `Xcode ${xcode.version} with SDK ${sdk} needs expo-build-properties ios.enableSceneSupport: true${notWired} (apps built with the iOS 27 SDK on the application life cycle do not launch correctly on iOS 27)`, 'Copy templates/shell-config/scene-support.ts (and its test) into packages/shell/src/config/ and wrap the plugin list withShell returns: plugins: withSceneSupport([...]); then confirm UIApplicationSceneManifest with npx expo config --type introspect.');
    if (compareVersions(xcode.version, line.xcodeMin) < 0) add(xcode.source, 1, 'xcode', `SDK ${sdk} needs Xcode ${line.xcodeMin} or newer, the builds use ${xcode.version}`, 'Select a newer Xcode through DEVELOPER_DIR (never xcode-select); installing Xcode is an owner step.');
    if (targetLine && compareVersions(xcode.version, targetLine.xcodeMin) < 0) add(xcode.source, 1, 'xcode', `SDK ${target} needs Xcode ${targetLine.xcodeMin} or newer, the builds use ${xcode.version}`, 'Ask the owner to install a newer Xcode 26.x before the move.');
  }
  for (const hit of line && line.sceneSupportMinExpo === null ? [...hits, ...leftovers] : hits) {
    if (line && line.sceneSupportMinExpo === null) add(hit.rel, hit.line, 'scene-support', `ios.enableSceneSupport is set on SDK ${sdk}, where it is a no-op`, 'Remove the withSceneSupport call or the enableSceneSupport entry, and delete scene-support.ts and its test, in the move commit (SDK 58 and later handle the scene life cycle themselves).');
    else if (line?.sceneSupportMinExpo && appExpo && compareVersions(bare(appExpo), line.sceneSupportMinExpo) < 0) add(hit.rel, hit.line, 'scene-support', `ios.enableSceneSupport needs expo ${line.sceneSupportMinExpo} or newer, the apps declare ${appExpo}`, `Run npx expo install expo@~${line.sceneSupportMinExpo} in every app first (the plugin throws on older expo).`);
  }
}

function checkSkiaApproval(repo, context, add) {
  const { skia, line } = context;
  const approvals = Object.keys(repo.rootManifest?.allowScripts ?? {}).filter((key) => key.startsWith('@shopify/react-native-skia'));
  if (!skia || !line || approvals.length === 0) return;
  if (compareVersions(bare(skia), line.skiaPostinstallUntil) >= 0) add('package.json', 1, 'skia-approval', `allowScripts still approves ${approvals.join(', ')}, but Skia ${bare(skia)} has no install script (removed in ${line.skiaPostinstallUntil})`, 'Delete the Skia entry from allowScripts; npm approve-scripts --allow-scripts-pending must still print "No packages with unreviewed install scripts."');
}

function checkJestConfig(repo, context, add) {
  const { apiLine, apiSdk, readiness } = context;
  const wanted = apiLine?.jestConfigMustInclude ?? [];
  if (wanted.length === 0) return;
  const file = join(repo.root, 'jest.config.js');
  if (!existsSync(file)) return add('jest.config.js', 0, 'jest-config', 'is missing', 'Restore the root Jest config (unit-and-component-tests owns it).');
  const text = readFileSync(file, 'utf8').replace(/\s+/g, ' ');
  const atMove = moveTimeReporter(readiness, add);
  for (const item of wanted) {
    if (!text.includes(item.text.replace(/\s+/g, ' '))) atMove('jest.config.js', 1, 'jest-config', `lacks ${item.text} for SDK ${apiSdk}${readiness ? ' (add it in the move commit)' : ''}: ${item.why}`, item.fix);
  }
}

/**
 * The version the apps install: the lockfile copy inside the apps' specifier (4.26.2 for "~4.26.0"),
 * the newest of them when several are; the range floor only when no copy satisfies it.
 */
function appVersion(found, spec) {
  const inRange = found.filter((version) => satisfies(version, spec)).sort(compareVersions);
  return inRange.at(-1) ?? bare(spec);
}

/** Native modules (module-map packages) installed in more than one version, read from the lockfile. */
function checkDuplicates(repo, map, appDeps, add) {
  const lock = readJsonSafe(join(repo.root, 'package-lock.json')).value;
  if (!lock?.packages || !map) return;
  const versions = new Map();
  for (const [path, entry] of Object.entries(lock.packages)) {
    const at = path.lastIndexOf('node_modules/');
    if (at < 0 || !entry?.version) continue;
    const name = path.slice(at + 'node_modules/'.length);
    if (name in map || name === 'react' || name === 'react-native') versions.set(name, new Set([...(versions.get(name) ?? []), entry.version]));
  }
  for (const [name, found] of versions) {
    if (found.size < 2) continue;
    const sorted = [...found].sort(compareVersions);
    const spec = appDeps[name] ?? map[name];
    const want = spec ? appVersion(sorted, spec) : sorted.at(-1);
    add('package-lock.json', 1, 'duplicate-native', `${name} is installed as ${sorted.join(' and ')}; a native build may contain only one version (the apps install ${want}${spec ? ` for "${spec}"` : ''})`, `Add "${name}": "${want}" to the root overrides, npm install, then npx expo-doctor must report no duplicate native modules. The second copy is the Shell's "*" peer resolving to another release at the root (npm's newest on a first install, the old line after an SDK move); the override keeps one copy.`);
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const rootArg = positionals[0] ?? options.root ?? '.';
  const repo = readRepo(requireDir(rootArg, 'repo root'));
  if (repo.apps.length === 0) fail(`nothing to check: ${rootArg} has no apps/<id>/package.json`, 'Run it from the monorepo root, or pass the root folder: check-sdk-alignment.mjs <repo-root>.');
  const sdk = appsSdk(repo);
  if (sdk === null) fail('no app declares an "expo" dependency', 'Every apps/<id>/package.json lists expo; pass the monorepo root.');
  const target = options['target-sdk'] === undefined ? null : Number(options['target-sdk']);
  if (target !== null && !(target > sdk)) fail(`--target-sdk ${options['target-sdk']} must be a later SDK than the apps' ${sdk}`, `Pass --target-sdk ${sdk + 1}.`);
  const lines = loadSdkLines();
  const report = createReporter({ name: 'check-sdk-alignment', json: options.json });
  const add = (file, line, rule, message, fix) => report.problem({ file, line, rule, message, fix });
  for (const error of repo.errors) add(error.file, 1, 'sdk-lockstep', error.message, 'Fix the JSON.');
  const line = lines[String(sdk)] ?? null;
  if (!line) add('apps/', 0, 'sdk-unknown', `this skill has no expectations for Expo SDK ${sdk}`, `Add an "${sdk}" entry to assets/sdk-lines.json (and the module map) from the new SDK's bundledNativeModules.json and versions API, in the same commit as the move.`);
  const targetLine = target === null ? null : lines[String(target)] ?? null;
  if (target !== null && !targetLine) add('apps/', 0, 'sdk-unknown', `this skill has no expectations for Expo SDK ${target}`, `Add a "${target}" entry to assets/sdk-lines.json before the readiness scan.`);
  const { map, source } = moduleMapFor(repo.root, sdk);
  console.log(`sdk      apps on Expo SDK ${sdk}; module map: ${source ?? 'none (add assets/expo-sdk-<n>-module-map.json)'}${target === null ? '' : `; readiness scan for SDK ${target}`}`);
  const first = depsOf(repo.apps[0].manifest);
  const xcode = readXcode(repo.root, options.xcode);
  if (xcode.version) console.log(`xcode    ${xcode.version} (${xcode.source})`);
  const gestureMajor = targetLine ? targetLine.gestureHandlerMajor : first['react-native-gesture-handler'] ? majorOf(first['react-native-gesture-handler']) : null;
  const context = { sdk, line, map, target, targetLine, xcode, appDeps: first, appReact: first.react, appRn: first['react-native'], appExpo: first.expo, skia: first['@shopify/react-native-skia'] };
  checkLockstep(repo, add);
  if (map) checkModuleMap(repo, map, source, add);
  checkRoot(repo, context, add);
  const files = sourceFiles(repo.root);
  scanSources(repo, files, { gestureMajor, apiLine: targetLine ?? line, apiSdk: target ?? sdk, readiness: target !== null }, add);
  checkJestConfig(repo, { apiLine: targetLine ?? line, apiSdk: target ?? sdk, readiness: target !== null }, add);
  checkDuplicates(repo, map, first, add);
  checkScene(repo, files, context, add);
  checkSkiaApproval(repo, context, add);
  return report.finish({ checked: repo.apps.length + 1 + files.length, unit: 'manifests and source files' });
});
