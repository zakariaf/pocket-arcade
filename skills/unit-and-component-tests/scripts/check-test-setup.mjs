#!/usr/bin/env node
// check-test-setup.mjs: checks the test infrastructure of a Pocket Arcade repo without running Jest:
// exact test-tool pins and one React, the canonical test scripts, babel.config.js with the Stryker
// branch, jest.config.js (two projects, workspace mapper, UTC, mocks reset, coverage gates),
// jest.setup.ts (with the central Skia mock), jest.sim.config.js, stryker.config.json,
// tsconfig.stryker.json, the root vendor mocks and the renderWithShell helper.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-test-setup.mjs [repo-root]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { REPO_SCAN_IGNORES, createReporter, fail, maskComments, parseArgs, requireDir, run, walk } from './check-lib.mjs';

const SPEC = {
  name: 'check-test-setup',
  summary: 'Checks the Jest, Babel, Stryker and mock set-up of the repo against the rules of the unit-and-component-tests skill. It loads jest.config.js and jest.sim.config.js (as Jest would) but runs no test.',
  usage: '[options] [repo-root]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  test-dep-missing          a test tool is missing from the root devDependencies (the message names its companion:',
    '                            RNTL 14.0.1 needs test-renderer 1.2.0; 1.3.0 targets React 19.3 and SDK 58)',
    '  test-dep-range            a test tool is pinned with ^, ~ or a range instead of an exact version',
    '  test-dep-version          a test tool is on the wrong line (jest 29.7, RNTL 14, fast-check 4, jest-expo = the SDK,',
    '                            @react-native/jest-preset = react-native, Stryker packages all equal)',
    '  test-renderer-line        test-renderer minor differs from the React minor (React 19.2 needs test-renderer 1.2.x)',
    '  one-react                 root overrides do not pin react and react-native to the apps\' exact versions',
    '  test-script               a canonical test script (test, test:golden, test:sim, test:coverage, test:mutation) differs',
    '  babel-config              root babel.config.js is missing or lacks the Stryker branch (worklets: false, reanimated: false)',
    '  jest-config-missing       no jest.config.js at the repo root',
    '  jest-config-load          jest.config.js or jest.sim.config.js throws when loaded',
    '  jest-tz                   a Jest config does not set process.env.TZ = \'UTC\'',
    '  jest-projects             not exactly two projects named unit and golden',
    '  jest-unit-project         unit: preset jest-expo/ios, jest.setup.ts, goldens and sims ignored',
    '  jest-golden-project       golden: Skia jestEnv + jestSetup, *.golden.test.ts only, and not jest.setup.ts (its inert',
    '                            Skia mock would blank every pixel golden)',
    '  jest-workspace-mapper     no moduleNameMapper from @e07/<package>/ to <rootDir>/packages/<package>/src/',
    '  jest-transform            transformIgnorePatterns does not let Babel transpile RN, Expo, Skia, navigation and FormatJS',
    '  jest-mock-reset           clearMocks and restoreMocks are not both true',
    '  jest-setup-file-missing   a setupFiles or setupFilesAfterEnv entry under <rootDir> does not exist',
    '  jest-retries              a Jest config retries tests (testRetries, jest.retryTimes)',
    '  jest-ignored-paths        modulePathIgnorePatterns lets Jest see skills/, .claude/ or .stryker-tmp/ (their',
    '                            package.json and __mocks__ copies collide: "duplicate manual mock found")',
    '  coverage-threshold        global below 90/90/90/85 or a logic key below 95/95/95/90',
    '  coverage-threshold-keys   the game-kit, save or rules threshold key is gone from jest.config.js',
    '  coverage-report           coverage is not written to reports/coverage with a json-summary reporter',
    '  coverage-scope            collectCoverageFrom counts tests, testing/ or fixtures/, or leaves out anything else',
    '                            (only packages/tooling, tests, .d.ts, fixtures/ and testing/ may be left out)',
    '  coverage-device-only      jest.config.js does not take its coverage exclusions from',
    '                            packages/tooling/src/quality/device-only.ts, the helper is missing, a file marked',
    '                            "// device-only: covered by <check>" is still counted, or a coverage exclusion hides a',
    '                            file that carries no such marker',
    '  jest-setup-missing        no jest.setup.ts at the repo root',
    '  jest-setup-content        jest.setup.ts lacks the Gesture Handler setup, the Worklets mock or Reanimated setUpTests',
    '  skia-unit-mock            jest.setup.ts does not mock @shopify/react-native-skia (Skia\'s native module cannot load in the',
    '                            unit project: every suite that imports the logo tile, a picture, the hazard strip, the debug',
    '                            screen or a board canvas crashes with "Native Skia Module failed to correctly install JSI Bindings")',
    '  icon-raster-mock          packages/shell/src/ui/icons/icon-raster.ts exists but jest.setup.ts does not mock it (unit',
    '                            tests would load Skia), or jest.setup.ts mocks it before the file exists (every suite fails)',
    '  sim-config                jest.sim.config.js is missing, not a plain node environment, or matches more than sims',
    '  stryker-config            stryker.config.json is missing or weaker (runner, jest config, checker, break >= 75, logic scope, report)',
    '  stryker-tsconfig          tsconfig.stryker.json is missing or not a jest-only program',
    '  root-mock-missing         an app uses react-native-google-mobile-ads, expo-iap or expo-tracking-transparency but',
    '                            __mocks__/<sdk>.ts is missing',
    '  nested-sdk-mock           a vendor SDK mock sits in a __mocks__ folder Jest does not apply to node modules',
    '  render-with-shell-missing component tests exist but packages/shell/src/testing/render-with-shell.tsx does not',
    '                            (a test marked "// no-shell-context: <why>" needs no Shell and does not count)',
    '',
    'Fixes name the template to copy from this skill (templates/<same path>).',
  ].join('\n'),
};

