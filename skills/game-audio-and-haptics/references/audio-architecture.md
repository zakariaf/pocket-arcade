# Audio architecture: library, port, adapter, lifecycle

How sound reaches the speaker in a Pocket Arcade app, and why each piece is the way it is. Every code file named here is in this skill's `templates/` folder at the same path it takes in the app repo.

## Contents

- Versions and install
- The config plugin
- The port
- The adapter: one AudioContext
- Voice policy
- One bank: UI sounds plus the game's sounds
- UI feedback: taps, toggles, results
- Lifecycle: suspend, resume, interruptions, dispose
- Music
- Wiring in the composition root
- Testing
- Simulator evidence: the app asked for the win feedback
- What only the owner can check
- Licences screen rows
- Known issues

## Versions and install

| Package | Version | How | Why |
|---|---|---|---|
| react-native-audio-api | **0.13.6 exact** | From the repo root: `npm install react-native-audio-api@0.13.6 --save-exact -w apps/<a> -w apps/<b> ...` (every app in one change) | Pre-1.0: minor releases have broken APIs (0.12.0, 0.13.6). It is not in Expo's module map, so `expo install` will not pin it. Its peer is `react-native-worklets >= 0.7.0` (the SDK 57 pin 0.10.1 satisfies it). No npm postinstall. |
| expo-haptics | ~57.0.3 | `npx expo install expo-haptics` inside each app | Expo's SDK 57 map; `expo install` writes `~57.0.3` even with `save-exact=true`. |

`packages/shell/package.json` lists both as `peerDependencies` `"*"` (the Shell imports them; the apps own the versions); the checker accepts `"*"` only in `peerDependencies`.

Never install `expo-audio`, `expo-av`, `react-native-sound`, `react-native-track-player` or `react-native-haptic-feedback`. `expo-audio`'s plugin adds a microphone purpose string, background audio and Android record permissions by default; the others duplicate a decided port.

Native modules autolink per app, so every `apps/<game>/package.json` lists both packages. The Shell imports them only in its two adapter files.

With the plugin options below, the build downloads nothing for this library: the pod's prepare step still calls its download script with `skipffmpeg`, but `DISABLE_AUDIOAPI_STATIC_EXTERNAL_LIBS=1` makes the script skip every iOS archive, and the build-time "Download RNAudioAPI prebuilt binaries" phase is not added.

**Before any bump** (the version is pre-1.0): `npm view react-native-audio-api version dist-tags` (a `1.0.0` nightly exists), read the release notes, re-read `node_modules/react-native-audio-api/src/plugin/withAudioAPI.ts` (plugin defaults) and `src/mock/index.ts` (the Jest mock), then run the adapter tests, a simulator smoke test and the owner's listening check. Update the pinned version in this skill's checker only after all of that passes.

## The config plugin

`packages/shell/src/config/audio-config.ts` exports `AUDIO_API_PLUGIN`; `withShell` imports it (`import { AUDIO_API_PLUGIN } from './audio-config.ts';`, relative with the `.ts` extension because Expo loads the config with Node) and puts it in every app's plugin list. The checker fails when no other config file uses it: a defined but unlisted plugin means every default applies.

```ts
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
```

Every default is overridden on purpose: the defaults add background audio and Android foreground-service permissions, and FFmpeg adds remote streaming, which the product forbids (no network requests of our own). After `npx expo prebuild --platform ios`, `Info.plist` has no `UIBackgroundModes` audio entry and no `NSMicrophoneUsageDescription`, and the Podfile has both `DISABLE_AUDIOAPI_*` lines.

**Microphone purpose string.** Add none up front. The library's binary references record-permission APIs the app never calls, so the first App Store upload may report ITMS-90683 ("Missing purpose string in Info.plist", naming `NSMicrophoneUsageDescription`). Only then set the plugin option `iosMicrophonePermission` to a neutral sentence (the option exists in 0.13.6), localise it through `expo.locales` in all four languages, put a comment naming ITMS-90683 on the line above, and rebuild with a new build number. Use the plugin option or an `ios.infoPlist` entry, not both. The app never asks, so players never see it.

## The port

`packages/shell/src/services/audio/audio-port.ts` is the only audio API the Shell and games use:

