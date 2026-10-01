// eslint.config.mjs: the ONE ESLint config for the whole monorepo (ESLint 9 flat config).
// Canonical copy: the typescript-and-lint-rules skill. Changing it needs a `Gate-Change:` trailer.
// Exceptions live in this file only: inline eslint-disable comments are switched off (block 0).
// It also carries the UI rules (react-components-and-hooks), the app zones
// (architecture-and-boundaries), the expo-iap adapter block (premium-purchase) and the
// __mocks__ naming block (unit-and-component-tests), so there is exactly one config.
// @ts-check
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import reactNativeOfficial from '@react-native/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier/flat';
import prettierPlugin from 'eslint-plugin-prettier';
import checkFile from 'eslint-plugin-check-file';
import formatjs from 'eslint-plugin-formatjs';
import globals from 'globals';
import jestPlugin from 'eslint-plugin-jest';
import reactNative from 'eslint-plugin-react-native';
import sonarjs from 'eslint-plugin-sonarjs';
import testingLibrary from 'eslint-plugin-testing-library';
import tseslint from 'typescript-eslint';

// ---------------------------------------------------------------------------------------------
// File groups (the canonical repo layout). A new top-level folder needs a glob here.
// ---------------------------------------------------------------------------------------------
const ALL_TS = ['**/*.{ts,tsx}'];
/** Code that ships inside an app bundle. */
const RUNTIME = [
  'apps/*/index.ts',
  'apps/*/game.config.ts',
  'apps/*/src/**/*.{ts,tsx}',
  'packages/game-kit/src/**/*.ts',
  'packages/shell/src/**/*.{ts,tsx}',
];
/** Code that runs in Node: build scripts, config composer, config plugins. */
const NODE_CODE = [
  'apps/*/app.config.ts',
  'packages/shell/src/config/**/*.ts',
  'packages/shell/plugins/**/*.ts',
  'packages/tooling/src/**/*.ts',
];
/** Pure TypeScript: no React, React Native, Expo, Skia or Shell imports. */
const PURE = ['packages/game-kit/src/**/*.ts', 'apps/*/src/{rules,levels}/**/*.ts'];
/** Deterministic code: replays and daily seeds must match on every device (Hermes vs V8 libm). */
const DETERMINISTIC = [
  'packages/game-kit/src/**/*.ts',
  'apps/*/src/{rules,levels,sim,geom}/**/*.ts',
];
const TESTS = [
  '**/*.test.{ts,tsx}',
  'test/**/*.{ts,tsx}',
  'jest.setup.ts',
  '__mocks__/**/*.{ts,tsx}',
];
const GOLDEN_TESTS = ['**/*.golden.test.ts'];
/** Plain JS config files (babel, jest, metro, eslint itself). */
const JS_CONFIG = ['*.{js,cjs,mjs}', 'apps/*/*.{js,cjs,mjs}', 'packages/*/*.{js,cjs,mjs}'];
/** The only files allowed to import a vendor SDK (one adapter per port). */
const ADAPTERS = [
  'packages/shell/src/services/*/*-adapter.ts',
  'packages/shell/src/services/*/*-save-store.ts',
  'packages/shell/src/services/*/*-sql-driver.ts',
];
const CLOCK_ADAPTERS = ['packages/shell/src/services/clock/*-adapter.ts'];
/** The one file that asks for App Tracking Transparency (ConsentPort.requestTracking; owner O1). */
const ATT_ADAPTER = ['packages/shell/src/services/consent/admob-consent-adapter.ts'];
const DIRECTION_MODULE = ['packages/shell/src/i18n/direction.ts'];
const APP_TEXT = ['packages/shell/src/ui/app-text.tsx'];

// App zones on resolved paths (block 5-zones, architecture-and-boundaries).
const ROOT = import.meta.dirname;
const APPS_DIR = resolve(ROOT, 'apps');
// Guarded: the scaffold commits this file before the first app exists.
const APP_IDS = existsSync(APPS_DIR)
  ? readdirSync(APPS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];
// Game code may use these Shell folders only (types and hooks built for games). The synth is
// pure and game recipe tests call synthesizeRecipe; messages.ts holds asGameKey,
// which a game's typed key table uses.
const GAME_FACING = [
  './game-host',
  './art',
  './i18n/messages.ts',
  './services/audio/audio-port.ts',
  './services/audio/synth',
  './theme/theme-types.ts',
];

