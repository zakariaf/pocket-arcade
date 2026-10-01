#!/usr/bin/env node
// check-e2e-setup.mjs: checks the end-to-end tooling of a Pocket Arcade repo without running it: the
// pinned, checksum-verified Maestro installer, the no-telemetry Maestro environment, the runner with its
// socket sampler, dedicated simulators, deterministic capture settings, the shared sub-flows and the
// matrix flow, the npm scripts, the visual-diff packages, ignored tool and report folders, and complete,
// consistent screenshot baselines, the runner's cold-start, memory and large-text steps, the
// test-only debug services (simulated connectivity, debug Premium, consent through the factory), the
// debug link handler, the debug flags kept across the direction reload, the S15 model hook and the
// installed network guard. The debug kit is Shell core (the composition root imports it): with
// shell-slice.json it is strict once the composition root exists, and only S15's model hook and the
// sub-flows of screens outside the slice print SKIP lines; everything else stays strict.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-e2e-setup.mjs [repo-root] [--baselines]

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, dueSkipReason, fail, maskComments, parseArgs, readShellSlice, requireDir, run, SHELL_DUE_TARGETS, sliceSkipReason, walk } from './check-lib.mjs';
import { maestroSpawnProblems } from './lib/maestro-spawns.mjs';

const SPEC = {
  name: 'check-e2e-setup',
  summary: 'Checks the Maestro installer, runner, simulator helpers, sub-flows, scripts, packages and screenshot baselines of the repo against the e2e-maestro rules.',
  usage: '[options] [repo-root]',
  options: {
    baselines: { type: 'boolean', help: 'Require the complete baseline matrix (2 devices x 4 languages x light/dark) for every app with flows (use before a release)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  maestro-pin           install-maestro.sh is missing, or its version/SHA-256 pair is not a verified pin, or it',
    '                        skips the checksum or strict mode',
    '  maestro-env           Maestro runs without Java 17 or without MAESTRO_CLI_NO_ANALYTICS,',
    '                        MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED and MAESTRO_DISABLE_UPDATE_CHECK set to true',
    '  runner-file-missing   a runner, simulator, gallery, comparator or socket-sampler file is missing',
    '  runner-no-sampler     run-e2e-ios.ts does not run the socket sampler or does not fail on network.txt',
    "  sampler-own-simulators the sampler watches every copy of the app on the Mac, not only the run's own",
    "                        simulators (sample-sockets.ts <App> <report> <udid>..., appPids(appName, udids)):",
    "                        another session's ADS_MODE=test copy then fills network.txt with Google sockets",
    '  runner-steps          run-e2e-ios.ts lacks a step: flows without a11y (quarantine,a11y) with S15\'s save benchmark',
    '                        kept right after them (recordSaveBenchmark: save-benchmark.json), cold start and memory',
    '                        (runPerfSteps: judgeColdStart, footprint, judgeMemory) or large text (a11y flows at',
    '                        accessibility-extra-extra-extra-large in en and fa)',
    '  shared-simulator      the tooling uses "booted" or another agent\'s simulator instead of a named, dedicated one',
    '  maestro-device        a spawn of the Maestro binary under packages/tooling/src does not start with the global',
    '                        --device <udid> and --driver-host-port <port> (maestroGlobalArgs from e2e/maestro-args.ts,',
    '                        a free port per run), passes the per-command --udid, or fixes the driver port: another',
    '                        session\'s simulator or XCTest driver can answer the run',
    '  e2e-ads-off           run-e2e-ios.ts does not refuse a build that is not the test variant with ADS_MODE=off',
    '                        (requireAdsOffTestBuild): only with ads off does no consent form or tracking prompt cover a',
    '                        screen and no ad SDK open a socket; or it runs admob-ads\' hand-run ads smoke flows',
    '                        (packages/shell/e2e/ads-smoke/, ADS_MODE=test builds only: check-flows checks them)',
    '  feedback-evidence     sim-perf-steps.ts does not write feedback.json from the perf log after the smoke flows',
    '                        (feedbackEvidenceOf), or feedback-evidence.ts is missing',
    '  openurl-prompt        the tooling opens a debug link with simctl openurl: iOS answers with an "Open in <app>?"',
    '                        prompt nobody accepts, so the app never gets the link (use debugSetupArgs: debug-setup.yaml)',
    '  maestro-upload        the tooling or an npm script uses maestro cloud/login or test --analyze (uploads the run)',
    '  deterministic-capture the status bar is not pinned to 9:41 or the text size is not set before capture',
    '  screenshot-tolerance  capture-screenshots-ios.ts allows more than MAX_DIFF_RATIO = 0.002 (0.2% of pixels), or',
    '                        compare-png.ts uses a pixelmatch threshold above 0.1',
    '  network-guard-missing the Shell\'s test-only JS network guard (network-guard.ts) is missing, or nothing installs',
    '                        it (createDebugParts calls installNetworkGuard; the test-only entry exports it)',
    '  debug-services        the debug module (packages/shell/src/screens/debug/) lacks simulated-connectivity.ts,',
    '                        simulated-clock.ts or debug-services.ts; debug-services.ts dispatches debug-premium-set before',
    '                        the save write, or does not flip setSimulatedOffline, set setSimulatedToday or build consent',
    '                        with createConsentPort; or test-only',
    '                        debug code calls createAdmobConsentAdapter or dispatches premium-granted',
    '  debug-link            the debug link handler (app/debug-link-handler.ts: parse, apply, listen, start), its inbox',
    '                        (app/debug-link-intake.ts), its parser (screens/debug/debug-link.ts, one reader per',
    '                        debug-link-params.json parameter), the save recipe, the routes, createDebugParts or the',
    '                        context is missing; the test-only entry does not export createDebugLinkHandler; nothing',
    '                        starts the handler (links?.start(Linking)); createDebugParts does not listen at once',
    '                        (links.listen(Linking): a link sent right after launchApp is lost otherwise); or the',
    '                        handler opens screen= before a first-run switch mounted the Main group (onNextNavigationState)',
    '  debug-persistence     the debug flags are not kept across the direction reload: the test-only key-value store',
    '                        (services/save/sqlite-kv-debug-store-adapter.ts, sync kv-store calls) or debug-overrides.ts',
    '                        is missing, debug-services.ts does not read and write debug.overrides, the handler does not',
    '                        keep debug.pending-screen before the restart, or createDebugParts does not pass the store',
    '  debug-model           S15\'s model hook (use-debug-model.ts with debug-actions, debug-tools, debug-sheets) is',
    '                        missing, reaches the debug state other than through useDebugServices() and useDebugLinks(),',
    '                        or reads it without readDebugState(..., version) (a React Compiler build keeps stale values)',
    '  subflow-missing       debug-setup, assert-no-network or shoot-screen sub-flow, or the matrix flow, is missing',
    '  perf-layer            the perf layer the evidence run measures is missing, in two halves. JS half (Shell step 7,',
    '                        with the composition root, due once packages/shell/src/app/start-shell.ts exists):',
    '                        app/perf/*.ts (cold-start, perf-log, process-start, use-cold-start-mark,',
    '                        debug-perf-actions), the feedback recorders services/audio/recording-feedback.ts',
    '                        (game-audio-and-haptics), markJsEntry() in start-shell.ts, createDebugParts',
    '                        making the perf log (TEST_ONLY.createPerfLog), S15\'s Performance actions',
    '                        (createDebugPerfActions) and the feedback recorders (recordAudioFeedback,',
    '                        recordHapticsFeedback), each exported by the test-only entry, and',
    "                        useColdStartMark(...perfLog...) in Home's use-home-model.ts (SKIP while S4 is outside",
    '                        shell-slice.json). Native half (Shell step 8, due once packages/shell/src/config/',
    '                        shell-plugins.ts exists): packages/shell/expo-module.config.json, ios/E07Shell.podspec and',
    '                        ios/ProcessStartModule.swift. Both halves SKIP for a game-first repo ("screens": [])',
    '',
    'A partial Shell (shell-slice.json): the debug kit (network guard, debug services, link, persistence, the',
    'debug actions) is Shell core, strict in every Shell app once the composition root exists (before Shell step',
    '7 created packages/shell/src/app/create-shell-app.tsx it prints a not-yet-due SKIP line; a game-first repo',
    'SKIPs it). Only S15\'s model hook (use-debug-model.ts) and the sub-flows belong to S15, the matrix also to',
    'the screens it shoots; for a screen outside the slice they print "SKIP <file> [<rule>] <S-id> not in',
    'shell-slice.json" and do not count.',
    '  e2e-script            npm script e2e:ios or screenshots:ios differs',
    '  visual-deps           pixelmatch 7.2.0, pngjs 7.0.0 or @types/pngjs 6.0.5 is missing or not an exact pin',
    '  gitignore-tools       .gitignore does not ignore /tools/ (Maestro) and reports/',
    '  baseline-matrix       a baseline set lacks a screen the other sets have, or (--baselines) a device/language/theme',
    '                        set is missing',
  ].join('\n'),
};

/** Verified Maestro releases: version -> SHA-256 of maestro.zip (from the release's checksums_sha256.txt). */
const MAESTRO_PINS = { '2.10.0': '29b675e10cc12080e445e9bfb2e2b4e4dfb9c0f2e30d5884120d258b5e1cd991' };
const SCRIPTS = {
  'e2e:ios': 'node packages/tooling/src/e2e/run-e2e-ios.ts',
  'screenshots:ios': 'node packages/tooling/src/e2e/capture-screenshots-ios.ts',
};
const VISUAL_DEPS = { pixelmatch: '7.2.0', pngjs: '7.0.0', '@types/pngjs': '6.0.5' };
const FILES = [
  'packages/tooling/src/e2e/run-e2e-ios.ts',
  'packages/tooling/src/e2e/simulator.ts',
  'packages/tooling/src/e2e/maestro-args.ts',
  'packages/tooling/src/e2e/feedback-evidence.ts',
  'packages/tooling/src/e2e/write-gallery.ts',
  'packages/tooling/src/e2e/capture-screenshots-ios.ts',
  'packages/tooling/src/e2e/sim-perf.ts',
  'packages/tooling/src/e2e/sim-perf-steps.ts',
  'packages/tooling/src/visual/compare-png.ts',
  'packages/tooling/src/audit/network-runtime-layer.ts',
  'packages/tooling/src/audit/sample-sockets.ts',
];
/** Each sub-flow with the screens it drives: the debug link opens S15; the matrix shoots these screens. */
const SUBFLOWS = {
  'packages/shell/e2e/subflows/debug-setup.yaml': ['S15'],
  'packages/shell/e2e/subflows/assert-no-network.yaml': ['S15'],
  'packages/shell/e2e/subflows/shoot-screen.yaml': ['S15'],
  'packages/shell/e2e/screenshots/matrix.yaml': ['S15', 'S4', 'S5', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13'],
};
const HERE = dirname(fileURLToPath(import.meta.url));
const DEVICES = ['phone', 'tablet'];
const LANGS = ['en', 'de', 'fa', 'ckb'];
const THEMES = ['light', 'dark'];

const exists = (root, rel) => existsSync(join(root, rel));
const read = (root, rel) => readFileSync(join(root, rel), 'utf8');

function checkInstaller(root, report) {
  const rel = 'packages/tooling/scripts/install-maestro.sh';
  const problem = (message, fix) => report.problem({ file: rel, line: 1, rule: 'maestro-pin', message, fix });
  if (!exists(root, rel)) {
    problem('is missing', "Copy this skill's templates/packages/tooling/scripts/install-maestro.sh; Maestro is installed only from the pinned GitHub zip, never Homebrew or curl | bash.");
    return;
  }
  const text = read(root, rel);
  const version = /MAESTRO_VERSION="([^"]+)"/.exec(text)?.[1];
  const sha = /MAESTRO_SHA256="([0-9a-f]{64})"/.exec(text)?.[1];
  if (!version || !sha) problem('does not pin MAESTRO_VERSION and a 64-hex MAESTRO_SHA256', 'Restore the two pin lines from the template.');
  else if (MAESTRO_PINS[version] === undefined) problem(`pins Maestro ${version}, which this skill has not verified`, 'Re-verify the release (references/maestro-setup.md, "Changing the pin"), then add the pair to this checker and the reference in one Gate-Change commit.');
  else if (MAESTRO_PINS[version] !== sha) problem(`the SHA-256 for ${version} is ${sha.slice(0, 12)}…, not the verified ${MAESTRO_PINS[version].slice(0, 12)}…`, 'Restore the verified checksum; never edit it to match a download.');
  if (!/shasum -a 256 -c/.test(text)) problem('does not verify the download with shasum -a 256 -c', 'Restore the checksum check from the template; a mismatch must delete the zip and exit 1.');
  if (!/set -euo pipefail/.test(text)) problem('does not run with set -euo pipefail', 'Add set -euo pipefail after the shebang.');
}