| Member | What it does |
|---|---|
| `load(bank)` | Synthesises every recipe of the bank at the context's sample rate and uploads the buffers. Called once at startup. |
| `play(id, delayMs?)` | Plays now, or `delayMs` later on the audio clock (timeline cues). Unknown ids are ignored silently. |
| `cancelPending()` | Stops voices scheduled for the future (fast-forward, pause, leaving the screen). |
| `applySettings(settings)` | Ramps the three category gains to the Sound effects and Music settings. |
| `startMusic(id)` / `stopMusic()` | The one looped music voice. |
| `suspend()` / `resume()` | Pauses and resumes the engine (background, full-screen ads). |
| `dispose()` | Closes the engine, before a JS reload and in tests. |

Categories: `sfx` (game effects) and `ui` (Shell menu sounds) follow the "Sound effects" setting; `music` follows "Music". `DEFAULT_AUDIO_SETTINGS` is effects on at 0.8 and music **off** at 0.6. The save stores integer percent; the settings glue divides by 100 before calling `applySettings` (the `settings-and-preferences` skill owns that glue).

## The adapter: one AudioContext

`audio-api-audio-adapter.ts` is the only file that imports `react-native-audio-api`. It creates exactly one `AudioContext` per app, lazily on the first `load`, and only after:

```ts
AudioManager.setAudioSessionOptions({ iosCategory: 'ambient', iosMode: 'default', iosOptions: [] });
```

`ambient` respects the silent switch and mixes with other apps' audio, so the player's own music keeps playing. The session must be configured before the context exists. Leave `iosAllowHaptics` at its default (it only matters for recording sessions).

- **Graph.** Each voice is a single-use `AudioBufferSourceNode` feeding one of three `GainNode`s (`sfx`, `ui`, `music`), which feed the destination. Source nodes are cheap and are collected after `ended`.
- **Scheduling.** `play(id, delayMs)` starts the source at `ctx.currentTime + delayMs / 1000`, so a cue at 120 ms lands on the frame where its animation starts. Delayed voices are remembered so `cancelPending()` can stop them before they sound.
- **Errors.** The adapter never throws into gameplay. Failed promises (suspend, resume, interruption handling) go to `reportError`, which the composition root wires as `(error) => errorLog.record('audio', error)`.
- **Sources.** Buffers come only from `synthesizeRecipe`. Never `decodeAudioData` with a URL or file, never `createStreamer`, never any file or network source.

## Voice policy

`admit-voice.ts` is pure and decides, on the audio clock, whether a voice may start. Each admitted voice is kept as an interval (`soundId`, `startMs`, `untilMs`), so scheduled cues are judged correctly:

- At most **8** overlapping voices (`MAX_VOICES`), so a cascade that fires 30 cues at once does not turn into noise. Only voices whose interval overlaps the new one count; a voice scheduled for later does not block one that plays and ends before it.
- The same sound restarts at most once per **30 ms** (`DEFAULT_MIN_INTERVAL_MS`), or per its own `minIntervalMs` (for example 60 ms for rapid hits; at most 1000 ms, `REMEMBER_MS`). The distance counts in both directions, because a timeline may schedule its tracks out of time order.
- `cancelPending()` stops every voice that has not started and `releaseVoices` frees their slots and repeat windows. Without it, a fast player's next move would find its own sounds "too soon" after cues that never played, and they would be dropped silently.
- `channelGain(setting)` is `volume²` when on and 0 when off: a squared slider sounds perceptually even.
- Every gain change ramps linearly over **50 ms** (`RAMP_S = 0.05`): an instant jump clicks.

## One bank: UI sounds plus the game's sounds

The Shell ships its menu sounds as `UI_SOUNDS` (ids `ui.tap`, `ui.toggle`, `ui.win`, `ui.lose`, category `ui`). Each game ships `SOUND_BANK` in `apps/<game>/src/sounds/sound-bank.ts` and hands it to the Shell as `presentation.sounds` of its `ShellGameModule`. The composition root loads both at once:

```ts
services.audio.load(composeSoundBank(game.presentation.sounds));
```

