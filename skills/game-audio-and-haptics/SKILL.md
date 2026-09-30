---
name: game-audio-and-haptics
description: Builds game sound and vibration - SoundRecipe synth banks, ambient AudioContext (react-native-audio-api 0.13.6), voice limits, tap/win/lose feedback, haptic cues, 40 ms throttle, WAV preview. Use when adding or tuning sounds, SFX, music or haptics. Not for Settings rows (settings-and-preferences).
---

# Game audio and haptics

Every Pocket Arcade sound is synthesised in code from a literal recipe and played through one ambient `AudioContext` behind `AudioPort`; every vibration is a cue from a fixed table played through `HapticsPort`, gated by the Vibration setting and throttled. This skill builds the Shell side once, each game's sound set, and the checks that prove both.

## Rules that must hold

1. **Pin `react-native-audio-api` at exactly `0.13.6` in every app and configure its plugin with all five defaults overridden** (`iosBackgroundMode: false`, `androidPermissions: []`, `androidForegroundService: false`, `disableFFmpeg: true`, `disableStaticExternalLibs: true`). Never install `expo-audio`, `expo-av` or another audio or haptics library. Why: the library is pre-1.0 and minors break APIs; the defaults add background audio, Android permissions and streaming downloads.
2. **Only `audio-api-audio-adapter.ts` imports `react-native-audio-api`, and only `expo-haptics-adapter.ts` imports `expo-haptics`.** Everything else uses `AudioPort` and `HapticsPort`; tests use `createFakeAudio()` and `createFakeHaptics()`. Why: one file changes on a library bump, and every other test runs in milliseconds without native code.
3. **Create exactly one `AudioContext`, inside the adapter, after `setAudioSessionOptions({ iosCategory: 'ambient', ... })`.** Why: `ambient` respects the silent switch and mixes with the player's own music; the session must be set before the context exists.
4. **Every sound is a literal `SoundRecipe` that passes `recipeProblems`** (finite, peak 0.05-0.9, first sample < 0.05, last < 0.01, later layers fade in over at least 1 ms, 10-1500 ms, music up to 30 s). No audio files, no `decodeAudioData` with a URL, no `createStreamer`, no network. Why: no licences to track, no clicks or clipping, byte-identical renders everywhere.
5. **A game's sounds live in `apps/<game>/src/sounds/sound-bank.ts` as `SOUND_BANK`, with kebab-case noun ids; every id is cued and every cue names a bank id.** The `ui.` namespace belongs to the Shell's `UI_SOUNDS`; the bank reaches the Shell as `presentation.sounds` and is loaded with `composeSoundBank`. Why: a cue with a typo is silent in production, and a `ui.` id would replace a menu sound.
6. **Keep the voice policy:** three category gains (`sfx` and `ui` follow Sound effects, `music` follows Music), slider mapped to `volume²`, 50 ms gain ramps, at most 8 overlapping voices, the same sound at most once per 30 ms (or its `minIntervalMs`, at most 1000 ms). Voices are intervals on the audio clock and `cancelPending` releases the ones it stops. Why: even loudness, no clicks, no pile-ups when a cascade fires many cues, and no sound silently lost after a fast move.
7. **Music is off by default; a game without a sound in category `music` hides the S11 Music rows (the switch and the volume) and the Pause (S6) Music key; never call `activelyReclaimSession`.** The rule is `hasMusicOf(module)` (`game-host/game-facts.ts`, read as `GameHost.hasMusic`), and visual parity compares such a game against the design-derived no-music reference variants (`s11-settings--no-music`, `s6-pause--no-music`) that it picks from `parity/game-facts.json` (`"hasMusic": false`; Line Siege has no music). Why: game music must never play over the player's music unless they turn it on, the library cannot report other playing audio, and a hidden row compared with the base reference would fail every S11 and S6 capture.
8. **Fire sounds and haptics from timeline cues (turn-based) or from drained events on JS (real-time), scheduled on the audio clock and cancelled on fast-forward, pause and screen exit.** Never from a sim, a `'worklet'` module or per tick. Why: sample-accurate sync with the animation, and the UI thread never touches a port.
9. **Mount `useAudioLifecycle` once, in `ShellApp`:** the context runs only while the app is active and no full-screen ad plays; interruptions suspend and resume it; `await audio.dispose()` before every `restartForDirection`/`reloadAppAsync` (the startup check in `start-shell.ts` runs before any audio exists and needs nothing). Why: no sound in the background or over ads, and the native engine closes before a JS reload.
10. **Haptics follow the cue table, only when Vibration is on and at least 40 ms after the previous pulse, and every native call ends with `.catch(() => undefined)`; `isSupported` is false on iPad.** UI buttons use no haptics except `selection` on toggles. Why: bursts feel like a buzz, Low Power Mode makes haptics a silent no-op, and iPads cannot vibrate.
11. **The Shell's own moments go through `playUiFeedback`:** every button press plays `ui.tap` (`usePressFeedback` in the Pressable hosts), a toggle `ui.toggle` + `selection`, a decided result `ui.win` + `success` or `ui.lose` + `error`. Why: the product asks for sound on button taps, wins and losses and a pulse on wins and losses; without these call sites the UI sounds load and never play.
12. **Add no microphone purpose string up front.** Only if an App Store upload reports ITMS-90683, set `iosMicrophonePermission` (localised, with a comment naming ITMS-90683). Why: the app never records; an unneeded purpose string invites review questions.
13. **A sound set is done only after the owner has listened and felt it on an iPhone.** Why: Claude cannot hear, and the simulator has no Taptic Engine; a green gate proves a sound is clean, not that it is right.