// ---------------------------------------------------------------------------------------------
// Shared option lists. A later flat-config block REPLACES a rule's options for the files it
// matches (no merging), so every block that narrows a rule rebuilds it from these lists.
// ---------------------------------------------------------------------------------------------
const N3 = 'Spec N3: our code makes no network requests.';
const NETWORK_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((name) => ({
  name,
  message: N3,
}));
const TEST_GLOBALS = ['jest', 'describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach'].map(
  (name) => ({ name, message: 'Test globals belong in *.test.ts(x) files only.' }),
);

const RESTRICTED_PROPERTIES = [
  { object: 'Math', property: 'random', message: 'Use the seeded RNG from @e07/game-kit.' },
  {
    object: 'Date',
    property: 'now',
    message: 'Inject ClockPort (test builds can set the date, spec S15).',
  },
  { object: 'performance', property: 'now', message: 'Use the frame timestamp or ClockPort.' },
  { object: 'I18nManager', property: 'isRTL', message: 'Read direction from DirectionContext.' },
];
// Node code (tooling, config) reads the wall clock in one module only.
const WALL_CLOCK = 'Read the wall clock only in packages/tooling/src/clock/system-clock.ts.';
const NODE_CLOCK_PROPERTIES = [{ object: 'Date', property: 'now', message: WALL_CLOCK }];
const NODE_NEW_DATE = {
  selector: "NewExpression[callee.name='Date'][arguments.length=0]",
  message: WALL_CLOCK,
};
const withoutProperty = (object, property) =>
  RESTRICTED_PROPERTIES.filter(
    (entry) => !(entry.object === object && entry.property === property),
  );

const vendor = (name, port) => ({
  name,
  message: `Only the ${port} adapter in packages/shell/src/services/ may import ${name}.`,
});
const VENDOR_SDK_PATHS = [
  vendor('react-native-google-mobile-ads', 'AdsPort/ConsentPort'),
  vendor('expo-iap', 'PurchasePort'),
  vendor('expo-sqlite', 'SaveStore/SqlDriver'),
  vendor('react-native-audio-api', 'AudioPort'),
  vendor('expo-haptics', 'HapticsPort'),
  vendor('expo-network', 'ConnectivityPort'),
];
const banned = (name, message) => ({ name, message });
// Owner decision O1 (2026-09-30): the app asks for App Tracking Transparency before any ad request
// that could use the IDFA, and only the consent adapter does (every other file keeps this ban).
const ATT_IMPORT = banned(
  'expo-tracking-transparency',
  'Only packages/shell/src/services/consent/admob-consent-adapter.ts asks for tracking (ConsentPort).',
);
const BANNED_PACKAGE_PATHS = [
  banned('axios', N3),
  banned(
    '@react-native-community/netinfo',
    'Its reachability probe calls Google (N3). Use ConnectivityPort.',
  ),
  banned('expo-updates', 'No OTA updates (N3). Restart with reloadAppAsync from expo.'),
  banned('expo-router', 'The Shell owns navigation (React Navigation 7 static API).'),
  banned('expo-audio', 'Sound goes through AudioPort (react-native-audio-api).'),
  banned('expo-file-system', 'Persist through SaveStore (expo-sqlite).'),
  banned('expo-web-browser', 'WebViews and browsers are network surfaces (N3).'),
  banned('react-native-webview', 'WebViews are network surfaces (N3).'),
  banned('@react-native-async-storage/async-storage', 'Persist through SaveStore (expo-sqlite).'),
  banned('react-native-iap', 'IAP goes through PurchasePort (expo-iap).'),
  banned('react-native-purchases', 'No purchase server (N2).'),
  ATT_IMPORT,
  banned('react-native-restart', 'Use reloadAppAsync from expo.'),
  {
    name: 'react-native',
    importNames: ['Alert'],
    message: 'Use the Shell dialogs (spec S14).',
  },
  {
    name: 'react-native',
    importNames: ['SafeAreaView'],
    message: 'Use react-native-safe-area-context.',
  },
];
const TEXT_IMPORT = {
  name: 'react-native',
  importNames: ['Text'],
  message: 'Render text with AppText from @e07/shell/ui/app-text.tsx (spec N11).',
};
const I18N_MANAGER_IMPORT = {
  name: 'react-native',
  importNames: ['I18nManager'],
  message:
    'Only packages/shell/src/i18n/direction.ts touches I18nManager (one source of direction).',
};
const PARENT_IMPORT = {
  group: ['../*', '../../*', '../../../*', '../../../../*'],
  message: 'No parent-relative imports: use ./sibling.ts or the package name (@e07/shell/...).',
};
const NODE_BUILTINS = {
  group: ['node:*', 'fs', 'path', 'child_process', 'os', 'crypto', 'http', 'https', 'net'],
  message: 'Node built-ins do not exist in the app runtime.',
};
const NO_TOOLING = {
  group: ['@e07/tooling', '@e07/tooling/**'],
  message: 'Tooling is Node-only build code; the app never imports it.',
};
const SHELL_BOUNDARY = {
  group: ['@e07/**', '!@e07/shell', '!@e07/shell/**', '!@e07/game-kit', '!@e07/game-kit/**'],
  message: 'The Shell imports only @e07/shell/* and @e07/game-kit/*, never an app (spec N5).',
};
const GAME_KIT_BOUNDARY = {
  group: ['@e07/**', '!@e07/game-kit', '!@e07/game-kit/**'],
  message: 'game-kit is the bottom layer: it imports only itself.',
};
const PURE_IMPORTS = {
  group: [
    'react',
    'react/*',
    'react-native',
    'react-native-*',
    'react-native/*',
    '@react-native/*',
    'expo',
    'expo-*',
    '@expo/*',
    '@shopify/*',
    '@e07/shell',
    '@e07/shell/*',
    'zustand',
    'zustand/*',
  ],
  message:
    'Rules, levels and game-kit are pure TypeScript: import only @e07/game-kit/* and siblings.',
};