const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const VENDOR_SDKS = ['react-native-google-mobile-ads', 'expo-iap', 'expo-tracking-transparency'];
const SCRIPTS = {
  test: 'jest --ci',
  'test:golden': 'jest --ci --selectProjects golden',
  'test:sim': 'jest --ci --config jest.sim.config.js',
  'test:coverage': 'jest --ci --coverage --randomize',
  'test:mutation': 'stryker run',
};
const LINES = {
  jest: [/^29\.7\./, '29.7.x'],
  '@types/jest': [/^29\./, '29.x'],
  '@testing-library/react-native': [/^14\./, '14.x'],
  'fast-check': [/^4\./, '4.x'],
  'babel-jest': [/^29\.7\./, '29.7.x'],
  'test-renderer': [/^1\./, '1.x'],
};
// The shared repo-scan ignores (skills/, .claude/, node_modules, Pods, each app's generated ios/, android/,
// build/, out/) plus generated reports.
const IGNORE = [...REPO_SCAN_IGNORES, 'apps/*/dist/**', 'reports/**', 'coverage/**', 'tools/**', 'dist-audit/**', '.stryker-tmp/**'];
// Test tools that only work as a pair: installing one alone lets npm pick a wrong line for the other.
const COMPANIONS = {
  '@testing-library/react-native': 'test-renderer 1.2.0 (RNTL 14.0.1 needs it; 1.3.0 targets React 19.3 and SDK 58)',
  'test-renderer': '@testing-library/react-native 14.0.1 (test-renderer 1.2.0 is its React 19.2 renderer; 1.3.0 targets React 19.3 and SDK 58)',
};
const DEVICE_ONLY_HELPER = 'packages/tooling/src/quality/device-only.ts';
const DEVICE_ONLY = /^\/\/\s*device-only:(.*)$/m;
const CANONICAL_COVERAGE_EXCLUSIONS = ['!<rootDir>/packages/tooling/**', '!**/*.{test,golden.test,sim.test}.{ts,tsx}', '!**/*.d.ts', '!**/fixtures/**', '!**/testing/**'];
const TRANSPILE = ['react-native', '@react-native', 'expo', '@expo', '@react-navigation', '@shopify/react-native-skia', 'react-intl', '@formatjs', 'intl-messageformat'];
const GLOBAL_MIN = { statements: 90, lines: 90, functions: 90, branches: 85 };
const LOGIC_MIN = { statements: 95, lines: 95, functions: 95, branches: 90 };
const LOGIC_KEYS = ['./packages/game-kit/src/', './packages/shell/src/services/save/', './apps/*/src/rules/**/*.ts'];
const STRYKER_SCOPE = ['packages/game-kit/src/**/*.ts', 'apps/*/src/rules/**/*.ts', 'apps/*/src/levels/**/*.ts', 'packages/shell/src/services/save/**/*.ts'];

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function workspaceManifests(root) {
  const out = [];
  for (const group of ['apps', 'packages']) {
    const dir = join(root, group);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      const file = join(dir, name, 'package.json');
      if (!existsSync(file)) continue;
      try {
        out.push({ rel: `${group}/${name}/package.json`, pkg: readJson(file) });
      } catch {
        // a broken manifest is another checker's business
      }
    }
  }
  return out;
}

const depsOf = (pkg) => ({ ...pkg.peerDependencies, ...pkg.devDependencies, ...pkg.dependencies });

/** The exact version the apps declare for a package, or null (ranges are stripped of ^ and ~). */
function appVersion(manifests, name) {
  for (const { rel, pkg } of manifests) {
    if (!rel.startsWith('apps/')) continue;
    const version = depsOf(pkg)[name];
    if (typeof version === 'string' && /\d/.test(version)) return version.replace(/^[\^~=]/, '');
  }
  return null;
}

