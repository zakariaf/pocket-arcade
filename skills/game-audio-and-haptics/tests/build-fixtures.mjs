#!/usr/bin/env node
// build-fixtures.mjs: rebuilds tests/fixtures/ for both checkers of this skill.
// The good repos are the skill's own templates laid out as an app repo (so the templates are proven to
// pass), plus small stubs for the files other skills own. Every bad-* fixture is a copy of good with ONE
// planted bug; its EXPECT.txt names the rule and the exact file:line, computed from the planted text.
// Run after changing a template or a checker: node tests/build-fixtures.mjs && node scripts/selftest.mjs

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(HERE, '..', 'templates');
const FIXTURES = join(HERE, 'fixtures');
const GAME = 'demo-game';

function write(dir, rel, text) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), text);
}

function read(dir, rel) {
  return readFileSync(join(dir, rel), 'utf8');
}

function replace(dir, rel, from, to) {
  const text = read(dir, rel);
  if (!text.includes(from)) throw new Error(`fixture builder: "${from}" not found in ${rel}`);
  write(dir, rel, text.replace(from, to));
}

/** 1-based line of the first occurrence of `marker` in a fixture file. */
function lineOf(dir, rel, marker) {
  const text = read(dir, rel);
  const index = text.indexOf(marker);
  if (index === -1) throw new Error(`fixture builder: marker "${marker}" not found in ${rel}`);
  return text.slice(0, index).split('\n').length;
}

const TIMELINE = `// apps/${GAME}/src/board/build-timeline.ts
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { DemoEvent } from '@e07/${GAME}/rules/demo-types.ts';

/** Pure: events to tracks; sounds and haptics ride on the track cues (the Tap Flip template game). */
export function buildTimeline(events: readonly DemoEvent[], motion: Motion): readonly Track[] {
  const scale = motion === 'full' ? 1 : 0.5;
  return events.map((event, index): Track => {
    switch (event.kind) {
      case 'cells-flipped':
        return { channel: 'flip', entityId: index, startMs: 0, durationMs: 200 * scale, easing: 'in-out-quad', from: [-1], to: [1], cue: { sound: 'flip', haptic: 'light' } };
      case 'board-cleared':
        return { channel: 'glow', entityId: index, startMs: 320 * scale, durationMs: 400 * scale, easing: 'out-quad', from: [1], to: [0], cue: { sound: 'clear', haptic: 'success' } };
      case 'moves-added':
        return { channel: 'bonus', entityId: index, startMs: 0, durationMs: 600 * scale, easing: 'out-back', from: [0.6], to: [1], cue: { sound: 'bonus', haptic: 'medium' } };
    }
  });
}
`;

const INDEX = `// apps/${GAME}/src/index.ts
import { SOUND_BANK } from './sounds/sound-bank.ts';

/** The game module handed to startShell (other members omitted in this fixture). */
export const DEMO_PRESENTATION = { sounds: SOUND_BANK } as const;
`;

const SHELL_APP = `// packages/shell/src/app/shell-app.tsx
import { PressFeedbackProvider } from '@e07/shell/app/press-feedback-context.tsx';
import { playUiFeedback } from '@e07/shell/services/audio/ui-feedback.ts';
import { useAudioLifecycle } from '@e07/shell/services/audio/use-audio-lifecycle.ts';

import type { Services } from './services-context.tsx';
import type { ReactNode } from 'react';

type ShellAppProps = {
  readonly services: Services;
  readonly isFullscreenAdShowing: boolean;
  readonly children: ReactNode;
};

/** The composition root's component: mounts the audio lifecycle once and gives buttons their tap. */
export function ShellApp(props: ShellAppProps): ReactNode {
  useAudioLifecycle({
    audio: props.services.audio,
    isFullscreenAdShowing: props.isFullscreenAdShowing,
    reportError: (error) => props.services.errorLog.record('audio', error),
  });
  return (
    <PressFeedbackProvider onPress={() => playUiFeedback(props.services, 'tap')}>
      {props.children}
    </PressFeedbackProvider>
  );
}
`;