// Every block that narrows no-restricted-imports starts from RUNTIME_PATHS minus its exemptions.
const without = (paths, ...removed) => paths.filter((entry) => !removed.includes(entry));
// `allow` lifts a banned package for one file-exact block (the ATT adapter); nothing else does.
const restrictedImports = ({ paths = [], patterns = [], allow = [] }) => [
  'error',
  {
    paths: [...without(BANNED_PACKAGE_PATHS, ...allow), ...paths],
    patterns: [PARENT_IMPORT, ...patterns],
  },
];
const REACT_INTL_IMPORT = {
  name: 'react-intl',
  message: 'Use t() / <T> from packages/shell/src/i18n, never react-intl directly.',
};
// UI primitives, compiler-era memo, deprecated/unsupported APIs (react-components-and-hooks).
const rn = (name, message) => ({ name: 'react-native', importNames: [name], message });
const PRESSABLE_IMPORT = rn(
  'Pressable',
  'Use the Shell buttons in packages/shell/src/ui (react-components-and-hooks).',
);
const IMAGE_IMPORT = rn('Image', 'Icons come from Icon in @e07/shell/ui/icons/icon.tsx (spec N9).');
const UI_PATHS = [
  PRESSABLE_IMPORT,
  IMAGE_IMPORT,
  rn('Dimensions', 'Use useWindowDimensions: windows resize on iPad and iOS 27.'),
  rn('Animated', 'Use react-native-reanimated.'),
  {
    name: 'react',
    importNames: ['useMemo', 'useCallback', 'memo'],
    message: 'React Compiler memoizes; a hand-written memo needs a measured reason.',
  },
  banned('react-native-svg', 'Icons are Skia paths rasterized by Icon; SVG can fetch (N3).'),
  banned('@shopify/flash-list', 'Not installed: use ScrollView or FlatList.'),
];
const RUNTIME_PATHS = [
  ...VENDOR_SDK_PATHS,
  TEXT_IMPORT,
  I18N_MANAGER_IMPORT,
  REACT_INTL_IMPORT,
  ...UI_PATHS,
];
// Port types (`*-port.ts`) stay importable: a ui/ component may receive a port as a prop.
// Match files, not folders: a negation cannot re-include a file under an excluded folder.
const UI_BOUNDARY = {
  group: [
    '@e07/shell/stores/*',
    '@e07/shell/screens/*',
    '@e07/shell/services/*/*',
    '!@e07/shell/services/*/*-port.ts',
  ],
  message: 'packages/shell/src/ui is presentational: data arrives through props.',
};
// The only app files that read the wall clock or performance.now (perf tools, test builds only).
const PERF_CLOCK_FILES = [
  'packages/shell/src/app/perf/cold-start.ts',
  'packages/shell/src/app/perf/use-cold-start-mark.ts',
  'packages/shell/src/app/perf/save-benchmark.ts',
];
const PERF_PROPERTIES = RESTRICTED_PROPERTIES.filter(
  (entry) => entry.object !== 'Date' && entry.object !== 'performance',
);
// Server features and hidden finishing stay banned inside the purchase adapter (premium-purchase).
const EXPO_IAP_SERVER_APIS = {
  name: 'expo-iap',
  importNames: ['kitApi', 'KitApiError', 'verifyPurchaseWithProvider', 'verifyPurchase', 'useIAP'],
  message: 'Server features and hidden finishing are banned (no purchase server, N2).',
};
const RUNTIME_IMPORTS = restrictedImports({
  paths: RUNTIME_PATHS,
  patterns: [NODE_BUILTINS, NO_TOOLING],
});