function checkPackage(root, manifests, report) {
  const file = join(root, 'package.json');
  let pkg;
  try {
    pkg = readJson(file);
  } catch (error) {
    fail(`package.json is not valid JSON: ${error.message}`, 'Fix the root package.json first.');
  }
  const dev = { ...pkg.dependencies, ...pkg.devDependencies };
  const problem = (rule, message, fix) => report.problem({ file: 'package.json', line: 1, rule, message, fix });
  const reactVersion = pkg.overrides?.react ?? appVersion(manifests, 'react');
  const rnVersion = pkg.overrides?.['react-native'] ?? appVersion(manifests, 'react-native');
  const expoVersion = appVersion(manifests, 'expo');
  const required = ['jest', '@types/jest', 'jest-expo', '@react-native/jest-preset', '@testing-library/react-native', 'test-renderer', 'fast-check'];
  if (existsSync(join(root, 'jest.sim.config.js'))) required.push('babel-jest');
  const stryker = ['@stryker-mutator/core', '@stryker-mutator/jest-runner', '@stryker-mutator/typescript-checker'];
  if (existsSync(join(root, 'stryker.config.json'))) required.push(...stryker);
  for (const name of required) {
    const version = dev[name];
    if (version === undefined) {
      const companion = COMPANIONS[name] ? ` It comes with ${COMPANIONS[name]}.` : '';
      problem('test-dep-missing', `devDependencies lack ${name}`, `Add the exact pin from templates/package.test-deps.json (npm install --save-dev --save-exact ${name}@<version>), together with its companion.${companion}`);
      continue;
    }
    if (!EXACT.test(version)) {
      problem('test-dep-range', `${name} is "${version}", not an exact version`, 'Pin the exact version (save-exact); a range lets npm move a test tool under the suite.');
      continue;
    }
    if (LINES[name] && !LINES[name][0].test(version)) problem('test-dep-version', `${name} ${version} is not the verified line ${LINES[name][1]}`, 'Use the version in templates/package.test-deps.json; move lines only in an SDK upgrade.');
  }
  const jestExpo = dev['jest-expo'];
  if (jestExpo && expoVersion && EXACT.test(jestExpo) && jestExpo.split('.')[0] !== expoVersion.split('.')[0]) problem('test-dep-version', `jest-expo ${jestExpo} does not match the apps' Expo SDK ${expoVersion}`, 'Install the jest-expo listed in expo/bundledNativeModules.json of the installed SDK.');
  const preset = dev['@react-native/jest-preset'];
  if (preset && rnVersion && EXACT.test(preset) && preset !== rnVersion) problem('test-dep-version', `@react-native/jest-preset ${preset} differs from react-native ${rnVersion}`, 'Pin @react-native/jest-preset to exactly the React Native version.');
  const strykerVersions = new Set(stryker.map((name) => dev[name]).filter(Boolean));
  if (strykerVersions.size > 1) problem('test-dep-version', `the Stryker packages are on different versions (${[...strykerVersions].join(', ')})`, 'Pin @stryker-mutator/core, jest-runner and typescript-checker to one version.');
  const renderer = dev['test-renderer'];
  if (renderer && reactVersion && EXACT.test(renderer)) {
    const reactMinor = reactVersion.split('.')[1];
    const rendererMinor = renderer.split('.')[1];
    if (reactMinor !== rendererMinor) problem('test-renderer-line', `test-renderer ${renderer} does not match React ${reactVersion}`, `Pin test-renderer 1.${reactMinor}.x (the line for React 19.${reactMinor}); npm's automatic pick follows the newest React.`);
  }
  for (const name of ['react', 'react-native']) {
    const override = pkg.overrides?.[name];
    const app = appVersion(manifests, name);
    if (override === undefined) problem('one-react', `overrides lack "${name}"`, `Add "overrides": { "${name}": "<the apps' exact version>" } so Jest tests the ${name} the app ships; check with npm ls react react-native.`);
    else if (!EXACT.test(override)) problem('one-react', `overrides pin ${name} as "${override}", not an exact version`, 'Use the exact version the apps declare.');
    else if (app && app !== override) problem('one-react', `overrides pin ${name} ${override} but the apps use ${app}`, 'Make the override equal the apps\' version.');
  }
  for (const [name, command] of Object.entries(SCRIPTS)) {
    const actual = pkg.scripts?.[name];
    if (actual !== command) problem('test-script', `script "${name}" is ${actual === undefined ? 'missing' : JSON.stringify(actual)}`, `Set "${name}": ${JSON.stringify(command)} (--ci never writes snapshots).`);
  }
}

function checkBabel(root, report) {
  const file = join(root, 'babel.config.js');
  if (!existsSync(file)) {
    report.problem({ file: 'babel.config.js', line: 0, rule: 'babel-config', message: 'is missing at the repo root', fix: 'Copy templates/babel.config.js to the root; jest-expo reads Babel options from the working directory.' });
    return;
  }
  const text = readFileSync(file, 'utf8');
  const needs = [
    [/babel-preset-expo/, 'babel-preset-expo'],
    [/STRYKER_MUTATOR_WORKER/, 'the STRYKER_MUTATOR_WORKER branch'],
    [/worklets:\s*false/, 'worklets: false'],
    [/reanimated:\s*false/, 'reanimated: false'],
  ];
  for (const [pattern, what] of needs) {
    if (!pattern.test(text)) report.problem({ file: 'babel.config.js', line: 1, rule: 'babel-config', message: `lacks ${what}`, fix: 'Copy templates/babel.config.js: mutation workers must compile without the Worklets and Reanimated plugins ("stryNS_… is read-only").' });
  }
}

