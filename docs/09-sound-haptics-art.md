# 09 · Sound, haptics and art

> **What this doc decides.** Sound effects are synthesised in code from small typed recipes and played through one `AudioContext` (react-native-audio-api 0.13.6, exact pin, iOS session category `ambient`, music off by default) behind `AudioPort`. Vibration goes through `HapticsPort` (expo-haptics) with a fixed cue table and a 40 ms throttle.
> Every image is drawn by code: a headless-Skia script renders the app icon (light, dark, tinted), the splash logos and any store art from the game's own draw functions and palette tokens. Sprites are pre-rendered at device pixels and re-rendered when the theme changes. The S11d licences screen reads data files defined here.
> All code below was compiled, linted and tested on 2026-09-26; the audio adapter, haptics adapter and fonts also ran in a Release build on the iOS 26.5 simulator.
> **Related docs:** [08-game-engine.md](08-game-engine.md) (timeline cues and board kit), [10-i18n-and-rtl.md](10-i18n-and-rtl.md) (fonts), [02-architecture-and-folders.md](02-architecture-and-folders.md) (ports and app zones), [14-ios-build-and-release.md](14-ios-build-and-release.md) (withShell and ITMS-90683), [16-quality-gates-hooks-ci.md](16-quality-gates-hooks-ci.md) (licence audit and verify). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

## Intro

### For the owner, in plain words

- **Sounds are made by code, not recorded.** Each sound is a short recipe ("a triangle wave sliding from 520 Hz to 380 Hz for 70 ms"). The app computes the sound when it starts. There are no audio files to license, and you can listen to every sound on your Mac before any build: `node packages/tooling/src/audio/render-sfx-wav.ts --app line-siege` writes WAV files into `apps/line-siege/sfx-preview/`.
- **Sound respects your phone.** The silent switch mutes it, and your own music keeps playing. Game music is **off by default**, because iOS offers no reliable way to ask "is the player already listening to something?".
- **Vibration is a short tap** on meaningful events (place, clear, win, lose). It follows the Vibration setting and is hidden on iPads, which cannot vibrate.
- **All art is drawn by code.** The icon, the splash screen and the board use the same shapes and colours. `node packages/tooling/src/art/render-art.ts --app line-siege` renders the icon files in under a second, and a check fails the build if they are stale.

### Scope

This doc owns the audio and haptics ports and adapters, the synth, the WAV preview, the art pipeline (icon, splash, store art, board previews, sprites), palette tokens as data, the board-side use of fonts, and the S11d licence data. docs/08 owns when sounds and haptics fire (timeline cues). docs/10 owns fonts in the UI (`AppText`, line heights). docs/14 owns `withShell` and the build. Names follow FINAL-DECISIONS F and docs/03; imports and limits follow docs/04.

## 1. Rules