// toybox-design-system's shared pressable: every button press runs the press feedback.
const RAISED_SURFACE = `// packages/shell/src/ui/raised-surface.tsx
import { usePressFeedback } from '@e07/shell/app/press-feedback-context.tsx';

/** Every Toybox button presses through here, so every press sounds ui.tap. */
export function useRaisedPress(onPress: () => void): () => void {
  const onPressFeedback = usePressFeedback();
  return () => {
    onPressFeedback();
    onPress();
  };
}
`;

const FINISH_RUN = `// packages/shell/src/game-host/finish-run.ts
import { playUiFeedback } from '@e07/shell/services/audio/ui-feedback.ts';

import type { FeedbackPorts } from '@e07/shell/services/audio/ui-feedback.ts';

/** The run's result is decided: one win or lose sound and pulse, before the Result screen. */
export function finishRun(ports: FeedbackPorts, isWon: boolean): void {
  playUiFeedback(ports, isWon ? 'win' : 'lose');
}
`;

const SETTINGS_TOGGLE = `// packages/shell/src/screens/settings/on-setting-toggled.ts
import { playUiFeedback } from '@e07/shell/services/audio/ui-feedback.ts';

import type { FeedbackPorts } from '@e07/shell/services/audio/ui-feedback.ts';

/** A settings switch flipped: the toggle sound and the selection pulse. */
export function onSettingToggled(ports: FeedbackPorts): void {
  playUiFeedback(ports, 'toggle');
}
`;

// The Shell's one plugin list (shell-plugins.ts, Shell step 8) takes the audio plugin from audio-config.ts.
const SHELL_PLUGINS = `// packages/shell/src/config/shell-plugins.ts
import { AUDIO_API_PLUGIN } from './audio-config.ts';

import type { ExpoConfig } from 'expo/config';

/** Excerpt: the native plugin list every app gets (withShell spreads it). */
export function shellPlugins(): NonNullable<ExpoConfig['plugins']> {
  return [AUDIO_API_PLUGIN];
}
`;

const SHELL_PACKAGE = `{
  "name": "@e07/shell",
  "private": true,
  "peerDependencies": {
    "expo-haptics": "*",
    "react-native-audio-api": "*"
  }
}
`;

const LANGUAGE_CHANGE = `// packages/shell/src/app/language-change.ts
import { restartForDirection } from '@e07/shell/i18n/direction.ts';

import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';

/** Restart now: close the native audio engine, then reload in the new direction. */
export async function restartNow(audio: AudioPort, isRtl: boolean): Promise<void> {
  await audio.dispose();
  await restartForDirection(isRtl);
}
`;

const DIRECTION = `// packages/shell/src/i18n/direction.ts
import { reloadAppAsync } from 'expo';

/** Applies the layout direction and reloads the JS bundle (callers dispose audio first). */
export async function restartForDirection(isRtl: boolean): Promise<void> {
  if (isRtl) await reloadAppAsync('direction');
}
`;

// A real-time host maps drained events to both ports; haptics.play('heavy') is not a sound cue.
const ON_EVENTS = `// apps/${GAME}/src/board/on-events.ts
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';

/** Drained sim events to sounds and haptics, once per frame on JS (never per tick). */
export function onHit(audio: AudioPort, haptics: HapticsPort): void {
  audio.play('flip');
  haptics.play('heavy');
}
`;

// The rtl-and-direction entry: its startup direction check reloads before any audio exists.
const START_SHELL = `// packages/shell/src/app/start-shell.ts
import { restartForDirection } from '@e07/shell/i18n/direction.ts';

/** Startup direction check: runs before the composition root creates audio, so nothing to dispose. */
export function startShell(needsRestart: boolean, isRtl: boolean): void {
  if (needsRestart) restartForDirection(isRtl).catch(() => undefined);
}
`;

const TOGGLE_ROW = `// packages/shell/src/ui/toggle-row.tsx
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';

/** A settings toggle: the only UI element that pulses (selection). */
export function onToggle(haptics: HapticsPort): void {
  haptics.play('selection');
}
`;

const GAME_PACKAGE = `{
  "name": "@e07/${GAME}",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "expo": "~57.0.25",
    "expo-haptics": "~57.0.3",
    "react-native-audio-api": "0.13.6"
  }
}
`;