function loadConfig(root, rel, report) {
  try {
    const require = createRequire(join(root, 'package.json'));
    return require(join(root, rel));
  } catch (error) {
    report.problem({ file: rel, line: 1, rule: 'jest-config-load', message: `throws when loaded: ${String(error.message).split('\n')[0]}`, fix: `Restore it from templates/${rel}.` });
    return null;
  }
}

const list = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);

function checkSetupFiles(root, rel, project, report) {
  for (const entry of [...list(project.setupFiles), ...list(project.setupFilesAfterEnv)]) {
    if (!String(entry).startsWith('<rootDir>/')) continue;
    const path = String(entry).replace('<rootDir>/', '');
    if (!existsSync(join(root, path))) report.problem({ file: rel, line: 1, rule: 'jest-setup-file-missing', message: `project "${project.displayName ?? '?'}" loads ${path}, which does not exist`, fix: `Create ${path} (templates/ has jest.setup.ts; the Shell's i18n work owns intl-polyfills.ts).` });
  }
}

/** Folders Jest must never index: skill templates and fixtures hold package.json and __mocks__ copies. */
const MUST_IGNORE = [['skills', 'x', 'package.json'], ['.claude', 'x', '__mocks__', 'expo-iap.ts'], ['.stryker-tmp', 'sandbox-1', 'package.json']].map((parts) => parts.join('/'));

function checkIgnoredPaths(root, rel, config, name, report) {
  const patterns = list(config.modulePathIgnorePatterns).map((pattern) => String(pattern).replaceAll('<rootDir>', String(config.rootDir ?? root)));
  let matcher = null;
  try {
    matcher = patterns.length > 0 ? new RegExp(patterns.join('|')) : null;
  } catch {
    matcher = null;
  }
  const seen = MUST_IGNORE.filter((sample) => !matcher?.test(join(root, sample))).map((sample) => sample.split('/')[0]);
  if (seen.length > 0) report.problem({ file: rel, line: 1, rule: 'jest-ignored-paths', message: `${name} does not ignore ${seen.join(', ')} in modulePathIgnorePatterns`, fix: `Copy modulePathIgnorePatterns from templates/${rel} (it lists skills, \\.claude and \\.stryker-tmp under <rootDir>); otherwise jest-haste-map indexes the skills' package.json and __mocks__ copies and may apply a fixture's mock instead of the root one.` });
}

function checkProjectCommon(root, rel, project, report) {
  const name = project.displayName ?? '?';
  checkIgnoredPaths(root, rel, project, `project "${name}"`, report);
  const mapper = Object.entries(project.moduleNameMapper ?? {});
  if (!mapper.some(([key, value]) => key.startsWith('^@e07/') && String(value).startsWith('<rootDir>/packages/'))) report.problem({ file: rel, line: 1, rule: 'jest-workspace-mapper', message: `project "${name}" has no moduleNameMapper from @e07/<package>/ to <rootDir>/packages/<package>/src/`, fix: 'Copy WORKSPACE_MODULES from templates/jest.config.js; without it Stryker tests the original files through the node_modules symlinks.' });
  const transform = list(project.transformIgnorePatterns).join(' ');
  const missing = TRANSPILE.filter((pkg) => !transform.includes(pkg));
  if (missing.length > 0) report.problem({ file: rel, line: 1, rule: 'jest-transform', message: `project "${name}" does not transpile ${missing.join(', ')}`, fix: 'Copy TRANSPILE_PACKAGES and transformIgnorePatterns from templates/jest.config.js.' });
  if (project.clearMocks !== true || project.restoreMocks !== true) report.problem({ file: rel, line: 1, rule: 'jest-mock-reset', message: `project "${name}" does not set clearMocks and restoreMocks to true`, fix: 'Set both in SHARED; call counts must reset before every test.' });
  if (project.testRetries !== undefined) report.problem({ file: rel, line: 1, rule: 'jest-retries', message: `project "${name}" sets testRetries`, fix: 'Remove it; fix the flaky test instead.' });
  checkSetupFiles(root, rel, project, report);
}

function checkUnit(rel, unit, report) {
  const problem = (message, fix) => report.problem({ file: rel, line: 1, rule: 'jest-unit-project', message, fix });
  if (unit.preset !== 'jest-expo/ios') problem(`unit preset is ${JSON.stringify(unit.preset)}, not "jest-expo/ios"`, 'Use preset jest-expo/ios (iOS first; it also names snapshots *.snap.ios).');
  if (!list(unit.setupFilesAfterEnv).includes('<rootDir>/jest.setup.ts')) problem('unit does not load <rootDir>/jest.setup.ts', 'Add setupFilesAfterEnv: [\'<rootDir>/jest.setup.ts\'] to the unit project.');
  const ignored = list(unit.testPathIgnorePatterns).join(' ');
  if (!/golden/.test(ignored) || !/sim/.test(ignored)) problem('unit does not ignore *.golden.test.* and *.sim.test.*', 'Add \'\\\\.golden\\\\.test\\\\.\' and \'\\\\.sim\\\\.test\\\\.\' to the unit testPathIgnorePatterns.');
  const match = list(unit.testMatch).join(' ');
  if (!match.includes('/test/') || !/\{apps,packages\}|apps|packages/.test(match)) problem('unit testMatch does not cover {apps,packages}/*/src and the root test/ folder', 'Copy TEST_ROOTS and testMatch from templates/jest.config.js.');
}

