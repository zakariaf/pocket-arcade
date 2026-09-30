#!/usr/bin/env node
// check-audio-haptics.mjs: checks how a Pocket Arcade repo wires sound and vibration: the pinned audio
// library and its config plugin, the one AudioContext, the ports and adapters, the voice and haptic policies,
// the lifecycle, and where games and screens may fire sounds and haptics.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-audio-haptics.mjs [repo-root]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_SCAN_IGNORES, SHELL_DUE_TARGETS, createReporter, dueSkipReason, fail, lineOf, maskComments, parseArgs, readShellSlice, run, sliceSkipReason, walk } from './check-lib.mjs';

const SPEC = {
  name: 'check-audio-haptics',
  summary: 'Checks the audio and haptics wiring of a Pocket Arcade repo (packages/shell, packages/tooling, apps/*, __mocks__).',
  usage: '[options] [repo-root]',
  options: { json: { type: 'boolean', help: 'Also print the problems as one JSON line' } },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  audio-file-missing     the Shell audio/haptics files, their tests, the root mock and the WAV preview exist',
    '  audio-pin              react-native-audio-api is pinned exactly to 0.13.6 wherever it is listed (a package\'s',
    '                         peerDependencies may say "*"), and every app lists it',
    '  haptics-dependency     every app lists expo-haptics (installed with npx expo install, ~57.x)',
    '  banned-audio-package   no expo-audio, expo-av, react-native-sound, react-native-track-player, react-native-haptic-feedback',
    '  vendor-import          only the audio adapter imports react-native-audio-api, only the haptics adapter imports',
    '                         expo-haptics, and nothing imports Vibration from react-native',
    '  audio-context          exactly one `new AudioContext(` (in the adapter), created after the ambient session options',
    '  file-audio             no decodeAudioData/createStreamer and no audio files (mp3, wav, m4a, ...) outside sfx-preview/',
    '  preview-ignored        the root .gitignore ignores apps/*/sfx-preview/',
    '  audio-plugin           the react-native-audio-api config plugin overrides all five defaults and shellPlugins uses it',
    '  mic-string             no microphone purpose string unless the line cites the ITMS-90683 upload warning',
    '  music-default          DEFAULT_AUDIO_SETTINGS keeps music off; no activelyReclaimSession anywhere',
    '  voice-policy           MAX_VOICES = 8, DEFAULT_MIN_INTERVAL_MS = 30, squared channel gain, 50 ms gain ramps',
    '  haptic-throttle        MIN_HAPTIC_GAP_MS = 40',
    '  haptic-table           each HapticCue maps to its expo-haptics call',
    '  haptic-safety          the haptics adapter throttles (shouldPulse), hides on iPad (isPad) and swallows failures',
    '  cue-in-sim             no sound or haptic calls inside sims or \'worklet\' modules (fire from drained events on JS)',
    '  button-haptics         Shell UI and screens use only the selection haptic (toggles)',
    '  ui-feedback            the Shell plays each UI moment (playUiFeedback tap, toggle, win, lose) and the shared',
    '                         pressable runs usePressFeedback, so button taps, toggles and results are heard',
    '  lifecycle-mount        useAudioLifecycle is called exactly once (in the Shell app root)',
    '  dispose-before-reload  code that calls restartForDirection or reloadAppAsync awaits audio.dispose() first',
    '                         (start-shell.ts is exempt: its startup direction check runs before any audio exists)',
    '  audio-mock             the root mock adds setAudioSessionOptions and observeAudioInterruptions',
    '',
    'A game-first repo (shell-slice.json with "screens": []) has no Shell app yet. It still needs the game stage (the audio',
    'and haptics ports, their fakes, the synth, use-is-app-active and the WAV preview tooling); the Shell audio wiring',
    '(adapters, lifecycle, UI feedback, voice and haptic policies, the root mock, the config plugin, the apps listing the',
    'native modules, the one lifecycle mount) prints SKIP and counts as a pass until the Shell app exists.',
    '',
    'Rules whose target a later Shell build step creates print SKIP lines until it exists: audio-plugin until',
    'packages/shell/src/config/shell-plugins.ts (Shell step 8), ui-feedback until packages/shell/src/app/start-shell.ts',
    '(Shell step 6). Once the file exists the rule is strict.',
    '',
    'Example: node check-audio-haptics.mjs .',
  ].join('\n'),
};