function buildAudioGood(dir) {
  cpSync(TEMPLATES, dir, { recursive: true });
  rmSync(join(dir, 'apps', '__GAME_ID__'), { recursive: true, force: true });
  for (const name of ['sound-bank.ts', 'sound-bank.test.ts']) {
    write(dir, `apps/${GAME}/src/sounds/${name}`, read(TEMPLATES, `apps/__GAME_ID__/src/sounds/${name}`).replaceAll('__GAME_ID__', GAME));
  }
  write(dir, `apps/${GAME}/src/board/build-timeline.ts`, TIMELINE);
  write(dir, `apps/${GAME}/src/index.ts`, INDEX);
  write(dir, `apps/${GAME}/src/board/on-events.ts`, ON_EVENTS);
  write(dir, `apps/${GAME}/package.json`, GAME_PACKAGE);
  write(dir, `apps/${GAME}/sfx-preview/flip.wav`, 'RIFF preview (ignored)');
  write(dir, 'package.json', '{\n  "name": "e07-games",\n  "private": true,\n  "workspaces": ["apps/*", "packages/*"]\n}\n');
  write(dir, 'packages/shell/package.json', SHELL_PACKAGE);
  write(dir, 'packages/shell/src/app/shell-app.tsx', SHELL_APP);
  write(dir, 'packages/shell/src/ui/raised-surface.tsx', RAISED_SURFACE);
  write(dir, 'packages/shell/src/game-host/finish-run.ts', FINISH_RUN);
  write(dir, 'packages/shell/src/screens/settings/on-setting-toggled.ts', SETTINGS_TOGGLE);
  write(dir, 'packages/shell/src/config/shell-plugins.ts', SHELL_PLUGINS);
  write(dir, 'packages/shell/src/app/language-change.ts', LANGUAGE_CHANGE);
  write(dir, 'packages/shell/src/app/start-shell.ts', START_SHELL);
  write(dir, 'packages/shell/src/i18n/direction.ts', DIRECTION);
  write(dir, 'packages/shell/src/ui/toggle-row.tsx', TOGGLE_ROW);
  write(dir, '.gitignore', 'node_modules/\nreports/\napps/*/sfx-preview/\n');
}

function buildBanksGood(dir) {
  const ui = 'packages/shell/src/services/audio/synth/ui-sounds.ts';
  write(dir, ui, read(TEMPLATES, ui));
  for (const name of ['sound-bank.ts', 'sound-bank.test.ts']) {
    write(dir, `apps/${GAME}/src/sounds/${name}`, read(TEMPLATES, `apps/__GAME_ID__/src/sounds/${name}`).replaceAll('__GAME_ID__', GAME));
  }
  write(dir, `apps/${GAME}/src/board/build-timeline.ts`, TIMELINE);
  write(dir, `apps/${GAME}/src/index.ts`, INDEX);
  write(dir, `apps/${GAME}/src/board/on-events.ts`, ON_EVENTS);
}

const ADAPTER = 'packages/shell/src/services/audio/audio-api-audio-adapter.ts';
const HAPTICS = 'packages/shell/src/services/haptics/expo-haptics-adapter.ts';
const APP_PKG = `apps/${GAME}/package.json`;
const CONFIG = 'packages/shell/src/config/audio-config.ts';
const BANK = `apps/${GAME}/src/sounds/sound-bank.ts`;
const TIMELINE_FILE = `apps/${GAME}/src/board/build-timeline.ts`;