## Workflow

1. **Pick the job.** First Shell setup: steps 2-4. A game's sound set: steps 5-8. Tuning one sound: steps 6-8. Bumping the library: step 9. Always finish with step 10.
2. **Shell setup, read first.** Read [references/audio-architecture.md](references/audio-architecture.md) (library, port, adapter, lifecycle, music, wiring, testing) and [references/haptics.md](references/haptics.md) (cue table, throttle, devices).
3. **Copy the Shell files.** Run `node ${CLAUDE_SKILL_DIR}/scripts/check-audio-haptics.mjs .` from the repo root. In a game-first repo (`shell-slice.json` with `"screens": []`, no Shell app yet) only the game stage is due (the ports and their fakes with tests, the `synth/` files, `use-is-app-active.ts` with its test, `packages/tooling/src/audio/`); the Shell wiring prints `SKIP` (a pass) until the Shell app exists, and steps 4 and 9-11 of the rules follow with it. For every `audio-file-missing` line, copy `templates/<path>` to `<path>` verbatim (tests included): the `services/audio/` and `services/audio/synth/` files, `services/haptics/`, `config/audio-config.ts`, `__mocks__/react-native-audio-api.ts` and `packages/tooling/src/audio/`. Copy `packages/shell/src/app/use-is-app-active.ts` only if it does not exist yet. These need `packages/game-kit/src/rng/sfc32.ts` and `timeline/track.ts` (`game-rules-engine`, `board-rendering-skia`).
4. **Install and wire.** From the repo root: `npm install react-native-audio-api@0.13.6 --save-exact -w apps/<a> -w apps/<b> ...` (every app at once); inside each app: `npx expo install expo-haptics`; add both to `packages/shell/package.json` `peerDependencies` as `"*"`. Import `AUDIO_API_PLUGIN` from `./audio-config.ts` into `withShell`'s plugin list and add `apps/*/sfx-preview/` to the root `.gitignore`. In the composition root create one audio adapter (`reportError` → `errorLog.record('audio', error)`), `load(composeSoundBank(game.presentation.sounds))`, create the haptics adapter with `isEnabled` read at call time and `ClockPort.nowMs`, and in `ShellApp` mount `useAudioLifecycle` and wrap the tree in `PressFeedbackProvider` (snippets in the architecture reference). Wire the UI feedback ("UI feedback" in the architecture reference): `usePressFeedback()` in the Pressable hosts (`raised-surface.tsx`, `quiet-button.tsx`, `list-row.tsx`), `playUiFeedback(services, 'toggle')` in toggle handlers, and `feedback: { audio, haptics }` for `createGameHost`, whose session controller plays `'win'`/`'lose'` for the deciding move (game-host-integration). Make every "Restart to apply" path `await audio.dispose()` before `restartForDirection`.
5. **Plan the game's sound set.** Read [references/sound-design.md](references/sound-design.md). Write the event → sound → haptic table (like the Line Siege one there): one cue per visible event, 3-6 effects, the most repeated action quietest, loud and long sounds only for rare moments. Choose haptics from the cue table.
6. **Write the bank test-first.** Copy `templates/apps/__GAME_ID__/src/sounds/` (bank and test) to `apps/<game-id>/src/sounds/`, replace `__GAME_ID__`, write one literal recipe per sound from the design guide, and run `npx jest apps/<game-id>/src/sounds --ci --selectProjects unit --coverage --collectCoverageFrom='apps/<game-id>/src/sounds/**/*.ts' --coverageThreshold='{}'` until green (paths first: `--selectProjects` swallows every following word as a project name and would run the whole suite). Imitate [examples/line-siege/](examples/line-siege/).
7. **Cue and wire.** Add `cue: { sound: '<id>', haptic: '<cue>' }` to the track that shows each event in `buildTimeline` (real-time games: map drained event kinds to `audio.play('<id>')`/`haptics.play` in the host, ids written as literals), and set `presentation.sounds: SOUND_BANK` in the game module. Run `npx tsc -p apps/<game-id> --noEmit`, `npx eslint --max-warnings 0` and `npx prettier --check` on the changed files.
8. **Render and hand over for listening.** Run `node ${CLAUDE_SKILL_DIR}/scripts/check-sound-banks.mjs . --game <game-id> --wav-dir reports/sfx` (writes `reports/sfx/<game-id>/<id>.wav`; the repo's `render-sfx-wav.ts` writes the same bytes to `apps/<game-id>/sfx-preview/`), fix every `FAIL` line, and ask the owner to listen in Finder and on a phone with the questions in the architecture reference ("What only the owner can check"). Tune one number at a time and re-render.
9. **Bumping `react-native-audio-api`:** follow "Before any bump" in the architecture reference (release notes, plugin defaults, Jest mock, adapter tests, simulator smoke test, owner listening check), then update `AUDIO_API_VERSION` in `scripts/check-audio-haptics.mjs` and the templates' comments together.
10. **Run the checks** (run, fix, rerun until both print `RESULT: PASS`): `node ${CLAUDE_SKILL_DIR}/scripts/check-sound-banks.mjs .` then `node ${CLAUDE_SKILL_DIR}/scripts/check-audio-haptics.mjs .`. Every `FAIL` line names the file, the rule and the fix. Two rules wait for a later Shell build step and print `SKIP` (a pass) until then: `audio-plugin` until `packages/shell/src/config/shell-plugins.ts` exists (Shell step 8, the one native plugin list) and `ui-feedback` until `packages/shell/src/app/start-shell.ts` exists (Shell step 6). Then `npx jest packages/shell/src/services apps/<game-id>/src/sounds packages/tooling/src/audio --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/services/**/*.ts' --coverageThreshold='{}'` (paths first; only `npm run test:coverage` judges the thresholds).

## Definition of done

- [ ] The Shell audio and haptics files, the root mock and the WAV preview exist as in `templates/`, and their tests pass (voice policy, adapter on the mock, lifecycle, recipes, bank composition, throttle, haptic table, WAV header).
- [ ] Every app lists `react-native-audio-api` `0.13.6` exactly and `expo-haptics` `~57.x`; no banned audio package is installed; `AUDIO_API_PLUGIN` is in `withShell`; no microphone purpose string without ITMS-90683.
- [ ] Each game with sounds has `SOUND_BANK` (literal recipes, kebab ids), a green `sound-bank.test.ts`, `presentation.sounds: SOUND_BANK`, and every cue names a bank id.
- [ ] Music is off by default; the Music row is hidden for games without music; the Vibration row is hidden when `isSupported` is false.
- [ ] `useAudioLifecycle` is mounted once; `audio.dispose()` is awaited before every reload.
- [ ] Button presses play `ui.tap` (the Pressable hosts run `usePressFeedback`), toggles `ui.toggle` + `selection`, results `ui.win` + `success` / `ui.lose` + `error`.
- [ ] The owner has listened to the WAV previews and felt the haptics on a phone, and the evidence report says so (or lists what is still to tune).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-sound-banks.mjs .` prints `RESULT: PASS`.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-audio-haptics.mjs .` prints `RESULT: PASS` (`SKIP` lines for the Shell wiring count as a pass in a game-first repo)

## Anti-patterns

- **Shipping a recorded or downloaded sound "just this once".** It brings a licence, a file the checker rejects and a network path; write a recipe from the design guide instead.
- **Creating an `AudioContext` in a screen or hook.** Two contexts fight over the session and double the memory; the adapter owns the only one.
- **Calling `audio.play` from `useEffect` in the Game screen for board events.** The sound drifts from the animation; put the cue on the track so it is scheduled on the audio clock and cancelled with the scene.
- **A cue on every particle track.** One visible event, one cue; the voice limit drops the rest and the mix turns to noise.
- **Pulsing on every button press.** Buttons are silent to the hand; only toggles use `selection`.
- **`audio.play('ui.tap')` in each screen's handlers.** One forgotten handler is a silent button; the Pressable hosts play the tap for every button through `usePressFeedback`.
- **Turning music on by default to make the game feel livelier.** It plays over the player's music; that is an owner decision needing the silence-hint module first.
- **Tuning by reading numbers.** A green quality gate only proves a sound is clean; render the WAVs and ask the owner to listen.
- **Raising `MAX_VOICES`, lowering the 40 ms throttle or widening the gate to make a check pass.** Fix the recipe or the cue instead; the limits exist because the failures are audible.
- **Importing `expo-haptics` in a test.** Mock it with a factory and read it with `jest.requireMock`; tests never import vendor SDKs.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/audio-architecture.md](references/audio-architecture.md) | Versions, plugin, port, adapter, voice policy, bank composition, lifecycle, music, composition-root wiring, testing, owner checks, licence rows, known issues | Workflow steps 2-4 and 9 |
| [references/sound-design.md](references/sound-design.md) | Recipe model, the quality gate, sound design guide, ids and banks, cues, real-time sounds, WAV preview and tuning, the Line Siege table | Workflow steps 5-8 |
| [references/haptics.md](references/haptics.md) | Haptics port, the cue table (iOS and Android later), rules of use, throttle, iPad and Low Power Mode, tests | Workflow steps 2 and 5 |
| `templates/packages/shell/src/services/audio/` | Port, adapter (+ test), voice policy (+ test), fake (+ test), lifecycle hook (+ test), `composeSoundBank` (+ test), `playUiFeedback` (+ test) | Step 3 (copy verbatim) |
| `templates/packages/shell/src/services/audio/synth/` | Synth (+ test), `recipeProblems` quality gate (+ test), `UI_SOUNDS` | Step 3 (copy verbatim) |
| `templates/packages/shell/src/services/haptics/` | Port, `shouldPulse` (+ test), expo-haptics adapter (+ test), fake (+ test) | Step 3 (copy verbatim) |
| [templates/packages/shell/src/config/audio-config.ts](templates/packages/shell/src/config/audio-config.ts) | `AUDIO_API_PLUGIN` with every default overridden | Step 4 |
| [templates/packages/shell/src/app/use-is-app-active.ts](templates/packages/shell/src/app/use-is-app-active.ts) | Foreground check shared with the board lifecycle; synced from the library, do not edit here | Step 3, only if missing |
| [templates/packages/shell/src/app/use-is-app-active.test.ts](templates/packages/shell/src/app/use-is-app-active.test.ts) | Its test (AppState changes, unsubscribe on unmount); synced from the library | Step 3, with the hook |
| [templates/packages/shell/src/app/press-feedback-context.tsx](templates/packages/shell/src/app/press-feedback-context.tsx) | `PressFeedbackProvider`/`usePressFeedback`, the one press-feedback context (in `app/` so `ui/` may import it); synced from the library, do not edit here | Step 3 (copy verbatim; identical to the design system's copy) |
| [templates/packages/shell/src/app/press-feedback-context.test.tsx](templates/packages/shell/src/app/press-feedback-context.test.tsx) | Its test (silent without the provider, runs the provider's feedback); synced from the library | Step 3 (copy verbatim) |
| `templates/packages/tooling/src/audio/` | `encode-wav.ts` (+ test) and `render-sfx-wav.ts`, the repo's WAV preview | Steps 3 and 8 |
| [templates/__mocks__/react-native-audio-api.ts](templates/__mocks__/react-native-audio-api.ts) | Root Jest mock adding the two missing `AudioManager` methods | Step 3 |
| `templates/apps/__GAME_ID__/src/sounds/` | A game's `SOUND_BANK` starter and its quality-gate test | Step 6 |
| [examples/line-siege/sounds/sound-bank.ts](examples/line-siege/sounds/sound-bank.ts) | Line Siege v1's bank: exactly the six ids its board cues (place, beam, shock, hit, pop, breach); synced from the library's canonical Line Siege | Step 6, as the model |
| [examples/line-siege/sounds/sound-bank.test.ts](examples/line-siege/sounds/sound-bank.test.ts) | Its test: every recipe passes the gate, the ids equal the cued ids, the most repeated sound is the quietest | Step 6 |
| [examples/line-siege/board/build-timeline.ts](examples/line-siege/board/build-timeline.ts) | The Line Siege timeline whose track cues name those six ids with their haptics (place light, beam medium, pop success, breach warning); synced | Step 7, to see where cues sit |
| [examples/line-siege/board/monster-tracks.ts](examples/line-siege/board/monster-tracks.ts) | The monster tracks the timeline builds (hit, pop and breach cues); synced | Step 7 |
| `scripts/check-sound-banks.mjs` | Renders every UI and game sound with a byte-exact synth port, checks the gate, ids, categories, cues vs bank, bank tests and wiring; `--wav-dir` writes WAVs | Steps 8 and 10 |
| `scripts/check-audio-haptics.mjs` | Checks pins, banned packages, vendor imports, the one ambient context, file audio, plugin (and that `shellPlugins` uses it; not due before Shell step 8), mic string, music default, voice and haptic policies, cue call sites, UI feedback call sites (not due before Shell step 6), lifecycle mount, dispose-before-reload, the root mock | Steps 3 and 10 |
| `scripts/selftest.mjs` | Proves both checkers pass the good fixtures and catch every planted bug | After changing a checker or a template |
| `scripts/lib/` | `synth.mjs` (synth, sfc32, WAV and gate port with a pinned golden hash) and `ts-literal.mjs` (literal-data reader) | When changing a checker |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in (`check-lib.mjs`, the press-feedback context and `use-is-app-active.ts` with their tests, the Line Siege sounds and timeline) | When adding a shared file |
| `tests/build-fixtures.mjs` | Rebuilds `tests/fixtures/` from the templates plus one planted bug per case | After changing a template or a checker, before the self-test |
| `tests/fixtures/` | Good repos (the templates) and planted-bad copies for both checkers, plus a game-first suite (`shell-slice.json` `"screens": []`) where the Shell wiring prints SKIP | When adding a rule |

## Related skills

- `board-rendering-skia` - timeline tracks and cues, the cue scheduler that calls these ports, the board lifecycle.
- `settings-and-preferences` - the Sound, Music and Vibration rows and the settings-to-audio glue.
- `toybox-design-system`, `toybox-components` - the Pressable hosts that run `usePressFeedback`.
- `game-host-integration` - the result step that plays the `win`/`lose` feedback.
- `realtime-game-loop` - sims that emit events the host turns into sounds and haptics.
- `architecture-and-boundaries` - ports, adapters, app zones and `withShell`.
- `dependency-management` - installing and pinning packages, the banned list.
- `ios-release-testflight` - upload warnings such as ITMS-90683.
- `game-balance-and-bots` - payoff moments worth a sound.