const AUDIO = 'packages/shell/src/services/audio';
const HAPTICS = 'packages/shell/src/services/haptics';
const AUDIO_ADAPTER = `${AUDIO}/audio-api-audio-adapter.ts`;
const HAPTICS_ADAPTER = `${HAPTICS}/expo-haptics-adapter.ts`;
const AUDIO_MOCK = '__mocks__/react-native-audio-api.ts';
const REQUIRED = [
  `${AUDIO}/audio-port.ts`,
  `${AUDIO}/admit-voice.ts`,
  `${AUDIO}/admit-voice.test.ts`,
  AUDIO_ADAPTER,
  `${AUDIO}/audio-api-audio-adapter.test.ts`,
  `${AUDIO}/fake-audio.ts`,
  `${AUDIO}/fake-audio.test.ts`,
  `${AUDIO}/use-audio-lifecycle.ts`,
  `${AUDIO}/use-audio-lifecycle.test.ts`,
  `${AUDIO}/compose-sound-bank.ts`,
  `${AUDIO}/compose-sound-bank.test.ts`,
  `${AUDIO}/ui-feedback.ts`,
  `${AUDIO}/ui-feedback.test.ts`,
  'packages/shell/src/app/press-feedback-context.tsx',
  'packages/shell/src/app/press-feedback-context.test.tsx',
  `${AUDIO}/synth/synthesize-recipe.ts`,
  `${AUDIO}/synth/synthesize-recipe.test.ts`,
  `${AUDIO}/synth/recipe-problems.ts`,
  `${AUDIO}/synth/recipe-problems.test.ts`,
  `${AUDIO}/synth/ui-sounds.ts`,
  'packages/shell/src/app/use-is-app-active.ts',
  'packages/shell/src/app/use-is-app-active.test.ts',
  `${HAPTICS}/haptics-port.ts`,
  `${HAPTICS}/should-pulse.ts`,
  `${HAPTICS}/should-pulse.test.ts`,
  HAPTICS_ADAPTER,
  `${HAPTICS}/expo-haptics-adapter.test.ts`,
  `${HAPTICS}/fake-haptics.ts`,
  `${HAPTICS}/fake-haptics.test.ts`,
  AUDIO_MOCK,
  'packages/tooling/src/audio/encode-wav.ts',
  'packages/tooling/src/audio/encode-wav.test.ts',
  'packages/tooling/src/audio/render-sfx-wav.ts',
];
/**
 * The game stage: what a game-first repo needs before the Shell app (the board host's cue scheduler and
 * its tests use the ports and fakes, check-sound-banks runs the synth, the owner hears the WAV preview).
 * Every other REQUIRED file is Shell audio wiring, skipped while shell-slice.json has "screens": [].
 */