/** Each case: plant one bug, return [rule, file:line or file, message fragment...] to expect. */
const AUDIO_CASES = {
  'file-missing': (dir) => {
    rmSync(join(dir, 'packages/shell/src/services/haptics/should-pulse.test.ts'));
    return ['[audio-file-missing]', 'packages/shell/src/services/haptics/should-pulse.test.ts'];
  },
  'audio-pin': (dir) => {
    replace(dir, APP_PKG, '"react-native-audio-api": "0.13.6"', '"react-native-audio-api": "^0.13.6"');
    return ['[audio-pin]', `${APP_PKG}:${lineOf(dir, APP_PKG, 'react-native-audio-api')}`];
  },
  'haptics-dependency': (dir) => {
    replace(dir, APP_PKG, '    "expo-haptics": "~57.0.3",\n', '');
    return ['[haptics-dependency]', `${APP_PKG}:1`, 'does not list expo-haptics'];
  },
  'banned-package': (dir) => {
    replace(dir, APP_PKG, '"expo": "~57.0.25",', '"expo": "~57.0.25",\n    "expo-audio": "~57.0.5",');
    return ['[banned-audio-package]', `${APP_PKG}:${lineOf(dir, APP_PKG, 'expo-audio')}`];
  },
  'audio-import': (dir) => {
    const rel = 'packages/shell/src/screens/home/home-sound.ts';
    write(dir, rel, "// packages/shell/src/screens/home/home-sound.ts\nimport { AudioManager } from 'react-native-audio-api';\n\nexport const isReady = AudioManager !== undefined;\n");
    return ['[vendor-import]', `${rel}:2`, 'outside the audio adapter'];
  },
  'haptics-import': (dir) => {
    const rel = `apps/${GAME}/src/board/shake.ts`;
    write(dir, rel, `// ${rel}\nimport { impactAsync } from 'expo-haptics';\n\nexport const shake = (): Promise<void> => impactAsync();\n`);
    return ['[vendor-import]', `${rel}:2`, 'outside the haptics adapter'];
  },
  'vibration-import': (dir) => {
    const rel = `apps/${GAME}/src/board/buzz.ts`;
    write(dir, rel, `// ${rel}\nimport { Vibration } from 'react-native';\n\nexport const buzz = (): void => Vibration.vibrate(20);\n`);
    return ['[vendor-import]', `${rel}:2`, 'Vibration'];
  },
  'second-context': (dir) => {
    const rel = 'packages/shell/src/screens/home/home-music.ts';
    write(dir, rel, `// ${rel}\nexport function makeContext(Ctor: new () => object): object {\n  return new AudioContext();\n}\n`);
    return ['[audio-context]', `${rel}:3`, 'outside the adapter'];
  },
  'session-order': (dir) => {
    replace(dir, ADAPTER, "  AudioManager.setAudioSessionOptions({\n    iosCategory: 'ambient',\n    iosMode: 'default',\n    iosOptions: [],\n  });\n  const ctx = new AudioContext();", "  const ctx = new AudioContext();\n  AudioManager.setAudioSessionOptions({\n    iosCategory: 'ambient',\n    iosMode: 'default',\n    iosOptions: [],\n  });");
    return ['[audio-context]', `${ADAPTER}:${lineOf(dir, ADAPTER, 'new AudioContext()')}`, 'ambient session'];
  },
  'decode-url': (dir) => {
    const rel = `apps/${GAME}/src/board/load-sound.ts`;
    write(dir, rel, `// ${rel}\nexport async function load(ctx: { decodeAudioData: (url: string) => Promise<unknown> }): Promise<unknown> {\n  return ctx.decodeAudioData('https://example.com/boom.mp3');\n}\n`);
    return ['[file-audio]', `${rel}:3`, 'decodeAudioData'];
  },
  'audio-asset': (dir) => {
    write(dir, `apps/${GAME}/assets/sounds/boom.mp3`, 'ID3 not really audio');
    return ['[file-audio]', `apps/${GAME}/assets/sounds/boom.mp3`, 'ships an audio file'];
  },
  'preview-not-ignored': (dir) => {
    write(dir, '.gitignore', 'node_modules/\nreports/\n');
    return ['[preview-ignored]', '.gitignore'];
  },
  'plugin-option': (dir) => {
    replace(dir, CONFIG, 'disableFFmpeg: true', 'disableFFmpeg: false');
    return ['[audio-plugin]', `${CONFIG}:${lineOf(dir, CONFIG, "'react-native-audio-api'")}`, 'disableFFmpeg'];
  },
  'plugin-unwired': (dir) => {
    replace(dir, 'packages/shell/src/config/shell-plugins.ts', 'return [AUDIO_API_PLUGIN];', "return [['react-native-audio-api']];");
    replace(dir, 'packages/shell/src/config/shell-plugins.ts', "import { AUDIO_API_PLUGIN } from './audio-config.ts';\n\n", '');
    return ['[audio-plugin]', `${CONFIG}:${lineOf(dir, CONFIG, 'export const AUDIO_API_PLUGIN')}`, 'no other config file'];
  },
  'shell-peer-range': (dir) => {
    replace(dir, 'packages/shell/package.json', '"react-native-audio-api": "*"', '"react-native-audio-api": "^0.13.6"');
    return ['[audio-pin]', `packages/shell/package.json:${lineOf(dir, 'packages/shell/package.json', 'react-native-audio-api')}`, 'not exactly 0.13.6'];
  },
  'ui-feedback-lose': (dir) => {
    replace(dir, 'packages/shell/src/game-host/finish-run.ts', "isWon ? 'win' : 'lose'", "'win'");
    return ['[ui-feedback]', 'packages/shell/src/services/audio/ui-feedback.ts', "never plays its 'lose' feedback"];
  },
  'press-feedback-unused': (dir) => {
    rmSync(join(dir, 'packages/shell/src/ui/raised-surface.tsx'));
    return ['[ui-feedback]', 'packages/shell/src/app/press-feedback-context.tsx', 'usePressFeedback'];
  },
  'mic-string': (dir) => {
    replace(dir, CONFIG, '    disableStaticExternalLibs: true,\n', "    disableStaticExternalLibs: true,\n    iosMicrophonePermission: 'Sound effects',\n");
    return ['[mic-string]', `${CONFIG}:${lineOf(dir, CONFIG, 'iosMicrophonePermission')}`];
  },
  'music-on': (dir) => {
    replace(dir, 'packages/shell/src/services/audio/audio-port.ts', 'music: { isOn: false', 'music: { isOn: true');
    return ['[music-default]', 'packages/shell/src/services/audio/audio-port.ts:1', 'keep music off'];
  },
  'reclaim-session': (dir) => {
    replace(dir, ADAPTER, '    AudioManager.observeAudioInterruptions(true);', '    AudioManager.observeAudioInterruptions(true);\n    AudioManager.activelyReclaimSession(true);');
    return ['[music-default]', `${ADAPTER}:${lineOf(dir, ADAPTER, 'activelyReclaimSession')}`];
  },
  'max-voices': (dir) => {
    replace(dir, 'packages/shell/src/services/audio/admit-voice.ts', 'MAX_VOICES = 8', 'MAX_VOICES = 16');
    return ['[voice-policy]', 'packages/shell/src/services/audio/admit-voice.ts:1', 'MAX_VOICES is not 8'];
  },
  'linear-gain': (dir) => {
    replace(dir, 'packages/shell/src/services/audio/admit-voice.ts', 'setting.volume * setting.volume', 'setting.volume');
    return ['[voice-policy]', 'does not square the slider'];
  },
  'no-ramp': (dir) => {
    replace(dir, ADAPTER, 'const RAMP_S = 0.05;', 'const RAMP_S = 0;');
    return ['[voice-policy]', `${ADAPTER}:1`, 'ramp over 50 ms'];
  },
  'haptic-throttle': (dir) => {
    replace(dir, 'packages/shell/src/services/haptics/should-pulse.ts', 'MIN_HAPTIC_GAP_MS = 40', 'MIN_HAPTIC_GAP_MS = 10');
    return ['[haptic-throttle]', 'packages/shell/src/services/haptics/should-pulse.ts:1'];
  },
  'haptic-table': (dir) => {
    replace(dir, HAPTICS, "    case 'error':\n      return notificationAsync(NotificationFeedbackType.Error);", "    case 'error':\n      return notificationAsync(NotificationFeedbackType.Warning);");
    return ['[haptic-table]', `${HAPTICS}:${lineOf(dir, HAPTICS, "case 'error'")}`, "cue 'error'"];
  },
  'haptic-no-catch': (dir) => {
    replace(dir, HAPTICS, 'fire(cue).catch(() => undefined);', 'void fire(cue);');
    return ['[haptic-safety]', `${HAPTICS}:1`, '.catch(() => undefined)'];
  },
  'sim-haptic': (dir) => {
    const rel = `apps/${GAME}/src/sim/demo-sim.ts`;
    write(dir, rel, `// ${rel}\n'worklet';\n\nexport function stepDemo(sim: { hits: number }, haptics: { play: (cue: 'heavy') => void }): void {\n  sim.hits += 1;\n  haptics.play('heavy');\n}\n`);
    return ['[cue-in-sim]', `${rel}:6`];
  },
  'button-haptic': (dir) => {
    replace(dir, 'packages/shell/src/ui/toggle-row.tsx', "haptics.play('selection');", "haptics.play('medium');");
    return ['[button-haptics]', 'packages/shell/src/ui/toggle-row.tsx:6', "'medium'"];
  },
  'lifecycle-twice': (dir) => {
    const rel = 'packages/shell/src/screens/game/game-audio.ts';
    write(dir, rel, `// ${rel}\nimport { useAudioLifecycle } from '@e07/shell/services/audio/use-audio-lifecycle.ts';\n\nimport type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';\n\nexport function useGameAudio(audio: AudioPort): void {\n  useAudioLifecycle({ audio, isFullscreenAdShowing: false, reportError: () => undefined });\n}\n`);
    return ['[lifecycle-mount]', 'called 2 times'];
  },
  'no-dispose': (dir) => {
    replace(dir, 'packages/shell/src/app/language-change.ts', '  await audio.dispose();\n', '');
    return ['[dispose-before-reload]', `packages/shell/src/app/language-change.ts:${lineOf(dir, 'packages/shell/src/app/language-change.ts', 'await restartForDirection')}`];
  },
  'other-dispose': (dir) => {
    replace(dir, 'packages/shell/src/app/language-change.ts', '  await audio.dispose();\n', '  boardImage.dispose();\n');
    return ['[dispose-before-reload]', `packages/shell/src/app/language-change.ts:${lineOf(dir, 'packages/shell/src/app/language-change.ts', 'await restartForDirection')}`];
  },
  'lifecycle-test-missing': (dir) => {
    rmSync(join(dir, 'packages/shell/src/services/audio/use-audio-lifecycle.test.ts'));
    return ['[audio-file-missing]', 'packages/shell/src/services/audio/use-audio-lifecycle.test.ts'];
  },
  // Shell step 5: the services are in, the plugin list (step 8) and the boot (step 7) are not.
  'not-yet-due': (dir) => {
    rmSync(join(dir, 'packages/shell/src/config/shell-plugins.ts'));
    rmSync(join(dir, 'packages/shell/src/app/start-shell.ts'));
    replace(dir, 'packages/shell/src/services/audio/admit-voice.ts', 'MAX_VOICES = 8', 'MAX_VOICES = 16');
    return [
      'SKIP packages/shell/src/config/shell-plugins.ts [audio-plugin] due at Shell step 8: packages/shell/src/config/shell-plugins.ts not yet created',
      'SKIP packages/shell/src/services/audio/ui-feedback.ts [ui-feedback] due at Shell step 7: packages/shell/src/app/start-shell.ts not yet created',
      '[voice-policy]',
      'RESULT: FAIL (1 problems)',
    ];
  },
  'mock-incomplete': (dir) => {
    replace(dir, '__mocks__/react-native-audio-api.ts', '  observeAudioInterruptions: jest.fn(),\n', '');
    return ['[audio-mock]', '__mocks__/react-native-audio-api.ts:1'];
  },
};