function checkGolden(rel, golden, report) {
  const problem = (message, fix) => report.problem({ file: rel, line: 1, rule: 'jest-golden-project', message, fix });
  if (golden.testEnvironment !== '@shopify/react-native-skia/jestEnv.js') problem(`golden testEnvironment is ${JSON.stringify(golden.testEnvironment)}`, 'Use testEnvironment: \'@shopify/react-native-skia/jestEnv.js\' (CanvasKit) in the golden project only.');
  if (!list(golden.setupFilesAfterEnv).includes('@shopify/react-native-skia/jestSetup.js')) problem('golden does not load @shopify/react-native-skia/jestSetup.js', 'Add it to the golden setupFilesAfterEnv.');
  if (list(golden.setupFilesAfterEnv).includes('<rootDir>/jest.setup.ts')) problem('golden loads <rootDir>/jest.setup.ts, whose inert Skia mock replaces CanvasKit', 'Load only @shopify/react-native-skia/jestSetup.js in the golden project; jest.setup.ts belongs to the unit project.');
  const matches = list(golden.testMatch);
  if (matches.length === 0 || !matches.every((glob) => String(glob).endsWith('*.golden.test.ts'))) problem('golden testMatch matches more than *.golden.test.ts', 'Use TEST_ROOTS.map((root) => `${root}*.golden.test.ts`).');
}

function checkThresholds(rel, text, config, report) {
  const thresholds = config.coverageThreshold ?? {};
  const problem = (rule, message, fix) => report.problem({ file: rel, line: 1, rule, message, fix });
  const below = (actual, min) => Object.entries(min).filter(([key, value]) => !(Number(actual?.[key]) >= value)).map(([key, value]) => `${key} ${actual?.[key] ?? 'missing'} < ${value}`);
  const global = below(thresholds.global, GLOBAL_MIN);
  if (global.length > 0) problem('coverage-threshold', `global coverage threshold is weaker than 90/90/90/85 (${global.join(', ')})`, 'Restore the global thresholds; add tests instead of lowering a gate.');
  for (const [key, value] of Object.entries(thresholds)) {
    if (key === 'global') continue;
    const weak = below(value, LOGIC_MIN);
    if (weak.length > 0) problem('coverage-threshold', `logic threshold ${key} is weaker than 95/95/95/90 (${weak.join(', ')})`, 'Restore LOGIC = { statements: 95, lines: 95, functions: 95, branches: 90 }.');
  }
  for (const key of LOGIC_KEYS) {
    if (!text.includes(`'${key}'`) && !text.includes(`"${key}"`)) problem('coverage-threshold-keys', `the logic threshold key ${key} is gone`, 'Copy LOGIC_THRESHOLDS from templates/jest.config.js (keys switch on by themselves once their folder has code).');
  }
  if (!String(config.coverageDirectory ?? '').endsWith('reports/coverage') || !list(config.coverageReporters).includes('json-summary')) problem('coverage-report', 'coverage is not written to <rootDir>/reports/coverage with the json-summary reporter', 'Set coverageDirectory: \'<rootDir>/reports/coverage\' and coverageReporters: [\'text-summary\', \'json-summary\', \'lcov\'] (the evidence report reads coverage-summary.json).');
  const collect = list(config.collectCoverageFrom).join(' ');
  for (const [needle, what] of [['test', 'test files'], ['testing', 'testing/ helpers'], ['fixtures', 'fixtures/']]) {
    if (!collect.split(' ').some((glob) => glob.startsWith('!') && glob.includes(needle))) problem('coverage-scope', `collectCoverageFrom does not exclude ${what}`, 'Copy collectCoverageFrom from templates/jest.config.js.');
  }
  for (const glob of list(config.collectCoverageFrom).map(String).filter((entry) => entry.startsWith('!'))) {
    if (!CANONICAL_COVERAGE_EXCLUSIONS.includes(glob)) problem('coverage-scope', `collectCoverageFrom leaves out ${glob}`, 'Remove it: only packages/tooling, tests, .d.ts, fixtures/ and testing/ are left out of coverage; a file Jest cannot run carries "// device-only: covered by <check>" in its first 6 lines instead (device-only.ts turns that into a coverage exclusion).');
  }
}

const hasDeviceOnlyMarker = (source) => {
  const marker = DEVICE_ONLY.exec(source.split('\n').slice(0, 6).join('\n'));
  return marker !== null && /\bcovered by\s+\S.{8,}/i.test(marker[1]);
};

