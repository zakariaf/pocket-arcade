// jest.config.js — the ONE Jest config for the monorepo (run from the repo root).
// Projects: 'unit' (jest-expo iOS env, everything except goldens, sims and *.android.test.*)
//           'unit-android' (jest-expo Android env, *.android.test.ts(x) only: Platform.OS is 'android')
//           'golden' (Skia CanvasKit env, *.golden.test.ts only; on the iOS preset, so no .snap.android).
// Bot simulations (*.sim.test.ts) are NOT here: they run via jest.sim.config.js (`npm run test:sim`).
const fs = require('node:fs');
const path = require('node:path');

// Coverage leaves out exactly the files whose first 6 lines say
// "// device-only: covered by <the e2e flow or simulator check that exercises it>" (native
// adapters, Skia and frame-callback modules, composition files). The one tested helper decides.
const { deviceOnlyCoveragePatterns } = require('./packages/tooling/src/quality/device-only.ts');

// Every worker inherits this: date code under test never depends on the Mac's time zone.
process.env.TZ = 'UTC';

// Packages that ship untranspiled ESM/Flow/TS and must go through Babel. Prefix match:
// 'react-native' also covers react-native-reanimated, -worklets, -gesture-handler, -google-mobile-ads;
// 'expo' also covers expo-iap, expo-sqlite, expo-network, expo-localization, expo-haptics.
const TRANSPILE_PACKAGES = [
  'react-native',
  '@react-native',
  'expo',
  '@expo',
  '@react-navigation',
  '@shopify/react-native-skia',
  'react-intl',
  '@formatjs',
  'intl-messageformat',
];

const transformIgnorePatterns = [
  `/node_modules/(?!(${TRANSPILE_PACKAGES.join('|')}))`,
  // Kept from jest-expo: never transform the Reanimated Babel plugin or the RN Babel preset.
  '/node_modules/react-native-reanimated/plugin/',
  '/node_modules/@react-native/babel-preset/',
];

// Generated native projects, build output, Stryker sandboxes, tool downloads and the skills (whose
// templates and fixtures hold package.json files and __mocks__ with our names) are invisible to Jest.
const IGNORED_PATHS = [
  '<rootDir>/apps/[^/]+/(ios|android|build|dist)/',
  '<rootDir>/(coverage|reports|tools|skills|\\.claude|\\.stryker-tmp)/',
];

// Resolve workspace imports straight to <rootDir> instead of through the node_modules symlinks.
// Without this, Stryker's sandbox imports the ORIGINAL files and reports "NoCoverage"/false survivors.
const WORKSPACE_MODULES = {
  '^@e07/(game-kit|shell|tooling)/(.*)$': '<rootDir>/packages/$1/src/$2',
  '^@e07/([^/]+)/(.*)$': '<rootDir>/apps/$1/src/$2',
};

const SHARED = {
  rootDir: __dirname,
  preset: 'jest-expo/ios',
  transformIgnorePatterns,
  moduleNameMapper: WORKSPACE_MODULES,
  modulePathIgnorePatterns: IGNORED_PATHS,
  testPathIgnorePatterns: ['/node_modules/', ...IGNORED_PATHS],
  clearMocks: true,
  restoreMocks: true,
  coveragePathIgnorePatterns: ['/node_modules/', ...deviceOnlyCoveragePatterns(__dirname).slice(1)],
  // The Shell's FormatJS polyfills load before anything else, in every project (Jest's V8 ICU
  // and Hermes then format numbers, plurals and dates identically).
  setupFiles: ['<rootDir>/packages/shell/src/i18n/intl-polyfills.ts'],
};

// Colocated tests in <workspace>/src/; Node-API tests (node:sqlite, fs, Buffer) in the root test/.
const TEST_ROOTS = ['<rootDir>/{apps,packages}/*/src/**/', '<rootDir>/test/**/'];

// Stryker compiles without the Worklets plugin (see babel.config.js), so the one test that checks
// the plugin's output cannot pass inside a mutation run.
const IS_MUTATION_RUN = process.env.STRYKER_MUTATOR_WORKER !== undefined;

// A test that needs Platform.OS === 'android' is named <unit>.android.test.ts(x): only the
// unit-android project runs it, and the iOS project never does (there it would see 'ios').
const ANDROID_TEST = '\\.android\\.test\\.';

const unitProject = {
  ...SHARED,
  displayName: 'unit',
  testMatch: TEST_ROOTS.map((root) => `${root}*.test.{ts,tsx}`),
  testPathIgnorePatterns: [
    ...SHARED.testPathIgnorePatterns,
    '\\.golden\\.test\\.',
    '\\.sim\\.test\\.',
    ANDROID_TEST,
    ...(IS_MUTATION_RUN ? ['/quality/worklet-transform\\.test\\.'] : []),
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

const unitAndroidProject = {
  ...SHARED,
  displayName: 'unit-android',
  preset: 'jest-expo/android',
  testMatch: TEST_ROOTS.map((root) => `${root}*.android.test.{ts,tsx}`),
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

// Goldens keep SHARED's iOS preset: its snapshot resolver writes .snap.ios, and a second
// platform would write a second set (.snap.android) of the same frozen data.
const goldenProject = {
  ...SHARED,
  displayName: 'golden',
  testEnvironment: '@shopify/react-native-skia/jestEnv.js',
  testMatch: TEST_ROOTS.map((root) => `${root}*.golden.test.ts`),
  setupFilesAfterEnv: ['@shopify/react-native-skia/jestSetup.js'],
};

// Coverage thresholds. A path key that matches no file makes Jest exit 1
// ("Coverage data for ... was not found"), so a key is only added once its folder has code.
const LOGIC = { statements: 95, lines: 95, functions: 95, branches: 90 };
const LOGIC_THRESHOLDS = {
  './packages/game-kit/src/': 'packages/game-kit/src/**/*.ts',
  './packages/shell/src/services/save/': 'packages/shell/src/services/save/**/*.ts',
  './apps/*/src/rules/**/*.ts': 'apps/*/src/rules/**/*.ts',
};

function hasSourceFiles(glob) {
  return fs
    .globSync(glob, { cwd: __dirname })
    .some((file) => !/\.(test|golden\.test|sim\.test)\.ts$/.test(path.basename(file)));
}

const coverageThreshold = {
  global: { statements: 90, lines: 90, functions: 90, branches: 85 },
  ...Object.fromEntries(
    Object.entries(LOGIC_THRESHOLDS)
      .filter(([, glob]) => hasSourceFiles(glob))
      .map(([key]) => [key, LOGIC]),
  ),
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [unitProject, unitAndroidProject, goldenProject],
  collectCoverageFrom: [
    '<rootDir>/{apps,packages}/*/src/**/*.{ts,tsx}',
    '!<rootDir>/packages/tooling/**',
    '!**/*.{test,golden.test,sim.test}.{ts,tsx}',
    '!**/*.d.ts',
    '!**/fixtures/**',
    '!**/testing/**',
  ],
  coverageDirectory: '<rootDir>/reports/coverage',
  coverageReporters: ['text-summary', 'json-summary', 'lcov'],
  coverageThreshold,
};