1. **Install `react-native-audio-api` at exactly `0.13.6` with `npm install --save-exact`,** because Expo's map does not pin it. Never install `expo-audio` (docs/04 bans it).
   *Why:* it is pre-1.0 and minor releases break APIs (a `1.0.0` nightly tag already exists). *Source:* [npm](https://www.npmjs.com/package/react-native-audio-api), FINAL B.20.
2. **Configure its config plugin with every default overridden:** `iosBackgroundMode: false`, `androidPermissions: []`, `androidForegroundService: false`, `disableFFmpeg: true`, `disableStaticExternalLibs: true` (`AUDIO_API_PLUGIN` below). After prebuild, `Info.plist` has no `UIBackgroundModes` audio and no `NSMicrophoneUsageDescription`, and the Podfile has both `DISABLE_AUDIOAPI_*` lines.
   *Why:* the defaults add background audio and Android foreground-service permissions; FFmpeg adds remote streaming, which spec N3 forbids. *Source:* [plugin docs](https://docs.swmansion.com/react-native-audio-api/docs/other/audio-api-plugin), the plugin source (`src/plugin/withAudioAPI.ts`, read today).
3. **Create exactly one `AudioContext` per app, inside the adapter, after `AudioManager.setAudioSessionOptions({ iosCategory: 'ambient', iosMode: 'default', iosOptions: [] })`.** Leave `iosAllowHaptics` at its default.
   *Why:* `ambient` respects the silent switch and mixes with other apps' audio; `iosAllowHaptics` only affects recording sessions. *Source:* [AVAudioSession.Category.ambient](https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/ambient), [AudioManager](https://docs.swmansion.com/react-native-audio-api/docs/system/audio-manager).
4. **Only `audio-api-audio-adapter.ts` imports `react-native-audio-api`, and only `expo-haptics-adapter.ts` imports `expo-haptics`.** Everything else uses `AudioPort` and `HapticsPort`; tests use `fake-audio.ts` and `fake-haptics.ts`.
   *Enforced by:* docs/04 `ADAPTERS` block.
5. **Synthesise every sound effect from a typed recipe (`SoundRecipe`); ship no audio files.** Every recipe must pass the recipe tests: finite samples, peak between 0.05 and 0.9, first sample below 0.05, last sample below 0.01.
   *Why:* spec N9 (made by Claude Code), no licences to track, and no clicks or clipping.
6. **Never use `decodeAudioData` with a URL, `createStreamer`, or any file or network source.**
   *Why:* spec N3; our buffers come only from `synthesizeRecipe`.
7. **Route sounds through three category gains:** `sfx` and `ui` follow "Sound effects", `music` follows "Music". A slider maps to `volume²`, and every gain change ramps over 50 ms.
   *Why:* a squared slider sounds even; an instant gain jump clicks.
8. **Keep music off by default** (`DEFAULT_AUDIO_SETTINGS.music.isOn = false`). Hide the Music row when the game has no music. Start music (a looped synthesised buffer) on Home only when the setting is on.
   *Why:* spec 8.7 says "never over the player's music unless they turn game music on", and react-native-audio-api has no API that reports "other audio is playing". *Source:* FINAL B.20.
9. **Schedule sounds on the audio clock from timeline cues** (`audio.play(id, track.startMs)`), and call `cancelPending()` on fast-forward, pause and screen exit. Allow at most 8 overlapping voices and at most one start of the same sound per 30 ms (or its `minIntervalMs`).
   *Why:* sample-accurate sync with animations, and no pile-ups when a cascade fires many cues at once.
10. **Suspend the `AudioContext` whenever the app is not active or a full-screen ad is showing, and resume it afterwards.** Handle audio-session interruptions. Call `dispose()` before `reloadAppAsync`.
    *Why:* FINAL B.19 (lifecycle); ads play their own sound.
11. **Add no microphone purpose string up front.** If the first App Store upload reports ITMS-90683 (missing `NSMicrophoneUsageDescription`), set the plugin option `iosMicrophonePermission` to a neutral sentence and localise it through `expo.locales` (docs/14's `ios.infoPlist` entry is equivalent; use one of the two, not both).
    *Why:* the library's binary references record-permission APIs we never call (FINAL B.20). The plugin option exists in 0.13.6 (read in its source).
12. **Re-verify on every bump of `react-native-audio-api`:** read the release notes, diff the plugin defaults and the Jest mock, then run the adapter tests, a simulator smoke test and the owner's listening check.
    *Why:* 0.x minors have broken APIs before (0.12.0 and 0.13.6 release notes).
13. **Map haptic cues with the table in section 6.2.** Fire them only when the Vibration setting is on and at least 40 ms after the previous pulse. End every call with `.catch(() => undefined)`. Set `isSupported` to false on iPad so Settings hides the Vibration row.
    *Why:* Expo documents that haptics silently do nothing in Low Power Mode, while the camera runs and in similar states, so a failure is the expected fallback (FINAL B.21). *Source:* [expo-haptics](https://docs.expo.dev/versions/latest/sdk/haptics/).
14. **Render all app images from code with `render-art.ts`:** icon light, dark and tinted (1024 × 1024) and splash logos (light and dark). Use the game's `drawIcon` and palette tokens. Commit the PNGs, and fail `verify` when `--check` finds them stale.
    *Why:* spec N9; one source of truth for board and icon. The output is deterministic (verified: byte-identical re-renders).
15. **Meet the icon requirements:** 1024 × 1024 sRGB, square and unmasked (no rounded corners, no inner shadow or glow). The light variant is opaque. The dark variant has a transparent background. The tinted variant is grayscale. Keep the glyph inside the central 62 %, and use no text.
    *Why:* Apple asks for "your tinted app icon as a grayscale image" and "your dark app icon with a transparent background"; the system masks corners and adds Liquid Glass effects. *Source:* [Configuring your app icon](https://developer.apple.com/documentation/xcode/configuring-your-app-icon), [HIG app icons](https://developer.apple.com/design/human-interface-guidelines/app-icons).
16. **Keep each game's colours as semantic tokens in `board-palettes.json`,** with four sets: `light`, `dark`, `colorBlindLight` and `colorBlindDark`. The board, the icon and the splash read only tokens, through `makeBoardColors`.
    *Why:* docs/04 rule 8 puts palettes in JSON; docs/05 derives the menu tokens from the same file (spec 8.12; the mapping is docs/05 open issue 8).
17. **Pre-render sprites at device pixels, once per cache key** (`<game>:<scheme>:<cb0|cb1>:<cellPt>@<pixelRatio>`), with `createSpriteCache`. A new key disposes the old image.
    *Why:* drawing hundreds of identical shapes per frame is slower than blitting one image, and a theme change must never show stale colours.
18. **On boards, take fonts from `Skia.FontMgr.System()`** (Vazirmatn is embedded by the `expo-font` plugin, docs/10). Never call Skia's `useFonts` on device. Tests and Node scripts register the TTF from `apps/<game>/assets/fonts/`.
    *Why:* the system font manager sees plugin-embedded fonts (verified on the simulator), so fonts are ready on the first frame (N1).
19. **Keep S11d complete:** npm packages come from the release-bundle licence audit (docs/16). `shell-notices.json` lists native code compiled into every app. Each game's `credits.json` lists its fonts, sounds (none in v1: all generated) and word lists, and reaches the screen as `GameArt.credits` (`presentation.art`, docs/02). `creditProblems` tests all rows against the licence allowlist.
    *Why:* BSD, OFL and Apache licences require the notice in the shipped product, and `audit:licenses` sees only JavaScript.

## 2. Versions and install

| Package | Version (2026-09-26) | How | Note |
|---|---|---|---|
| react-native-audio-api | **0.13.6** exact (npm latest; `audio-api-nightly` = 1.0.0-nightly) | `npm install --save-exact react-native-audio-api@0.13.6` | peer `react-native-worklets >= 0.7.0`; no npm postinstall |
| expo-haptics | ~57.0.3 | `npx expo install expo-haptics` | Expo SDK 57 map |
| expo-splash-screen | ~57.0.9 | `npx expo install expo-splash-screen` | config plugin used below |
| expo-font | ~57.0.4 | `npx expo install expo-font` | docs/10 owns the font config |
| @shopify/react-native-skia | 2.6.2 | `npx expo install @shopify/react-native-skia` | headless build used by `render-art.ts` |

Build-time network: with both `disable*` options on, nothing is downloaded. The pod's `prepare_command` still calls `scripts/download-prebuilt-binaries.sh ios skipffmpeg`, but with `DISABLE_AUDIOAPI_STATIC_EXTERNAL_LIBS=1` the script skips every iOS archive, and the build-time "Download RNAudioAPI prebuilt binaries" phase is not added at all (read in `RNAudioAPI.podspec` and the script, 0.13.6). docs/01 section 3.2 and docs/14 section 3.3 say the same; only the library's defaults would download them.

Re-verify before relying on these numbers: `npm view react-native-audio-api version dist-tags`, `npx expo install --check` in every app, then re-read `node_modules/react-native-audio-api/src/plugin/withAudioAPI.ts` (plugin defaults) and `src/mock/index.ts` (the Jest mock).

## 3. Config (sound, icon, splash)

`withShell` (docs/14) merges these pieces into the Expo config. They sit in the Node-world config folder:

```ts
// packages/shell/src/config/media-config.ts
// Node world (read by app.config.ts through withShell). The sound, icon and splash parts of the
// Expo config; withShell (docs/14) merges them (it already sets the 120 Hz Info.plist key).
import type { ExpoConfig } from 'expo/config';

type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

/** Files written by `node packages/tooling/src/art/render-art.ts --app <id>`, relative to the app. */
const GENERATED = './assets/generated';

/** react-native-audio-api: override every default that adds background audio or permissions. */
export const AUDIO_API_PLUGIN: PluginEntry = [
  'react-native-audio-api',
  {
    iosBackgroundMode: false,
    androidPermissions: [],
    androidForegroundService: false,
    disableFFmpeg: true,
    disableStaticExternalLibs: true,
  },
];

export type SplashColors = { readonly light: string; readonly dark: string };

/** Splash = the game's logo on its background colour (spec S1), light and dark. */
export function splashPlugin(background: SplashColors): PluginEntry {
  return [
    'expo-splash-screen',
    {
      image: `${GENERATED}/splash-logo.png`,
      imageWidth: 200,
      backgroundColor: background.light,
      dark: { image: `${GENERATED}/splash-logo-dark.png`, backgroundColor: background.dark },
    },
  ];
}

/** Root `icon` (Android and fallbacks) and `ios.icon` with the iOS 18+ appearances. */
export const ICON_CONFIG = {
  icon: `${GENERATED}/icon-light.png`,
  iosIcon: {
    light: `${GENERATED}/icon-light.png`,
    dark: `${GENERATED}/icon-dark.png`,
    tinted: `${GENERATED}/icon-tinted.png`,
  },
} as const satisfies {
  readonly icon: string;
  readonly iosIcon: NonNullable<ExpoConfig['ios']>['icon'];
};
```

Verified with `npx expo prebuild --platform ios` on an SDK 57 app using these values:

- `AppIcon.appiconset/Contents.json` contains three 1024 × 1024 entries: the light one without `appearances`, a `luminosity: dark` one and a `luminosity: tinted` one.
- Expo removed the alpha channel from the light and tinted PNGs and kept it in the dark PNG (`sips -g hasAlpha`: no / yes / no).
- `SplashScreenBackground.colorset` has the light colour plus a dark appearance.
- `SplashScreenLogo.imageset` has `image@1x/2x/3x` and `dark_image@1x/2x/3x`.
- `Info.plist` has `CADisableMinimumFrameDurationOnPhone = true` (set by docs/14's `withShell`).

## 4. Audio architecture

### 4.1 The port

```ts
// packages/shell/src/services/audio/audio-port.ts
import type { SoundRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';

export type SoundCategory = 'sfx' | 'ui' | 'music';

export type SoundSpec = {
  readonly category: SoundCategory;
  readonly recipe: SoundRecipe;
  /** Same sound cannot restart sooner than this (default 30 ms). */
  readonly minIntervalMs?: number;
  /** Music only: loop the buffer. */
  readonly isLoop?: boolean;
};

export type SoundBank = Readonly<Record<string, SoundSpec>>;

export type ChannelSetting = { readonly isOn: boolean; readonly volume: number };

/** From the settings store. Music defaults to OFF (FINAL-DECISIONS B.20, spec 8.7). */
export type AudioSettings = { readonly effects: ChannelSetting; readonly music: ChannelSetting };

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  effects: { isOn: true, volume: 0.8 },
  music: { isOn: false, volume: 0.6 },
};

/** The ONLY audio API the Shell and games use. Adapter: audio-api-audio-adapter.ts. */
export type AudioPort = {
  /** Synthesises and uploads every buffer of the bank (call once at startup). */
  readonly load: (bank: SoundBank) => void;
  /** Plays a sound now or after `delayMs` (timeline cues). Silently ignores unknown ids. */
  readonly play: (soundId: string, delayMs?: number) => void;
  /** Stops sounds scheduled for the future (timeline fast-forward, pause). */
  readonly cancelPending: () => void;
  readonly applySettings: (settings: AudioSettings) => void;
  readonly startMusic: (soundId: string) => void;
  readonly stopMusic: () => void;
  readonly suspend: () => Promise<void>;
  readonly resume: () => Promise<void>;
  /** Before reloadAppAsync (direction change) and in tests. */
  readonly dispose: () => Promise<void>;
};
```

### 4.2 The adapter (the one `AudioContext`)

```ts
// packages/shell/src/services/audio/audio-api-audio-adapter.ts
// The ONLY file that imports react-native-audio-api (pinned exactly: 0.13.6).
import { AudioContext, AudioManager } from 'react-native-audio-api';

import { synthesizeRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';

import { DEFAULT_MIN_INTERVAL_MS, EMPTY_VOICES, admitVoice, channelGain } from './admit-voice.ts';

import type {
  AudioPort,
  AudioSettings,
  SoundBank,
  SoundCategory,
  SoundSpec,
} from './audio-port.ts';
import type {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioEventSubscription,
  GainNode,
} from 'react-native-audio-api';

type Loaded = {
  readonly buffer: AudioBuffer;
  readonly spec: SoundSpec;
  readonly durationMs: number;
};
type Pending = { readonly source: AudioBufferSourceNode; readonly startS: number };
type Graph = {
  readonly ctx: AudioContext;
  readonly gains: Readonly<Record<SoundCategory, GainNode>>;
};

const RAMP_S = 0.05;

/** ONE AudioContext per app. The session must be configured BEFORE the context exists. */
function createGraph(): Graph {
  AudioManager.setAudioSessionOptions({
    iosCategory: 'ambient',
    iosMode: 'default',
    iosOptions: [],
  });
  const ctx = new AudioContext();
  const gains = { sfx: ctx.createGain(), ui: ctx.createGain(), music: ctx.createGain() };
  for (const gain of Object.values(gains)) gain.connect(ctx.destination);
  return { ctx, gains };
}

/** Click-free gain change: hold the current value, then ramp linearly for 50 ms. */
function rampTo(ctx: AudioContext, gain: GainNode, value: number): void {
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(value, now + RAMP_S);
}

export type AudioAdapterDeps = {
  /** `(error) => errorLog.record('audio', error)`: logged, never thrown into gameplay. */
  readonly reportError: (error: unknown) => void;
};

class AudioApiAudioAdapter implements AudioPort {
  private readonly reportError: (error: unknown) => void;
  private graph: Graph | null = null;
  private readonly loaded = new Map<string, Loaded>();
  private voices = EMPTY_VOICES;
  private pending: Pending[] = [];
  private music: AudioBufferSourceNode | null = null;
  private interruptions: AudioEventSubscription | null = null;

  constructor(deps: AudioAdapterDeps) {
    this.reportError = deps.reportError;
  }

  readonly load = (bank: SoundBank): void => {
    const graph = this.ensureGraph();
    for (const [id, spec] of Object.entries(bank)) {
      const samples = synthesizeRecipe(spec.recipe, graph.ctx.sampleRate);
      const buffer = graph.ctx.createBuffer(1, samples.length, graph.ctx.sampleRate);
      buffer.copyToChannel(samples, 0, 0);
      this.loaded.set(id, {
        buffer,
        spec,
        durationMs: (samples.length / graph.ctx.sampleRate) * 1000,
      });
    }
  };

  readonly play = (soundId: string, delayMs = 0): void => {
    const item = this.loaded.get(soundId);
    if (item === undefined || this.graph === null) return;
    const startS = this.graph.ctx.currentTime + delayMs / 1000;
    const minIntervalMs = item.spec.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    const decision = admitVoice(this.voices, {
      soundId,
      atMs: startS * 1000,
      durationMs: item.durationMs,
      minIntervalMs,
    });
    this.voices = decision.state;
    if (!decision.isAdmitted) return;
    const source = this.graph.ctx.createBufferSource();
    source.buffer = item.buffer;
    source.connect(this.graph.gains[item.spec.category]);
    source.start(startS);
    if (delayMs > 0) this.pending.push({ source, startS });
  };

  readonly cancelPending = (): void => {
    const now = this.graph?.ctx.currentTime ?? 0;
    for (const { source, startS } of this.pending) if (startS > now) source.stop(0);
    this.pending = [];
  };

  readonly applySettings = (settings: AudioSettings): void => {
    const graph = this.graph;
    if (graph === null) return;
    rampTo(graph.ctx, graph.gains.sfx, channelGain(settings.effects));
    rampTo(graph.ctx, graph.gains.ui, channelGain(settings.effects));
    rampTo(graph.ctx, graph.gains.music, channelGain(settings.music));
  };

  readonly startMusic = (soundId: string): void => {
    const item = this.loaded.get(soundId);
    if (item === undefined || this.graph === null || this.music !== null) return;
    const source = this.graph.ctx.createBufferSource();
    source.buffer = item.buffer;
    source.loop = true;
    source.connect(this.graph.gains.music);
    source.start(this.graph.ctx.currentTime);
    this.music = source;
  };

  readonly stopMusic = (): void => {
    this.music?.stop(0);
    this.music = null;
  };

  readonly suspend = async (): Promise<void> => {
    this.cancelPending();
    await this.graph?.ctx.suspend();
  };

  readonly resume = async (): Promise<void> => {
    await this.graph?.ctx.resume();
  };

  readonly dispose = async (): Promise<void> => {
    this.interruptions?.remove();
    this.stopMusic();
    await this.graph?.ctx.close();
    this.graph = null;
  };

  private ensureGraph(): Graph {
    if (this.graph !== null) return this.graph;
    this.graph = createGraph();
    AudioManager.observeAudioInterruptions(true);
    this.interruptions = AudioManager.addSystemEventListener('interruption', (event) => {
      if (event.type === 'began') this.suspend().catch(this.reportError);
      else if (event.shouldResume) this.resume().catch(this.reportError);
    });
    return this.graph;
  }
}

/** Create exactly ONE per app, in the composition root (FINAL B.20: one AudioContext). */
export function createAudioApiAudioAdapter(deps: AudioAdapterDeps): AudioPort {
  return new AudioApiAudioAdapter(deps);
}
```

How it works:

- **Graph.** Each voice is a single-use `AudioBufferSourceNode`. It feeds one of the category `GainNode`s `sfx`, `ui` or `music`, and those feed the destination. Source nodes are cheap and are garbage-collected after `ended`.
- **Load once.** At startup, `load(bank)` synthesises every recipe at the context's sample rate (48 kHz on the simulator) and uploads the buffers. Loading five short sounds takes a few milliseconds.
- **Scheduling.** `play(id, delayMs)` starts the source at `ctx.currentTime + delayMs / 1000`, so a cue at 120 ms lands on the frame where the beam starts. Delayed voices are remembered, so that `cancelPending()` can stop them before they sound.
- **Errors.** The adapter never throws into gameplay. Promise failures (suspend, resume) go to `reportError`, which the composition root wires as `(error) => errorLog.record('audio', error)` (`ErrorLogPort`, docs/02).

### 4.3 Voice policy

```ts
// packages/shell/src/services/audio/admit-voice.ts
import type { ChannelSetting } from './audio-port.ts';

export const MAX_VOICES = 8;
export const DEFAULT_MIN_INTERVAL_MS = 30;

export type VoiceState = {
  readonly lastStartMs: Readonly<Partial<Record<string, number>>>;
  /** Start times (audio clock, ms) of voices that may still be sounding. */
  readonly activeUntilMs: readonly number[];
};

export const EMPTY_VOICES: VoiceState = { lastStartMs: {}, activeUntilMs: [] };

export type VoiceRequest = {
  readonly soundId: string;
  readonly atMs: number;
  readonly durationMs: number;
  readonly minIntervalMs: number;
};

/** Pure: decides whether a voice may start, and the next state. Time is the audio clock. */
export function admitVoice(
  state: VoiceState,
  request: VoiceRequest,
): { readonly isAdmitted: boolean; readonly state: VoiceState } {
  const active = state.activeUntilMs.filter((until) => until > request.atMs);
  const last = state.lastStartMs[request.soundId];
  const isTooSoon = last !== undefined && request.atMs - last < request.minIntervalMs;
  if (isTooSoon || active.length >= MAX_VOICES)
    return { isAdmitted: false, state: { ...state, activeUntilMs: active } };
  return {
    isAdmitted: true,
    state: {
      lastStartMs: { ...state.lastStartMs, [request.soundId]: request.atMs },
      activeUntilMs: [...active, request.atMs + request.durationMs],
    },
  };
}

/** Settings → gain. Squared for a perceptually even slider; 0 when the channel is off. */
export function channelGain(setting: ChannelSetting): number {
  return setting.isOn ? setting.volume * setting.volume : 0;
}
```

```ts
// packages/shell/src/services/audio/admit-voice.test.ts
import { EMPTY_VOICES, MAX_VOICES, admitVoice, channelGain } from './admit-voice.ts';

const tap = (atMs: number) => ({ soundId: 'tap', atMs, durationMs: 50, minIntervalMs: 30 });

describe('voice policy', () => {
  it('drops a repeat of the same sound inside its minimum interval', () => {
    const first = admitVoice(EMPTY_VOICES, tap(1000));
    expect(admitVoice(first.state, tap(1010)).isAdmitted).toBe(false);
    expect(admitVoice(first.state, tap(1031)).isAdmitted).toBe(true);
  });

  it('caps polyphony at MAX_VOICES overlapping voices', () => {
    let state = EMPTY_VOICES;
    for (let i = 0; i < MAX_VOICES; i += 1)
      state = admitVoice(state, { ...tap(1000), soundId: `s${String(i)}` }).state;
    expect(admitVoice(state, { ...tap(1001), soundId: 'extra' }).isAdmitted).toBe(false);
    expect(admitVoice(state, { ...tap(1100), soundId: 'extra' }).isAdmitted).toBe(true);
  });

  it('maps an off channel to silence and squares the slider', () => {
    expect(channelGain({ isOn: false, volume: 1 })).toBe(0);
    expect(channelGain({ isOn: true, volume: 0.5 })).toBe(0.25);
  });
});
```

### 4.4 Lifecycle

Mount the audio lifecycle hook once, in `ShellApp` (the composition root):

```ts
// packages/shell/src/services/audio/use-audio-lifecycle.ts
import { useEffect, useEffectEvent } from 'react';

import { useIsAppActive } from '@e07/shell/app/use-is-app-active.ts';

import type { AudioPort } from './audio-port.ts';

export type AudioLifecycleInput = {
  readonly audio: AudioPort;
  /** From the ads store: interstitials and rewarded ads play their own sound. */
  readonly isFullscreenAdShowing: boolean;
  /** `(error) => errorLog.record('audio', error)`: a failed suspend/resume is logged. */
  readonly reportError: (error: unknown) => void;
};

/** Mounted once in ShellApp: the AudioContext runs only while the app is visible and no ad plays. */
export function useAudioLifecycle(input: AudioLifecycleInput): void {
  const isAudible = useIsAppActive() && !input.isFullscreenAdShowing;
  const apply = useEffectEvent((isOn: boolean) => {
    const change = isOn ? input.audio.resume() : input.audio.suspend();
    change.catch(input.reportError);
  });
  useEffect(() => {
    apply(isAudible);
  }, [isAudible]);
}
```

`useIsAppActive` is shared with the board lifecycle (docs/08). The adapter's interruption listener suspends on `began` and resumes on `ended` when iOS says `shouldResume`. docs/10's `restartForDirection` does not touch audio, so the S2 and Settings flows that call it must `await audio.dispose()` first; the old native engine is then closed before the JS reload. The startup direction check in `startShell()` runs before any audio exists and needs nothing.

### 4.5 Music

Music is a long recipe (a few seconds of a simple pattern) with `category: 'music'` and `isLoop: true`, started by `startMusic(id)` when Home mounts and the Music setting is on, and stopped by `stopMusic()` when the setting goes off. Most games have no music; for them the Settings row is hidden (spec S11). Because music is off by default, no check for other playing audio is needed. If music is ever turned on by default, first build the small local Expo module that returns `AVAudioSession.secondaryAudioShouldBeSilencedHint` (FINAL B.20). Never use the library's experimental `activelyReclaimSession`: it stops the engine when other audio plays.

### 4.6 Testing audio

- Shell and screen tests inject `createFakeAudio()` and assert the calls.
- Adapter tests use a root manual mock. The library's own mock (`react-native-audio-api/mock`, 0.13.6) has no `AudioManager.setAudioSessionOptions` or `observeAudioInterruptions`, so the root mock adds them (verified: without it the adapter test fails with "setAudioSessionOptions is not a function"). The root `tsconfig.json` includes `__mocks__/**` (docs/04), and `export default` is allowed in `__mocks__`. This file uses `module.exports`.

```ts
// __mocks__/react-native-audio-api.ts
// Root manual mock, applied automatically. The library's own mock (0.13.6) lacks
// AudioManager.setAudioSessionOptions and observeAudioInterruptions, which the adapter calls.
import type * as AudioApi from 'react-native-audio-api';

const libraryMock = jest.requireActual<typeof AudioApi>('react-native-audio-api/mock');

const audioManagerMock = {
  setAudioSessionOptions: jest.fn(),
  observeAudioInterruptions: jest.fn(),
  addSystemEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getDevicePreferredSampleRate: jest.fn(() => 48_000),
};

module.exports = { ...libraryMock, AudioManager: audioManagerMock };
```

```ts
// packages/shell/src/services/audio/fake-audio.ts
import type { AudioPort, AudioSettings, SoundBank } from './audio-port.ts';

export type AudioCall =
  | { readonly kind: 'play'; readonly soundId: string; readonly delayMs: number }
  | { readonly kind: 'cancel-pending' }
  | { readonly kind: 'settings'; readonly settings: AudioSettings }
  | { readonly kind: 'music'; readonly soundId: string | null }
  | { readonly kind: 'suspend' | 'resume' | 'dispose' };

/** In-memory AudioPort for Jest and ADS_MODE-style offline test builds: records every call. */
export function createFakeAudio(): AudioPort & {
  readonly calls: AudioCall[];
  readonly loadedIds: string[];
} {
  const calls: AudioCall[] = [];
  const loadedIds: string[] = [];
  return {
    calls,
    loadedIds,
    load: (bank: SoundBank) => loadedIds.push(...Object.keys(bank)),
    play: (soundId, delayMs = 0) => calls.push({ kind: 'play', soundId, delayMs }),
    cancelPending: () => calls.push({ kind: 'cancel-pending' }),
    applySettings: (settings) => calls.push({ kind: 'settings', settings }),
    startMusic: (soundId) => calls.push({ kind: 'music', soundId }),
    stopMusic: () => calls.push({ kind: 'music', soundId: null }),
    suspend: () => {
      calls.push({ kind: 'suspend' });
      return Promise.resolve();
    },
    resume: () => {
      calls.push({ kind: 'resume' });
      return Promise.resolve();
    },
    dispose: () => {
      calls.push({ kind: 'dispose' });
      return Promise.resolve();
    },
  };
}
```

```ts
// packages/shell/src/services/audio/audio-api-audio-adapter.test.ts
import { UI_SOUNDS } from '@e07/shell/services/audio/synth/ui-sounds.ts';

import { createAudioApiAudioAdapter } from './audio-api-audio-adapter.ts';
import { DEFAULT_AUDIO_SETTINGS } from './audio-port.ts';

describe('audio-api adapter (library mock)', () => {
  it('loads a bank, plays, schedules, cancels and disposes without throwing', async () => {
    const audio = createAudioApiAudioAdapter({ reportError: jest.fn() });
    const bank = { 'ui.tap': { category: 'ui', recipe: UI_SOUNDS['ui.tap'] } } as const;
    audio.load(bank);
    audio.applySettings(DEFAULT_AUDIO_SETTINGS);
    audio.play('ui.tap');
    audio.play('ui.tap', 120);
    audio.play('unknown.id');
    audio.cancelPending();
    await audio.suspend();
    await audio.resume();
    await expect(audio.dispose()).resolves.toBeUndefined();
  });
});
```

The owner checks by ear on a device: latency, volume balance, and the silent switch (the simulator plays audio through the Mac, but only a phone proves the `ambient` behaviour).

## 5. Synthesis

### 5.1 Recipes

A recipe is a list of voices. Each voice is a waveform (sine, triangle, square or seeded noise) with a pitch glide, a start offset, a duration, an attack and a gain. The envelope decays quadratically and ends in a 6 ms fade, so every sound ends at exactly zero. The Shell ships the UI sounds (`UI_SOUNDS`, ids `ui.*`, category `ui`) and loads them together with the game's bank; each game ships a `SOUND_BANK` whose ids are the `cue.sound` values its timeline uses. A game never imports `ui-sounds.ts`: docs/02's app zones open only `services/audio/audio-port.ts` and `services/audio/synth/` of the audio folder (the synth for the game's recipe tests), and the game bank must not duplicate the Shell's `ui.*` ids.

```ts
// packages/shell/src/services/audio/synth/synthesize-recipe.ts
// Pure synthesis: data in, Float32Array out. Same code on device, in Jest and in the
// Node WAV preview script. Noise is seeded, so every render is byte-identical.
import { nextU32, seedRng } from '@e07/game-kit/rng/sfc32.ts';

export type Wave = 'sine' | 'triangle' | 'square' | 'noise';

/** One layer of a sound: a pitch glide with a linear attack and a quadratic decay. */
export type VoiceSpec = {
  readonly wave: Wave;
  readonly startHz: number;
  readonly endHz: number;
  readonly offsetMs: number;
  readonly durationMs: number;
  readonly attackMs: number;
  /** Peak amplitude 0…1 before mixing. */
  readonly gain: number;
  /** Only for 'noise'. */
  readonly seed?: number;
};

export type SoundRecipe = readonly VoiceSpec[];

type Samples = Float32Array<ArrayBuffer>;

const TWO_PI = 2 * Math.PI;
const FADE_OUT_MS = 6;
const PEAK_LIMIT = 0.9;

function oscillate(wave: Wave, phase: number, noise: number): number {
  switch (wave) {
    case 'sine':
      return Math.sin(TWO_PI * phase);
    case 'triangle':
      return 1 - 4 * Math.abs(phase - Math.floor(phase + 0.5));
    case 'square':
      return phase % 1 < 0.5 ? 0.6 : -0.6;
    case 'noise':
      return noise;
  }
}

type EnvelopeShape = { readonly total: number; readonly attack: number; readonly fade: number };

/** Attack ramp, quadratic decay, and a short fade so the last sample is exactly 0 (no click). */
function envelope(i: number, shape: EnvelopeShape): number {
  const rise = shape.attack > 0 ? Math.min(1, i / shape.attack) : 1;
  const left = (shape.total - i) / shape.total;
  const tail = Math.max(0, Math.min(1, (shape.total - 1 - i) / shape.fade));
  return rise * left * left * tail;
}

export function synthesizeVoice(spec: VoiceSpec, sampleRate: number): Samples {
  const shape = {
    total: Math.round((spec.durationMs / 1000) * sampleRate),
    attack: (spec.attackMs / 1000) * sampleRate,
    fade: (FADE_OUT_MS / 1000) * sampleRate,
  };
  const out = new Float32Array(shape.total);
  let rng = seedRng(spec.seed ?? 1);
  let phase = 0;
  for (let i = 0; i < shape.total; i += 1) {
    phase += (spec.startHz + (spec.endHz - spec.startHz) * (i / shape.total)) / sampleRate;
    const draw = nextU32(rng);
    rng = draw.state;
    out[i] =
      oscillate(spec.wave, phase, draw.value / 2147483648 - 1) * spec.gain * envelope(i, shape);
  }
  return out;
}

/** Mixes all voices at their offsets; if layers sum above 0.9 the whole sound is scaled down. */
export function synthesizeRecipe(recipe: SoundRecipe, sampleRate: number): Samples {
  const endMs = Math.max(...recipe.map((voice) => voice.offsetMs + voice.durationMs));
  const mix = new Float32Array(Math.round((endMs / 1000) * sampleRate));
  for (const voice of recipe) {
    const start = Math.round((voice.offsetMs / 1000) * sampleRate);
    synthesizeVoice(voice, sampleRate).forEach((sample, i) => {
      if (start + i < mix.length) mix[start + i] = (mix[start + i] ?? 0) + sample;
    });
  }
  const peak = mix.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  return peak > PEAK_LIMIT ? mix.map((sample) => (sample * PEAK_LIMIT) / peak) : mix;
}
```

```ts
// packages/shell/src/services/audio/synth/ui-sounds.ts
import type { SoundRecipe } from './synthesize-recipe.ts';

/** Shell menu sounds (category 'ui'). Games add their own bank; ids must not collide. */
export const UI_SOUNDS = {
  'ui.tap': [
    {
      wave: 'triangle',
      startHz: 1400,
      endHz: 900,
      offsetMs: 0,
      durationMs: 45,
      attackMs: 1,
      gain: 0.35,
    },
  ],
  'ui.toggle': [
    {
      wave: 'sine',
      startHz: 660,
      endHz: 660,
      offsetMs: 0,
      durationMs: 60,
      attackMs: 2,
      gain: 0.35,
    },
    {
      wave: 'sine',
      startHz: 990,
      endHz: 990,
      offsetMs: 45,
      durationMs: 70,
      attackMs: 2,
      gain: 0.3,
    },
  ],
  'ui.win': [
    {
      wave: 'triangle',
      startHz: 523.25,
      endHz: 523.25,
      offsetMs: 0,
      durationMs: 140,
      attackMs: 4,
      gain: 0.4,
    },
    {
      wave: 'triangle',
      startHz: 659.25,
      endHz: 659.25,
      offsetMs: 110,
      durationMs: 140,
      attackMs: 4,
      gain: 0.4,
    },
    {
      wave: 'triangle',
      startHz: 783.99,
      endHz: 783.99,
      offsetMs: 220,
      durationMs: 320,
      attackMs: 4,
      gain: 0.45,
    },
  ],
  'ui.lose': [
    {
      wave: 'square',
      startHz: 330,
      endHz: 196,
      offsetMs: 0,
      durationMs: 420,
      attackMs: 6,
      gain: 0.3,
    },
  ],
} as const satisfies Readonly<Record<string, SoundRecipe>>;
```

```ts
// apps/line-siege/src/sounds/sound-bank.ts
import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';

/** Spec 10 "sound set": ids match Track cues. The Shell loads its own UI_SOUNDS beside it. */
export const SOUND_BANK: SoundBank = {
  place: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 520,
        endHz: 380,
        offsetMs: 0,
        durationMs: 70,
        attackMs: 2,
        gain: 0.5,
      },
    ],
  },
  beam: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 300,
        endHz: 1200,
        offsetMs: 0,
        durationMs: 240,
        attackMs: 8,
        gain: 0.45,
      },
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 0,
        durationMs: 160,
        attackMs: 4,
        gain: 0.15,
        seed: 3,
      },
    ],
  },
  hit: {
    category: 'sfx',
    minIntervalMs: 60,
    recipe: [
      {
        wave: 'square',
        startHz: 180,
        endHz: 90,
        offsetMs: 0,
        durationMs: 120,
        attackMs: 1,
        gain: 0.35,
      },
    ],
  },
};
```

```ts
// packages/shell/src/services/audio/synth/synthesize-recipe.test.ts
import { synthesizeRecipe } from './synthesize-recipe.ts';
import { UI_SOUNDS } from './ui-sounds.ts';

const RATE = 48_000;

describe('synth recipes', () => {
  it.each(Object.entries(UI_SOUNDS))('renders %s as a clean, click-free buffer', (_id, recipe) => {
    const samples = synthesizeRecipe(recipe, RATE);
    const peak = samples.reduce((max, s) => Math.max(max, Math.abs(s)), 0);
    expect(samples.length).toBeGreaterThan(RATE / 100);
    expect(samples.every((s) => Number.isFinite(s))).toBe(true);
    expect(peak).toBeGreaterThan(0.05);
    expect(peak).toBeLessThanOrEqual(0.9);
    expect(Math.abs(samples[0] ?? 1)).toBeLessThan(0.05);
    expect(Math.abs(samples.at(-1) ?? 1)).toBeLessThan(0.01);
  });

  it('renders identical bytes every time (seeded noise, no clocks)', () => {
    const noisy = [
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 0,
        durationMs: 80,
        attackMs: 1,
        gain: 0.5,
        seed: 9,
      },
    ] as const;
    expect(synthesizeRecipe(noisy, RATE)).toStrictEqual(synthesizeRecipe(noisy, RATE));
  });
});
```

Sound design guide (starting points, tuned by ear with the WAV preview):

| Event type | Recipe shape |
|---|---|
| tap / place | triangle, 45–80 ms, pitch falling ~30 %, attack 1–2 ms |
| clear / beam / merge | sine sweep up (300 → 1200 Hz) over 200–300 ms plus 150 ms of soft noise (gain ≤ 0.15) |
| hit | square, 100–150 ms, falling an octave; `minIntervalMs: 60` for rapid hits |
| win | three rising triangle notes (C5–E5–G5), 110 ms apart |
| lose | square falling a sixth over 400 ms |

The synth may use `Math.sin` (it is not simulation code). It still takes randomness only from the seeded PRNG, so previews and device buffers are identical.

### 5.2 The WAV preview script

```ts
// packages/tooling/src/audio/encode-wav.ts
/** Mono float samples (−1…1) → 16-bit PCM WAV bytes (RIFF, little-endian). */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const view = new DataView(new ArrayBuffer(44 + dataBytes));
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);
  samples.forEach((sample, i) => {
    view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true);
  });
  return new Uint8Array(view.buffer);
}
```

```ts
// packages/tooling/src/audio/render-sfx-wav.ts
// Usage: node packages/tooling/src/audio/render-sfx-wav.ts --app line-siege
// Writes apps/<app>/sfx-preview/<sound-id>.wav (gitignored) so the owner can listen in Finder.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { synthesizeRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';

import { encodeWav } from './encode-wav.ts';

import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';

const SAMPLE_RATE = 48_000;

const { values } = parseArgs({ options: { app: { type: 'string' } } });
const app = values.app ?? '';
if (!/^[a-z][a-z0-9-]*$/.test(app)) throw new Error('Pass --app <game-id>, e.g. --app line-siege');

const { SOUND_BANK: bank } = (await import(`@e07/${app}/sounds/sound-bank.ts`)) as {
  readonly SOUND_BANK?: SoundBank;
};
if (bank === undefined)
  throw new Error(`apps/${app}/src/sounds/sound-bank.ts must export SOUND_BANK`);

const outDir = join('apps', app, 'sfx-preview');
mkdirSync(outDir, { recursive: true });
for (const [id, spec] of Object.entries(bank)) {
  const samples = synthesizeRecipe(spec.recipe, SAMPLE_RATE);
  writeFileSync(join(outDir, `${id}.wav`), encodeWav(samples, SAMPLE_RATE));
  console.log(`${id}.wav  ${String(Math.round((samples.length / SAMPLE_RATE) * 1000))} ms`);
}
```

Run it from the repo root: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/audio/render-sfx-wav.ts --app line-siege`. This was verified: it wrote the 3 Line Siege sounds, `afinfo` reported `1 ch, 48000 Hz, Int16`, and two runs produced identical bytes. `apps/*/sfx-preview/` is in the root `.gitignore` (docs/16 section 4). The warning flag silences Node's notice about the app package, which has no `"type"` field (the Shell, game-kit and tooling declare `"type": "module"`, docs/04; Expo apps do not, docs/07).

## 6. Haptics

### 6.1 Port, policy, adapter, fake

```ts
// packages/shell/src/services/haptics/haptics-port.ts
import type { HapticCue } from '@e07/game-kit/timeline/track.ts';

export type { HapticCue };

/** The ONLY haptics API the Shell and games use. Adapter: expo-haptics-adapter.ts. */
export type HapticsPort = {
  /** False on devices without a Taptic Engine: Settings hides the Vibration row. */
  readonly isSupported: boolean;
  /** Fire-and-forget. Gated by the Vibration setting and throttled; never throws. */
  readonly play: (cue: HapticCue) => void;
};
```

```ts
// packages/shell/src/services/haptics/should-pulse.ts
export const MIN_HAPTIC_GAP_MS = 40;

export type HapticGate = {
  readonly isEnabled: boolean;
  readonly lastAtMs: number | null;
  readonly nowMs: number;
};

/** Pure: Vibration setting on, and at least 40 ms since the last pulse (bursts feel mushy). */
export function shouldPulse(gate: HapticGate): boolean {
  if (!gate.isEnabled) return false;
  if (gate.lastAtMs === null) return true;
  const gapMs = gate.nowMs - gate.lastAtMs;
  // ClockPort.nowMs is wall-clock time: a clock set backwards must not mute haptics.
  return gapMs < 0 || gapMs >= MIN_HAPTIC_GAP_MS;
}
```

```ts
// packages/shell/src/services/haptics/expo-haptics-adapter.ts
// The ONLY file that imports expo-haptics.
import {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  selectionAsync,
} from 'expo-haptics';
import { Platform } from 'react-native';

import { shouldPulse } from './should-pulse.ts';

import type { HapticCue, HapticsPort } from './haptics-port.ts';

export type HapticsDeps = {
  /** Current value of the Vibration setting (read at call time). */
  readonly isEnabled: () => boolean;
  /** ClockPort.nowMs (epoch ms, docs/02); never Date.now(). */
  readonly nowMs: () => number;
};

/** The mapping table from docs/09-sound-haptics-art.md, as code. */
function fire(cue: HapticCue): Promise<void> {
  switch (cue) {
    case 'selection':
      return selectionAsync();
    case 'light':
      return impactAsync(ImpactFeedbackStyle.Light);
    case 'medium':
      return impactAsync(ImpactFeedbackStyle.Medium);
    case 'heavy':
      return impactAsync(ImpactFeedbackStyle.Heavy);
    case 'success':
      return notificationAsync(NotificationFeedbackType.Success);
    case 'warning':
      return notificationAsync(NotificationFeedbackType.Warning);
    case 'error':
      return notificationAsync(NotificationFeedbackType.Error);
  }
}

/** iPads have no Taptic Engine; phones do. Android (later) is treated as supported. */
function hasHaptics(): boolean {
  return Platform.OS === 'ios' ? !Platform.isPad : true;
}

export function createExpoHapticsAdapter(deps: HapticsDeps): HapticsPort {
  let lastAtMs: number | null = null;
  const isSupported = hasHaptics();
  return {
    isSupported,
    play: (cue) => {
      const nowMs = deps.nowMs();
      if (!isSupported || !shouldPulse({ isEnabled: deps.isEnabled(), lastAtMs, nowMs })) return;
      lastAtMs = nowMs;
      fire(cue).catch(() => undefined);
    },
  };
}
```

```ts
// packages/shell/src/services/haptics/fake-haptics.ts
import type { HapticCue, HapticsPort } from './haptics-port.ts';

export function createFakeHaptics(
  isSupported = true,
): HapticsPort & { readonly played: HapticCue[] } {
  const played: HapticCue[] = [];
  return { isSupported, played, play: (cue) => played.push(cue) };
}
```

```ts
// packages/shell/src/services/haptics/should-pulse.test.ts
import { MIN_HAPTIC_GAP_MS, shouldPulse } from './should-pulse.ts';

describe('shouldPulse', () => {
  it('stays silent when Vibration is off', () => {
    expect(shouldPulse({ isEnabled: false, lastAtMs: null, nowMs: 0 })).toBe(false);
  });

  it('throttles pulses closer than the minimum gap', () => {
    expect(
      shouldPulse({ isEnabled: true, lastAtMs: 1000, nowMs: 1000 + MIN_HAPTIC_GAP_MS - 1 }),
    ).toBe(false);
    expect(shouldPulse({ isEnabled: true, lastAtMs: 1000, nowMs: 1000 + MIN_HAPTIC_GAP_MS })).toBe(
      true,
    );
  });

  it('pulses again after the wall clock jumps backwards', () => {
    expect(shouldPulse({ isEnabled: true, lastAtMs: 5000, nowMs: 1000 })).toBe(true);
  });
});
```

`nowMs` is `ClockPort.nowMs` (docs/02). It is wall-clock epoch time, so `shouldPulse` also lets a pulse through when the clock has jumped backwards. The adapter reads no clock itself (docs/04).

### 6.2 The mapping table

| `HapticCue` | iOS call (expo-haptics 57.0.3) | Use for | Android later (`performAndroidHapticsAsync`) |
|---|---|---|---|
| `selection` | `selectionAsync()` | toggles, picker steps, tray selection | `AndroidHaptics.Segment_Tick` |
| `light` | `impactAsync(ImpactFeedbackStyle.Light)` | place a piece, move a tile | `AndroidHaptics.Context_Click` |
| `medium` | `impactAsync(ImpactFeedbackStyle.Medium)` | line or column clear, merge, capture | `AndroidHaptics.Confirm` |
| `heavy` | `impactAsync(ImpactFeedbackStyle.Heavy)` | big combo, breach, explosion | `AndroidHaptics.Long_Press` |
| `success` | `notificationAsync(NotificationFeedbackType.Success)` | level won, daily done | `AndroidHaptics.Confirm` |
| `warning` | `notificationAsync(NotificationFeedbackType.Warning)` | illegal move rejected, last life | `AndroidHaptics.Reject` |
| `error` | `notificationAsync(NotificationFeedbackType.Error)` | level lost | `AndroidHaptics.Reject` |

Rules of use:

- Fire haptics only on meaningful events: never per frame, never from a real-time sim's per-tick events.
- Buttons use no haptics, except `selection` on toggles.
- The 40 ms throttle drops extra pulses, so a cascade feels like one strong event instead of a buzz.
- The owner judges strength on a phone. The simulator has no Taptic Engine; `selectionAsync()` was called there without error.

## 7. The art pipeline

### 7.1 What is generated, from what

| Output | File | Source | Consumer |
|---|---|---|---|
| App icon, light | `apps/<game>/assets/generated/icon-light.png` (1024², opaque) | `drawIcon(variant 'light')` + light palette | `icon`, `ios.icon.light` |
| App icon, dark | `…/icon-dark.png` (1024², transparent background) | `drawIcon('dark')` + dark palette | `ios.icon.dark` |
| App icon, tinted | `…/icon-tinted.png` (1024², grayscale) | `drawIcon('tinted')` + dark palette + a luma colour filter | `ios.icon.tinted` |
| Splash logo | `…/splash-logo.png`, `…/splash-logo-dark.png` (1024², transparent) | `drawIcon('logo')` | `expo-splash-screen` plugin |
| Board previews | `test/goldens/boards/__image_snapshots__/<game>-*.png`; headless previews via docs/07's `render-board-previews.ts` | the board goldens (docs/08) | owner review gallery |
| App Store screenshots | simulator captures | the screenshot matrix (docs/07 section 3.13) | store listing |
| Google Play (later) | `play-icon-512.png`, `feature-graphic.png` (1024 × 500) | add two `OUTPUTS` rows to `render-art.ts` | Play Console |

The App Store takes its large icon from the binary's asset catalog; no separate marketing icon is uploaded.

### 7.2 Palette tokens

Each game's colours are data:

```json
{
  "light": {
    "background": "#f4f1ea",
    "cell": "#e2ddd1",
    "block": "#2f6fd6",
    "beam": "#ffb000",
    "monster": "#c2362f",
    "number": "#ffffff",
    "ghost": "#2f6fd680"
  },
  "dark": {
    "background": "#14161c",
    "cell": "#272b37",
    "block": "#4f86e8",
    "beam": "#ffc94d",
    "monster": "#e0564e",
    "number": "#ffffff",
    "ghost": "#4f86e880"
  },
  "colorBlindLight": {
    "background": "#f4f1ea",
    "cell": "#e2ddd1",
    "block": "#0072b2",
    "beam": "#e69f00",
    "monster": "#d55e00",
    "number": "#ffffff",
    "ghost": "#0072b280"
  },
  "colorBlindDark": {
    "background": "#14161c",
    "cell": "#272b37",
    "block": "#56b4e9",
    "beam": "#f0e442",
    "monster": "#e69f00",
    "number": "#000000",
    "ghost": "#56b4e980"
  }
}
```

```ts
// apps/line-siege/src/board/board-palettes.ts
import palettes from './board-palettes.json' with { type: 'json' };

import type { PaletteSet } from '@e07/shell/game-host/board-kit.ts';

/** Semantic colour tokens of the board; the values live in board-palettes.json (docs/04 rule 8). */
export type BoardToken = keyof typeof palettes.light;

/** light / dark / colour-blind light / colour-blind dark, checked against the PaletteSet shape. */
export const BOARD_PALETTES: PaletteSet<BoardToken> = palettes;
```

Import JSON with `with { type: 'json' }`. This was verified to work in `tsc`, ESLint, Jest, Metro (`expo export`) and Node 26, which requires the attribute. Token rules:

- Tokens are semantic (`block`, `monster`, `beam`), never visual (`blue`).
- All four sets have the same keys; `PaletteSet<BoardToken>` rejects a missing token.
- Colour-blind sets use a CVD-safe hue family (the example uses Okabe–Ito colours). Meaning is also carried by shape or symbol in `draw()`, because spec S11 says nothing may be told apart by colour alone.
- `#RRGGBBAA` is allowed for translucent tokens (the ghost).
- docs/05 derives the UI tokens (backgrounds, text, accents) from this file, and docs/15's contrast tests check them (docs/05 open issue 8 tracks the mapping).

`makeBoardColors(skia, palettes, { scheme, isColorBlind })` (docs/08, `board-kit.ts`) resolves the tokens once per theme change.

### 7.3 Drawing the icon

```ts
// packages/shell/src/art/game-art.ts
import type { CreditEntry } from './credit-entry.ts';
import type { PaletteSet } from '@e07/shell/game-host/board-kit.ts';
import type { BoardColors, RenderKit, SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

/**
 * light:  opaque, full-bleed square (iOS masks the corners; Expo flattens transparency onto white).
 * dark:   transparent background, glyph only (iOS supplies the dark backdrop).
 * tinted: opaque grayscale (iOS applies the user's tint).
 * logo:   transparent glyph for the splash screen and the in-app S1 logo.
 */
export type ArtVariant = 'light' | 'dark' | 'tinted' | 'logo';

export type ArtFrame<TToken extends string> = {
  readonly size: number;
  readonly variant: ArtVariant;
  readonly colors: BoardColors<TToken>;
  readonly kit: RenderKit;
};

/** What each game exports from apps/<game>/src/art/game-art.ts (docs/02: presentation.art). */
export type GameArt<TToken extends string> = {
  readonly palettes: PaletteSet<TToken>;
  /** Unit paths shared with the board (same shapes on the icon and in play). */
  readonly buildPaths: (skia: SkiaApi) => RenderKit['paths'];
  readonly drawIcon: (canvas: SkCanvas, frame: ArtFrame<TToken>) => void;
  /** S11d rows for the game's fonts, CC0 sounds and word lists (its credits.json). */
  readonly credits: readonly CreditEntry[];
};
```

```ts
// apps/line-siege/src/art/draw-icon.ts
import type { BoardToken } from '@e07/line-siege/board/board-palettes.ts';
import type { ArtFrame } from '@e07/shell/art/game-art.ts';
import type { SkCanvas, SkColor } from '@shopify/react-native-skia';

/** Keep the glyph inside the central 62 % (Android adaptive safe zone is 66 %; iOS masks corners). */
const GLYPH_SCALE = 0.62;

function backgroundFor(frame: ArtFrame<BoardToken>): SkColor | null {
  switch (frame.variant) {
    case 'light':
      return frame.colors.color.block;
    case 'tinted':
      return frame.colors.color.background;
    case 'dark':
    case 'logo':
      return null;
  }
}

/** Shield + beam, drawn from the same unit path the board uses. Pure: canvas in, pixels out. */
export function drawIcon(canvas: SkCanvas, frame: ArtFrame<BoardToken>): void {
  const { size, colors, kit } = frame;
  const background = backgroundFor(frame);
  if (background !== null) canvas.drawColor(background);
  const shield = kit.paths['shield'];
  if (shield === undefined) return;
  const glyph = size * GLYPH_SCALE;
  canvas.save();
  canvas.translate((size - glyph) / 2, (size - glyph) / 2);
  canvas.scale(glyph, glyph);
  kit.fill.setColor(frame.variant === 'light' ? colors.color.number : colors.color.block);
  canvas.drawPath(shield, kit.fill);
  kit.fill.setColor(colors.color.beam);
  canvas.drawRect({ x: 0.44, y: 0.12, width: 0.12, height: 0.76 }, kit.fill);
  canvas.restore();
}
```

```ts
// apps/line-siege/src/art/game-art.ts

import { BOARD_PALETTES } from '@e07/line-siege/board/board-palettes.ts';
import { lineSiegeBoard } from '@e07/line-siege/board/line-siege-board.ts';
import credits from '@e07/line-siege/credits/credits.json' with { type: 'json' };

import { drawIcon } from './draw-icon.ts';

import type { BoardToken } from '@e07/line-siege/board/board-palettes.ts';
import type { CreditEntry } from '@e07/shell/art/credit-entry.ts';
import type { GameArt } from '@e07/shell/art/game-art.ts';

export const GAME_ART: GameArt<BoardToken> = {
  palettes: BOARD_PALETTES,
  buildPaths: lineSiegeBoard.buildPaths,
  drawIcon,
  // JSON widens `kind` to string; credits.test.ts validates every row with creditProblems.
  credits: credits as readonly CreditEntry[],
};
```

The icon reuses the board's unit paths (`buildPaths`), so the icon and the game look like one product.

### 7.4 The render script

```ts
// packages/tooling/src/art/render-art.ts
// Usage: node packages/tooling/src/art/render-art.ts --app line-siege [--check]
// Renders the app icon variants and splash logos with headless Skia (CanvasKit) from the
// game's own draw code. Writes apps/<app>/assets/generated/*.png (committed).
// --check re-renders in memory and exits 1 if a committed file is stale.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';

import type { ArtVariant, GameArt } from '@e07/shell/art/game-art.ts';
import type { SkiaApi } from '@e07/shell/game-host/board-types.ts';

type Output = {
  readonly file: string;
  readonly variant: ArtVariant;
  readonly scheme: 'light' | 'dark';
};

const SIZE = 1024;
const OUTPUTS: readonly Output[] = [
  { file: 'icon-light.png', variant: 'light', scheme: 'light' },
  { file: 'icon-dark.png', variant: 'dark', scheme: 'dark' },
  { file: 'icon-tinted.png', variant: 'tinted', scheme: 'dark' },
  { file: 'splash-logo.png', variant: 'logo', scheme: 'light' },
  { file: 'splash-logo-dark.png', variant: 'logo', scheme: 'dark' },
];
/** Rec. 709 luma: the tinted icon must be grayscale. */
const GRAYSCALE = [
  0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0,
  1, 0,
];

/** Skia has no `exports` map: deep imports need the `.js` extension under Node ESM (docs/04). */
async function loadHeadlessSkia(): Promise<SkiaApi> {
  const { LoadSkiaWeb } =
    await import('@shopify/react-native-skia/lib/commonjs/web/LoadSkiaWeb.js');
  await LoadSkiaWeb();
  const headless = await import('@shopify/react-native-skia/lib/commonjs/headless/index.js');
  // The CommonJS build declares its own copy of the Skia types; the runtime API is the same.
  return headless.getSkiaExports().Skia as unknown as SkiaApi;
}

function renderOne<TToken extends string>(
  skia: SkiaApi,
  art: GameArt<TToken>,
  output: Output,
): Uint8Array {
  const surface = skia.Surface.Make(SIZE, SIZE);
  if (surface === null) throw new Error('No offscreen surface');
  const canvas = surface.getCanvas();
  const colors = makeBoardColors(skia, art.palettes, {
    scheme: output.scheme,
    isColorBlind: false,
  });
  const kit = makeBoardKit(skia, {
    paths: art.buildPaths(skia),
    numberTypeface: null,
    numberSize: 0,
  });
  if (output.variant === 'tinted') {
    const gray = skia.Paint();
    gray.setColorFilter(skia.ColorFilter.MakeMatrix(GRAYSCALE));
    canvas.saveLayer(gray);
  }
  art.drawIcon(canvas, { size: SIZE, variant: output.variant, colors, kit });
  if (output.variant === 'tinted') canvas.restore();
  surface.flush();
  return surface.makeImageSnapshot().encodeToBytes();
}

const { values } = parseArgs({
  options: { app: { type: 'string' }, check: { type: 'boolean', default: false } },
});
const app = values.app ?? '';
if (!/^[a-z][a-z0-9-]*$/.test(app)) throw new Error('Pass --app <game-id>, e.g. --app line-siege');
const { GAME_ART: art } = (await import(`@e07/${app}/art/game-art.ts`)) as {
  readonly GAME_ART?: GameArt<string>;
};
if (art === undefined) throw new Error(`apps/${app}/src/art/game-art.ts must export GAME_ART`);

const skia = await loadHeadlessSkia();
const outDir = join('apps', app, 'assets', 'generated');
mkdirSync(outDir, { recursive: true });
const stale: string[] = [];
for (const output of OUTPUTS) {
  const png = renderOne(skia, art, output);
  const path = join(outDir, output.file);
  if (values.check) {
    if (!existsSync(path) || !Buffer.from(png).equals(readFileSync(path))) stale.push(path);
  } else {
    writeFileSync(path, png);
    console.log(`wrote ${path}`);
  }
}
if (stale.length > 0) {
  console.error(`Stale generated art (run without --check and commit):\n${stale.join('\n')}`);
  process.exitCode = 1;
}
```

Commands, run from the repo root:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/art/render-art.ts --app line-siege           # writes, ~0.4 s
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/art/render-art.ts --app line-siege --check   # exits 1 if stale
```

- Run it after any change to `draw-icon.ts`, the paths or the palette. Commit the five PNGs. Before committing, look at them with the Read tool, downscaled to 256 px as well (`sips -Z 256 in.png --out out.png`): a glyph that reads at 60 px on the Home Screen must read at 256.
- The `--check` run belongs in `verify` next to `audit:licenses` (docs/16 owns the script list).
- A Skia upgrade can change anti-aliasing bytes. Re-render, review and commit with a `Gate-Change:` trailer.
- **Liquid Glass.** iOS 26 applies its glass effects to flat icons too, and generates the clear appearances itself. Icon Composer `.icon` bundles (Expo supports `ios.icon: './assets/app.icon'`) give per-layer control, but their `icon.json` format is Apple's tool output, not a documented schema. v1 ships flat PNGs (see Open issues).

### 7.5 Sprites: pre-render once, invalidate on theme change

```ts
// packages/shell/src/game-host/sprite-cache.ts
// Sprites drawn in code (N9) are pre-rendered ONCE per theme into one image, then blitted
// with drawImageRect or <Atlas>. The cache key covers everything that changes the pixels.
import type { SkiaApi } from './board-types.ts';
import type { SkCanvas, SkImage, SkRect } from '@shopify/react-native-skia';

export type SpriteSpec = {
  readonly id: string;
  /** Draws the sprite into a size×size cell whose origin is the canvas origin. */
  readonly draw: (canvas: SkCanvas, size: number) => void;
};

export type SpriteSheetInput = {
  /** paletteId + scheme + colour-blind + cell size + pixel ratio, e.g. 'line-siege:dark:cb0:44@3'. */
  readonly key: string;
  readonly sprites: readonly SpriteSpec[];
  /** Cell size in points and the device pixel ratio (PixelRatio.get()). */
  readonly cellPt: number;
  readonly pixelRatio: number;
};

export type SpriteSheet = {
  readonly key: string;
  readonly image: SkImage;
  /** Source rectangle of each sprite in image pixels. */
  readonly rects: Readonly<Partial<Record<string, SkRect>>>;
  readonly cellPx: number;
};

export type SpriteCache = { readonly sheetFor: (input: SpriteSheetInput) => SpriteSheet };

/** Renders all sprites side by side into one CPU-backed image (safe to share with the UI thread). */
export function buildSpriteSheet(skia: SkiaApi, input: SpriteSheetInput): SpriteSheet {
  const cellPx = Math.round(input.cellPt * input.pixelRatio);
  const surface = skia.Surface.MakeOffscreen(cellPx * input.sprites.length, cellPx);
  if (surface === null) throw new Error('Offscreen surface unavailable');
  const canvas = surface.getCanvas();
  const rects: Partial<Record<string, SkRect>> = {};
  input.sprites.forEach((sprite, index) => {
    canvas.save();
    canvas.translate(index * cellPx, 0);
    sprite.draw(canvas, cellPx);
    canvas.restore();
    rects[sprite.id] = { x: index * cellPx, y: 0, width: cellPx, height: cellPx };
  });
  surface.flush();
  const image = surface.makeImageSnapshot().makeNonTextureImage();
  if (image === null) throw new Error('Sprite sheet snapshot failed');
  return { key: input.key, image, rects, cellPx };
}

/** One cache per app (composition root). A new key disposes the old image before building. */
export function createSpriteCache(skia: SkiaApi): SpriteCache {
  let current: SpriteSheet | null = null;
  return {
    sheetFor: (input) => {
      if (current?.key === input.key) return current;
      current?.image.dispose();
      current = buildSpriteSheet(skia, input);
      return current;
    },
  };
}
```

```ts
// packages/shell/src/game-host/sprite-cache.golden.test.ts
import { Skia } from '@shopify/react-native-skia';

import { createSpriteCache } from './sprite-cache.ts';

import type { SpriteSpec } from './sprite-cache.ts';

function disc(id: string, hex: string): SpriteSpec {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(hex));
  return {
    id,
    draw: (canvas, size) => {
      canvas.drawCircle(size / 2, size / 2, size * 0.4, paint);
    },
  };
}

describe('sprite cache', () => {
  it('renders every sprite into its own cell at device pixels', () => {
    const cache = createSpriteCache(Skia);
    const input = {
      key: 'demo:dark:cb0:10@3',
      sprites: [disc('red', '#ff0000'), disc('blue', '#0000ff')],
      cellPt: 10,
      pixelRatio: 3,
    };
    const sheet = cache.sheetFor(input);
    expect(sheet.cellPx).toBe(30);
    expect([sheet.image.width(), sheet.image.height()]).toStrictEqual([60, 30]);
    expect(sheet.rects['blue']).toStrictEqual({ x: 30, y: 0, width: 30, height: 30 });
  });

  it('rebuilds only when the key changes (theme, palette, size)', () => {
    const cache = createSpriteCache(Skia);
    const input = {
      key: 'demo:dark:cb0:10@3',
      sprites: [disc('red', '#ff0000')],
      cellPt: 10,
      pixelRatio: 3,
    };
    const first = cache.sheetFor(input);
    expect(cache.sheetFor(input)).toBe(first);
    expect(cache.sheetFor({ ...input, key: 'demo:light:cb0:10@3' })).not.toBe(first);
  });
});
```

Usage:

- **Creation.** The composition root creates one cache: `createSpriteCache(Skia)`.
- **Getting a sheet.** The Game screen calls `sheetFor({ key, sprites, cellPt, pixelRatio: PixelRatio.get() })` and puts the sheet in the render kit.
- **Few sprites.** `draw()` blits a sprite with `canvas.drawImageRect(sheet.image, rect, dest, kit.fill)`.
- **Hundreds of sprites (Halo Drift).** Use `<Atlas image={sheet.image} sprites={…} transforms={…} />` with `useRSXformBuffer`. *Source:* [Skia Atlas](https://shopify.github.io/react-native-skia/docs/shapes/atlas).
- **What goes in the key.** Everything that changes pixels: palette id, scheme, colour-blind flag, cell size and pixel ratio. A rotation that changes the cell size therefore rebuilds the sheet.
- **Why a snapshot.** `makeNonTextureImage()` turns the GPU snapshot into a CPU-backed image that can be shared with the UI thread. This is the same pattern as Skia's own `drawAsImageFromPicture`.

### 7.6 Fonts on boards and in art

docs/10 owns the font files (`apps/<game>/assets/fonts/Vazirmatn-{Regular,Bold}.ttf` + `OFL.txt`), the `expo-font` plugin entry (`['expo-font', { fonts: ['./assets/fonts/Vazirmatn-Regular.ttf', './assets/fonts/Vazirmatn-Bold.ttf'] }]`, family names `Vazirmatn-Regular`/`Vazirmatn-Bold`) and the UI line heights (1.5 × for Arabic script, 1.3 × for Latin, tuned in screenshots; never `fontWeight` with a custom family). For Skia:

- **On the device.** `Skia.FontMgr.System().matchFamilyStyle('Vazirmatn', { weight: 400, width: 5, slant: 0 })` gives the typeface for `makeBoardKit`. Paragraphs built without a provider resolve `fontFamilies: ['Vazirmatn']`. This was verified on the iOS 26.5 simulator once the plugin had embedded the fonts: `countFamilies()` listed `Vazirmatn`, and a Persian and Sorani Paragraph and the `۱۲` digits rendered.
- **In Jest goldens and Node scripts.** Load the TTF with `Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(bytes))`, and register it in a `Skia.TypefaceFontProvider` for paragraphs. The docs/08 goldens do this.
- **Board line height.** For Paragraph labels, set `heightMultiplier: 1.5` in the text style for Arabic script, the same ratio as docs/10.
- **Icons.** They contain no text, so `render-art.ts` loads no fonts.

## 8. App icon requirements (summary)

| Requirement | Value | Checked by |
|---|---|---|
| Size and shape | 1024 × 1024 px, square, unmasked, sRGB | `render-art.ts` constant; `sips -g pixelWidth -g pixelHeight` |
| Light | opaque, full-bleed background | Expo flattens alpha onto white, so draw a background (a transparent light icon would turn white) |
| Dark | transparent background, glyph only | Apple: "Provide your dark app icon with a transparent background" |
| Tinted | grayscale | luma colour filter in `render-art.ts`; Apple: "Provide your tinted app icon as a grayscale image" |
| Content | one simple glyph inside the central 62 %; no text, no photos, no fake gloss or shadows | review; HIG "Let the system handle blurring and other visual effects" |
| Sizes | only 1024; Xcode derives every other size from a single-size icon | Apple: apps "can auto-generate all icon variations from a single 1024×1024 pixel image" |
| Config | `icon` + `ios.icon: { light, dark, tinted }` | prebuild output (section 3) |
| Android (later) | `android.adaptiveIcon` foreground = logo variant, background = palette colour, monochrome = a white glyph | add outputs when Android starts |

## 9. Licences and credits for S11d

The S11d screen (`screens/licences/`, route `Licences` in docs/06) shows three lists. Headings and explanations come from the catalogs through `t()`; proper names do not.

1. **npm packages** in the release bundle, with their SPDX licence. `npm run audit:licenses` (docs/16) already computes this set from the bundle source maps; it should also write it to a JSON file for the screen (Open issues).
2. **Native code compiled into every app** but not visible to a JS audit (`shell-notices.json`, below).
3. **Game credits** (`apps/<game>/src/credits/credits.json`): fonts, CC0 sounds (none in v1: every sound is generated in code), and word lists (Letter Bugs). The game passes them as `GAME_ART.credits`; `CreditEntry` and `creditProblems` live in the game-facing `packages/shell/src/art/` folder so app code may import them.

The screen also shows one catalog sentence per game: "Graphics and sounds were created in code for this game." (key `licences.generated-assets`).

```ts
// packages/shell/src/art/credit-entry.ts

/** What an S11d row is about; the screen groups rows by kind. */
export type CreditKind = 'font' | 'sound' | 'word-list' | 'native-library' | 'npm-package';

/** One row of the S11d licences screen. Proper names are not translated; headings are. */
export type CreditEntry = {
  readonly kind: CreditKind;
  readonly name: string;
  readonly version: string;
  /** SPDX identifier, or 'LicenseRef-<name>' for non-SPDX terms (Google SDK terms). */
  readonly license: string;
  readonly copyright: string;
  readonly url: string;
};
```

```json
[
  {
    "kind": "native-library",
    "name": "Skia Graphics Library (inside @shopify/react-native-skia 2.6.2)",
    "version": "m-series bundled by 2.6.2",
    "license": "BSD-3-Clause",
    "copyright": "Copyright (c) 2011 Google Inc.",
    "url": "https://skia.googlesource.com/skia/+/main/LICENSE"
  },
  {
    "kind": "native-library",
    "name": "Hermes JavaScript engine",
    "version": "bundled by React Native 0.86.3",
    "license": "MIT",
    "copyright": "Copyright (c) Meta Platforms, Inc. and affiliates.",
    "url": "https://github.com/facebook/hermes/blob/main/LICENSE"
  },
  {
    "kind": "native-library",
    "name": "Folly (RCT-Folly)",
    "version": "2024.11.18.00 (React Native 0.86.3)",
    "license": "Apache-2.0",
    "copyright": "Copyright (c) Meta Platforms, Inc. and affiliates.",
    "url": "https://github.com/facebook/folly/blob/main/LICENSE"
  },
  {
    "kind": "native-library",
    "name": "Boost",
    "version": "1.84.0 (React Native 0.86.3)",
    "license": "BSL-1.0",
    "copyright": "Boost Software License 1.0",
    "url": "https://www.boost.org/LICENSE_1_0.txt"
  },
  {
    "kind": "native-library",
    "name": "{fmt}",
    "version": "12.1.0 (React Native 0.86.3)",
    "license": "MIT",
    "copyright": "Copyright (c) 2012 - present, Victor Zverovich and {fmt} contributors",
    "url": "https://github.com/fmtlib/fmt/blob/master/LICENSE"
  },
  {
    "kind": "native-library",
    "name": "fast_float",
    "version": "8.0.0 (React Native 0.86.3)",
    "license": "MIT",
    "copyright": "Copyright (c) 2021 The fast_float authors",
    "url": "https://github.com/fastfloat/fast_float/blob/main/LICENSE-MIT"
  },
  {
    "kind": "native-library",
    "name": "double-conversion",
    "version": "1.1.6 (React Native 0.86.3)",
    "license": "BSD-3-Clause",
    "copyright": "Copyright 2006-2011, the V8 project authors",
    "url": "https://github.com/google/double-conversion/blob/master/LICENSE"
  },
  {
    "kind": "native-library",
    "name": "glog",
    "version": "0.3.5 (React Native 0.86.3)",
    "license": "BSD-3-Clause",
    "copyright": "Copyright (c) 2008, Google Inc.",
    "url": "https://github.com/google/glog/blob/v0.3.5/COPYING"
  },
  {
    "kind": "native-library",
    "name": "miniaudio (inside react-native-audio-api 0.13.6)",
    "version": "0.13.6",
    "license": "MIT-0",
    "copyright": "Copyright 2025 David Reid (public domain or MIT No Attribution)",
    "url": "https://github.com/mackron/miniaudio"
  },
  {
    "kind": "native-library",
    "name": "PFFFT (inside react-native-audio-api 0.13.6)",
    "version": "0.13.6",
    "license": "LicenseRef-FFTPACK",
    "copyright": "Copyright (c) 2013 Julien Pommier; Copyright (c) 2004 the University Corporation for Atmospheric Research",
    "url": "https://github.com/marton78/pffft"
  },
  {
    "kind": "native-library",
    "name": "moodycamel ConcurrentQueue (inside react-native-audio-api 0.13.6)",
    "version": "0.13.6",
    "license": "BSD-2-Clause",
    "copyright": "Copyright (c) 2013-2020, Cameron Desrochers",
    "url": "https://github.com/cameron314/concurrentqueue"
  },
  {
    "kind": "native-library",
    "name": "r8brain-free-src (inside react-native-audio-api 0.13.6)",
    "version": "0.13.6",
    "license": "MIT",
    "copyright": "Copyright (c) 2013-2025 Aleksey Vaneev",
    "url": "https://github.com/avaneev/r8brain-free-src"
  },
  {
    "kind": "native-library",
    "name": "base64 (inside react-native-audio-api 0.13.6)",
    "version": "0.13.6",
    "license": "Zlib",
    "copyright": "Copyright (C) 2004-2017, 2020-2022 René Nyffenegger",
    "url": "https://github.com/ReneNyffenegger/cpp-base64"
  },
  {
    "kind": "native-library",
    "name": "SQLite (inside expo-sqlite)",
    "version": "bundled by expo-sqlite ~57.0.3",
    "license": "blessing",
    "copyright": "Public domain",
    "url": "https://sqlite.org/copyright.html"
  },
  {
    "kind": "native-library",
    "name": "Google Mobile Ads SDK",
    "version": "13.6.0",
    "license": "LicenseRef-Google-Mobile-Ads-SDK-Terms",
    "copyright": "Copyright 2026 Google LLC",
    "url": "https://developers.google.com/admob/terms"
  },
  {
    "kind": "native-library",
    "name": "Google User Messaging Platform SDK",
    "version": "3.1.0",
    "license": "LicenseRef-Google-Mobile-Ads-SDK-Terms",
    "copyright": "Copyright 2025 Google LLC",
    "url": "https://developers.google.com/admob/terms"
  },
  {
    "kind": "native-library",
    "name": "OpenIAP (inside expo-iap 5.8.0)",
    "version": "3.6.0",
    "license": "MIT",
    "copyright": "Copyright (c) 2025 hyo.dev",
    "url": "https://github.com/hyodotdev/openiap"
  }
]
```

```json
[
  {
    "kind": "font",
    "name": "Vazirmatn",
    "version": "33.003",
    "license": "OFL-1.1",
    "copyright": "Copyright 2015 The Vazirmatn Project Authors (https://github.com/rastikerdar/vazirmatn)",
    "url": "https://github.com/rastikerdar/vazirmatn"
  }
]
```

```ts
// packages/shell/src/art/credit-problems.ts
import type { CreditEntry, CreditKind } from './credit-entry.ts';

const KINDS: readonly CreditKind[] = [
  'font',
  'sound',
  'word-list',
  'native-library',
  'npm-package',
];

/** FINAL D.43 / docs/16 allowlist plus the exact identifiers our native notices use. */
const ALLOWED_LICENSE =
  /^(MIT|MIT-0|0BSD|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|ISC|OFL-1\.1|CC0-1\.0|BSL-1\.0|Zlib|blessing|LicenseRef-[A-Za-z0-9-]+)$/;

function problemsOfEntry(entry: CreditEntry): string[] {
  const problems: string[] = [];
  if (!KINDS.includes(entry.kind)) problems.push(`${entry.name}: unknown kind`);
  if (!ALLOWED_LICENSE.test(entry.license))
    problems.push(`${entry.name}: licence ${entry.license}`);
  if (new URL(entry.url).protocol !== 'https:') problems.push(`${entry.name}: url must be https`);
  if (entry.copyright.trim().length === 0) problems.push(`${entry.name}: copyright missing`);
  return problems;
}

/** Empty when every S11d row is complete and its licence is allowed. */
export function creditProblems(entries: readonly CreditEntry[]): readonly string[] {
  return entries.flatMap(problemsOfEntry);
}
```

```ts
// packages/shell/src/art/credit-problems.test.ts
import shellNotices from '@e07/shell/screens/licences/shell-notices.json' with { type: 'json' };

import { creditProblems } from './credit-problems.ts';

import type { CreditEntry } from './credit-entry.ts';

describe('creditProblems', () => {
  it('accepts every shell notice', () => {
    expect(creditProblems(shellNotices as CreditEntry[])).toStrictEqual([]);
  });

  it('rejects a copyleft licence and a missing copyright', () => {
    const [valid] = shellNotices as CreditEntry[];
    if (valid === undefined) throw new Error('shell-notices.json is empty');
    const bad: CreditEntry = { ...valid, license: 'GPL-3.0-only', copyright: ' ' };
    expect(creditProblems([bad])).toHaveLength(2);
  });
});
```

```ts
// apps/line-siege/src/credits/credits.test.ts
import { GAME_ART } from '@e07/line-siege/art/game-art.ts';
import { creditProblems } from '@e07/shell/art/credit-problems.ts';

describe('line siege credits', () => {
  it('lists every font, sound and word list with an allowed licence', () => {
    expect(creditProblems(GAME_ART.credits)).toStrictEqual([]);
  });
});
```

The JavaScript packages the audit will list for an SDK 57 app. Their `license` fields were read from their `package.json` today:

| Package | Version | Licence |
|---|---|---|
| react, react-native | 19.2.3, 0.86.3 | MIT |
| expo + Expo modules (expo-font, expo-haptics, expo-localization, expo-sqlite, expo-splash-screen, expo-network, …) | 57.x | MIT |
| @react-navigation/native, native-stack; react-native-screens; react-native-safe-area-context | 7.4.1, 7.19.2; 4.26.x; 5.7.0 | MIT |
| zustand | 5.0.15 | MIT |
| react-intl, intl-messageformat | 12.1.3, 12.1.2 | BSD-3-Clause |
| @formatjs/intl-getcanonicallocales, -locale, -pluralrules, -numberformat | 3.2.12, 5.3.12, 6.3.15, 9.4.3 | MIT |
| @shopify/react-native-skia | 2.6.2 | MIT (Copyright 2021-present Shopify Inc.) |
| react-native-reanimated, react-native-worklets, react-native-gesture-handler | 4.5.1, 0.10.1, 2.32.0 | MIT |
| react-native-audio-api | 0.13.6 | MIT |
| react-native-google-mobile-ads | 17.2.0 | Apache-2.0 |
| expo-iap | 5.8.0 | MIT |

The native notices were checked against the upstream files on 2026-09-26:

- Skia's `LICENSE` (BSD-3-Clause, "Copyright (c) 2011 Google Inc.").
- The React Native 0.86.3 `third-party-podspecs` (RCT-Folly Apache-2.0, boost BSL-1.0, fmt MIT, fast_float MIT, double-conversion, glog).
- The headers vendored in `react-native-audio-api/common/cpp/audioapi/libs`: miniaudio (public domain / MIT-0), PFFFT (FFTPACK licence), concurrentqueue (Simplified BSD), base64 (zlib-style). Also r8brain-free-src (MIT, in `dsp/r8brain`).
- The CocoaPods acknowledgements of the services spike (Google-Mobile-Ads-SDK "Copyright 2026 Google LLC", UMP "Copyright 2025 Google LLC", openiap MIT).

Re-check the list when a native dependency changes: `Pods/Target Support Files/Pods-<App>/Pods-<App>-acknowledgements.markdown` after `pod install`, plus the folders above. CocoaPods acknowledgements alone are incomplete, because Expo's precompiled modules and vendored C code are missing from them (verified).

## Checklist

- [ ] `react-native-audio-api` is exactly `0.13.6` in `package.json`, `expo-audio` is absent, and `AUDIO_API_PLUGIN` is in the config. The prebuilt `Info.plist` has no audio background mode and no microphone string.
- [ ] Only the two adapter files import `react-native-audio-api` and `expo-haptics` (`npm run lint`).
- [ ] Every game sound is a recipe in `SOUND_BANK`, and its id matches a `cue.sound` in `buildTimeline`. `synthesize-recipe.test.ts` covers the UI sounds, a game's `sounds/sound-bank.test.ts` runs the same four checks over its `SOUND_BANK`, and the WAV preview was listened to.
- [ ] Music is off by default. The Music row is hidden when the game has no music.
- [ ] The audio lifecycle hook is mounted once. The context suspends on background and during full-screen ads. `dispose()` runs before `reloadAppAsync`.
- [ ] Haptic cues follow the table. The throttle and Vibration gating are tested, and the row is hidden when `isSupported` is false.
- [ ] `render-art.ts --app <game> --check` passes. The icons were reviewed at 1024 and 256 px. Light is opaque, dark is transparent, tinted is grayscale.
- [ ] `board-palettes.json` has all four sets with identical keys, and colour-blind meaning is also shown by shape.
- [ ] Sprite sheets are keyed by palette, scheme, colour-blind flag, size and pixel ratio.
- [ ] Board fonts come from `Skia.FontMgr.System()`. The goldens register the TTF from `apps/<game>/assets/fonts/`.
- [ ] `credits.json` lists every font, sound and word list. `creditProblems` passes for the shell notices and the game credits.

## Sources

- react-native-audio-api: [docs](https://docs.swmansion.com/react-native-audio-api/) · [plugin](https://docs.swmansion.com/react-native-audio-api/docs/other/audio-api-plugin) · [AudioManager](https://docs.swmansion.com/react-native-audio-api/docs/system/audio-manager) · [testing](https://docs.swmansion.com/react-native-audio-api/docs/other/testing) · [npm](https://www.npmjs.com/package/react-native-audio-api) · [repo](https://github.com/software-mansion/react-native-audio-api)
- Apple: [AVAudioSession ambient](https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/ambient) · [NSMicrophoneUsageDescription](https://developer.apple.com/documentation/bundleresources/information-property-list/nsmicrophoneusagedescription) · [Configuring your app icon](https://developer.apple.com/documentation/xcode/configuring-your-app-icon) · [HIG app icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- Expo: [haptics](https://docs.expo.dev/versions/latest/sdk/haptics/) · [splash screen](https://docs.expo.dev/versions/latest/sdk/splash-screen/) · [font](https://docs.expo.dev/versions/latest/sdk/font/) · [app config (icon)](https://docs.expo.dev/versions/latest/config/app/)
- Skia: [headless](https://shopify.github.io/react-native-skia/docs/getting-started/headless) · [Atlas](https://shopify.github.io/react-native-skia/docs/shapes/atlas) · [Paragraph](https://shopify.github.io/react-native-skia/docs/text/paragraph) · [Skia LICENSE](https://skia.googlesource.com/skia/+/main/LICENSE)
- Node: [TypeScript type stripping](https://nodejs.org/api/typescript.html)
- Fonts: [Vazirmatn](https://github.com/rastikerdar/vazirmatn) · [SIL OFL](https://openfontlicense.org/)
- Vendored native code: [miniaudio](https://github.com/mackron/miniaudio) · [PFFFT](https://github.com/marton78/pffft) · [concurrentqueue](https://github.com/cameron314/concurrentqueue) · [r8brain-free-src](https://github.com/avaneev/r8brain-free-src) · [Hermes LICENSE](https://github.com/facebook/hermes/blob/main/LICENSE)

## Verified (2026-09-26)

Versions checked today with `npm view` and Expo's SDK 57 map: react-native-audio-api 0.13.6 (latest; nightly 1.0.0), expo-haptics 57.0.3, expo-splash-screen 57.0.9, expo-font 57.0.4, @shopify/react-native-skia 2.6.2, @expo/prebuild-config 57.0.16, Node 26.4.0, Xcode 26.6, iOS 26.5 simulator.

**In a copy of the verified probe** (`scratchpad/rn/writer-08-09/ws`), every file above passed `tsc` (app world, and tooling with `types: ["node", "jest"]`), ESLint with `--max-warnings 0`, and Prettier. The shared Jest suite (61 tests with docs/08) covers the recipes, the voice policy, the adapter against the extended mock, the haptic throttle, the sprite cache (CanvasKit), and the credit data. Specific checks:

- `render-sfx-wav.ts` wrote the bank's 48 kHz 16-bit WAVs, and they were byte-identical across runs.
- `render-art.ts` rendered the five PNGs in 0.38 s, and `--check` re-renders byte-identically.
- `expo prebuild` produced the icon and splash asset catalogs described in section 3.
- `import … with { type: 'json' }` worked in tsc, ESLint, Jest, Metro `expo export` and Node.
- Reviewer re-run (`scratchpad/rn/verify-game`, 2026-09-26): after the fixes (import order, `render-art.ts` loading headless Skia through typed `import()`, credits moved to `shell/src/art/` with `GameArt.credits`, the Shell's UI sounds kept out of the game bank, the duplicate 120 Hz constant removed), every block passes `tsc`, docs/04's `eslint.config.mjs` plus docs/02's app-zone block, Prettier and Jest; `render-art.ts --check` and `render-sfx-wav.ts` still produce byte-identical files. The plugin options, podspec download logic, `AudioManager` types, the library mock, `activelyReclaimSession`, expo-haptics enums and Apple's icon wording were re-read at the source.

**In a Release build on the iOS 26.5 simulator** (spike app):

- The adapter created the `ambient` context, loaded the Line Siege bank, played and scheduled cues from the timeline, and cancelled pending voices, all without an exception.
- `createExpoHapticsAdapter` fired cues without error.
- The `expo-font` plugin embedded Vazirmatn, and `Skia.FontMgr.System()` listed it.
- The simulator was deleted afterwards.

**Integration pass (2026-09-26).** The two CLIs moved into area folders (`art/render-art.ts`, `audio/render-sfx-wav.ts`, docs/02 section 10); in a copy of `scratchpad/rn/verify-game` both still ran (`--check` exit 0, three WAVs written) and passed `tsc`, ESLint and Prettier at the new paths.

**App zones merged (2026-09-26, `scratchpad/fix-final/wide`).** Every app file printed in the handbook, this doc's `sounds/`, `art/` and `credits/` files included, was linted with docs/04's merged config: no `import/no-restricted-paths` error, so the game-facing list covers the audio port, the synth and `art/`.

**Not verifiable by Claude:**

- Audible output, latency and the silent switch (the owner checks on a phone).
- Haptic strength (the simulator has no Taptic Engine).
- How iOS 26 renders the flat icons with Liquid Glass (check on a device, or in the simulator's Home Screen with dark and tinted appearances).

## Open issues

1. **ITMS-90683 risk (FINAL B.20).** Still open until the first TestFlight upload. The fallback is ready: the plugin option `iosMicrophonePermission` plus `expo.locales` strings.
2. **The library's Jest mock is incomplete** in 0.13.6: `AudioManager` lacks `setAudioSessionOptions` and `observeAudioInterruptions`. The root mock above extends it. Re-check on every bump, and drop the extension once upstream adds the methods.
3. **Flat PNG icons instead of Icon Composer `.icon` bundles.** v1 ships flat light, dark and tinted PNGs, which Apple documents and Expo supports. The `.icon` format (`icon.json` + layers) is not documented as a schema, so generating it headlessly is unverified. Revisit if the owner wants per-layer Liquid Glass depth.
4. **`--check` for generated art is not yet in docs/16's `verify` script.** Add `node packages/tooling/src/art/render-art.ts --app <id> --check` for every app, with a `Gate-Change:` trailer.
5. **S11d npm list.** docs/16's `audit:licenses` computes the shipped-package set but does not write it for the app. It should emit `apps/<game>/assets/generated/npm-licences.json` (name, version, SPDX) so the screen needs no network and no guesswork.
6. **Node scripts that import app `.ts` files print `MODULE_TYPELESS_PACKAGE_JSON`.** The Shell, game-kit and tooling declare `"type": "module"` (docs/04, docs/14); Expo apps do not (docs/07), so the scripts pass `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON`. The warning is harmless.
7. **Haptics `.catch(() => undefined)` (FINAL B.21) vs docs/04 rule 11 ("never swallow an error").** Kept FINAL's form, because a no-op is Expo's documented behaviour in Low Power Mode and similar states. docs/04 may want to name this as an allowed fallback.
8. **Resolved: game recipe tests need `synthesizeRecipe`.** docs/02's app zones list `./services/audio/synth` in `GAME_FACING`, and docs/04's config now carries them (block 5-zones, merged 2026-09-26).