/** Source files coverage counts (apps and packages other than tooling), with their device-only marker. */
function coverageSources(root) {
  return walk(root, { include: ['*.ts', '*.tsx'], ignore: IGNORE })
    .filter((rel) => /^(apps|packages)\/[^/]+\/src\//.test(rel) && !rel.startsWith('packages/tooling/') && !/\.(test|golden\.test|sim\.test)\.tsx?$|\.d\.ts$/.test(rel))
    .map((rel) => ({ rel, isMarked: hasDeviceOnlyMarker(readFileSync(join(root, rel), 'utf8')) }));
}

/** Coverage leaves out exactly the files marked device-only, through the one helper (D13 policy). */
function checkDeviceOnly(root, rel, config, report) {
  const problem = (file, message, fix) => report.problem({ file, line: 1, rule: 'coverage-device-only', message, fix });
  const seen = new Set();
  for (const project of list(config.projects).filter((entry) => entry && typeof entry === 'object')) {
    const base = String(project.rootDir ?? config.rootDir ?? root);
    const patterns = list(project.coveragePathIgnorePatterns).map((pattern) => {
      try {
        return new RegExp(String(pattern).replaceAll('<rootDir>', base));
      } catch {
        return null;
      }
    }).filter(Boolean);
    for (const { rel: file, isMarked } of coverageSources(root)) {
      const isIgnored = patterns.some((re) => re.test(join(base, file)));
      if (seen.has(file) || isIgnored === isMarked) continue;
      seen.add(file);
      if (isMarked) problem(file, `is marked device-only but ${rel} still counts it in coverage (project "${project.displayName ?? '?'}")`, 'Copy templates/jest.config.js: SHARED.coveragePathIgnorePatterns comes from deviceOnlyCoveragePatterns(__dirname).');
      else problem(file, `is left out of coverage by ${rel} but carries no "// device-only: covered by <check>" marker`, 'Remove the hand-written exclusion and test the file; only a native adapter, a Skia or frame-callback module or a composition file may carry the marker, naming the e2e flow or simulator check that covers it.');
    }
  }
}

function checkJest(root, report) {
  const rel = 'jest.config.js';
  if (!existsSync(join(root, rel))) {
    report.problem({ file: rel, line: 0, rule: 'jest-config-missing', message: 'no jest.config.js at the repo root', fix: 'Copy templates/jest.config.js to the repo root and run Jest from there.' });
    return;
  }
  const text = readFileSync(join(root, rel), 'utf8');
  if (!/process\.env\.TZ\s*=\s*['"]UTC['"]/.test(text)) report.problem({ file: rel, line: 1, rule: 'jest-tz', message: 'does not set process.env.TZ = \'UTC\'', fix: 'Add process.env.TZ = \'UTC\'; at the top so date code never depends on the machine\'s time zone.' });
  if (/retryTimes|testRetries/.test(text)) report.problem({ file: rel, line: 1, rule: 'jest-retries', message: 'retries tests', fix: 'Remove the retry; a retry hides a flaky test.' });
  const usesHelper = text.includes(DEVICE_ONLY_HELPER);
  if (!usesHelper) report.problem({ file: rel, line: 1, rule: 'coverage-device-only', message: `does not take its coverage exclusions from ${DEVICE_ONLY_HELPER}`, fix: 'Copy templates/jest.config.js: coveragePathIgnorePatterns = [\'/node_modules/\', ...deviceOnlyCoveragePatterns(__dirname)], so exactly the files marked "// device-only: covered by <check>" leave coverage.' });
  if (usesHelper && !existsSync(join(root, DEVICE_ONLY_HELPER))) {
    report.problem({ file: DEVICE_ONLY_HELPER, line: 0, rule: 'coverage-device-only', message: 'jest.config.js requires this helper but it does not exist (every Jest run fails to load the config)', fix: `Copy templates/${DEVICE_ONLY_HELPER} and its test into the repo.` });
    return;
  }
  const config = loadConfig(root, rel, report);
  if (!config) return;
  const projects = list(config.projects);
  const names = projects.map((project) => project?.displayName);
  if (projects.length !== 2 || !names.includes('unit') || !names.includes('golden')) {
    report.problem({ file: rel, line: 1, rule: 'jest-projects', message: `projects are [${names.map(String).join(', ')}], not exactly unit and golden`, fix: 'Use projects: [unitProject, goldenProject] from templates/jest.config.js; sims run through jest.sim.config.js.' });
  }
  for (const project of projects) if (project && typeof project === 'object') checkProjectCommon(root, rel, project, report);
  const unit = projects.find((project) => project?.displayName === 'unit');
  const golden = projects.find((project) => project?.displayName === 'golden');
  if (unit) checkUnit(rel, unit, report);
  if (golden) checkGolden(rel, golden, report);
  checkThresholds(rel, text, config, report);
  if (usesHelper) checkDeviceOnly(root, rel, config, report);
}

function checkSetup(root, report) {
  const rel = 'jest.setup.ts';
  if (!existsSync(join(root, rel))) {
    report.problem({ file: rel, line: 0, rule: 'jest-setup-missing', message: 'no jest.setup.ts at the repo root', fix: 'Copy templates/jest.setup.ts.' });
    return;
  }
  const text = readFileSync(join(root, rel), 'utf8');
  const needs = [
    [/react-native-gesture-handler\/jestSetup/, 'import \'react-native-gesture-handler/jestSetup\''],
    [/jest\.mock\(\s*['"]react-native-worklets['"]/, 'jest.mock(\'react-native-worklets\', ...)'],
    [/react-native-reanimated['"]\s*\)\s*\.setUpTests\(\)/, 'require(\'react-native-reanimated\').setUpTests()'],
  ];
  for (const [pattern, what] of needs) {
    if (!pattern.test(text)) report.problem({ file: rel, line: 1, rule: 'jest-setup-content', message: `lacks ${what}`, fix: 'Copy the three lines from templates/jest.setup.ts.' });
  }
  if (/retryTimes/.test(text)) report.problem({ file: rel, line: 1, rule: 'jest-retries', message: 'calls jest.retryTimes', fix: 'Remove it; fix the flaky test instead.' });
  if (!/jest\.mock\(\s*['"]@shopify\/react-native-skia['"]/.test(maskComments(text))) report.problem({ file: rel, line: 1, rule: 'skia-unit-mock', message: 'does not mock @shopify/react-native-skia', fix: "Copy the jest.mock('@shopify/react-native-skia', ...) block from templates/jest.setup.ts: Skia's native module cannot load in the unit project, so every suite that imports the logo tile, a code-drawn picture, the hazard strip, the debug screen or a board canvas crashes. A per-file Skia mock is only for a test that inspects Skia calls." });
  const hasRaster = existsSync(join(root, 'packages', 'shell', 'src', 'ui', 'icons', 'icon-raster.ts'));
  const masked = maskComments(text);
  const mocksRaster = /jest\.mock\(\s*['"]@e07\/shell\/ui\/icons\/icon-raster\.ts['"]/.test(masked);
  // The template's mock waits for the file (if (existsSync(...icon-raster.ts...)) { jest.mock(...) }),
  // so it is right at every build step: before Shell step 7 and after.
  const waitsForRaster = mocksRaster && /\bif\s*\(\s*existsSync\([^)]*icon-raster\.ts['"]\s*\)\s*\)/.test(masked);
  if (hasRaster && !mocksRaster) report.problem({ file: rel, line: 1, rule: 'icon-raster-mock', message: 'icon-raster.ts exists but is not mocked', fix: "Copy jest.setup.ts from templates/: its jest.mock('@e07/shell/ui/icons/icon-raster.ts', ...) waits for the file with existsSync. Skia's native module cannot load in the unit project, so every test that renders an Icon would fail." });
  if (!hasRaster && mocksRaster && !waitsForRaster) report.problem({ file: rel, line: 1, rule: 'icon-raster-mock', message: 'mocks icon-raster.ts, which does not exist yet', fix: 'Copy jest.setup.ts from templates/: its mock waits for packages/shell/src/ui/icons/icon-raster.ts with existsSync, because a jest.mock of a missing module fails the setup file and with it every suite.' });
}

function checkSim(root, report) {
  const rel = 'jest.sim.config.js';
  if (!existsSync(join(root, rel))) {
    report.problem({ file: rel, line: 0, rule: 'sim-config', message: 'is missing', fix: 'Copy templates/jest.sim.config.js; bot simulations run only through it (npm run test:sim).' });
    return;
  }
  const text = readFileSync(join(root, rel), 'utf8');
  if (!/process\.env\.TZ\s*=\s*['"]UTC['"]/.test(text)) report.problem({ file: rel, line: 1, rule: 'jest-tz', message: 'does not set process.env.TZ = \'UTC\'', fix: 'Add process.env.TZ = \'UTC\'; at the top.' });
  const config = loadConfig(root, rel, report);
  if (!config) return;
  checkIgnoredPaths(root, rel, config, 'the sim config', report);
  if (config.testEnvironment !== 'node') report.problem({ file: rel, line: 1, rule: 'sim-config', message: `testEnvironment is ${JSON.stringify(config.testEnvironment)}, not "node"`, fix: 'Sims run in plain Node: a sim that needs a React Native mock is a bug in the rules.' });
  const matches = list(config.testMatch);
  if (matches.length === 0 || !matches.every((glob) => String(glob).endsWith('.sim.test.ts'))) report.problem({ file: rel, line: 1, rule: 'sim-config', message: 'testMatch matches more than *.sim.test.ts', fix: 'Match only <rootDir>/{apps,packages}/*/src/**/*.sim.test.ts and <rootDir>/test/**/*.sim.test.ts.' });
}

function parseJsonc(text) {
  return JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
}

function checkStryker(root, report) {
  const rel = 'stryker.config.json';
  const problem = (message, fix = 'Restore the value from templates/stryker.config.json.') => report.problem({ file: rel, line: 1, rule: 'stryker-config', message, fix });
  if (!existsSync(join(root, rel))) {
    problem('is missing', 'Copy templates/stryker.config.json and templates/tsconfig.stryker.json to the repo root.');
    return;
  }
  let config;
  try {
    config = parseJsonc(readFileSync(join(root, rel), 'utf8'));
  } catch (error) {
    problem(`is not valid JSON (${error.message.split('\n')[0]})`);
    return;
  }
  if (config.testRunner !== 'jest') problem(`testRunner is ${JSON.stringify(config.testRunner)}, not "jest"`);
  if (config.jest?.configFile !== 'jest.config.js') problem('jest.configFile is not "jest.config.js"');
  if (!list(config.checkers).includes('typescript')) problem('the typescript checker is off', 'Add "checkers": ["typescript"]; mutants that do not compile must count as errors, not kills.');
  if (!(Number(config.thresholds?.break) >= 75)) problem(`thresholds.break is ${config.thresholds?.break ?? 'missing'} (must be at least 75)`, 'Restore "break": 75; kill survivors with boundary examples instead.');
  const mutate = list(config.mutate);
  for (const glob of STRYKER_SCOPE) if (!mutate.includes(glob)) problem(`mutate lacks ${glob}`, 'Keep the logic scope from templates/stryker.config.json.');
  if (config.jsonReporter?.fileName !== 'reports/stryker/mutation.json' || !list(config.reporters).includes('json')) problem('the json reporter does not write reports/stryker/mutation.json', 'Add "json" to reporters and "jsonReporter": { "fileName": "reports/stryker/mutation.json" } (check-mutation-report.mjs reads it).');
  const tsconfig = config.tsconfigFile ?? 'tsconfig.json';
  const tsRel = String(tsconfig);
  if (!existsSync(join(root, tsRel))) {
    report.problem({ file: tsRel, line: 0, rule: 'stryker-tsconfig', message: 'the Stryker tsconfig is missing', fix: 'Copy templates/tsconfig.stryker.json and set "tsconfigFile": "tsconfig.stryker.json".' });
    return;
  }
  try {
    const ts = parseJsonc(readFileSync(join(root, tsRel), 'utf8'));
    const types = ts.compilerOptions?.types;
    if (!Array.isArray(types) || types.length !== 1 || types[0] !== 'jest') report.problem({ file: tsRel, line: 1, rule: 'stryker-tsconfig', message: `compilerOptions.types is ${JSON.stringify(types)}, not ["jest"]`, fix: 'Keep it an app-world program (jest types only); node types clash with the Shell\'s own process declaration.' });
  } catch (error) {
    report.problem({ file: tsRel, line: 1, rule: 'stryker-tsconfig', message: `is not valid JSON (${error.message.split('\n')[0]})`, fix: 'Restore templates/tsconfig.stryker.json.' });
  }
}

function checkMocks(root, manifests, report) {
  for (const sdk of VENDOR_SDKS) {
    const users = manifests.filter(({ pkg }) => depsOf(pkg)[sdk] !== undefined).map(({ rel }) => rel);
    if (users.length > 0 && !existsSync(join(root, '__mocks__', `${sdk}.ts`))) report.problem({ file: `__mocks__/${sdk}.ts`, line: 0, rule: 'root-mock-missing', message: `${users[0]} depends on ${sdk} but the root mock is missing`, fix: `Copy templates/__mocks__/${sdk}.ts; the real SDK crashes on import in Jest.` });
  }
  const files = walk(root, { include: ['**/__mocks__/*'], ignore: IGNORE });
  for (const rel of files) {
    if (rel.startsWith('__mocks__/')) continue;
    const base = rel.split('/').pop().replace(/\.(ts|tsx|js)$/, '');
    if (VENDOR_SDKS.includes(base)) report.problem({ file: rel, line: 0, rule: 'nested-sdk-mock', message: `a ${base} mock outside the root __mocks__ folder is never applied to the node module`, fix: `Move it to __mocks__/${base}.ts at the repo root (next to node_modules).` });
  }
}

/** A test that renders with plain RNTL on purpose says so: "// no-shell-context: <why>" (the check-test-code marker). */
const needsNoShell = (source) => {
  const match = /\/\/\s*no-shell-context:\s*(.+)$/m.exec(source);
  return match !== null && match[1].trim().length >= 10;
};

function checkHelpers(root, report) {
  const componentTests = walk(root, { include: ['*.test.tsx'], ignore: IGNORE }).filter((rel) => /^(apps|packages)\//.test(rel) && !needsNoShell(readFileSync(join(root, rel), 'utf8')));
  if (componentTests.length > 0 && !existsSync(join(root, 'packages', 'shell', 'src', 'testing', 'render-with-shell.tsx'))) report.problem({ file: 'packages/shell/src/testing/render-with-shell.tsx', line: 0, rule: 'render-with-shell-missing', message: `${componentTests.length} component test file(s) exist (${componentTests[0]}) but the renderWithShell helper does not`, fix: 'Copy templates/packages/shell/src/testing/render-with-shell.tsx (and its test) into place.' });
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  if (!existsSync(join(root, 'package.json'))) fail(`nothing to check: ${positionals[0] ?? '.'} has no package.json`, 'Run from the repo root or pass the repo root.');
  const report = createReporter({ name: SPEC.name, json: options.json });
  const manifests = workspaceManifests(root);
  checkPackage(root, manifests, report);
  checkBabel(root, report);
  checkJest(root, report);
  checkSetup(root, report);
  checkSim(root, report);
  checkStryker(root, report);
  checkMocks(root, manifests, report);
  checkHelpers(root, report);
  return report.finish({ checked: 1, unit: 'repo' });
});