const BANK_CASES = {
  'click': (dir) => {
    replace(dir, BANK, 'attackMs: 2,\n        gain: 0.45,', 'attackMs: 0,\n        gain: 0.9,');
    return ['[recipe-quality]', `${BANK}:${lineOf(dir, BANK, '  flip:')}`, 'sound "flip" first sample'];
  },
  'late-layer-click': (dir) => {
    replace(dir, BANK, 'offsetMs: 0,\n        durationMs: 160,\n        attackMs: 4,', 'offsetMs: 40,\n        durationMs: 160,\n        attackMs: 0,');
    return ['[recipe-quality]', `${BANK}:${lineOf(dir, BANK, '  clear:')}`, 'sound "clear" voice 1: a layer that starts later needs attackMs'];
  },
  'too-long': (dir) => {
    replace(dir, BANK, 'durationMs: 240,', 'durationMs: 2400,');
    return ['[recipe-quality]', `${BANK}:${lineOf(dir, BANK, '  clear:')}`, 'lasts 2400 ms (limit 1500 ms)'];
  },
  'too-quiet': (dir) => {
    replace(dir, BANK, 'attackMs: 2,\n        gain: 0.45,', 'attackMs: 2,\n        gain: 0.03,');
    return ['[recipe-quality]', 'sound "flip" peak', 'below 0.05'];
  },
  'not-literal': (dir) => {
    replace(dir, BANK, 'export const SOUND_BANK', 'const FLIP_GAIN = 0.45;\n\nexport const SOUND_BANK');
    replace(dir, BANK, 'gain: 0.45,', 'gain: FLIP_GAIN,');
    return ['[recipe-literal]', `${BANK}:${lineOf(dir, BANK, 'gain: FLIP_GAIN')}`, '"FLIP_GAIN" is not literal data'];
  },
  'ui-id-in-game': (dir) => {
    replace(dir, BANK, '  flip: {', "  'ui.flip': {");
    replace(dir, TIMELINE_FILE, "sound: 'flip'", "sound: 'ui.flip'");
    return ['[sound-id]', `${BANK}:${lineOf(dir, BANK, "'ui.flip'")}`, 'ui. is the Shell namespace'];
  },
  'bad-ui-id': (dir) => {
    const ui = 'packages/shell/src/services/audio/synth/ui-sounds.ts';
    replace(dir, ui, "'ui.tap': [", "tap: [");
    return ['[sound-id]', `${ui}:${lineOf(dir, ui, 'tap: [')}`, 'is not ui.<kebab>'];
  },
  'ui-category': (dir) => {
    replace(dir, BANK, "  flip: {\n    category: 'sfx',", "  flip: {\n    category: 'ui',");
    return ['[bank-category]', `${BANK}:${lineOf(dir, BANK, '  flip:')}`, 'category "ui"'];
  },
  'music-no-loop': (dir) => {
    replace(dir, BANK, "  clear: {\n    category: 'sfx',", "  clear: {\n    category: 'music',");
    return ['[bank-category]', 'music "clear" is not looped'];
  },
  'bank-missing': (dir) => {
    rmSync(join(dir, BANK));
    return ['[bank-missing]', `${TIMELINE_FILE}:${lineOf(dir, TIMELINE_FILE, "sound: 'flip'")}`];
  },
  'cue-unknown': (dir) => {
    replace(dir, TIMELINE_FILE, "sound: 'clear'", "sound: 'boom'");
    return ['[cue-unknown]', `${TIMELINE_FILE}:${lineOf(dir, TIMELINE_FILE, "sound: 'boom'")}`, 'sound "boom"', '[sound-unused]'];
  },
  'sound-unused': (dir) => {
    replace(dir, TIMELINE_FILE, "sound: 'clear', haptic: 'success'", "haptic: 'success'");
    return ['[sound-unused]', `${BANK}:${lineOf(dir, BANK, '  clear:')}`, 'sound "clear" is never cued'];
  },
  'play-unknown': (dir) => {
    const rel = `apps/${GAME}/src/board/on-events.ts`;
    replace(dir, rel, "audio.play('flip');", "audio.play('zap');");
    return ['[cue-unknown]', `${rel}:${lineOf(dir, rel, "audio.play('zap')")}`, 'sound "zap"'];
  },
  'no-bank-test': (dir) => {
    rmSync(join(dir, `apps/${GAME}/src/sounds/sound-bank.test.ts`));
    return ['[bank-test]', `apps/${GAME}/src/sounds/sound-bank.test.ts:1`];
  },
  'bank-unwired': (dir) => {
    write(dir, `apps/${GAME}/src/index.ts`, `// apps/${GAME}/src/index.ts\nexport const DEMO_PRESENTATION = { sounds: {} } as const;\n`);
    return ['[bank-unwired]', `apps/${GAME}/src/index.ts:1`];
  },
};