const GAME_STAGE = new Set([
  `${AUDIO}/audio-port.ts`,
  `${AUDIO}/fake-audio.ts`,
  `${AUDIO}/fake-audio.test.ts`,
  `${AUDIO}/synth/synthesize-recipe.ts`,
  `${AUDIO}/synth/synthesize-recipe.test.ts`,
  `${AUDIO}/synth/recipe-problems.ts`,
  `${AUDIO}/synth/recipe-problems.test.ts`,
  `${AUDIO}/synth/ui-sounds.ts`,
  'packages/shell/src/app/use-is-app-active.ts',
  'packages/shell/src/app/use-is-app-active.test.ts',
  `${HAPTICS}/haptics-port.ts`,
  `${HAPTICS}/fake-haptics.ts`,
  `${HAPTICS}/fake-haptics.test.ts`,
  'packages/tooling/src/audio/encode-wav.ts',
  'packages/tooling/src/audio/encode-wav.test.ts',
  'packages/tooling/src/audio/render-sfx-wav.ts',
]);
// The startup direction check reloads before any audio exists, so it has nothing to dispose.
const RELOAD_BEFORE_AUDIO = new Set(['packages/shell/src/app/start-shell.ts']);
const AUDIO_API_VERSION = '0.13.6';
const HAPTICS_RANGE = /^~?57\.\d+\.\d+$/;
const BANNED = ['expo-audio', 'expo-av', 'react-native-sound', 'react-native-track-player', 'react-native-haptic-feedback'];
const HAPTIC_TABLE = {
  selection: 'selectionAsync()',
  light: 'impactAsync(ImpactFeedbackStyle.Light)',
  medium: 'impactAsync(ImpactFeedbackStyle.Medium)',
  heavy: 'impactAsync(ImpactFeedbackStyle.Heavy)',
  success: 'notificationAsync(NotificationFeedbackType.Success)',
  warning: 'notificationAsync(NotificationFeedbackType.Warning)',
  error: 'notificationAsync(NotificationFeedbackType.Error)',
};
const PLUGIN_OPTIONS = [
  ['iosBackgroundMode', /\biosBackgroundMode\s*:\s*false\b/],
  ['androidPermissions', /\bandroidPermissions\s*:\s*\[\s*\]/],
  ['androidForegroundService', /\bandroidForegroundService\s*:\s*false\b/],
  ['disableFFmpeg', /\bdisableFFmpeg\s*:\s*true\b/],
  ['disableStaticExternalLibs', /\bdisableStaticExternalLibs\s*:\s*true\b/],
];
const AUDIO_FILE = /\.(mp3|wav|m4a|aac|caf|ogg|oga|flac|aif|aiff|opus)$/i;
const WORKLET_DIRECTIVE = /^(?:\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/))*\s*['"]worklet['"];/;
const IS_TEST = /\.(test|golden\.test|sim\.test)\.tsx?$/;
const UI_FEEDBACK_FILE = `${AUDIO}/ui-feedback.ts`;
const PRESS_FEEDBACK_FILE = 'packages/shell/src/app/press-feedback-context.tsx';
const UI_FEEDBACK_KINDS = { tap: 'every button press (ShellApp wraps the app in <PressFeedbackProvider onPress={() => { playUiFeedback(services, \'tap\'); }}>)', toggle: 'every toggle row and picker step', win: 'the move that wins the run (the game host\'s session controller does it once createGameHost gets feedback: { audio, haptics })', lose: 'the move that loses the run (the game host\'s session controller, the same call)' };

function readRel(root, rel) {
  const abs = join(root, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

function listDirs(root, rel) {
  const abs = join(root, rel);
  return existsSync(abs) ? readdirSync(abs, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => `${rel}/${entry.name}`).sort() : [];
}

function sourceFiles(root) {
  const bases = [...listDirs(root, 'packages').map((dir) => `${dir}/src`), ...listDirs(root, 'apps').map((dir) => `${dir}/src`), 'test', '__mocks__'];
  const files = [];
  for (const base of bases) {
    if (!existsSync(join(root, base))) continue;
    for (const rel of walk(join(root, base), { include: ['*.ts', '*.tsx'] })) files.push(`${base}/${rel}`);
  }
  return files;
}

/** Value imports of a module specifier (type-only imports are erased and always fine). */
function valueImportsOf(source, pattern) {
  const hits = [];
  const re = new RegExp(`^[ \\t]*(import|export)\\s+(?!type\\b)[^;]*?from\\s+['"](${pattern})['"]|\\brequire\\(\\s*['"](${pattern})['"]`, 'gm');
  for (const match of source.matchAll(re)) hits.push(match.index);
  return hits;
}

function checkFiles(root, shellSkip, report) {
  for (const rel of REQUIRED) {
    if (existsSync(join(root, rel))) continue;
    if (shellSkip !== null && !GAME_STAGE.has(rel)) report.skip({ file: rel, rule: 'audio-file-missing', message: `${shellSkip}: Shell audio wiring comes with the Shell app` });
    else report.problem({ file: rel, line: 0, rule: 'audio-file-missing', message: 'required audio/haptics file is missing', fix: `Copy templates/${rel} from the game-audio-and-haptics skill (verbatim, tests included).` });
  }
}

function packageFiles(root) {
  return ['package.json', ...listDirs(root, 'packages').map((dir) => `${dir}/package.json`), ...listDirs(root, 'apps').map((dir) => `${dir}/package.json`)].filter((rel) => existsSync(join(root, rel)));
}

function checkPackages(root, shellSkip, report) {
  for (const rel of packageFiles(root)) {
    const text = readFileSync(join(root, rel), 'utf8');
    let pkg;
    try {
      pkg = JSON.parse(text);
    } catch {
      report.problem({ file: rel, line: 1, rule: 'audio-pin', message: 'package.json is not valid JSON', fix: 'Fix the JSON.' });
      continue;
    }
    // A package (the Shell) lists native modules as peerDependencies "*"; the apps pin them.
    const peers = Object.fromEntries(Object.entries(pkg.peerDependencies ?? {}).filter(([, range]) => range !== '*'));
    const deps = { ...peers, ...pkg.dependencies, ...pkg.devDependencies };
    const lineOfKey = (key) => lineOf(text, Math.max(0, text.indexOf(`"${key}"`)));
    for (const name of BANNED) {
      if (deps[name] !== undefined || pkg.peerDependencies?.[name] !== undefined) report.problem({ file: rel, line: lineOfKey(name), rule: 'banned-audio-package', message: `${name} is installed`, fix: 'Remove it: sound goes through AudioPort (react-native-audio-api), vibration through HapticsPort (expo-haptics).' });
    }
    const audio = deps['react-native-audio-api'];
    const isApp = rel.startsWith('apps/');
    if (audio !== undefined && audio !== AUDIO_API_VERSION) report.problem({ file: rel, line: lineOfKey('react-native-audio-api'), rule: 'audio-pin', message: `react-native-audio-api is "${audio}", not exactly ${AUDIO_API_VERSION}`, fix: `npm install --save-exact react-native-audio-api@${AUDIO_API_VERSION} (pre-1.0: minors break APIs; re-verify before any bump).` });
    // The app lists the native modules for the Shell app build; a game-first repo has none yet (wrong pins still fail).
    const unlisted = (rule, name) => report.skip({ file: rel, rule, message: `${shellSkip}: the app lists ${name} when the Shell app arrives` });
    if (isApp && audio === undefined) {
      if (shellSkip !== null) unlisted('audio-pin', 'react-native-audio-api');
      else report.problem({ file: rel, line: 1, rule: 'audio-pin', message: 'the app does not list react-native-audio-api', fix: `Add "react-native-audio-api": "${AUDIO_API_VERSION}" to the app's dependencies (native modules autolink per app).` });
    }
    const haptics = deps['expo-haptics'];
    if (isApp && haptics === undefined && shellSkip !== null) unlisted('haptics-dependency', 'expo-haptics');
    else if (isApp && (haptics === undefined || !HAPTICS_RANGE.test(haptics))) report.problem({ file: rel, line: haptics === undefined ? 1 : lineOfKey('expo-haptics'), rule: 'haptics-dependency', message: haptics === undefined ? 'the app does not list expo-haptics' : `expo-haptics is "${haptics}", not the SDK 57 range`, fix: 'Run `npx expo install expo-haptics` inside the app (writes ~57.0.3).' });
  }
}

function checkImports(root, files, report) {
  let contexts = 0;
  for (const rel of files) {
    const raw = readFileSync(join(root, rel), 'utf8');
    const source = maskComments(raw);
    const isTest = IS_TEST.test(rel);
    if (rel !== AUDIO_ADAPTER && rel !== AUDIO_MOCK) {
      for (const index of valueImportsOf(source, 'react-native-audio-api(?:/[^\'"]*)?')) report.problem({ file: rel, line: lineOf(source, index), rule: 'vendor-import', message: 'imports react-native-audio-api outside the audio adapter', fix: 'Use AudioPort (useServices().audio); tests use createFakeAudio().' });
    }
    if (rel !== HAPTICS_ADAPTER) {
      for (const index of valueImportsOf(source, 'expo-haptics')) report.problem({ file: rel, line: lineOf(source, index), rule: 'vendor-import', message: 'imports expo-haptics outside the haptics adapter', fix: 'Use HapticsPort (useServices().haptics); tests use createFakeHaptics() or jest.mock + jest.requireMock.' });
    }
    for (const match of source.matchAll(/import\s*\{[^}]*\bVibration\b[^}]*\}\s*from\s*['"]react-native['"]/g)) report.problem({ file: rel, line: lineOf(source, match.index), rule: 'vendor-import', message: 'imports Vibration from react-native', fix: 'Vibrate only through HapticsPort cues (selection, light, medium, heavy, success, warning, error).' });
    for (const match of source.matchAll(/\bnew\s+AudioContext\s*\(/g)) {
      contexts += 1;
      if (rel !== AUDIO_ADAPTER) report.problem({ file: rel, line: lineOf(source, match.index), rule: 'audio-context', message: 'creates an AudioContext outside the adapter', fix: 'The app has exactly one AudioContext, inside audio-api-audio-adapter.ts.' });
    }
    if (!isTest) {
      for (const match of source.matchAll(/\b(decodeAudioData|decodePCMInBase64|createStreamer)\b/g)) report.problem({ file: rel, line: lineOf(source, match.index), rule: 'file-audio', message: `uses ${match[1]} (file, URL or stream audio)`, fix: 'Every sound is a synthesized SoundRecipe; buffers come only from synthesizeRecipe.' });
    }
    for (const match of source.matchAll(/\bactivelyReclaimSession\b/g)) report.problem({ file: rel, line: lineOf(source, match.index), rule: 'music-default', message: 'uses activelyReclaimSession', fix: 'Never: it stops the engine when other audio plays. Music stays off by default instead.' });
  }
  return contexts;
}

function checkAdapter(root, contexts, report) {
  const raw = readRel(root, AUDIO_ADAPTER);
  if (raw === null) return;
  const source = maskComments(raw);
  const ctxIndex = source.search(/\bnew\s+AudioContext\s*\(/);
  const sessionIndex = source.search(/\bsetAudioSessionOptions\s*\(/);
  if (contexts !== 1 || ctxIndex === -1) report.problem({ file: AUDIO_ADAPTER, line: ctxIndex === -1 ? 1 : lineOf(source, ctxIndex), rule: 'audio-context', message: `found ${contexts} \`new AudioContext(\` in the repo, expected exactly 1 (in the adapter)`, fix: 'Create the one context in createGraph() of the adapter and nowhere else.' });
  if (sessionIndex === -1 || (ctxIndex !== -1 && sessionIndex > ctxIndex) || !/iosCategory\s*:\s*['"]ambient['"]/.test(source)) {
    report.problem({ file: AUDIO_ADAPTER, line: ctxIndex === -1 ? 1 : lineOf(source, ctxIndex), rule: 'audio-context', message: "the ambient session (setAudioSessionOptions({ iosCategory: 'ambient', ... })) is not set before the context is created", fix: "Call AudioManager.setAudioSessionOptions({ iosCategory: 'ambient', iosMode: 'default', iosOptions: [] }) first: ambient respects the silent switch and mixes with the player's music." });
  }
  const ramp = /\bRAMP_S\s*=\s*0\.05\b/.test(source) && /linearRampToValueAtTime/.test(source);
  if (!ramp) report.problem({ file: AUDIO_ADAPTER, line: 1, rule: 'voice-policy', message: 'gain changes do not ramp over 50 ms (RAMP_S = 0.05 with linearRampToValueAtTime)', fix: 'Keep rampTo(): an instant gain jump clicks.' });
}

function expectPattern(root, rel, pattern, rule, message, fix, report) {
  const raw = readRel(root, rel);
  if (raw === null) return;
  if (!pattern.test(maskComments(raw))) report.problem({ file: rel, line: 1, rule, message, fix });
}

function checkPolicies(root, report) {
  expectPattern(root, `${AUDIO}/audio-port.ts`, /\bmusic\s*:\s*\{\s*isOn\s*:\s*false\b/, 'music-default', 'DEFAULT_AUDIO_SETTINGS does not keep music off', 'Set music: { isOn: false, volume: 0.6 }: game music must never play over the player\'s own music unless they turn it on.', report);
  const admit = `${AUDIO}/admit-voice.ts`;
  expectPattern(root, admit, /\bMAX_VOICES\s*=\s*8\b/, 'voice-policy', 'MAX_VOICES is not 8', 'Keep at most 8 overlapping voices so cascades never pile up.', report);
  expectPattern(root, admit, /\bDEFAULT_MIN_INTERVAL_MS\s*=\s*30\b/, 'voice-policy', 'DEFAULT_MIN_INTERVAL_MS is not 30', 'The same sound restarts at most once per 30 ms (or its minIntervalMs).', report);
  expectPattern(root, admit, /setting\.volume\s*\*\s*setting\.volume/, 'voice-policy', 'channelGain does not square the slider', 'Return setting.isOn ? setting.volume * setting.volume : 0 (a squared slider sounds even).', report);
  expectPattern(root, `${HAPTICS}/should-pulse.ts`, /\bMIN_HAPTIC_GAP_MS\s*=\s*40\b/, 'haptic-throttle', 'MIN_HAPTIC_GAP_MS is not 40', 'Keep 40 ms: closer pulses feel like a mushy buzz.', report);
  const rawMock = readRel(root, AUDIO_MOCK);
  const mock = rawMock === null ? null : maskComments(rawMock);
  if (mock !== null && !(/\bsetAudioSessionOptions\b/.test(mock) && /\bobserveAudioInterruptions\b/.test(mock))) report.problem({ file: AUDIO_MOCK, line: 1, rule: 'audio-mock', message: 'the root mock does not add AudioManager.setAudioSessionOptions and observeAudioInterruptions', fix: 'Copy templates/__mocks__/react-native-audio-api.ts: the library mock (0.13.6) lacks both, so the adapter test would fail.' });
}

function checkHaptics(root, report) {
  const raw = readRel(root, HAPTICS_ADAPTER);
  if (raw === null) return;
  const source = maskComments(raw);
  const found = {};
  for (const match of source.matchAll(/case\s+['"](\w+)['"]\s*:\s*return\s+([^;]+);/g)) found[match[1]] = { call: match[2].replace(/\s+/g, ''), line: lineOf(source, match.index) };
  for (const [cue, call] of Object.entries(HAPTIC_TABLE)) {
    const got = found[cue];
    if (got === undefined) report.problem({ file: HAPTICS_ADAPTER, line: 1, rule: 'haptic-table', message: `cue '${cue}' is not mapped`, fix: `case '${cue}': return ${call};` });
    else if (got.call !== call) report.problem({ file: HAPTICS_ADAPTER, line: got.line, rule: 'haptic-table', message: `cue '${cue}' calls ${got.call}, expected ${call}`, fix: 'Follow the haptic cue table (references/haptics.md).' });
  }
  const safety = [
    [/\bshouldPulse\s*\(/, 'does not gate pulses through shouldPulse (Vibration setting + 40 ms throttle)'],
    [/\bisPad\b/, 'does not report isSupported = false on iPad'],
    [/\.catch\(\s*\(\)\s*=>\s*undefined\s*\)/, 'does not end the native call with .catch(() => undefined)'],
  ];
  for (const [pattern, message] of safety) {
    if (!pattern.test(source)) report.problem({ file: HAPTICS_ADAPTER, line: 1, rule: 'haptic-safety', message, fix: 'Copy templates/packages/shell/src/services/haptics/expo-haptics-adapter.ts.' });
  }
}

function checkConfig(root, shellSkip, report) {
  const configDir = 'packages/shell/src/config';
  const configFiles = existsSync(join(root, configDir)) ? walk(join(root, configDir), { include: ['*.ts'] }).map((rel) => `${configDir}/${rel}`) : [];
  let pluginFile = null;
  for (const rel of configFiles) {
    const source = maskComments(readFileSync(join(root, rel), 'utf8'));
    const at = source.search(/\[\s*['"]react-native-audio-api['"]\s*,/);
    if (at === -1) continue;
    pluginFile = rel;
    const block = source.slice(at, source.indexOf(']', source.indexOf('}', at)) + 1);
    const line = lineOf(source, source.indexOf('react-native-audio-api', at));
    for (const [name, pattern] of PLUGIN_OPTIONS) {
      if (!pattern.test(block)) report.problem({ file: rel, line, rule: 'audio-plugin', message: `the react-native-audio-api plugin does not set ${name} to its safe value`, fix: 'Use AUDIO_API_PLUGIN from templates/packages/shell/src/config/audio-config.ts (no background audio, no Android permissions, no downloads).' });
    }
  }
  // The one plugin list (shell-plugins.ts) arrives at Shell step 8: until then the entry is not due.
  const pluginsDue = dueSkipReason(root, SHELL_DUE_TARGETS.plugins);
  if (pluginFile === null && shellSkip !== null) report.skip({ file: `${configDir}/audio-config.ts`, rule: 'audio-plugin', message: `${shellSkip}: withShell and its plugins come with the Shell app` });
  else if (pluginsDue !== null) report.skip({ file: SHELL_DUE_TARGETS.plugins.file, rule: 'audio-plugin', message: pluginsDue });
  else if (pluginFile === null) report.problem({ file: `${configDir}/audio-config.ts`, line: 0, rule: 'audio-plugin', message: 'no react-native-audio-api config plugin entry in packages/shell/src/config/', fix: 'Copy templates/packages/shell/src/config/audio-config.ts and add AUDIO_API_PLUGIN to shellPlugins (shell-plugins.ts, the one plugin list).' });
  else {
    const defining = maskComments(readFileSync(join(root, pluginFile), 'utf8'));
    const at = defining.search(/\bexport\s+const\s+AUDIO_API_PLUGIN\b/);
    const isUsed = configFiles.some((rel) => rel !== pluginFile && /\bAUDIO_API_PLUGIN\b/.test(maskComments(readFileSync(join(root, rel), 'utf8'))));
    if (at !== -1 && !isUsed) report.problem({ file: pluginFile, line: lineOf(defining, at), rule: 'audio-plugin', message: 'AUDIO_API_PLUGIN is defined but no other config file (withShell or its plugin list) uses it', fix: 'Import AUDIO_API_PLUGIN from ./audio-config.ts in with-shell.ts (or its shellPlugins list) and put it in plugins: without it every default applies (background audio, downloads).' });
  }
  const micFiles = [...configFiles, ...listDirs(root, 'apps').flatMap((dir) => ['app.config.ts', 'game.config.ts', 'app.json'].map((name) => `${dir}/${name}`))].filter((rel) => existsSync(join(root, rel)));
  for (const rel of micFiles) {
    const raw = readFileSync(join(root, rel), 'utf8');
    const lines = raw.split('\n');
    maskComments(raw).split('\n').forEach((code, index) => {
      if (!/NSMicrophoneUsageDescription|iosMicrophonePermission/.test(code)) return;
      const line = lines[index] ?? '';
      if (/ITMS-90683/.test(line) || /ITMS-90683/.test(lines[index - 1] ?? '')) return;
      report.problem({ file: rel, line: index + 1, rule: 'mic-string', message: 'adds a microphone purpose string up front', fix: 'Remove it. Only if an App Store upload reports ITMS-90683, set the plugin option iosMicrophonePermission with a comment naming ITMS-90683.' });
    });
  }
}

function checkAssets(root, report) {
  const bases = [...listDirs(root, 'apps'), ...listDirs(root, 'packages')];
  for (const base of bases) {
    for (const rel of walk(join(root, base), { ignore: [...REPO_SCAN_IGNORES, 'sfx-preview', 'dist'] })) {
      if (AUDIO_FILE.test(rel)) report.problem({ file: `${base}/${rel}`, line: 0, rule: 'file-audio', message: 'ships an audio file', fix: 'Delete it and write a SoundRecipe instead (no audio files, no licences to track).' });
    }
  }
  if (listDirs(root, 'apps').length === 0) return;
  const ignore = readRel(root, '.gitignore');
  if (ignore === null || !/sfx-preview/.test(ignore)) report.problem({ file: '.gitignore', line: 0, rule: 'preview-ignored', message: 'the root .gitignore does not ignore the WAV previews', fix: 'Add the line apps/*/sfx-preview/ to the root .gitignore.' });
}

function checkCallSites(root, files, shellSkip, report) {
  let mounts = 0;
  for (const rel of files) {
    if (IS_TEST.test(rel)) continue;
    const raw = readFileSync(join(root, rel), 'utf8');
    const source = maskComments(raw);
    const isSim = /^apps\/[^/]+\/src\/sim\//.test(rel) || WORKLET_DIRECTIVE.test(raw);
    if (isSim) {
      for (const match of source.matchAll(/\b(haptics|audio)\s*\.\s*(play|startMusic)\s*\(/g)) report.problem({ file: rel, line: lineOf(source, match.index), rule: 'cue-in-sim', message: `calls ${match[1]}.${match[2]} inside a sim or 'worklet' module`, fix: 'Emit an event; the host drains events once per frame on JS and plays sounds and haptics from them (never per tick).' });
    }
    if (/^packages\/shell\/src\/(ui|screens)\//.test(rel)) {
      for (const match of source.matchAll(/\bhaptics\s*\.\s*play\s*\(\s*['"](\w+)['"]/g)) {
        if (match[1] !== 'selection') report.problem({ file: rel, line: lineOf(source, match.index), rule: 'button-haptics', message: `UI fires the '${match[1]}' haptic`, fix: "Buttons use no haptics; toggles may use 'selection'. Gameplay haptics come from timeline cues." });
      }
    }
    if (rel.startsWith('packages/shell/src/') && rel !== `${AUDIO}/use-audio-lifecycle.ts`) mounts += [...source.matchAll(/\buseAudioLifecycle\s*\(/g)].length;
    const defines = /function\s+restartForDirection\b/.test(source);
    const call = source.search(/\b(restartForDirection|reloadAppAsync)\s*\(/);
    if (!defines && !RELOAD_BEFORE_AUDIO.has(rel) && call !== -1 && (rel.startsWith('packages/shell/src/') || rel.startsWith('apps/'))) {
      // audio.dispose(), services.audio.dispose() or audio?.dispose(); a Skia image's dispose() does not count.
      const dispose = source.search(/\baudio\s*\??\.\s*dispose\s*\(\s*\)/);
      if (dispose === -1 || dispose > call) report.problem({ file: rel, line: lineOf(source, call), rule: 'dispose-before-reload', message: 'reloads the app without awaiting audio.dispose() first', fix: 'await audio.dispose() before restartForDirection/reloadAppAsync, so the native engine closes before the JS reload.' });
    }
  }
  checkUiFeedback(root, files, report);
  if (mounts === 0 && shellSkip !== null) report.skip({ file: 'packages/shell/src/app', rule: 'lifecycle-mount', message: `${shellSkip}: the Shell app root mounts useAudioLifecycle` });
  else if (mounts !== 1) report.problem({ file: 'packages/shell/src/app', line: 0, rule: 'lifecycle-mount', message: `useAudioLifecycle is called ${mounts} times, expected once`, fix: 'Call useAudioLifecycle({ audio, isFullscreenAdShowing, reportError }) once, in the Shell app root (ShellApp).' });
}

/** The text between a call's opening parenthesis (at `from`) and its matching closing one. */
function callArguments(source, from) {
  let depth = 1;
  for (let i = from; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')' && (depth -= 1) === 0) return source.slice(from, i);
  }
  return '';
}

/** Every Shell feedback moment is played somewhere, and a Pressable host runs the press feedback. */
function checkUiFeedback(root, files, report) {
  if (!existsSync(join(root, UI_FEEDBACK_FILE))) return;
  // The Shell's boot (start-shell.ts, Shell step 6) and the screens that play these come later.
  const bootDue = dueSkipReason(root, SHELL_DUE_TARGETS.boot);
  if (bootDue !== null) {
    report.skip({ file: UI_FEEDBACK_FILE, rule: 'ui-feedback', message: bootDue });
    return;
  }
  const played = new Set();
  let isPressWired = false;
  for (const rel of files) {
    if (IS_TEST.test(rel) || !rel.startsWith('packages/shell/src/') || rel === UI_FEEDBACK_FILE) continue;
    const source = maskComments(readFileSync(join(root, rel), 'utf8'));
    // Every kind literal inside the call counts, so playUiFeedback(services, isWon ? 'win' : 'lose') plays both.
    for (const match of source.matchAll(/\bplayUiFeedback\s*\(/g)) {
      for (const kind of callArguments(source, match.index + match[0].length).matchAll(/['"](tap|toggle|win|lose)['"]/g)) played.add(kind[1]);
    }
    if (rel !== PRESS_FEEDBACK_FILE && /\busePressFeedback\s*\(/.test(source)) isPressWired = true;
  }
  for (const [kind, where] of Object.entries(UI_FEEDBACK_KINDS)) {
    if (!played.has(kind)) report.problem({ file: UI_FEEDBACK_FILE, line: 0, rule: 'ui-feedback', message: `the Shell never plays its '${kind}' feedback (ui.${kind})`, fix: `Call playUiFeedback(services, '${kind}') on ${where}; see references/audio-architecture.md, "UI feedback".` });
  }
  if (!isPressWired) report.problem({ file: PRESS_FEEDBACK_FILE, line: 0, rule: 'ui-feedback', message: 'no Shell component calls usePressFeedback(), so button taps are silent', fix: 'In the Pressable hosts (raised-surface.tsx, quiet-button.tsx, list-row.tsx) call const onPressFeedback = usePressFeedback(); and run it in onPress (not for switch rows, which play the toggle feedback).' });
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = positionals[0] ?? '.';
  if (!existsSync(join(root, 'packages/shell/src'))) fail(`nothing to check: ${root} has no packages/shell/src (not a Pocket Arcade repo root)`, 'Run from the app repo root, or pass its path.');
  const report = createReporter({ name: 'check-audio-haptics', json: options.json });
  // A game-first repo ("screens": []) has no Shell app yet: its audio wiring is skipped (D10).
  const shellSkip = sliceSkipReason(readShellSlice(root));
  const files = sourceFiles(root);
  checkFiles(root, shellSkip, report);
  checkPackages(root, shellSkip, report);
  const contexts = checkImports(root, files, report);
  checkAdapter(root, contexts, report);
  checkPolicies(root, report);
  checkHaptics(root, report);
  checkConfig(root, shellSkip, report);
  checkAssets(root, report);
  checkCallSites(root, files, shellSkip, report);
  return report.finish({ checked: files.length, unit: 'source files' });
});
