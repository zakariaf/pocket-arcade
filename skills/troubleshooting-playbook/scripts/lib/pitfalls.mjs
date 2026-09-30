// pitfalls.mjs: known failures that can be seen in the repo before they happen. Each rule names
// its catalogue id; check-catalogue.mjs proves every id exists. A rule returns findings
// [{ file, line, message }] from the repo context { root, files, read(rel) }.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { lineOf, matchGlob, maskComments } from '../check-lib.mjs';

// Runtime code that Metro bundles for the phone (packages/tooling is Node code and is excluded).
const CODE = ['packages/shell/src/**/*.{ts,tsx}', 'packages/game-kit/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}', 'apps/*/index.ts'];
const TOOLING = ['packages/tooling/**/*.{ts,mts,sh}'];
const CONFIG = ['apps/*/app.config.ts', 'packages/shell/src/config/**/*.ts', 'packages/shell/plugins/**/*.ts'];
const PACKAGE_JSONS = ['package.json', 'apps/*/package.json', 'packages/*/package.json'];
const FLOWS = ['**/e2e/**/*.{yaml,yml}'];
const TEST_FILE = /\.(test|golden\.test|sim\.test|perf\.test)\.tsx?$/;
const RAW = /\.(json|ya?ml|plist)$/;

function filesMatching(ctx, globs, { tests = true } = {}) {
  return ctx.files.filter((rel) => globs.some((glob) => matchGlob(rel, glob)) && (tests || !TEST_FILE.test(rel)));
}

/** Code with comments blanked (line numbers kept); data files as they are. */
function text(ctx, rel) {
  return RAW.test(rel) ? ctx.read(rel) : maskComments(ctx.read(rel));
}

/** One finding per file where `pattern` matches. */
function grep(ctx, globs, pattern, message, { except = [], tests = true } = {}) {
  const findings = [];
  for (const rel of filesMatching(ctx, globs, { tests })) {
    if (except.includes(rel)) continue;
    const body = text(ctx, rel);
    const match = pattern.exec(body);
    if (match) findings.push({ file: rel, line: lineOf(body, match.index), message });
  }
  return findings;
}

function dependencies(ctx, rel) {
  try {
    const pkg = JSON.parse(ctx.read(rel));
    return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  } catch {
    return {};
  }
}

/** Every dependency of every workspace package.json, merged (first declaration wins). */
function allDependencies(ctx) {
  const merged = {};
  for (const rel of filesMatching(ctx, PACKAGE_JSONS)) {
    for (const [name, version] of Object.entries(dependencies(ctx, rel))) merged[name] ??= String(version);
  }
  return merged;
}

/** Findings for dependencies whose name matches and for which bad(version, allDeps) is true. */
function depRule(ctx, names, bad, message) {
  const findings = [];
  const everything = allDependencies(ctx);
  for (const rel of filesMatching(ctx, PACKAGE_JSONS)) {
    for (const [name, version] of Object.entries(dependencies(ctx, rel))) {
      const named = names.some((pattern) => (pattern instanceof RegExp ? pattern.test(name) : pattern === name));
      if (named && bad(String(version), everything)) findings.push({ file: rel, line: 0, message: `${name}@${version}: ${message}` });
    }
  }
  return findings;
}

const major = (version) => Number(/(\d+)/.exec(version ?? '')?.[1] ?? 0);
const always = () => true;