function buildSuite(name, buildGood, cases) {
  const root = join(FIXTURES, name);
  rmSync(root, { recursive: true, force: true });
  const good = join(root, 'good');
  buildGood(good);
  for (const [caseName, plant] of Object.entries(cases)) {
    const dir = join(root, `bad-${caseName}`);
    cpSync(good, dir, { recursive: true });
    const expect = plant(dir);
    writeFileSync(join(dir, 'EXPECT.txt'), `${expect.join('\n')}\n`);
  }
  return Object.keys(cases).length;
}

/**
 * A game-first repo (shell-slice.json "screens": []): only the game stage is installed, the pilot app
 * lists no native audio modules yet, and there is no Shell app. The Shell audio wiring prints SKIP.
 */
const GAME_STAGE_TEMPLATES = [
  'packages/shell/src/services/audio/audio-port.ts',
  'packages/shell/src/services/audio/fake-audio.ts',
  'packages/shell/src/services/audio/fake-audio.test.ts',
  'packages/shell/src/services/audio/synth/synthesize-recipe.ts',
  'packages/shell/src/services/audio/synth/synthesize-recipe.test.ts',
  'packages/shell/src/services/audio/synth/recipe-problems.ts',
  'packages/shell/src/services/audio/synth/recipe-problems.test.ts',
  'packages/shell/src/services/audio/synth/ui-sounds.ts',
  'packages/shell/src/app/use-is-app-active.ts',
  'packages/shell/src/app/use-is-app-active.test.ts',
  'packages/shell/src/services/haptics/haptics-port.ts',
  'packages/shell/src/services/haptics/fake-haptics.ts',
  'packages/shell/src/services/haptics/fake-haptics.test.ts',
  'packages/tooling/src/audio/encode-wav.ts',
  'packages/tooling/src/audio/encode-wav.test.ts',
  'packages/tooling/src/audio/render-sfx-wav.ts',
];
const GAME_FIRST_PACKAGE = `{\n  "name": "@e07/${GAME}",\n  "version": "1.0.0",\n  "private": true,\n  "dependencies": {\n    "expo": "~57.0.25"\n  }\n}\n`;

