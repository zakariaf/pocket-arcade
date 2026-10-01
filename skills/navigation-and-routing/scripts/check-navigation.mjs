#!/usr/bin/env node
// check-navigation.mjs: checks the Shell's navigation against the Pocket Arcade rules: one static
// native stack with exactly the S2-S15 routes in the FirstRun/Main/Debug groups, typed routes,
// the container's direction and motion, Back on the Game screen opening Pause, popTo for going back.
// A partial Shell (shell-slice.json at the repo root) keeps the whole route table: routes whose
// screen is outside the slice point at NotBuiltScreen and their screen rules print SKIP lines.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-navigation.mjs [repo-root] [--complete]

import { existsSync, readFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

import {
  REPO_SCAN_IGNORES,
  SHELL_SLICE_FILE,
  createReporter,
  lineOf,
  maskComments,
  parseArgs,
  readShellSlice,
  requireDir,
  run,
  sliceSkipReason,
  toPosix,
  walk,
} from './check-lib.mjs';
import { callObjectArgument, childObject, extractBlock, topLevelEntries } from './lib/object-literal.mjs';

const SPEC = {
  name: 'check-navigation',
  summary:
    'Checks the navigator (packages/shell/src/navigation) and every navigation call in the Shell and the apps: ' +
    'one static native stack, the exact route table, typed routes, direction, reduce-motion transitions and Back on the Game screen.',
  usage: '[options] [repo-root]',
  options: {
    apps: { type: 'string', value: 'dir', help: 'Folder with the game apps, also scanned for navigators (default: <repo-root>/apps; skipped when missing)' },
    complete: { type: 'boolean', help: 'The Shell is finished: fail while shell-slice.json exists or any route uses NotBuiltScreen' },
    json: { type: 'boolean', help: 'Also print the problems as JSON before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'repo-root defaults to the current folder; the Shell source is <repo-root>/packages/shell/src.',
    '(A path that is itself a Shell source folder, such as packages/shell/src, is still accepted.)',
    '',
    'Partial Shell: with shell-slice.json at the repo root ({ "screens": ["S4", "S11"], "why": "..." }),',
    'the route table must still hold every group and route; a route whose screen is outside the slice',
    'points at NotBuiltScreen (navigation/not-built-screen.tsx) and its screen rules print',
    '"SKIP <file> [<rule>] <S-id> not in shell-slice.json" (not a problem). A slice screen that still',
    'points at NotBuiltScreen fails. "screens": [] (a game-first repo) skips every navigator rule.',
    'Without shell-slice.json (the full Shell), or with --complete, every rule is strict.',
    '',
    'Rules:',
    '  one-navigator              exactly one createNativeStackNavigator, in navigation/root-stack.tsx; no tabs, drawers, JS stack or expo-router',
    '  static-container           the container is createStaticNavigation(...), never <NavigationContainer>',
    '  route-table                groups FirstRun / Main / Debug hold exactly the S2-S15 routes; Home is the first Main screen',
    '  group-if                   each group has its if-hook; LanguageChoice has if: useNeedsLanguageChoice',
    '  gesture-off                Game and Tutorial set gestureEnabled: false',
    '  header-hidden              screenOptions set headerShown: false (the Shell draws its own top bar)',
    '  typed-routes               navigation/react-navigation.d.ts registers StaticParamList<typeof rootStack>',
    '  container-direction        navigation-root.tsx passes direction={readLayoutDirection()} and no linking prop',
    '  motion-transition          the stack cross-fades when useReduceMotion() is on',
    '  back-opens-pause           screens/game/game-screen.tsx uses usePreventRemove and leaves with popTo',
    '  pop-to-home                never navigate(\'Home\'): Home is the root, go back with popTo or goBack',
    '  params-serialisable        route-params.ts holds plain data (no functions, Date, Map or Set)',
    '  no-rtl-read                navigation code never reads I18nManager (use readLayoutDirection)',
    '  debug-gated                debug-route.tsx and font-test-route.tsx reach their pages only through TEST_ONLY',
    '                             (TEST_ONLY.DebugScreen, TEST_ONLY.FontTestScreen)',
    '  route-not-built            a route points at NotBuiltScreen although its screen is due (in the slice,',
    '                             or the full Shell); Tutorial, part of every Shell app, never may',
    '  home-daily-edge            S4 Home (screens/home/, once built) never navigates to Daily (the daily card body',
    '                             opens S9, lead decision L7) or never starts the daily run (the card\'s Play key)',
    '  slice-present              --complete: shell-slice.json still exists (a slice never ships)',
  ].join('\n'),
};

const GROUPS = [
  { name: 'FirstRun', hook: 'useIsFirstRun', screens: ['LanguageChoice', 'Tutorial'] },
  {
    name: 'Main',
    hook: 'useIsMainApp',
    screens: ['Home', 'Game', 'Levels', 'Daily', 'Stats', 'Settings', 'SettingsLanguage', 'About', 'PrivacyPolicy', 'Licences', 'Premium', 'HowToPlay'],
  },
  { name: 'Debug', hook: 'useIsTestBuild', screens: ['Debug', 'FontTest'] },
];
/** The product screen each route shows: a slice names screens, the stack names routes. */
const SCREEN_OF_ROUTE = {
  LanguageChoice: 'S2',
  Tutorial: 'S13',
  Home: 'S4',
  Game: 'S5',
  Levels: 'S8',
  Daily: 'S9',
  Stats: 'S10',
  Settings: 'S11',
  SettingsLanguage: 'S11a',
  About: 'S11b',
  PrivacyPolicy: 'S11c',
  Licences: 'S11d',
  Premium: 'S12',
  HowToPlay: 'S13',
  Debug: 'S15',
  FontTest: 'S15',
};
/**
 * Routes of the Shell core: every Shell app registers their real screen whatever shell-slice.json
 * says (the first launch plays the tutorial; game-host-integration ships TutorialScreen).
 */
const SHELL_CORE_ROUTES = new Set(['Tutorial']);
/** The test-only routes of the Debug group and the TEST_ONLY member each one renders. */
const TEST_ONLY_ROUTES = [
  { file: 'debug-route.tsx', member: 'DebugScreen', template: 'templates/debug-route.tsx' },
  { file: 'font-test-route.tsx', member: 'FontTestScreen', template: 'templates/font-test-route.tsx' },
];
const NOT_BUILT = /^NotBuiltScreen$|\bscreen\s*:\s*NotBuiltScreen\b/;
const NOT_ROUTES = 'S1 Splash is the native splash, S3 is Google\'s consent form, S6 Pause and S7 Result are overlays inside Game, S14 dialogs render above the navigator';
const OTHER_NAVIGATORS = /\bcreate(BottomTab|Drawer|MaterialTopTab|MaterialBottomTab|Stack|NativeBottomTab)Navigator\s*\(/g;
const BANNED_IMPORTS = /from\s+['"](expo-router|@react-navigation\/(bottom-tabs|drawer|stack|material-top-tabs|material-bottom-tabs))['"]/g;

function read(abs) {
  return maskComments(readFileSync(abs, 'utf8'));
}

/** Why a rule tied to this screen is skipped (outside shell-slice.json), or null when it is checked. */
function skipReasonFor(ctx, screenId) {
  return ctx.isComplete ? null : sliceSkipReason(ctx.slice, screenId);
}

/** Reports the rule when its screen is due, or prints a SKIP line when the slice leaves it out. */
function screenRule(ctx, screenId, entry) {
  const reason = skipReasonFor(ctx, screenId);
  if (reason === null) return true;
  ctx.report.skip({ file: entry.file, rule: entry.rule, message: reason });
  return false;
}

/** REPO_SCAN_IGNORES for a walk rooted at apps/: the entries under apps/ lose that prefix. */
const APPS_IGNORES = [
  ...REPO_SCAN_IGNORES.filter((glob) => !glob.includes('/')),
  ...REPO_SCAN_IGNORES.filter((glob) => glob.startsWith('apps/')).map((glob) => glob.slice('apps/'.length)),
];

function checkSourceTree(ctx, root, label, ignore = []) {
  const files = walk(root, { include: ['*.ts', '*.tsx'], ignore: ['*.d.ts', ...ignore] });
  for (const rel of files) {
    const abs = join(root, rel);
    const shown = toPosix(join(label, rel));
    const isTest = /\.test\.tsx?$/.test(rel);
    const source = read(abs);
    for (const match of source.matchAll(OTHER_NAVIGATORS)) {
      ctx.report.problem({ file: shown, line: lineOf(source, match.index), rule: 'one-navigator', message: `create${match[1]}Navigator: the Shell has exactly one navigator, a static native stack`, fix: 'Add the screen to the Main group of rootStack in navigation/root-stack.tsx instead of creating another navigator.' });
    }
    for (const match of source.matchAll(BANNED_IMPORTS)) {
      ctx.report.problem({ file: shown, line: lineOf(source, match.index), rule: 'one-navigator', message: `imports ${match[1]}: only @react-navigation/native and native-stack are used`, fix: 'Remove the import; route through rootStack (static native stack).' });
    }
    if (!isTest) {
      for (const match of source.matchAll(/\bcreateNativeStackNavigator\s*\(/g)) {
        if (!rel.endsWith('navigation/root-stack.tsx')) {
          ctx.report.problem({ file: shown, line: lineOf(source, match.index), rule: 'one-navigator', message: 'a second createNativeStackNavigator outside navigation/root-stack.tsx', fix: 'Register the screen in rootStack; no nested or second stacks.' });
        }
      }
      for (const match of source.matchAll(/<NavigationContainer\b/g)) {
        ctx.report.problem({ file: shown, line: lineOf(source, match.index), rule: 'static-container', message: '<NavigationContainer> used directly', fix: 'Render createStaticNavigation(rootStack) from navigation/navigation-root.tsx.' });
      }
    }
    for (const match of source.matchAll(/\bnavigate\(\s*['"]Home['"]/g)) {
      ctx.report.problem({ file: shown, line: lineOf(source, match.index), rule: 'pop-to-home', message: "navigate('Home') pushes a second Home in React Navigation 7", fix: "Use navigation.dispatch(StackActions.popTo('Home')) or navigation.popTo('Home')." });
    }
    ctx.checked += 1;
  }
}

function checkRouteTable(ctx, stackFile, shown) {
  const source = read(stackFile);
  const call = callObjectArgument(source, 'createNativeStackNavigator');
  if (!call) {
    ctx.report.problem({ file: shown, line: 1, rule: 'route-table', message: 'no createNativeStackNavigator({ ... }) call', fix: 'Copy templates/root-stack.tsx from this skill.' });
    return;
  }
  const at = (offsetText) => lineOf(source, Math.max(0, source.indexOf(offsetText, call.index)));
  const options = childObject(call.inner, 'screenOptions') ?? '';
  if (!/headerShown\s*:\s*false/.test(options)) {
    ctx.report.problem({ file: shown, line: at('createNativeStackNavigator'), rule: 'header-hidden', message: 'screenOptions do not set headerShown: false', fix: "Set screenOptions: { headerShown: false }; the Shell's TopBar draws the back button and title." });
  }
  if (/^\s*screens\s*:/m.test(call.inner) && !childObject(call.inner, 'groups')) {
    ctx.report.problem({ file: shown, line: at('screens'), rule: 'route-table', message: 'screens are not split into the FirstRun / Main / Debug groups', fix: 'Use groups with if-hooks (templates/root-stack.tsx).' });
    return;
  }
  const groupsInner = childObject(call.inner, 'groups');
  if (!groupsInner) {
    ctx.report.problem({ file: shown, line: at('createNativeStackNavigator'), rule: 'route-table', message: 'no groups: { FirstRun, Main, Debug }', fix: 'Copy the groups from templates/root-stack.tsx.' });
    return;
  }
  const groups = topLevelEntries(groupsInner);
  const names = groups.map((group) => group.key);
  const wanted = GROUPS.map((group) => group.name);
  if (names.join(',') !== wanted.join(',')) {
    ctx.report.problem({ file: shown, line: at('groups'), rule: 'route-table', message: `groups are [${names.join(', ')}], expected [${wanted.join(', ')}] in this order`, fix: 'Keep exactly FirstRun, Main, Debug; the first group that renders gives the initial route.' });
  }
  const seen = new Map();
  for (const expected of GROUPS) {
    const group = groups.find((candidate) => candidate.key === expected.name);
    if (!group) continue;
    const inner = extractBlock(group.value, 0)?.inner ?? '';
    const hook = topLevelEntries(inner).find((entry) => entry.key === 'if');
    if (!hook || hook.value !== expected.hook) {
      ctx.report.problem({ file: shown, line: at(`${expected.name}:`), rule: 'group-if', message: `group ${expected.name} needs if: ${expected.hook} (found ${hook ? hook.value : 'none'})`, fix: 'Groups switch by their if-hooks (route-guards.ts), never by navigate().' });
    }
    const screensInner = childObject(inner, 'screens') ?? '';
    const screens = topLevelEntries(screensInner);
    for (const screen of screens) seen.set(screen.key, { group: expected.name, value: screen.value });
    const keys = screens.map((screen) => screen.key);
    const missing = expected.screens.filter((name) => !keys.includes(name));
    const extra = keys.filter((name) => !expected.screens.includes(name));
    for (const name of missing) {
      ctx.report.problem({ file: shown, line: at(`${expected.name}:`), rule: 'route-table', message: `route ${name} is missing from group ${expected.name}`, fix: `Register ${name} in the ${expected.name} group (see references/routes-and-flows.md).` });
    }
    for (const name of extra) {
      ctx.report.problem({ file: shown, line: at(`${name}:`), rule: 'route-table', message: `route ${name} is not in the route table (${NOT_ROUTES})`, fix: 'Render it inside its screen (overlay) or the dialog host, or add it to the table in the skill first.' });
    }
    if (expected.name === 'Main' && keys.length > 0 && keys[0] !== 'Home') {
      ctx.report.problem({ file: shown, line: at('Main:'), rule: 'route-table', message: `the first Main screen is ${keys[0]}, so the app would open there`, fix: 'Put Home first in the Main group.' });
    }
  }
  for (const [name, entry] of seen) {
    const screenId = SCREEN_OF_ROUTE[name];
    if (screenId === undefined || !NOT_BUILT.test(entry.value.trim())) continue;
    const found = { file: shown, line: at(`${name}:`), rule: 'route-not-built' };
    if (SHELL_CORE_ROUTES.has(name)) {
      ctx.report.problem({ ...found, message: `route ${name} points at NotBuiltScreen, but it is part of every Shell app, slice or not`, fix: `Register ${name}: { screen: TutorialScreen, options: { gestureEnabled: false } } (game-host-integration's screens/first-run/tutorial-screen.tsx); a first launch reaches Home only through it.` });
      continue;
    }
    if (!screenRule(ctx, screenId, found)) continue;
    const why = ctx.slice === null || ctx.isComplete ? 'the full Shell needs every screen' : `${screenId} is in ${SHELL_SLICE_FILE}`;
    ctx.report.problem({ ...found, message: `route ${name} (${screenId}) still points at NotBuiltScreen, but ${why}`, fix: `Build ${screenId} (toybox-screens) and register its screen component for ${name}${ctx.slice === null || ctx.isComplete ? '' : `, or take ${screenId} out of ${SHELL_SLICE_FILE}`}.` });
  }
  const language = seen.get('LanguageChoice');
  if (language && !/if\s*:\s*useNeedsLanguageChoice/.test(language.value)) {
    ctx.report.problem({ file: shown, line: at('LanguageChoice'), rule: 'group-if', message: 'LanguageChoice has no if: useNeedsLanguageChoice', fix: 'A relaunch after a direction reload must open Tutorial, not the language choice again.' });
  }
  for (const name of ['Game', 'Tutorial']) {
    const entry = seen.get(name);
    const isCore = SHELL_CORE_ROUTES.has(name);
    if (entry && !isCore && !screenRule(ctx, SCREEN_OF_ROUTE[name], { file: shown, rule: 'gesture-off' })) continue;
    if (entry && !/gestureEnabled\s*:\s*false/.test(entry.value)) {
      ctx.report.problem({ file: shown, line: at(`${name}:`), rule: 'gesture-off', message: `${name} keeps the iOS back swipe`, fix: `Give ${name} options: { gestureEnabled: false } so a stray swipe never loses a run.` });
    }
  }
}

function requireFileIn(ctx, abs, shown, rule, fix) {
  if (existsSync(abs)) return read(abs);
  ctx.report.problem({ file: shown, line: 1, rule, message: 'file is missing', fix });
  return null;
}

/**
 * S4 -> S9 and S4 -> today's run (L7): Home's daily card body navigates to Daily, and its Play key
 * starts a daily run in Game. Checked once screens/home/ exists (check-screens owns "not built").
 */
function checkHomeDailyEdge(ctx, src, label) {
  const home = join(src, 'screens', 'home');
  if (!existsSync(home)) return;
  const shown = toPosix(join(label, 'screens', 'home'));
  if (!screenRule(ctx, 'S4', { file: shown, rule: 'home-daily-edge' })) return;
  const files = walk(home, { include: ['*.ts', '*.tsx'], ignore: ['*.test.ts', '*.test.tsx'] });
  const source = files.map((rel) => read(join(home, rel))).join('\n');
  const fix = "Copy toybox-screens' use-home-actions.ts: onOpenDaily navigates to 'Daily' (the card body), onPlayDaily to Game with { start: 'new', ref: { kind: 'daily', date } } (the Play key); references/routes-and-flows.md.";
  if (!/\bnavigate\(\s*['"]Daily['"]/.test(source)) {
    ctx.report.problem({ file: `${shown}/`, line: 1, rule: 'home-daily-edge', message: "Home never calls navigate('Daily'): nothing on Home opens S9 Daily challenge", fix });
  }
  if (!/\bkind\s*:\s*['"]daily['"]/.test(source)) {
    ctx.report.problem({ file: `${shown}/`, line: 1, rule: 'home-daily-edge', message: "Home never starts today's run (navigate('Game', { start: 'new', ref: { kind: 'daily', date } })) from the daily card's Play key", fix });
  }
}

function checkNavigationFolder(ctx, src, label) {
  checkHomeDailyEdge(ctx, src, label);
  const nav = (name) => ({ abs: join(src, 'navigation', name), shown: toPosix(join(label, 'navigation', name)) });
  const stack = nav('root-stack.tsx');
  if (existsSync(stack.abs)) checkRouteTable(ctx, stack.abs, stack.shown);
  else ctx.report.problem({ file: stack.shown, line: 1, rule: 'one-navigator', message: 'navigation/root-stack.tsx is missing', fix: 'Copy templates/root-stack.tsx from this skill.' });

  const dts = nav('react-navigation.d.ts');
  const types = requireFileIn(ctx, dts.abs, dts.shown, 'typed-routes', 'Copy templates/react-navigation.d.ts: it types navigate() everywhere.');
  if (types !== null && !(/StaticParamList\s*<\s*typeof\s+rootStack\s*>/.test(types) && /interface\s+RootParamList\s+extends/.test(types))) {
    ctx.report.problem({ file: dts.shown, line: 1, rule: 'typed-routes', message: 'RootParamList is not extended from StaticParamList<typeof rootStack>', fix: 'Copy templates/react-navigation.d.ts.' });
  }

  const root = nav('navigation-root.tsx');
  const container = requireFileIn(ctx, root.abs, root.shown, 'container-direction', 'Copy templates/navigation-root.tsx.');
  const stackSource = existsSync(stack.abs) ? read(stack.abs) : '';
  if (container !== null) {
    if (!/createStaticNavigation\s*\(/.test(container)) {
      ctx.report.problem({ file: root.shown, line: 1, rule: 'static-container', message: 'no createStaticNavigation(...)', fix: 'Build the container with createStaticNavigation (templates/navigation-root.tsx).' });
    }
    if (!/direction\s*=\s*\{/.test(container) || !/readLayoutDirection/.test(container)) {
      ctx.report.problem({ file: root.shown, line: 1, rule: 'container-direction', message: 'the container does not get direction={readLayoutDirection()}', fix: 'Pass the layout direction from i18n/direction.ts, never the language setting.' });
    }
    const linking = /\blinking\s*=\s*\{/.exec(container);
    if (linking) {
      ctx.report.problem({ file: root.shown, line: lineOf(container, linking.index), rule: 'container-direction', message: 'a linking prop: the store app has no deep links', fix: 'Remove linking; test builds handle their debug links in test-only code.' });
    }
  }
  const motion = `${container ?? ''}\n${stackSource}`;
  if (!/useReduceMotion\s*\(/.test(motion) || !/['"]fade['"]/.test(motion)) {
    ctx.report.problem({ file: root.shown, line: 1, rule: 'motion-transition', message: 'pushes never switch to a cross-fade when Reduce motion is on', fix: "Wrap rootStack with .with(...) and set animation: isReduced ? 'fade' : 'default' (templates/navigation-root.tsx)." });
  }

  const params = nav('route-params.ts');
  const paramSource = requireFileIn(ctx, params.abs, params.shown, 'params-serialisable', 'Copy templates/route-params.ts.');
  if (paramSource !== null) {
    const bad = /=>|\b(Date|Map|Set|Promise)\s*</.exec(paramSource) ?? /:\s*(Date|Map|Set)\b/.exec(paramSource);
    if (bad) {
      ctx.report.problem({ file: params.shown, line: lineOf(paramSource, bad.index), rule: 'params-serialisable', message: 'route params hold a function or a non-JSON object', fix: 'Pass ids and plain data only; read everything else from the stores.' });
    }
  }

  for (const rel of walk(join(src, 'navigation'), { include: ['*.ts', '*.tsx'] })) {
    const source = read(join(src, 'navigation', rel));
    const match = /\bI18nManager\b/.exec(source);
    if (match) {
      ctx.report.problem({ file: toPosix(join(label, 'navigation', rel)), line: lineOf(source, match.index), rule: 'no-rtl-read', message: 'navigation reads I18nManager', fix: 'Use readLayoutDirection() from i18n/direction.ts.' });
    }
  }

  for (const route of TEST_ONLY_ROUTES) {
    const file = nav(route.file);
    if (!screenRule(ctx, 'S15', { file: file.shown, rule: 'debug-gated' })) continue;
    const source = requireFileIn(ctx, file.abs, file.shown, 'debug-gated', `Copy ${route.template}.`);
    if (source !== null && !new RegExp(`TEST_ONLY\\.${route.member}\\b`).test(source)) {
      ctx.report.problem({ file: file.shown, line: 1, rule: 'debug-gated', message: `the route does not render TEST_ONLY.${route.member}`, fix: `Render TEST_ONLY.${route.member} (null when TEST_ONLY is null) so store bundles never contain the test-only page.` });
    }
  }

  const game = { abs: join(src, 'screens', 'game', 'game-screen.tsx'), shown: toPosix(join(label, 'screens', 'game', 'game-screen.tsx')) };
  const isGameDue = screenRule(ctx, 'S5', { file: game.shown, rule: 'back-opens-pause' });
  const gameSource = isGameDue ? requireFileIn(ctx, game.abs, game.shown, 'back-opens-pause', 'Copy templates/game-screen.tsx.') : null;
  if (gameSource !== null) {
    if (!/usePreventRemove\s*\(/.test(gameSource)) {
      ctx.report.problem({ file: game.shown, line: 1, rule: 'back-opens-pause', message: 'no usePreventRemove: Back would leave a live run', fix: 'Intercept removal while playing or paused: Back opens Pause, Back in Pause resumes.' });
    }
    if (!/popTo\s*\(/.test(gameSource)) {
      ctx.report.problem({ file: game.shown, line: 1, rule: 'back-opens-pause', message: 'the Pause Home button does not leave with popTo', fix: "Set the leaving ref, then navigation.dispatch(StackActions.popTo('Home'))." });
    }
  }
}

/**
 * The repo root and the Shell source. The argument is the repo root; a Shell source folder itself
 * (packages/shell/src, or any folder holding navigation/) is still accepted.
 */
function locate(arg) {
  const given = requireDir(arg, 'repo root');
  const shellSrc = join(given, 'packages', 'shell', 'src');
  if (existsSync(shellSrc)) return { root: given, src: shellSrc };
  if (existsSync(join(given, 'navigation'))) {
    const isInRepo = basename(given) === 'src' && basename(resolve(given, '..')) === 'shell';
    return { root: isInRepo ? resolve(given, '..', '..', '..') : null, src: given };
  }
  return { root: given, src: null };
}

const shownPath = (abs) => toPosix(relative(process.cwd(), abs)) || '.';

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const { root, src } = locate(positionals[0] ?? '.');
  const slice = root === null ? null : readShellSlice(root);
  const report = createReporter({ name: 'check-navigation', json: options.json });
  const ctx = { report, checked: 0, slice, isComplete: options.complete === true };
  if (ctx.isComplete && slice !== null) {
    report.problem({ file: shownPath(join(root, SHELL_SLICE_FILE)), line: 1, rule: 'slice-present', message: `the Shell is declared partial (${slice.why}); a slice never ships`, fix: `Build the remaining screens, point every route at its real screen, then delete ${SHELL_SLICE_FILE}.` });
  }
  const noShellApp = ctx.isComplete ? null : sliceSkipReason(slice, null);
  if (src === null && noShellApp === null) requireDir(join(root, 'packages', 'shell', 'src'), 'Shell source folder (packages/shell/src)');
  if (src !== null) checkSourceTree(ctx, src, shownPath(src));
  const apps = options.apps ?? join(root ?? process.cwd(), 'apps');
  if (existsSync(apps)) checkSourceTree(ctx, apps, shownPath(apps), APPS_IGNORES);
  if (noShellApp !== null) {
    report.skip({ file: shownPath(join(src ?? join(root, 'packages', 'shell', 'src'), 'navigation')), rule: 'route-table', message: noShellApp });
    if (ctx.checked === 0) return report.notApplicable(`${noShellApp}: no Shell or app source to scan for navigators`);
  } else {
    checkNavigationFolder(ctx, src, shownPath(src));
  }
  return report.finish({ checked: ctx.checked, unit: 'files' });
});