function checkRunner(root, report) {
  for (const rel of FILES) if (!exists(root, rel)) report.problem({ file: rel, line: 0, rule: 'runner-file-missing', message: 'is missing', fix: `Copy it from this skill's templates/${rel}.` });
  const simulator = 'packages/tooling/src/e2e/simulator.ts';
  if (exists(root, simulator)) {
    const code = maskComments(read(root, simulator));
    for (const name of ['MAESTRO_CLI_NO_ANALYTICS', 'MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED', 'MAESTRO_DISABLE_UPDATE_CHECK']) {
      if (!new RegExp(`${name}\\s*:\\s*['"]true['"]`).test(code)) report.problem({ file: simulator, line: 1, rule: 'maestro-env', message: `maestroEnv() does not set ${name}: 'true'`, fix: 'Restore maestroEnv() from the template: no analytics, no analysis prompt, no update check.' });
    }
    if (!/java_home['"]?\s*,\s*\[\s*['"]-v['"]\s*,\s*['"]17['"]/.test(code) && !/JAVA_HOME/.test(code)) report.problem({ file: simulator, line: 1, rule: 'maestro-env', message: 'maestroEnv() does not select Java 17', fix: "Resolve JAVA_HOME with /usr/libexec/java_home -v 17 (fallback: Android Studio's bundled JBR)." });
    if (!/'--time'\s*,\s*'9:41'|--time 9:41/.test(code)) report.problem({ file: simulator, line: 1, rule: 'deterministic-capture', message: 'prepareSimulator does not pin the status bar to 9:41', fix: 'Restore the simctl status_bar override (time 9:41, full bars, battery 100%).' });
    if (!/content_size/.test(code)) report.problem({ file: simulator, line: 1, rule: 'deterministic-capture', message: 'prepareSimulator does not set the text size', fix: 'Restore simctl ui <udid> content_size <size> (large by default, the 200% pass uses accessibility-extra-extra-extra-large).' });
  }
  const sampler = 'packages/tooling/src/audit/sample-sockets.ts';
  if (exists(root, sampler) && !/\bappPids\s*\(\s*[^,()]+,\s*[^,()]+\)/.test(maskComments(read(root, sampler)))) {
    report.problem({ file: sampler, line: 1, rule: 'sampler-own-simulators', message: "samples every copy of the app on this Mac (appPids without the run's simulator UDIDs)", fix: "Restore sample-sockets.ts from the template: <AppName> <report> <udid>..., appPids(appName, udids)." });
  }
  const runner = 'packages/tooling/src/e2e/run-e2e-ios.ts';
  if (exists(root, runner)) {
    const code = maskComments(read(root, runner));
    if (!/sample-sockets/.test(code) || !/network\.txt/.test(code)) report.problem({ file: runner, line: 1, rule: 'runner-no-sampler', message: 'does not run the socket sampler around maestro test or does not check network.txt', fix: 'Restore runWithSocketSampler from the template: any non-loopback socket of the app fails the run (spec N3).' });
    // Each sampler names its simulator: [SOCKET_SAMPLER, <app name>, <report>, <udid>].
    if (/SOCKET_SAMPLER|sample-sockets/.test(code) && !/\[\s*SOCKET_SAMPLER\s*,[^\],]+,[^\],]+,[^\],]+\]/.test(code)) report.problem({ file: runner, line: 1, rule: 'sampler-own-simulators', message: "spawns the socket sampler without a simulator's UDID, so it samples every copy of the app on this Mac (another session's ads-on build included)", fix: "Restore socketSamplers() from the template: one sampler per simulator of the run, spawned as [SOCKET_SAMPLER, app.name, network, udid]." });
    if (!/exclude-tags['"]?\s*,\s*['"]quarantine/.test(code)) report.problem({ file: runner, line: 1, rule: 'runner-no-sampler', message: 'does not pass --exclude-tags quarantine', fix: 'Restore the maestro test arguments from the template.' });
    const steps = [
      [/['"]quarantine,a11y['"]/, 'the flows step does not exclude the a11y flows (they need LANG and 200 % text)'],
      [/\brunPerfSteps\s*\(/, 'there is no cold-start and memory step (runPerfSteps)'],
      [/accessibility-extra-extra-extra-large/, 'there is no large-text step at accessibility-extra-extra-extra-large'],
      [/['"]--include-tags['"]\s*,\s*['"]a11y['"]/, 'the large-text step does not run the a11y-tagged flows'],
      [/LANG=\$\{/, 'the large-text step does not pass LANG to the a11y flows'],
      [/\brecordSaveBenchmark\s*\(/, "the flows step does not keep S15's save benchmark (recordSaveBenchmark right after the flows writes save-benchmark.json)"],
    ];
    for (const [pattern, message] of steps) if (!pattern.test(code)) report.problem({ file: runner, line: 1, rule: 'runner-steps', message, fix: "Restore run-e2e-ios.ts from this skill's template: flows, cold start, memory and large text run in one evidence run (--flows-only is for iterating)." });
    if (/ads-smoke/.test(code)) report.problem({ file: runner, line: 1, rule: 'e2e-ads-off', message: 'runs the packages/shell/e2e/ads-smoke/ flows, which need an ADS_MODE=test build and a launch by xcrun simctl launch', fix: "Run only packages/shell/e2e/flows/*/*.yaml and apps/<game-id>/e2e/flows/*/*.yaml (this skill's template); admob-ads' ads smoke flows are run by hand (references/flows.md, \"The ads smoke flows\")." });
    if (!/\brequireAdsOffTestBuild\s*\(/.test(code)) report.problem({ file: runner, line: 1, rule: 'e2e-ads-off', message: 'runs the flows on whatever build it finds, without refusing one that is not the test variant with ADS_MODE=off', fix: "Restore startRun from this skill's template: requireAdsOffTestBuild(appPath, game) before the simulator is prepared (with ads off ConsentPort asks neither Google's form nor Apple's tracking prompt, and no ad SDK opens a socket)." });
  }
  if (exists(root, simulator)) {
    const code = maskComments(read(root, simulator));
    const guard = /function\s+e2eBuildProblem\b[\s\S]*?\n\}/.exec(code)?.[0] ?? '';
    if (!/appVariant\s*===\s*['"]test['"]/.test(guard) || !/adsMode\s*===\s*['"]off['"]/.test(guard)) report.problem({ file: simulator, line: 1, rule: 'e2e-ads-off', message: "e2eBuildProblem does not accept exactly appVariant 'test' with adsMode 'off'", fix: "Restore e2eBuildProblem and requireAdsOffTestBuild from this skill's template (they read EXConstants.bundle/app.config of the build)." });
  }
  const perfSteps = 'packages/tooling/src/e2e/sim-perf-steps.ts';
  if (exists(root, perfSteps)) {
    const code = maskComments(read(root, perfSteps));
    const needs = [
      [/\bjudgeColdStart\s*\(/, 'does not judge the cold starts (judgeColdStart)'],
      [/['"]footprint['"]/, 'does not measure memory with footprint'],
      [/\bjudgeMemory\s*\(/, 'does not judge the footprint (judgeMemory)'],
      [/cold-start-sim-/, 'does not read the committed perf-baselines/cold-start-sim-<game-id>.json'],
    ];
    for (const [pattern, message] of needs) if (!pattern.test(code)) report.problem({ file: perfSteps, line: 1, rule: 'runner-steps', message, fix: "Restore sim-perf-steps.ts from this skill's template." });
    if (!/\bfeedbackEvidenceOf\s*\(/.test(code) || !/feedback\.json/.test(code)) report.problem({ file: perfSteps, line: 1, rule: 'feedback-evidence', message: 'the memory step does not write feedback.json from the perf log after the smoke flows', fix: "Restore sim-perf-steps.ts from this skill's template: recordFeedback reads the perf log with feedbackEvidenceOf right after the smoke flows (check-e2e-report needs the win sound and the success haptic)." });
  }
  const capture = 'packages/tooling/src/e2e/capture-screenshots-ios.ts';
  if (exists(root, capture)) {
    const code = maskComments(read(root, capture));
    const ratio = /\bMAX_DIFF_RATIO\s*=\s*([0-9.eE+-]+)/.exec(code);
    const passes = /maxDiffRatio\s*:\s*MAX_DIFF_RATIO\b/.test(code);
    if (!ratio || !(Number(ratio[1]) <= 0.002) || !passes) report.problem({ file: capture, line: 1, rule: 'screenshot-tolerance', message: ratio ? `MAX_DIFF_RATIO is ${ratio[1]}${passes ? '' : ' or comparePng does not receive it'}, not at most 0.002` : 'has no MAX_DIFF_RATIO', fix: "Restore const MAX_DIFF_RATIO = 0.002 and maxDiffRatio: MAX_DIFF_RATIO; a tolerance changes only with the owner's agreement (Gate-Change trailer)." });
  }
  const compare = 'packages/tooling/src/visual/compare-png.ts';
  if (exists(root, compare)) {
    const threshold = /\bthreshold\s*:\s*([0-9.]+)/.exec(maskComments(read(root, compare)));
    if (!threshold || Number(threshold[1]) > 0.1) report.problem({ file: compare, line: 1, rule: 'screenshot-tolerance', message: `the pixelmatch threshold is ${threshold ? threshold[1] : 'missing'}, not at most 0.1`, fix: 'Restore threshold: 0.1 (a higher per-pixel threshold hides colour changes).' });
  }
  for (const rel of FILES.filter((file) => file.includes('/e2e/'))) {
    if (!exists(root, rel)) continue;
    const code = maskComments(read(root, rel));
    if (/['"](?:--analyze|cloud|login)['"]/.test(code)) report.problem({ file: rel, line: 1, rule: 'maestro-upload', message: 'passes --analyze, cloud or login to Maestro', fix: 'Remove it: those send the run, its screenshots or the app to Maestro\'s servers; runs stay on the Mac.' });
    if (/['"]booted['"]/.test(code)) report.problem({ file: rel, line: 1, rule: 'shared-simulator', message: 'targets the "booted" simulator', fix: 'Use ensureSimulator(\'e07-...\', model) and name its UDID in every simctl call and every Maestro run (runMaestro: --device <udid> before the command); never run on another agent\'s simulator.' });
    if (/['"]openurl['"]/.test(code)) report.problem({ file: rel, line: 1, rule: 'openurl-prompt', message: 'opens a URL with simctl openurl, which iOS answers with an "Open in <app>?" prompt that nothing accepts, so the app never gets the link', fix: 'Launch the app, then runMaestro(debugSetupArgs({ udid, app, query, waitFor, outDir })): the debug-setup sub-flow taps Open and waits for the screen.' });
  }
}

/** Every Maestro run of the repo tooling names its simulator and its own driver port first. */
function checkMaestroDevice(root, report) {
  const base = 'packages/tooling/src';
  if (!existsSync(join(root, base))) return;
  const files = walk(join(root, base), { include: ['*.ts', '*.mts'], ignore: ['*.test.ts', '*.test.mts'] }).map((rel) => ({ rel: `${base}/${rel}`, code: maskComments(read(root, `${base}/${rel}`)) }));
  for (const found of maestroSpawnProblems(files)) report.problem({ ...found, rule: 'maestro-device' });
}

const DEBUG_DIR = 'packages/shell/src/screens/debug';
const APP_DIR = 'packages/shell/src/app';
const ENTRY = `${APP_DIR}/test-only-entry.ts`;
const GUARD = `${DEBUG_DIR}/network-guard.ts`;
const SERVICES = `${DEBUG_DIR}/debug-services.ts`;
const PARSER = `${DEBUG_DIR}/debug-link.ts`;
const HANDLER = `${APP_DIR}/debug-link-handler.ts`;
const PARTS = `${APP_DIR}/create-debug-parts.ts`;
const KV_STORE = 'packages/shell/src/services/save/sqlite-kv-debug-store-adapter.ts';
const MODEL = `${DEBUG_DIR}/use-debug-model.ts`;
const ACTIONS = `${DEBUG_DIR}/debug-actions.ts`;

/** The test-only debug kit this skill ships (S15's services, link, persistence, model), by rule. */
const DEBUG_KIT = {
  'network-guard-missing': [GUARD],
  'debug-services': [`${DEBUG_DIR}/simulated-connectivity.ts`, `${DEBUG_DIR}/simulated-clock.ts`, SERVICES],
  'debug-link': [PARSER, `${DEBUG_DIR}/debug-save-recipe.ts`, HANDLER, `${APP_DIR}/debug-link-intake.ts`, `${APP_DIR}/debug-link-routes.ts`, PARTS, `${APP_DIR}/debug-services-context.tsx`],
  'debug-persistence': [`${DEBUG_DIR}/debug-overrides.ts`, KV_STORE],
  'debug-model': [MODEL, ACTIONS, `${DEBUG_DIR}/debug-tools.ts`, `${DEBUG_DIR}/debug-sheets.ts`, `${DEBUG_DIR}/debug-save-import.ts`],
};

/** Comment-masked source of a repo file, or '' when it does not exist. */
const codeOf = (root, rel) => (exists(root, rel) ? maskComments(read(root, rel)) : '');

/** Every non-test .ts/.tsx file of the Shell package (the app, the debug module, the navigator). */
function shellSources(root) {
  const base = 'packages/shell/src';
  if (!existsSync(join(root, base))) return [];
  return walk(join(root, base), { include: ['*.ts', '*.tsx'], ignore: ['*.test.ts', '*.test.tsx'] }).map((rel) => `${base}/${rel}`);
}

/** Test-only code that reaches services: the debug module and the test-only entry. */
function debugSources(root) {
  const files = listDir(join(root, DEBUG_DIR)).filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)).map((name) => `${DEBUG_DIR}/${name}`);
  return exists(root, ENTRY) ? [...files, ENTRY] : files;
}

function checkGuardInstalled(root, report) {
  if (!exists(root, GUARD)) return;
  const installs = shellSources(root).some((rel) => rel !== GUARD && /\binstallNetworkGuard\s*\(/.test(codeOf(root, rel)));
  if (!installs) report.problem({ file: GUARD, line: 1, rule: 'network-guard-missing', message: 'nothing installs the network guard, so debug.network-attempts stays 0 whatever the app does', fix: "Install it first in test builds: createDebugParts (this skill's templates/packages/shell/src/app/create-debug-parts.ts) calls TEST_ONLY.installNetworkGuard(globalThis, ...) and records each attempt with errorLog.record('network', ...)." });
  if (exists(root, ENTRY) && !/\binstallNetworkGuard\b/.test(codeOf(root, ENTRY))) report.problem({ file: ENTRY, line: 1, rule: 'network-guard-missing', message: 'does not export installNetworkGuard', fix: "Add /** @public */ export { installNetworkGuard } from '@e07/shell/screens/debug/network-guard.ts' and its TestOnlyApi field." });
}

/** The statements of one debug action, `name: (args) => { ... }`, up to its first closing brace. */
const actionBody = (code, name) => new RegExp(`\\b${name}\\s*:\\s*(?:\\([^)]*\\)|\\w+)\\s*=>\\s*\\{([^}]*)`).exec(code)?.[1] ?? '';

function checkServicesCode(root, report) {
  const problem = (message, fix) => report.problem({ file: SERVICES, line: 1, rule: 'debug-services', message, fix });
  if (!exists(root, SERVICES)) return;
  const code = codeOf(root, SERVICES);
  const persist = code.search(/\bpersistPremium\s*\(/);
  const dispatch = code.search(/['"]debug-premium-set['"]/);
  if (persist === -1 || dispatch === -1 || dispatch < persist) problem('premium=0|1 does not write the save before it dispatches debug-premium-set', "Restore setPremium from the template: persistPremium(...) first, then dispatchPremium({ type: 'debug-premium-set', isPremium }).");
  if (!/\bsetSimulatedOffline\s*\(/.test(actionBody(code, 'setOffline'))) problem('offline=0|1 does not flip SimulatedConnectivity', 'Restore setOffline from the template: connectivity.setSimulatedOffline(isOffline) tells every ConnectivityPort subscriber.');
  if (!/\bsetSimulatedToday\s*\(/.test(actionBody(code, 'setDate'))) problem('date=YYYY-MM-DD does not set the SimulatedClock', 'Restore setDate from the template: clock.setSimulatedToday(today) moves today() for the whole app (nowMs() and the countdown stay real).');
  if (!/\bcreateConsentPort\s*\(/.test(code)) problem('the debug consent port is not built with createConsentPort', 'Restore createConsent from the template: createConsentPort(adsMode, { debugGeography, onError }), so an ADS_MODE=off build never calls UMP.');
  for (const rel of debugSources(root)) {
    const source = codeOf(root, rel);
    if (/\bcreateAdmobConsentAdapter\s*\(/.test(source)) report.problem({ file: rel, line: 1, rule: 'debug-services', message: 'builds a consent port with createAdmobConsentAdapter', fix: 'Use debugServices.createConsent(geography) (createConsentPort underneath): an ADS_MODE=off build must never call Google UMP.' });
    if (/type\s*:\s*['"]premium-granted['"]/.test(source)) report.problem({ file: rel, line: 1, rule: 'debug-services', message: "dispatches 'premium-granted' from test-only code", fix: 'Use debugServices.setPremium(isPremium): the save is written first, then debug-premium-set; premium-granted belongs to the purchase service.' });
  }
}

/** The parser's READERS keys, which must be exactly the parameters check-flows accepts. */
function readerKeys(code) {
  const block = /const READERS\b[^{]*\{([\s\S]*?)\n\};/.exec(code)?.[1] ?? '';
  return new Set([...block.matchAll(/^ {2}['"]?([A-Za-z]+)['"]?\s*:/gm)].map((match) => match[1]));
}

function checkDebugLink(root, report) {
  const problem = (file, message, fix) => report.problem({ file, line: 1, rule: 'debug-link', message, fix });
  const handler = codeOf(root, HANDLER);
  if (exists(root, HANDLER) && !(/\bparseDebugLink\s*\(/.test(handler) && /\bapply\s*:/.test(handler) && /\bstart\s*:/.test(handler))) problem(HANDLER, 'does not parse the link (parseDebugLink), apply S15 requests (apply) and start listening (start)', "Restore createDebugLinkHandler from this skill's template.");
  if (exists(root, ENTRY) && !/\bcreateDebugLinkHandler\b/.test(codeOf(root, ENTRY))) problem(ENTRY, 'does not export createDebugLinkHandler, so no test build can apply a debug link', "Add /** @public */ export { createDebugLinkHandler } from '@e07/shell/app/debug-link-handler.ts' and its TestOnlyApi field.");
  const starts = shellSources(root).some((rel) => rel !== HANDLER && /\.start\(\s*Linking\s*\)/.test(codeOf(root, rel)));
  if (exists(root, HANDLER) && !starts) problem(HANDLER, 'nothing starts the handler, so every <scheme>://debug/setup link is ignored and flows wait 15 s for their screen', "Start it from the navigator's onReady: debug.links?.start(Linking) (references/debug-deep-link.md, \"Wiring\").");
  if (exists(root, PARTS) && !/\.listen\s*\(/.test(codeOf(root, PARTS))) problem(PARTS, 'createDebugParts does not start listening to Linking at once, so a link a flow sends right after launchApp (before the navigator is ready) is lost', "Restore createDebugParts from this skill's template: links.listen(input.linking ?? Linking) right after the handler is made; start() from onReady then applies the queue.");
  if (exists(root, HANDLER) && !/\bonNextNavigationState\b/.test(handler)) problem(HANDLER, 'opens screen= at once even when the same link ended the first run, before the navigator mounted the Main group, so firstRun=0&screen=game lands on Home', "Restore the template's group-switch wait: after a write that switches the group, open screen= in deps.onNextNavigationState(...).");
  if (!exists(root, PARSER)) return;
  const params = Object.keys(JSON.parse(readFileSync(join(HERE, '..', 'assets', 'debug-link-params.json'), 'utf8')).params);
  const keys = readerKeys(codeOf(root, PARSER));
  for (const name of params.filter((param) => !keys.has(param))) problem(PARSER, `has no reader for the debug parameter "${name}" that flows may send`, 'Add it to READERS with the values of debug-link-params.json and the table in references/debug-deep-link.md, in the same change.');
  for (const name of [...keys].filter((key) => !params.includes(key))) problem(PARSER, `reads the parameter "${name}", which debug-link-params.json (and so check-flows) does not know`, 'Add it to the skill assets and the reference table in the same change, or drop the reader.');
}

function checkPersistence(root, report) {
  const problem = (file, message, fix) => report.problem({ file, line: 1, rule: 'debug-persistence', message, fix });
  const services = codeOf(root, SERVICES);
  if (exists(root, SERVICES) && !(/\.get\(\s*['"]debug\.overrides['"]/.test(services) && /\.set\(\s*['"]debug\.overrides['"]/.test(services))) problem(SERVICES, 'does not read and write debug.overrides in the test-only key-value store, so the date and the flags are lost at the direction reload and on a kill', 'Restore restoreOverrides from the template: read the stored flags when the services are created, write every change at once.');
  const handler = codeOf(root, HANDLER);
  const keep = handler.search(/\.set\(\s*(?:PENDING_KEY|['"]debug\.pending-screen['"])/);
  const restart = handler.search(/\.restart\(/);
  if (exists(root, HANDLER) && (!/['"]debug\.pending-screen['"]/.test(handler) || keep === -1 || restart === -1 || keep > restart)) problem(HANDLER, 'does not keep debug.pending-screen before the direction restart, so the link\'s screen is lost after the reload', 'Restore finish() from the template: store { screen, url } first, then deps.restart(direction).');
  const kv = codeOf(root, KV_STORE);
  if (exists(root, KV_STORE) && !(/['"]expo-sqlite\/kv-store['"]/.test(kv) && /\bgetItemSync\s*\(/.test(kv) && /\bsetItemSync\s*\(/.test(kv))) problem(KV_STORE, 'does not use the synchronous expo-sqlite/kv-store calls (getItemSync, setItemSync)', 'Restore the template: the flags must be back before the first render, so an async read is too late.');
  const parts = codeOf(root, PARTS);
  if (exists(root, PARTS) && [...parts.matchAll(/\bstore\s*:\s*[\w.?]*createSqliteKvDebugStoreAdapter\s*\(/g)].length < 2) problem(PARTS, 'does not give both the debug services and the link handler the test-only key-value store', 'Restore createDebugParts from the template: store: build.api.createSqliteKvDebugStoreAdapter() for both.');
  if (exists(root, ENTRY) && !/\bcreateSqliteKvDebugStoreAdapter\b/.test(codeOf(root, ENTRY))) problem(ENTRY, 'does not export createSqliteKvDebugStoreAdapter', "Add /** @public */ export { createSqliteKvDebugStoreAdapter } from '@e07/shell/services/save/sqlite-kv-debug-store-adapter.ts' and its TestOnlyApi field.");
}

function checkModel(root, report) {
  const problem = (file, message, fix) => report.problem({ file, line: 1, rule: 'debug-model', message, fix });
  const model = codeOf(root, MODEL);
  if (!exists(root, MODEL)) return;
  if (!(/\buseDebugServices\s*\(/.test(model) && /\buseDebugLinks\s*\(/.test(model))) problem(MODEL, 'does not reach the debug state through useDebugServices() and useDebugLinks()', "Restore the template: the switches call the debug services, the tools the link handler's apply().");
  if (!/\breadDebugState\s*\([^;]*\bversion\b/.test(model)) problem(MODEL, "does not read S15's outside state (debug flags, simulated day, error and perf logs) through readDebugState(..., version), so the React Compiler of an app build keeps showing the old switches and counts after a change (no subscription tells it)", 'Restore the template: const state = readDebugState({ services, errorLog, clock }, isPremium, version), version being the useReducer refresh counter, and read every switch and count from state.');
  if (!/\bnetworkAttempts\s*:\s*(?!string\b)\S/.test(model)) problem(MODEL, "does not give S15 the network guard's counter (networkAttempts, shown as debug.network-attempts)", 'Restore networkAttempts: String(networkAttemptsOf(errorLog.entries())) from the template.');
  for (const rel of [MODEL, ACTIONS]) {
    const around = /\bcreateDebugServices\s*\(|\bcreateDebugLinkHandler\s*\(|\bsetSimulated(?:Offline|Today)\s*\(|['"]debug-premium-set['"]/.exec(codeOf(root, rel));
    if (around) problem(rel, `goes around the debug services (${around[0].replace(/\s*\($/, '')})`, 'Call debugServices.setOffline / setDate / setPremium or links.apply(request): a second path leaves the store, the ads and S12 in the old state.');
  }
}

/** The composition root (Shell step 7) brings the Shell core, the debug kit included. */
const COMPOSITION_ROOT = { file: `${APP_DIR}/create-shell-app.tsx`, step: 7 };

/**
 * The test-only debug kit is Shell core (the composition root imports createDebugParts): strict in
 * every Shell app once the composition root exists, whatever shell-slice.json holds. Only S15's model
 * hook follows the slice. With S15 in the slice (or the full Shell) everything is strict at once.
 */
function checkDebugKit(root, slice, report) {
  const modelSkip = sliceSkipReason(slice, 'S15');
  const coreSkip = modelSkip === null ? null : (sliceSkipReason(slice) ?? dueSkipReason(root, COMPOSITION_ROOT));
  if (coreSkip !== null) {
    for (const [rule, files] of Object.entries(DEBUG_KIT)) report.skip({ file: files[0], rule, message: coreSkip });
    return;
  }
  for (const [rule, files] of Object.entries(DEBUG_KIT)) {
    for (const rel of files) {
      if (rel === MODEL && modelSkip !== null) report.skip({ file: rel, rule, message: modelSkip });
      else if (!exists(root, rel)) report.problem({ file: rel, line: 0, rule, message: 'is missing', fix: `Copy it (and its test) from this skill's templates/${rel}; the debug kit is Shell core (the composition root and the debug link need all of it), and only use-debug-model.ts waits for S15.` });
    }
  }
  checkGuardInstalled(root, report);
  checkServicesCode(root, report);
  checkDebugLink(root, report);
  checkPersistence(root, report);
  if (modelSkip === null) checkModel(root, report);
}

const PERF_FILES = [...['cold-start.ts', 'perf-log.ts', 'process-start.ts', 'use-cold-start-mark.ts', 'debug-perf-actions.ts'].map((name) => `${APP_DIR}/perf/${name}`), 'packages/shell/src/services/audio/recording-feedback.ts'];
const NATIVE_FILES = ['packages/shell/expo-module.config.json', 'packages/shell/ios/E07Shell.podspec', 'packages/shell/ios/ProcessStartModule.swift'];
const START_SHELL = `${APP_DIR}/start-shell.ts`;
const HOME_MODEL = 'packages/shell/src/screens/home/use-home-model.ts';
/** What createDebugParts takes from TEST_ONLY for the perf layer, each exported by the test-only entry. */
const PERF_MEMBERS = [
  ['createPerfLog', 'the perf log (Home has no log to mark the cold start in)'],
  ['createDebugPerfActions', "S15's Performance actions (record frame times, share the report, run the save benchmark)"],
  ['recordAudioFeedback', 'the audio feedback recorder (no win sound in feedback.json)'],
  ['recordHapticsFeedback', 'the haptics feedback recorder (no success haptic in feedback.json)'],
];

/**
 * The perf layer the evidence run reads (performance-budgets' templates), in two halves. Its JS half
 * (app/perf/*.ts, the JS entry mark, the perf log, S15's Performance actions and the feedback
 * recorders the debug parts make, Home's cold-start mark) is Shell core and lands at Shell step 7 with
 * the composition root, so it is due once start-shell.ts exists. Its native half (the process-start
 * module) lands at Shell step 8 with the native plugin list and the rebuild. Without either, every E2E
 * run fails "no new cold-start entry within 30 s" or finds no feedback evidence.
 */
function checkPerfLayer(root, slice, report) {
  const problem = (file, message, fix) => report.problem({ file, line: 0, rule: 'perf-layer', message, fix });
  const fromPerf = (step) => `Copy it from performance-budgets' templates at Shell step ${step} (${step === 7 ? 'shell-perf/ into packages/shell/src/app/perf/' : 'shell-native/ into packages/shell/, then rebuild'}): the cold-start and feedback steps read it.`;
  const jsSkip = sliceSkipReason(slice) ?? dueSkipReason(root, SHELL_DUE_TARGETS.boot);
  if (jsSkip !== null) report.skip({ file: `${APP_DIR}/perf/`, rule: 'perf-layer', message: jsSkip });
  else checkPerfJsHalf(root, slice, problem, fromPerf(7));
  const nativeSkip = sliceSkipReason(slice) ?? dueSkipReason(root, SHELL_DUE_TARGETS.plugins);
  if (nativeSkip !== null) report.skip({ file: NATIVE_FILES[0], rule: 'perf-layer', message: nativeSkip });
  else for (const rel of NATIVE_FILES) if (!exists(root, rel)) problem(rel, 'is missing, so the e2e:ios cold-start step has no process start time to measure from', fromPerf(8));
  const homeSkip = sliceSkipReason(slice, 'S4');
  if (jsSkip === null && homeSkip !== null) report.skip({ file: HOME_MODEL, rule: 'perf-layer', message: homeSkip });
  else if (jsSkip === null && !/\buseColdStartMark\s*\([^;]{0,160}?perfLog/.test(codeOf(root, HOME_MODEL))) problem(HOME_MODEL, "Home does not call useColdStartMark with the debug services' perfLog, so no cold start is ever recorded", "Call useColdStartMark(useOptionalDebugServices()?.perfLog ?? null) in useHomeModel (toybox-screens' template; null in store builds).");
}

function checkPerfJsHalf(root, slice, problem, fromPerf) {
  for (const rel of PERF_FILES) if (!exists(root, rel)) problem(rel, 'is missing, so the e2e:ios cold-start and feedback steps have nothing to read', fromPerf);
  if (exists(root, START_SHELL) && !/\bmarkJsEntry\s*\(\s*\)/.test(codeOf(root, START_SHELL))) problem(START_SHELL, 'does not call markJsEntry(), so the cold start has no JS entry mark', 'Call markJsEntry() once inside startShell (start-shell.ts), right after readParityLaunch() (performance-budgets).');
  const parts = codeOf(root, PARTS);
  const entry = codeOf(root, ENTRY);
  for (const [name, what] of PERF_MEMBERS) {
    if (exists(root, PARTS) && !new RegExp(`\\b${name}\\s*\\(`).test(parts)) problem(PARTS, `createDebugParts does not make ${what} with TEST_ONLY.${name}`, "Restore createDebugParts from this skill's template: the perf log, services.perf and parts.feedback come from the test-only entry in test builds.");
    if (exists(root, ENTRY) && !new RegExp(`\\b${name}\\b`).test(entry)) problem(ENTRY, `does not export ${name}`, `Copy the shared test-only pair (ios-simulator-build's templates/packages/shell/src/app/): /** @public */ export { ${name} } from its file (performance-budgets' app/perf/, or game-audio-and-haptics' services/audio/recording-feedback.ts for the recorders), and its TestOnlyApi member.`);
  }
}

function checkPackage(root, report) {
  if (!exists(root, 'package.json')) return;
  let pkg;
  try {
    pkg = JSON.parse(read(root, 'package.json'));
  } catch (error) {
    fail(`package.json is not valid JSON: ${error.message}`, 'Fix the root package.json first.');
  }
  for (const [name, command] of Object.entries(SCRIPTS)) {
    if (pkg.scripts?.[name] !== command) report.problem({ file: 'package.json', line: 1, rule: 'e2e-script', message: `script "${name}" is ${pkg.scripts?.[name] === undefined ? 'missing' : JSON.stringify(pkg.scripts[name])}`, fix: `Set "${name}": ${JSON.stringify(command)}.` });
  }
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    if (/\bmaestro\b[^&|;]*(?:\s--analyze\b|\s(?:cloud|login)\b)/.test(String(command))) report.problem({ file: 'package.json', line: 1, rule: 'maestro-upload', message: `script "${name}" uploads to Maestro's servers: ${String(command).slice(0, 80)}`, fix: 'Remove --analyze, maestro cloud and maestro login; runs stay on the Mac.' });
  }
  if (exists(root, 'packages/tooling/src/visual/compare-png.ts')) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, version] of Object.entries(VISUAL_DEPS)) if (deps[name] !== version) report.problem({ file: 'package.json', line: 1, rule: 'visual-deps', message: `${name} is ${deps[name] === undefined ? 'missing' : `"${deps[name]}"`}, not exactly ${version}`, fix: `npm install --save-dev --save-exact ${name}@${version} (root devDependency; pixelmatch 7 is ESM-only).` });
  }
}

function checkFlowsPresent(root, slice, report) {
  for (const [rel, screens] of Object.entries(SUBFLOWS)) {
    const skipped = screens.map((id) => sliceSkipReason(slice, id)).find((reason) => reason !== null);
    if (skipped !== undefined) report.skip({ file: rel, rule: 'subflow-missing', message: skipped });
    else if (!exists(root, rel)) report.problem({ file: rel, line: 0, rule: 'subflow-missing', message: 'is missing', fix: `Copy this skill's templates/${rel}.` });
  }
}

function checkIgnore(root, report) {
  if (!exists(root, '.gitignore')) {
    report.problem({ file: '.gitignore', line: 0, rule: 'gitignore-tools', message: 'is missing', fix: 'Add a root .gitignore that lists /tools/ and reports/.' });
    return;
  }
  const lines = read(root, '.gitignore').split('\n').map((line) => line.trim());
  if (!lines.includes('/tools/') && !lines.includes('tools/')) report.problem({ file: '.gitignore', line: 1, rule: 'gitignore-tools', message: 'does not ignore /tools/', fix: 'Add /tools/ (the 315 MB Maestro install lives there).' });
  if (!lines.includes('reports/') && !lines.includes('/reports/')) report.problem({ file: '.gitignore', line: 1, rule: 'gitignore-tools', message: 'does not ignore reports/', fix: 'Add reports/ (JUnit, network.txt, raw screenshots and diffs are never committed).' });
}

const listDir = (path) => (existsSync(path) && statSync(path).isDirectory() ? readdirSync(path).sort() : []);

function checkBaselines(root, requireAll, report) {
  for (const app of listDir(join(root, 'apps'))) {
    const hasFlows = existsSync(join(root, 'apps', app, 'e2e', 'flows'));
    const base = join('apps', app, 'e2e', 'baselines');
    const sets = [];
    for (const device of listDir(join(root, base))) {
      if (device === 'boards') continue;
      for (const combo of listDir(join(root, base, device))) {
        const pngs = listDir(join(root, base, device, combo)).filter((name) => name.endsWith('.png'));
        sets.push({ device, combo, pngs });
      }
    }
    const byCombo = new Map(sets.map((set) => [`${set.device}/${set.combo}`, set.pngs]));
    const union = new Set(sets.filter((set) => !set.combo.includes('-accessibility')).flatMap((set) => set.pngs));
    for (const set of sets.filter((item) => !item.combo.includes('-accessibility'))) {
      const missing = [...union].filter((name) => !set.pngs.includes(name));
      if (missing.length > 0) report.problem({ file: `${base}/${set.device}/${set.combo}`, line: 0, rule: 'baseline-matrix', message: `lacks ${missing.length} screen(s) the other sets have: ${missing.slice(0, 4).join(', ')}`, fix: `Capture them: npm run screenshots:ios -- --app ${app} --update --devices ${set.device} --langs ${set.combo.split('-')[0]}, open every new PNG, commit with a Gate-Change trailer.` });
    }
    if (!requireAll || !hasFlows) continue;
    for (const device of DEVICES) for (const lang of LANGS) for (const theme of THEMES) {
      if (!byCombo.has(`${device}/${lang}-${theme}`)) report.problem({ file: `${base}/${device}/${lang}-${theme}`, line: 0, rule: 'baseline-matrix', message: 'the baseline set is missing', fix: `Capture it: npm run screenshots:ios -- --app ${app} --update --devices ${device} --langs ${lang}, open every PNG, commit with a Gate-Change trailer.` });
    }
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  if (!exists(root, 'package.json')) fail(`nothing to check: ${positionals[0] ?? '.'} has no package.json`, 'Run from the repo root or pass the repo root.');
  const report = createReporter({ name: SPEC.name, json: options.json });
  const slice = readShellSlice(root);
  checkInstaller(root, report);
  checkRunner(root, report);
  checkMaestroDevice(root, report);
  checkDebugKit(root, slice, report);
  checkPerfLayer(root, slice, report);
  checkPackage(root, report);
  checkFlowsPresent(root, slice, report);
  checkIgnore(root, report);
  checkBaselines(root, options.baselines, report);
  return report.finish({ checked: 1, unit: 'repo' });
});