export const PITFALLS = [
  // ---- build and variants
  { id: 'build-metro-cache-variant', detect: (ctx) => filesMatching(ctx, ['apps/*/metro.config.{js,cjs}']).filter((rel) => !/cacheVersion\s*=[^;\n]*EXPO_PUBLIC_APP_VARIANT/.test(maskComments(ctx.read(rel)))).map((rel) => ({ file: rel, line: 1, message: 'metro.config does not key cacheVersion on EXPO_PUBLIC_APP_VARIANT: a store build can ship test code' })) },
  { id: 'build-config-missing-ts-extension', detect: (ctx) => grep(ctx, ['apps/*/app.config.ts'], /from\s+['"]\.\/game\.config['"]/, "imports './game.config' without .ts: Node type stripping cannot resolve it") },
  { id: 'build-imported-constant-gate', detect: (ctx) => grep(ctx, CODE, /require\(\s*['"][^'"]*test-only-entry(?:\.ts)?['"]\s*\)/, 'requires test-only-entry outside the literal gate in src/app/test-only.ts', { except: ['packages/shell/src/app/test-only.ts'] }) },
  { id: 'build-reload-during-bundle-eval', detect: (ctx) => grep(ctx, ['apps/*/index.ts', 'packages/shell/src/app/start-shell.ts'], /^(?:void\s+|await\s+)?reloadAppAsync\(/m, 'calls reloadAppAsync() at module level: the Release app terminates (startSurface failed)') },
  { id: 'build-xcode-27-picked', detect: (ctx) => grep(ctx, TOOLING, /xcode-select['"]?\s*,?\s*\[?\s*['"]?\s*(?:-s|--switch)\b|xcode-select\s+(?:-s|--switch)\b/, 'switches the global Xcode with xcode-select; select it per process with DEVELOPER_DIR') },
  { id: 'build-other-agents-simulators', detect: (ctx) => grep(ctx, TOOLING, /['"](?:shutdown|erase|delete)['"]\s*,\s*['"]all['"]|simctl\s+(?:shutdown|erase|delete)\s+all\b/, 'touches all simulators; other agents use them too') },
  // ---- dependencies
  { id: 'deps-netinfo-probe', detect: (ctx) => depRule(ctx, ['@react-native-community/netinfo'], always, 'its reachability probe fetches clients3.google.com from our bundle; use expo-network') },
  { id: 'deps-network-packages', detect: (ctx) => [...depRule(ctx, ['expo-updates', 'expo-dev-client', 'expo-insights', 'expo-observe', 'react-native-purchases', 'react-native-webview', '@expo/dom-webview', /^@sentry\//, /^@react-native-firebase\//], always, 'adds a server, telemetry or OTA updates (banned)'), ...grep(ctx, CONFIG, /updates\s*:\s*\{\s*enabled\s*:\s*true/, 'enables OTA updates (updates.enabled must stay false)')] },
  { id: 'deps-expo-audio', detect: (ctx) => depRule(ctx, ['expo-audio'], always, 'use react-native-audio-api; expo-audio defaults to recording and background playback') },
  { id: 'deps-svg-and-flashlist', detect: (ctx) => depRule(ctx, ['react-native-svg', '@shopify/flash-list'], always, 'not used: icons are Skia paths, lists are ScrollView/FlatList') },
  { id: 'deps-eslint-10-crash', detect: (ctx) => depRule(ctx, ['eslint'], (v, all) => major(v) >= 10 && major(all['eslint-config-expo']) <= 57, 'eslint-config-expo 57 crashes on ESLint 10; pin 9.39.5') },
  { id: 'deps-typescript-7', detect: (ctx) => depRule(ctx, ['typescript'], (v, all) => major(v) >= 7 && major(all['typescript-eslint']) <= 8, 'TypeScript 7 has no API yet; typescript-eslint 8 needs typescript <6.1') },
  { id: 'deps-jest-30', detect: (ctx) => depRule(ctx, ['jest'], (v, all) => major(v) >= 30 && major(all['jest-expo']) <= 58, 'jest-expo 57/58 depend on Jest 29; stay on 29.7') },
  { id: 'deps-test-renderer-1-3', detect: (ctx) => depRule(ctx, ['test-renderer'], (v) => /^[~^]?1\.3/.test(v), 'test-renderer 1.3 is for React 19.3; SDK 57 needs 1.2.0') },
  { id: 'deps-expo-install-range', detect: (ctx) => depRule(ctx, ['react-native-audio-api', 'react-native-google-mobile-ads', 'expo-iap'], (v) => !/^\d+\.\d+\.\d+$/.test(v), 'is not pinned exactly (a fast-moving package outside Expo\'s module map: write the exact version)') },
  { id: 'deps-expo-iap-servers', detect: (ctx) => grep(ctx, CONFIG, /\bonside\b|iapkitApiKey/, 'enables an expo-iap option that adds a server (Onside or IAPKit)') },
  // ---- services and i18n
  { id: 'services-att-prompt', detect: (ctx) => [...grep(ctx, CONFIG, /userTrackingUsageDescription/, 'passes userTrackingUsageDescription: v1 never asks for tracking'), ...depRule(ctx, ['expo-tracking-transparency'], always, 'v1 never asks for tracking (D4)')] },
  { id: 'i18n-localization-rtl-flags', detect: (ctx) => grep(ctx, CONFIG, /\b(supportsRTL|forcesRTL)\b/, 'sets expo-localization supportsRTL/forcesRTL; the Shell owns direction') },
  { id: 'i18n-force-rtl-reload', detect: (ctx) => grep(ctx, CODE, /Updates\.reloadAsync|from\s+['"]expo-updates['"]/, "reloads through expo-updates; use reloadAppAsync from 'expo'") },
  { id: 'i18n-dynamic-locale-import', detect: (ctx) => grep(ctx, CODE, /\bimport\(\s*`/, 'template-string dynamic import: Metro cannot bundle it') },
  { id: 'i18n-hermes-intl', detect: (ctx) => grep(ctx, CODE, /\bIntl\.DateTimeFormat\b|\.toLocale(?:Date|Time)?String\(/, 'formats with Intl.DateTimeFormat or toLocale*: Hermes drops the numbering system and uses the Persian calendar for fa; use the Shell formatters', { tests: false }) },
  // ---- engine
  { id: 'engine-frame-clock-freeze', detect: (ctx) => grep(ctx, CODE, /\.timeSinceFirstFrame\b/, 'reads timeSinceFirstFrame, which resets when the frame callback restarts; use timestamp and startAt', { tests: false }) },
  { id: 'engine-zustand-new-object', detect: (ctx) => grep(ctx, CODE, /\buse\w*Store\(\s*\(?\s*\w*\s*\)?\s*=>\s*(?:\(\s*\{|\[)/, 'a store selector returns a new object or array on every call (Maximum update depth exceeded); wrap it in useShallow', { tests: false }) },
  { id: 'engine-shared-value-access', detect: (ctx) => sharedValueAccess(ctx) },
  { id: 'engine-runonjs-deprecated', detect: (ctx) => grep(ctx, CODE, /(?<!\.)\brunOnJS\b/, 'uses runOnJS (deprecated in Worklets 0.10); use scheduleOnRN', { tests: false }) },
  { id: 'parity-capture-unstable-loop', detect: (ctx) => filesMatching(ctx, CODE, { tests: false }).filter((rel) => { const body = text(ctx, rel); return /\bwithRepeat\s*\(/.test(body) && !/reduced?Motion/i.test(body); }).map((rel) => ({ file: rel, line: lineOf(text(ctx, rel), text(ctx, rel).search(/\bwithRepeat\s*\(/)), message: 'a repeating animation (withRepeat) that never reads reduce motion: parity captures stay unstable; rest when useReduceMotion() is true (true while the parity launch freezes motion)' })) },
  { id: 'services-interstitial-only-once', detect: (ctx) => filesMatching(ctx, ['packages/shell/src/app/create-shell-parts.ts']).filter((rel) => { const body = text(ctx, rel); return /\bcreateGameHost\s*\(/.test(body) && !/\bextendRunEnd\b/.test(body); }).map((rel) => ({ file: rel, line: lineOf(text(ctx, rel), text(ctx, rel).search(/\bcreateGameHost\s*\(/)), message: 'createGameHost gets no extendRunEnd, so finished levels never reach the ad history and only one interstitial ever shows; pass extendRunEnd: recordAdLevelEnd' })) },
  { id: 'engine-skia-mutable-path', detect: (ctx) => grep(ctx, CODE, /\bSkia\.Path\.Make\(\s*\)/, 'builds a mutable SkPath (deprecated since Skia 2.6); use Skia.PathBuilder.Make()...build()', { tests: false }) },
  // ---- lint and tests
  { id: 'lint-jest-rules-spread', detect: (ctx) => grep(ctx, ['eslint.config.{js,mjs,cjs}'], /\.\.\.\s*[\w.]+\[\s*['"]flat\/recommended['"]\s*\]\s*,\s*\.\.\.\s*[\w.]+\[\s*['"]flat\/style['"]\s*\]/, 'spreads jest flat/recommended and flat/style into one object: every recommended rule is dropped; use extends') },
  { id: 'lint-complexity-switch', detect: (ctx) => grep(ctx, ['eslint.config.{js,mjs,cjs}'], /(?<![\w/-])['"]?complexity['"]?\s*:\s*\[\s*['"]error['"]\s*,\s*(?:\d+|\{(?![^}]*variant\s*:\s*['"]modified['"])[^}]*\})\s*\]/, "complexity without variant: 'modified' fails exhaustive switches") },
  { id: 'testing-babel-config-missing', detect: (ctx) => (Object.keys(dependencies(ctx, 'package.json')).includes('jest-expo') && !['babel.config.js', 'babel.config.cjs'].some((name) => existsSync(join(ctx.root, name))) ? [{ file: 'package.json', line: 0, message: 'jest-expo is installed but babel.config.js is missing: every suite fails with a Flow syntax error' }] : []) },
  { id: 'testing-skia-global-env', detect: (ctx) => filesMatching(ctx, ['jest.config.{js,cjs,mjs,ts}']).filter((rel) => { const body = maskComments(ctx.read(rel)); return /testEnvironment\s*:\s*['"]@shopify\/react-native-skia\/jestEnv/.test(body) && !/\bprojects\s*:/.test(body); }).map((rel) => ({ file: rel, line: 0, message: "Skia's jestEnv is the global test environment; split unit and golden projects" })) },
  { id: 'testing-coverage-missing-dir', detect: (ctx) => coverageKeys(ctx) },
  { id: 'testing-snap-ios-path', detect: (ctx) => snapIosGated(ctx) },
  { id: 'testing-maestro-ai-commands', detect: (ctx) => grep(ctx, FLOWS, /\b(assertWithAI|assertNoDefectsWithAI|extractTextWithAI)\b/, 'uploads screenshots to an LLM service (banned in flows)') },
  { id: 'testing-maestro-airplane', detect: (ctx) => grep(ctx, FLOWS, /\bsetAirplaneMode\b/, 'setAirplaneMode does nothing on the iOS simulator; use the Simulate offline debug switch') },
  { id: 'testing-maestro-tags-flag', detect: (ctx) => [...grep(ctx, TOOLING, /(?<![\w-])--tags\b/, 'passes --tags, which Maestro 2.10 rejects; use --include-tags / --exclude-tags'), ...grep(ctx, ['package.json'], /maestro[^"\n]*(?<![\w-])--tags\b/, 'passes --tags, which Maestro 2.10 rejects; use --include-tags / --exclude-tags')] },
  // ---- release
  { id: 'release-app-store-method', detect: (ctx) => grep(ctx, ['packages/tooling/config/*.plist'], /<key>method<\/key>\s*<string>app-store<\/string>/, 'ExportOptions method app-store is deprecated; use app-store-connect') },
  { id: 'release-manage-version-default', detect: (ctx) => filesMatching(ctx, ['packages/tooling/config/export-options-*.plist']).filter((rel) => !/<key>manageAppVersionAndBuildNumber<\/key>\s*<false\s*\/>/.test(ctx.read(rel))).map((rel) => ({ file: rel, line: 0, message: 'manageAppVersionAndBuildNumber is not false: Xcode would rewrite version and build numbers' })) },
  { id: 'release-secrets-printed', detect: (ctx) => grep(ctx, TOOLING, /console\.(?:log|info|warn|error)\([^;]*\b(token|jwt|privateKeyPem|authorization)\b/i, 'prints a token, JWT, key or Authorization header') },
  // ---- state
  { id: 'state-zod-jit', detect: (ctx) => depRule(ctx, ['zod'], always, "zod 4's JIT uses new Function; the save file uses valibot") },
  { id: 'state-newer-db-crash', detect: (ctx) => grep(ctx, ['packages/shell/src/services/save/sqlite-save-store.ts'], /\bthrow\b/, 'the SQLite store throws while opening save.db: a save.db from a newer app crash-loops every launch') },
  { id: 'state-countdown-utc', detect: (ctx) => grep(ctx, ['packages/shell/src/screens/**/*.{ts,tsx}'], /%\s*86_?400_?000\b/, 'epoch time modulo a day is UTC midnight, not the player\'s: use useNextDayCountdown()', { tests: false }) },
  // ---- repo holding the skills folder
  { id: 'deps-knip-skills-folder', detect: (ctx) => skillsNotIgnored(ctx, 'knip.json', /["']skills\/\*\*["']/, 'knip.json does not ignore skills/**: knip reads the skill templates and fixtures') },
  { id: 'testing-duplicate-manual-mock', detect: (ctx) => skillsNotIgnored(ctx, 'jest.config.js', /\bskills\b/, "jest.config.js does not ignore skills/: Jest indexes the skills' __mocks__ (duplicate manual mock)") },
  { id: 'gates-commit-msg-enobufs', detect: (ctx) => filesMatching(ctx, ['packages/tooling/**/check-commit-message.ts']).filter((rel) => /\bspawnSync\s*\(/.test(ctx.read(rel)) && !/\bmaxBuffer\b/.test(ctx.read(rel))).map((rel) => ({ file: rel, line: 1, message: 'spawnSync without maxBuffer: a commit that stages skills/ fails with ENOBUFS' })) },
];

/** A root config that must ignore skills/ once the repo holds the skills folder. */
function skillsNotIgnored(ctx, rel, pattern, message) {
  if (!existsSync(join(ctx.root, 'skills')) || !ctx.files.includes(rel)) return [];
  return pattern.test(ctx.read(rel)) ? [] : [{ file: rel, line: 1, message }];
}

/** `const x = useSharedValue(...)` followed by `x.value`: use x.get() / x.set() under the React Compiler. */
function sharedValueAccess(ctx) {
  const findings = [];
  for (const rel of filesMatching(ctx, CODE, { tests: false })) {
    const body = maskComments(ctx.read(rel));
    for (const declared of body.matchAll(/const\s+(\w+)\s*=\s*useSharedValue\b/g)) {
      const use = new RegExp(`\\b${declared[1]}\\.value\\b`).exec(body);
      if (use) {
        findings.push({ file: rel, line: lineOf(body, use.index), message: `${declared[1]}.value: use ${declared[1]}.get() / .set() (compiler-safe)` });
        break;
      }
    }
  }
  return findings;
}

/** Static coverageThreshold keys such as './packages/shell/src/save/': { ... } that point at missing folders. */
function coverageKeys(ctx) {
  const findings = [];
  for (const rel of filesMatching(ctx, ['jest.config.{js,cjs,mjs,ts}'])) {
    const body = maskComments(ctx.read(rel));
    if (/\bglobSync\b|\bexistsSync\b/.test(body)) continue; // keys are filtered by what exists
    for (const key of body.matchAll(/['"](\.\/[^'"*{}]+)['"]\s*:\s*\{/g)) {
      if (!existsSync(join(ctx.root, key[1]))) findings.push({ file: rel, line: lineOf(body, key.index), message: `coverageThreshold key ${key[1]} matches no files yet: Jest exits 1 ("Coverage data ... was not found")` });
    }
  }
  return findings;
}

/** quality-gates.json gates golden snapshots but not the *.snap.ios files jest-expo/ios writes. */
function snapIosGated(ctx) {
  if (!ctx.files.includes('quality-gates.json')) return [];
  let gates;
  try {
    gates = JSON.parse(ctx.read('quality-gates.json'));
  } catch {
    return [{ file: 'quality-gates.json', line: 0, message: 'is not valid JSON' }];
  }
  const paths = Array.isArray(gates?.gatedPaths) ? gates.gatedPaths : [];
  if (paths.some((glob) => /\.snap\.ios\b/.test(String(glob)))) return [];
  return [{ file: 'quality-gates.json', line: 0, message: 'gatedPaths has no **/*.golden.test.ts.snap.ios entry: golden updates written by jest-expo/ios pass without a Gate-Change trailer' }];
}