function buildGameFirstGood(dir) {
  for (const rel of GAME_STAGE_TEMPLATES) write(dir, rel, read(TEMPLATES, rel));
  buildBanksGood(dir);
  write(dir, `apps/${GAME}/package.json`, GAME_FIRST_PACKAGE);
  write(dir, 'package.json', '{\n  "name": "e07-games",\n  "private": true,\n  "workspaces": ["apps/*", "packages/*"]\n}\n');
  write(dir, 'packages/shell/package.json', SHELL_PACKAGE);
  write(dir, '.gitignore', 'node_modules/\nreports/\napps/*/sfx-preview/\n');
  write(dir, 'shell-slice.json', '{ "screens": [], "why": "game-first repo: the board and its sounds come before the Shell app" }\n');
  // The in-repo skill library holds planted findings on purpose; REPO_SCAN_IGNORES keeps it silent.
  write(dir, ['skills', 'some-skill', 'tests', 'fixtures', 'bad-asset', 'apps', 'x', 'assets', 'boom.mp3'].join('/'), 'ID3 planted');
}

const GAME_FIRST_CASES = {
  'game-stage-missing': (dir) => {
    rmSync(join(dir, 'packages/shell/src/services/audio/fake-audio.ts'));
    return ['[audio-file-missing]', 'packages/shell/src/services/audio/fake-audio.ts', 'SKIP packages/shell/src/services/audio/audio-api-audio-adapter.ts [audio-file-missing] no Shell app', 'RESULT: FAIL (1 problems)'];
  },
  'wrong-pin-still-fails': (dir) => {
    replace(dir, APP_PKG, '"expo": "~57.0.25"', '"expo": "~57.0.25",\n    "react-native-audio-api": "^0.13.6"');
    return ['[audio-pin]', `${APP_PKG}:${lineOf(dir, APP_PKG, 'react-native-audio-api')}`, 'not exactly 0.13.6'];
  },
  'slice-has-shell-app': (dir) => {
    write(dir, 'shell-slice.json', '{ "screens": ["S4", "S11"], "why": "Home and Settings slice: the Shell app exists" }\n');
    return ['[audio-file-missing]', 'packages/shell/src/services/audio/audio-api-audio-adapter.ts', '[lifecycle-mount]', 'SKIP packages/shell/src/config/shell-plugins.ts [audio-plugin] due at Shell step 8', `[audio-pin]`];
  },
  'audio-asset-in-app': (dir) => {
    write(dir, `apps/${GAME}/assets/sounds/boom.mp3`, 'ID3 not really audio');
    return ['[file-audio]', `apps/${GAME}/assets/sounds/boom.mp3`];
  },
};

if (!existsSync(TEMPLATES)) throw new Error('templates/ not found next to tests/');
const audio = buildSuite('check-audio-haptics', buildAudioGood, AUDIO_CASES);
const gameFirst = buildSuite('check-audio-haptics-game-first', buildGameFirstGood, GAME_FIRST_CASES);
const banks = buildSuite('check-sound-banks', buildBanksGood, BANK_CASES);
console.log(`built fixtures: check-audio-haptics good + ${audio} bad, check-audio-haptics-game-first good + ${gameFirst} bad, check-sound-banks good + ${banks} bad`);