`composeSoundBank` throws if a game id is in the `ui.` namespace, because it would silently replace a menu sound. A game never imports `ui-sounds.ts`; the app zones let game code import only `services/audio/audio-port.ts` and `services/audio/synth/` (the synth and `recipeProblems` for its bank test).

## UI feedback: taps, toggles, results

The product asks for a sound on every button tap, win and loss, and a short pulse on wins and losses. `ui-feedback.ts` maps each Shell moment to its UI sound and pulse, and `playUiFeedback(services, kind)` plays both through the ports (so the settings, the voice policy and the 40 ms throttle apply):

| Kind | Sound | Pulse | Where it is called |
|---|---|---|---|
| `tap` | `ui.tap` | none | Every button press, once for the whole app: `ShellApp` wraps the tree in `<PressFeedbackProvider onPress={() => { playUiFeedback(services, 'tap'); }}>`, and the three files allowed to hold a `Pressable` (`raised-surface.tsx` from `toybox-design-system`, `quiet-button.tsx` and `list-row.tsx` from `toybox-components`) call `const onPressFeedback = usePressFeedback();` and run it in `onPress`, except a switch row (`accessibilityRole: 'switch'`), whose handler plays `toggle` instead. Outside the provider the hook is a no-op, so component tests need no audio fake. |
| `toggle` | `ui.toggle` | `selection` | The handler of every toggle row and picker step (Settings, Pause). |
| `win` | `ui.win` | `success` | Once, for the move that wins the run: the game host's session controller calls `playUiFeedback(deps.feedback, session.status === 'won' ? 'win' : 'lose')` in its persist step, after the run end is saved and before the Result screen shows. The composition root passes `feedback: debugFeedbackOf(() => debug, { audio, haptics })` to `createGameHost` (game-host-integration): the real ports in a store build, the debug parts' recording ports in a test build. |
| `lose` | `ui.lose` | `error` | Once, for the move that loses the run (the same call), including a loss that waits for its continue; declining the continue later records the loss silently. |