// Physical-direction style keys (spec N11), only inside style contexts: game rules may use
// `left`/`right` as data. Verified selector (2026-09-26).
const PHYSICAL_KEYS =
  '/^(left|right|marginLeft|marginRight|paddingLeft|paddingRight|borderLeftWidth|borderRightWidth|borderLeftColor|borderRightColor|borderTopLeftRadius|borderTopRightRadius|borderBottomLeftRadius|borderBottomRightRadius)$/';
const STYLE_CONTEXT =
  ":matches(CallExpression[callee.object.name='StyleSheet'][callee.property.name='create'], JSXAttribute[name.name=/[sS]tyle$/], VariableDeclarator[id.typeAnnotation.typeAnnotation.typeName.name=/Style$/])";
const KEBAB = '[a-z0-9]+(-[a-z0-9]+)*';

const SYNTAX = {
  physicalStyleKeys: {
    selector: `${STYLE_CONTEXT} Property[key.name=${PHYSICAL_KEYS}]`,
    message: 'Spec N11: use start/end (marginStart, paddingEnd, start, end), never left/right.',
  },
  textAlignLiteral: {
    selector: "Property[key.name='textAlign'][value.value=/^(left|right)$/]",
    message: "Spec N11: pass align='start'|'end' to AppText instead of textAlign left/right.",
  },
  rowReverse: {
    selector: "Property[key.name='flexDirection'][value.value='row-reverse']",
    message: 'Spec N11: row already mirrors in RTL; row-reverse double-flips.',
  },
  enums: {
    selector: 'TSEnumDeclaration',
    message: 'No enums: use a string-literal union from an `as const` array.',
  },
  remoteUrl: {
    selector: 'Literal[value=/^(https?|wss?|ftp):\\/\\//i]',
    message:
      'Spec N3: no remote URLs in app code. OS links live in packages/shell/src/config/external-links.ts.',
  },
  remoteUrlTemplate: {
    selector: 'TemplateElement[value.raw=/^(https?|wss?|ftp):\\/\\//i]',
    message: 'Spec N3: no remote URLs in app code.',
  },
  newDate: {
    selector: "NewExpression[callee.name='Date']",
    message: 'Inject ClockPort; format dates with the Shell date formatter.',
  },
  intlDate: {
    selector:
      "MemberExpression[object.name='Intl'][property.name=/^(DateTimeFormat|RelativeTimeFormat)$/]",
    message: 'Hermes calendars differ per locale: use the Shell date formatter.',
  },
  toLocaleCall: {
    selector: 'CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]',
    message: 'Hermes ignores the digits setting: use t(), createNumberFormatter or formatDayMonth.',
  },
  setTimeoutNoDelay: {
    selector: "CallExpression[callee.name='setTimeout'][arguments.length<2]",
    message: 'Pass an explicit delay.',
  },
  a11yLiteral: {
    selector:
      'JSXAttribute[name.name=/^(aria-label|accessibilityLabel|accessibilityHint|placeholder|title|alt)$/] > Literal',
    message: 'Spec N12: user-facing text props come from t().',
  },
  testIdFormat: {
    selector: `JSXAttribute[name.name='testID'] > Literal[value!=/^${KEBAB}(\\.${KEBAB})+$/]`,
    message:
      "testID is '<screen>.<element>' in kebab-case, e.g. 'home.play-button' (naming-conventions).",
  },
  kindValue: {
    selector: `Property[key.name=/^(kind|type)$/] > Literal[value=/[^a-z0-9-]/]`,
    message:
      "`kind`/`type` values are kebab-case string literals, e.g. 'column-cleared' (naming-conventions).",
  },
  kindTypeValue: {
    selector: `TSPropertySignature[key.name=/^(kind|type)$/] TSLiteralType > Literal[value=/[^a-z0-9-]/]`,
    message:
      "`kind`/`type` values are kebab-case string literals, e.g. 'column-cleared' (naming-conventions).",
  },
  asyncHandler: {
    selector:
      'JSXAttribute[name.name=/^on[A-Z]/] > JSXExpressionContainer > :function[async=true], VariableDeclarator[id.name=/^handle[A-Z]/] > :function[async=true], FunctionDeclaration[async=true][id.name=/^handle[A-Z]/]',
    message: 'Event handlers are synchronous: start async work with `task().catch(reportError)`.',
  },
  importExtension: {
    selector:
      ':matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration)[source.value=/^(\\.|@e07\\/)/][source.value!=/\\.(ts|tsx|json)$/]',
    message:
      'Write the file extension (./x.ts, @e07/shell/ui/app-text.tsx): Node type stripping needs it.',
  },
  pressableA11y: {
    selector:
      "JSXOpeningElement[name.name='Pressable']:not(:has(JSXAttribute[name.name=/^(accessibilityRole|role)$/]))",
    message: 'Spec 8.11: every Pressable declares role (and a label from t()).',
  },
  storeWithoutSelector: {
    selector:
      ":matches(CallExpression[callee.name=/^use[A-Z][A-Za-z]*Store$/][arguments.length=0], CallExpression[callee.name='useStore'][arguments.length<2])",
    message: 'Pass a selector to the store hook: a bare call re-renders on every change.',
  },
};
const DETERMINISM_SYNTAX = [
  {
    selector:
      "MemberExpression[object.name='Math'][property.name!=/^(sqrt|imul|floor|round|abs|min|max|PI)$/]",
    message:
      'Determinism: deterministic code uses only + - * /, sqrt, imul, floor, round, abs, min, max.',
  },
  {
    selector: "BinaryExpression[operator='**'], AssignmentExpression[operator='**=']",
    message: 'Determinism: ** is Math.pow; multiply explicitly.',
  },
];
const runtimeSyntax = (omit = []) => [
  'error',
  ...Object.entries(SYNTAX)
    .filter(([key]) => !omit.includes(key))
    .map(([, value]) => value),
];