The context lives in `packages/shell/src/app/press-feedback-context.tsx`, not in `services/audio/`: the Pressable hosts live in `ui/`, which never imports `services/` (ESLint's ui boundary), and this file imports only React. The hosts and `ShellApp` both import it from `@e07/shell/app/press-feedback-context.tsx`, so there is exactly one context. The toybox-design-system skill ships the same file byte for byte; whichever skill runs first copies it.

Never call `audio.play('ui.tap')` from individual screens: one forgotten handler is a silent button. `check-audio-haptics.mjs` fails (`ui-feedback`) until every kind is played somewhere in the Shell and some Shell component calls `usePressFeedback()`. Games never use these; their sounds come from timeline cues.

## Lifecycle: suspend, resume, interruptions, dispose

`useAudioLifecycle({ audio, isFullscreenAdShowing, reportError })` is mounted **once**, in `ShellApp` (the composition root's component). The context runs only while the app is active and no full-screen ad plays (interstitials and rewarded ads play their own sound); otherwise it is suspended. `suspend()` also cancels pending voices.

- `useIsAppActive` (`packages/shell/src/app/use-is-app-active.ts`) is shared with the board lifecycle; copy it from the templates only if it does not exist yet.
- The adapter listens for audio-session interruptions (a phone call, Siri): it suspends on `began` and resumes on `ended` when iOS says `shouldResume`.
- The Game screen's board lifecycle also cancels cues and suspends audio when the screen loses focus (the `board-rendering-skia` skill owns that hook).
- **Before any JS reload** (the "Restart to apply" direction change in first-run language choice and in Settings), `await audio.dispose()` first, so the old native engine closes before the bundle reloads. The startup direction check runs before any audio exists and needs nothing.

## Music

Music is off by default. The product rule is "never play over the player's music unless they turn game music on", and react-native-audio-api has no API that reports "other audio is playing", so the only safe default is off.

- Most games have no music; for them Settings (S11) hides the Music switch row and the Music volume row, and Pause (S6) hides its Music key (hidden, never greyed out; the rows below close up). The signal is the bank itself: `hasMusicOf(module)` in `packages/shell/src/game-host/game-facts.ts`, true when some sound has `category: 'music'`. Screens read it as `useGameHost().hasMusic` (the `settings-and-preferences` skill owns the rows; there is no separate sounds context).
- Visual parity follows the same fact. The Toybox design draws S11 and S6 with the Music rows, so a game without music is compared with the design-derived reference variants `s11-settings--no-music` and `s6-pause--no-music` (the rows removed, everything below closed up exactly as the app lays it out). The capture picks the variant from the app repo's `parity/game-facts.json` (`{ "version": 1, "games": { "<app id>": { "designGame": "lineSiege", "hasMusic": false, "winLine": "score" } } }`), and the parity pin test `apps/<id>/src/parity-game-facts.test.ts` checks that file against `hasMusicOf(module)`, so a game that gains a music track fails there before any capture uses the wrong reference. Line Siege has six sfx and no music: `"hasMusic": false`.
- A game with music has one bank entry with `category: 'music'` and `isLoop: true` (a few seconds of a simple synthesised pattern, up to 30 s). The Home screen starts it with `startMusic(id)` on mount only when the Music setting is on; switching the setting off calls `stopMusic()` at once.
- Never use the library's experimental `activelyReclaimSession`: it stops the engine when other audio plays.
- If music is ever turned on by default, first build a small local Expo module that returns `AVAudioSession.secondaryAudioShouldBeSilencedHint` and start music only when it is false. That is an owner decision.

## Wiring in the composition root

```ts
// inside createShellApp (the composition root), once per app
const audio = createAudioApiAudioAdapter({ reportError: (error) => errorLog.record('audio', error) });
audio.load(composeSoundBank(game.presentation.sounds));
// settings-and-preferences' createShellHaptics = createExpoHapticsAdapter({ isEnabled: () =>
// selectIsVibrationOn(settings.getState()), nowMs }); the lazy getState lets the game host get the
// port before the stores exist.
const haptics = createShellHaptics({ getState: () => stores.settings.getState() }, clock);
// ... createGameHost(game, { ..., feedback: debugFeedbackOf(() => debug, { audio, haptics }) }),
// then the stores (a store build plays through audio and haptics themselves):
connectAudioSettings(stores.settings, audio); // settings-and-preferences skill
const services = { ...otherPorts, audio, haptics };

// inside ShellApp (once): the full-screen gate is the game host's
useAudioLifecycle({ audio: services.audio, isFullscreenAdShowing: useIsFullscreenAdShowing(host.lifecycle), reportError });
return (
  <PressFeedbackProvider
    onPress={() => {
      playUiFeedback(services, 'tap');
    }}
  >
    {children}
  </PressFeedbackProvider>
);
```

Timeline cues reach both ports through the board's cue scheduler: sounds with `audio.play(cue.sound, track.startMs)`, haptics with timers at `track.startMs`; a new move or a pause cancels what has not fired (`cancelPending`). The `board-rendering-skia` skill owns the scheduler; this skill owns what it calls.

## Testing

- Screens, stores and the game host inject `createFakeAudio()` (records every call as `{ kind, ... }`) and `createFakeHaptics()` (records `played` cues) and assert the calls.
- The adapter test uses a **root manual mock** `__mocks__/react-native-audio-api.ts`. The library's own mock (`react-native-audio-api/mock`, 0.13.6) has no `AudioManager.setAudioSessionOptions` or `observeAudioInterruptions`; without the root mock the adapter test fails with "setAudioSessionOptions is not a function". The root `tsconfig.json` includes `__mocks__/**`; the mock uses `module.exports`.
- An adapter test that inspects the mock calls `jest.mock('react-native-audio-api')` and then `jest.requireMock(...)`: without the explicit `jest.mock`, `requireMock` returns a second instance. Tests never import a vendor SDK.
- The haptics adapter test mocks `expo-haptics` with a factory that records calls into an array created inside the factory (Jest 29's `restoreMocks` resets `jest.fn` implementations between tests, so plain recording functions are safer).
- `use-audio-lifecycle.test.ts` replaces `useIsAppActive` with a switch the test flips, because AppState is not driven in Jest.
- `synthesize-recipe.test.ts` runs `recipeProblems` over every UI sound; each game's `sound-bank.test.ts` does the same over its bank (see sound-design.md).
- `ui-feedback.test.ts` proves each kind's sound and pulse and that every UI sound has a moment; `press-feedback-context.test.tsx` proves the hook is silent without the provider. The adapter test spies on the mock's `AudioBufferSourceNode.prototype.start`/`stop` to prove `cancelPending` stops and releases scheduled voices.

## Simulator evidence: the app asked for the win feedback

Test builds wrap the Shell's two ports with `recordAudioFeedback(audio, { perfLog, nowMs })` and `recordHapticsFeedback(haptics, { perfLog, nowMs })` (`services/audio/recording-feedback.ts`, test-only, wired by e2e-maestro's `createDebugParts` through the test-only entry; store builds contain none of it). Each cue passes through unchanged and is appended to the perf log as `{ kind: 'feedback', label: <sound id or haptic cue>, atEpochMs, data }` (sounds carry `{ delayMs }`). After the level-1 flow the E2E runner reads the log, and its report requires the win sound (`ui.win`) and the success haptic (`success`): the simulator proof that the app asked for them. Jest's fakes prove the wiring, the WAV preview proves the sound, and how they sound and feel is the owner's device check below, which never blocks.

## What only the owner can check

Claude cannot hear, and the simulator has no Taptic Engine. These are owner steps that never block (owner decision O6, 2026-09-30): list them in every slice or release report under "Owner steps (not blocking)", carry on, and tune when the answers come. The questions, in plain words, on a real iPhone:

1. Listen to the WAV previews in Finder (`apps/<game>/sfx-preview/`): does each sound fit its event, and are they balanced against each other?
2. In the app: do sounds land in time with the animations (latency)? With the silent switch on, is the game silent? Does their own music keep playing underneath?
3. Do the vibrations feel right for place, clear, win and lose, and never like a buzz?

Record the answers in the next report when they come; a "no" is a tuning task, not a failure to hide, and no gate waits for them.

## Licences screen rows

Sounds need no credits: every sound is generated in code, and the licences screen shows the catalog sentence "Graphics and sounds were created in code for this game." (key `licences.generated-assets`). The audio library compiles vendored native code into every app, which a JavaScript licence audit cannot see; the Shell's native-notices list must include these rows (checked against the headers vendored in `react-native-audio-api/common/cpp/audioapi/libs` and `dsp/r8brain`, 0.13.6):

| Name | Licence | Copyright |
|---|---|---|
| miniaudio (inside react-native-audio-api 0.13.6) | MIT-0 | Copyright 2025 David Reid (public domain or MIT No Attribution) |
| PFFFT (inside react-native-audio-api 0.13.6) | LicenseRef-FFTPACK | Copyright (c) 2013 Julien Pommier; Copyright (c) 2004 the University Corporation for Atmospheric Research |
| moodycamel ConcurrentQueue (inside react-native-audio-api 0.13.6) | BSD-2-Clause | Copyright (c) 2013-2020, Cameron Desrochers |
| r8brain-free-src (inside react-native-audio-api 0.13.6) | MIT | Copyright (c) 2013-2025 Aleksey Vaneev |
| base64 (inside react-native-audio-api 0.13.6) | Zlib | Copyright (C) 2004-2017, 2020-2022 René Nyffenegger |

The npm packages themselves (`react-native-audio-api` MIT, `expo-haptics` MIT) come from the release-bundle licence audit.

## Known issues

1. **ITMS-90683 risk.** Open until the first TestFlight upload; the fallback is ready (plugin option `iosMicrophonePermission` plus `expo.locales`).
2. **The library's Jest mock is incomplete in 0.13.6.** The root mock extends it; re-check on every bump and drop the extension once upstream adds the methods.
3. **Haptics swallow their own failure** (`.catch(() => undefined)`), an allowed exception to "never swallow an error": Expo documents that haptics silently do nothing in Low Power Mode and similar states, so a failed pulse is the expected fallback. Recording the first failure per session through `ErrorLogPort` would also be acceptable.
4. **The WAV preview prints a harmless warning** (`MODULE_TYPELESS_PACKAGE_JSON`) because Expo apps have no `"type"` field; run it with `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON`.