const BOOLEAN_PREFIXES = ['is', 'has', 'can', 'should', 'did', 'will', 'was'];

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.expo/**',
    'apps/*/ios/**',
    'apps/*/android/**',
    'apps/*/build/**',
    'apps/*/dist/**',
    'coverage/**',
    'reports/**',
    'dist-audit/**',
    'tools/**',
    '.stryker-tmp/**',
    '**/expo-env.d.ts',
    // The skill library and Claude Code settings hold templates and planted-bug fixtures.
    'skills/**',
    '.claude/**',
  ]),

  // 0. No inline eslint-disable comments anywhere; unused exceptions are errors.
  {
    linterOptions: {
      noInlineConfig: false,
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },

  // 1. Expo base: import, react, react-hooks (React Compiler rules) and expo rules.
  expoConfig,
  {
    plugins: {
      sonarjs,
      'react-native': reactNative,
      '@react-native': reactNativeOfficial,
      'check-file': checkFile,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['tsconfig.json', 'packages/*/tsconfig.json', 'apps/*/tsconfig.json'],
        },
        node: true,
      },
    },
    rules: { 'import/no-named-as-default-member': 'off' },
  },

  // 2. Type-aware TypeScript rules.
  {
    files: ALL_TS,
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: false, requireDefaultForNonUnion: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { args: 'all', argsIgnorePattern: '^_', caughtErrors: 'all', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        { allowString: false, allowNumber: false, allowNullableObject: true },
      ],
      '@typescript-eslint/no-floating-promises': [
        'error',
        { ignoreVoid: false, ignoreIIFE: false },
      ],
      '@typescript-eslint/prefer-readonly': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-async-promise-executor': 'error',
      'no-warning-comments': [
        'error',
        { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'start' },
      ],
      'sonarjs/no-commented-code': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
        // React components are PascalCase functions.
        { selector: 'variable', types: ['function'], format: ['camelCase', 'PascalCase'] },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase', 'UPPER_CASE'],
          prefix: [...BOOLEAN_PREFIXES, ...BOOLEAN_PREFIXES.map((p) => `${p.toUpperCase()}_`)],
        },
        { selector: 'variable', modifiers: ['destructured'], format: null },
        { selector: 'parameter', format: ['camelCase', 'PascalCase'], leadingUnderscore: 'allow' },
        {
          selector: 'parameter',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: BOOLEAN_PREFIXES,
          leadingUnderscore: 'allow',
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        {
          selector: 'typeParameter',
          format: ['PascalCase'],
          custom: { regex: '^(T|T[A-Z][A-Za-z]+)$', match: true },
        },
        // Object keys may mirror external APIs, style props or catalog keys.
        { selector: ['objectLiteralProperty', 'typeProperty'], format: null },
      ],
    },
  },

  // 3. Size and complexity limits (typescript-and-lint-rules, limits table).
  {
    files: ALL_TS,
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 40, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      complexity: ['error', { max: 10, variant: 'modified' }],
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-depth': ['error', 3],
      'max-params': ['error', 3],
      'max-nested-callbacks': ['error', 3],
      'max-classes-per-file': ['error', 1],
      'react/jsx-max-depth': ['error', { max: 5 }],
      'react/no-multi-comp': ['error', { ignoreStateless: false }],
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }],
      'sonarjs/no-collapsible-if': 'error',
      complexity: 'off',
      'sonarjs/no-nested-conditional': 'error',
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-inverted-boolean-check': 'error',
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      'max-lines-per-function': [
        'error',
        { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
    },
  },

  // 4. Rules for every TypeScript file: exports, imports, hygiene.
  {
    files: ALL_TS,
    rules: {
      'import/no-default-export': 'error',
      'import/no-cycle': ['error', { maxDepth: 10 }],
      'import/no-duplicates': 'error',
      'import/no-self-import': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
          pathGroups: [{ pattern: '@e07/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'no-restricted-imports': restrictedImports({}),
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'no-nested-ternary': 'error',
      'no-param-reassign': ['error', { props: true }],
      'prefer-const': 'error',
      'object-shorthand': 'error',
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      'check-file/folder-naming-convention': [
        'error',
        { '{apps,packages,test}/**/': 'KEBAB_CASE' },
      ],
      'check-file/filename-blocklist': [
        'error',
        {
          '**/{util,utils,helper,helpers,misc,common,shared,stuff}.{ts,tsx}': '**/[a-z]*-[a-z]*.ts',
        },
      ],
    },
  },

  // 5. App runtime code: network, determinism of time, RTL-safe styles, i18n, SDK adapters.
  {
    files: RUNTIME,
    rules: {
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS, ...TEST_GLOBALS],
      'no-restricted-properties': ['error', ...RESTRICTED_PROPERTIES],
      'no-restricted-imports': RUNTIME_IMPORTS,
      'no-restricted-syntax': runtimeSyntax(),
      'react/jsx-no-literals': [
        'error',
        { noStrings: true, ignoreProps: true, noAttributeStrings: false },
      ],
      'react-native/no-unused-styles': 'error',
      'react-native/no-inline-styles': 'error',
      'react-native/no-color-literals': 'error',
      'react-native/no-single-element-style-arrays': 'error',
      '@react-native/no-deep-imports': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/incompatible-library': 'error',
      'react-hooks/unsupported-syntax': 'error',
      'check-file/filename-blocklist': [
        'error',
        {
          '**/{util,utils,helper,helpers,misc,common,shared,stuff}.{ts,tsx}': '**/[a-z]*-[a-z]*.ts',
          'packages/*/src/**/index.{ts,tsx}': '**/[a-z]*-[a-z]*.ts',
          'apps/*/src/*/**/index.{ts,tsx}': '**/[a-z]*-[a-z]*.ts',
        },
      ],
    },
  },

  {
    files: ['packages/shell/src/**/*.{ts,tsx}'],
    ignores: ['packages/shell/src/config/**'],
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: RUNTIME_PATHS,
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY],
      }),
    },
  },

  // 5-zones (architecture-and-boundaries). import/no-restricted-paths works on RESOLVED paths, so it
  // catches every spelling: an app never imports another app, and game code uses only the
  // Shell's game-facing folders. Target globs must match files, and basePath is the repo root.
  {
    files: ['apps/*/src/**/*.{ts,tsx}', 'apps/*/index.ts'],
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          basePath: ROOT,
          zones: [
            ...APP_IDS.map((id) => ({
              target: `./apps/${id}`,
              from: './apps',
              except: [`./${id}`],
              message: 'Apps never import each other; shared code moves to the Shell or game-kit.',
            })),
            {
              target: './apps/*/src/**/*',
              from: './packages/shell/src',
              except: GAME_FACING,
              message:
                'Game code uses only the Shell game-facing modules (game-host, art, audio, theme, asGameKey).',
            },
          ],
        },
      ],
    },
  },

  // 5-i18n. FormatJS for JSX text and user-facing props (i18n-strings-and-catalogs): the Shell wraps
  // react-intl in t() and <T>, and only its i18n folder may import react-intl.
  {
    files: ['packages/*/src/**/*.tsx', 'apps/*/src/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    plugins: { formatjs },
    settings: { formatjs: { additionalFunctionNames: ['t'], additionalComponentNames: ['T'] } },
    rules: {
      'formatjs/no-literal-string-in-jsx': [
        'error',
        {
          props: {
            include: [
              [
                '*',
                '{accessibilityLabel,accessibilityHint,aria-label,aria-description,placeholder,title,alt,label}',
              ],
            ],
          },
        },
      ],
    },
  },
  {
    files: ['packages/shell/src/i18n/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: without(RUNTIME_PATHS, REACT_INTL_IMPORT),
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY],
      }),
    },
  },

  // 5a. Pure code (game-kit, rules, levels): no UI, no Shell, no platform.
  {
    files: PURE,
    rules: {
      'no-restricted-imports': restrictedImports({
        patterns: [NODE_BUILTINS, NO_TOOLING, PURE_IMPORTS],
      }),
    },
  },
  {
    files: ['packages/game-kit/src/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedImports({
        patterns: [NODE_BUILTINS, PURE_IMPORTS, GAME_KIT_BOUNDARY],
      }),
    },
  },

  // 5b. Deterministic code (Hermes and V8 libm differ): integer-safe arithmetic only.
  {
    files: DETERMINISTIC,
    rules: { 'no-restricted-syntax': [...runtimeSyntax(), ...DETERMINISM_SYNTAX] },
  },

  // 5c. File-level exemptions (the ONLY places these APIs are allowed).
  // Real-time sims mutate typed arrays inside shared values in place, and the
  // spatial hash fills caller-owned scratch buffers (no per-frame allocation).
  {
    files: ['apps/*/src/sim/**/*.ts', 'packages/game-kit/src/geom/spatial-hash.ts'],
    rules: { 'no-param-reassign': ['error', { props: false }] },
  },
  {
    files: ADAPTERS,
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: without(RUNTIME_PATHS, ...VENDOR_SDK_PATHS),
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY],
      }),
    },
  },
  // The ADAPTERS block lifts every expo-iap ban, so the purchase adapter
  // gets the server-feature names back.
  {
    files: ['packages/shell/src/services/purchase/expo-iap-purchase-adapter.ts'],
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: [...without(RUNTIME_PATHS, ...VENDOR_SDK_PATHS), EXPO_IAP_SERVER_APIS],
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY],
      }),
    },
  },
  // O1: the consent adapter alone imports expo-tracking-transparency (the ADAPTERS block above keeps
  // the ban for every other adapter).
  {
    files: ATT_ADAPTER,
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: without(RUNTIME_PATHS, ...VENDOR_SDK_PATHS),
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY],
        allow: [ATT_IMPORT],
      }),
    },
  },
  {
    files: CLOCK_ADAPTERS,
    rules: {
      'no-restricted-properties': ['error', ...withoutProperty('Date', 'now')],
      'no-restricted-syntax': runtimeSyntax(['newDate']),
    },
  },
  {
    files: DIRECTION_MODULE,
    rules: {
      'no-restricted-properties': ['error', ...withoutProperty('I18nManager', 'isRTL')],
      'no-restricted-imports': restrictedImports({
        paths: without(RUNTIME_PATHS, I18N_MANAGER_IMPORT, REACT_INTL_IMPORT),
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY],
      }),
    },
  },
  // Raw Pressable only in ui/, raw Image only in the Icon component; ui/ stays presentational.
  {
    files: ['packages/shell/src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: without(RUNTIME_PATHS, PRESSABLE_IMPORT),
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY, UI_BOUNDARY],
      }),
    },
  },
  {
    files: ['packages/shell/src/ui/icons/icon.tsx'],
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: without(RUNTIME_PATHS, PRESSABLE_IMPORT, IMAGE_IMPORT),
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY, UI_BOUNDARY],
      }),
    },
  },
  // The cold-start log and the save benchmark (test builds only) read clocks.
  {
    files: PERF_CLOCK_FILES,
    rules: { 'no-restricted-properties': ['error', ...PERF_PROPERTIES] },
  },
  {
    files: APP_TEXT,
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: without(RUNTIME_PATHS, TEXT_IMPORT, PRESSABLE_IMPORT),
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY, UI_BOUNDARY],
      }),
      'no-restricted-syntax': runtimeSyntax(['textAlignLiteral']),
    },
  },
  // Test-only code is loaded by require() behind an inline variant check, so Metro drops it
  // from store bundles.
  {
    files: ['packages/shell/src/app/test-only.ts'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['packages/shell/src/config/external-links.ts'],
    rules: { 'no-restricted-syntax': runtimeSyntax(['remoteUrl', 'remoteUrlTemplate']) },
  },

  // 6. Node code (tooling, config composer, config plugins): Node APIs and network allowed.
  {
    files: NODE_CODE,
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': ['error', ...NODE_CLOCK_PROPERTIES],
      'no-restricted-syntax': ['error', SYNTAX.enums, SYNTAX.importExtension, NODE_NEW_DATE],
      'no-restricted-imports': restrictedImports({}),
      'no-console': 'off',
    },
  },
  {
    files: ['packages/tooling/src/clock/system-clock.ts'],
    rules: {
      'no-restricted-properties': 'off',
      'no-restricted-syntax': ['error', SYNTAX.enums, SYNTAX.importExtension],
    },
  },
  // Expo reads the default export of app.config.ts and of a config plugin named by path.
  {
    files: ['apps/*/app.config.ts', 'packages/shell/plugins/**/*.ts'],
    rules: { 'import/no-default-export': 'off' },
  },

  // 7. Tests.
  {
    files: TESTS,
    extends: [jestPlugin.configs['flat/recommended'], jestPlugin.configs['flat/style']],
  },
  {
    files: TESTS,
    extends: [testingLibrary.configs['flat/react']],
    rules: {
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': 'off',
      'max-nested-callbacks': ['error', 4],
      'sonarjs/no-duplicate-string': 'off',
      'react/jsx-no-literals': 'off',
      'react/no-multi-comp': 'off',
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS],
      'no-restricted-syntax': runtimeSyntax(['a11yLiteral']),
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'testing-library/no-await-sync-events': 'off',
      'testing-library/await-async-events': ['error', { eventModule: ['fireEvent', 'userEvent'] }],
      'jest/expect-expect': ['error', { assertFunctionNames: ['expect', 'fc.assert'] }],
      'jest/consistent-test-it': ['error', { fn: 'it', withinDescribe: 'it' }],
      'jest/no-disabled-tests': 'error',
      'jest/no-focused-tests': 'error',
      'jest/require-top-level-describe': 'error',
      'jest/prefer-strict-equal': 'error',
      'jest/no-large-snapshots': ['error', { maxSize: 50, inlineMaxSize: 10 }],
      'jest/valid-title': ['error', { mustMatch: { it: '^(can|[a-z]+s)\\b' } }],
    },
  },
  { files: GOLDEN_TESTS, rules: { 'jest/no-large-snapshots': 'off' } },
  // Declaration merging (NodeJS.ProcessEnv, ReactNavigation.RootParamList) needs `interface`.
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
    },
  },
  {
    files: ['__mocks__/**/*.{ts,tsx}', 'jest.setup.ts'],
    rules: { 'import/no-default-export': 'off', 'no-restricted-imports': restrictedImports({}) },
  },
  // Root mocks mirror the libraries' PascalCase exports (AdsConsent, TestIds).
  {
    files: ['__mocks__/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/naming-convention': 'off' },
  },

  // 8. Plain JS config files: no type information.
  {
    files: JS_CONFIG,
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
    rules: { 'import/no-default-export': 'off', 'no-restricted-globals': 'off' },
  },

  // 9. Prettier last: turns off every formatting rule that conflicts with Prettier.
  prettierConfig,
]);
