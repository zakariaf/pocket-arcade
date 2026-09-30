# Sound design: recipes, the quality gate, cues and the WAV preview

Every sound in a Pocket Arcade game is synthesised in code from a small typed recipe. There are no audio files, so there are no licences to track, every render is byte-identical, and every sound can be heard on the Mac before any build.

## Contents

- The recipe model
- The quality gate
- Sound design guide (starting points)
- Ids and banks
- From events to cues
- Real-time games
- The WAV preview and tuning by ear
- Worked example: Line Siege

## The recipe model

A `SoundRecipe` is a list of voices (layers). Each `VoiceSpec` is:

| Field | Meaning |
|---|---|
| `wave` | `'sine'`, `'triangle'`, `'square'` (±0.6, softer than a full square) or `'noise'` (seeded white noise) |
| `startHz`, `endHz` | Pitch glide, linear over the voice (ignored for noise; write 0) |
| `offsetMs` | When the layer starts inside the sound |
| `durationMs` | Length of the layer |
| `attackMs` | Linear fade-in; 1-2 ms removes the click at the start |
| `gain` | Peak amplitude 0…1 before mixing |
| `seed` | Noise only: the sfc32 seed, so noise is identical on every render |

The envelope is: linear attack, then a quadratic decay over the whole voice, then a 6 ms fade so the last sample is exactly zero (no click when the buffer stops). `synthesizeRecipe` mixes the layers at their offsets; if the mix peaks above 0.9, the whole sound is scaled down to 0.9, so layers can never clip.

The synth may use `Math.sin` (it is not simulation code), but it takes randomness only from the seeded PRNG, so device buffers, Jest and the WAV preview are identical. The same pure function runs on device (at the context's sample rate, 48 kHz on the simulator), in Jest and in Node.

Write recipes as **literal data** inside the bank: numbers and strings inline, no shared constants, spreads or helper calls. The data is short, a diff shows exactly what changed, and this skill's `check-sound-banks.mjs` can read and render it without a TypeScript compiler.

## The quality gate

`recipeProblems(recipe, maxDurationMs)` (in `services/audio/synth/recipe-problems.ts`, game-facing) returns an empty list for a clean sound. The Shell's `synthesize-recipe.test.ts` runs it over `UI_SOUNDS`; each game's `sound-bank.test.ts` runs it over `SOUND_BANK`; `check-sound-banks.mjs` runs a byte-exact JavaScript port of the same checks.

| Check | Limit | What it prevents |
|---|---|---|
| Finite samples | no NaN/Infinity | a broken recipe that silences the whole mix |
| Peak | 0.05 to 0.9 | inaudible sounds; clipping |
| First sample | below 0.05 | a click at the start (attack too short for a loud triangle or square) |
| Last sample | below 0.01 | a click at the end |
| Length | 10 ms to 1500 ms (music up to 30 s) | sounds too short to hear; long effects that pile up in cascades |
| Voice fields | `durationMs > 0`, `0 <= attackMs < durationMs`, `0 < gain <= 1`, `offsetMs >= 0`, tonal pitch within 20-20000 Hz | nonsense data |
| Later layers | a voice with `offsetMs > 0` has `attackMs >= 1` | a click in the middle of the sound (the first-sample check only sees the start) |

A green gate proves the sound is clean, not that it is right. Only listening proves that (see the WAV preview).

## Sound design guide (starting points)

Start from these shapes, then tune by ear:

| Event type | Recipe shape |
|---|---|
| tap / place / move a tile | triangle, 45-80 ms, pitch falling about 30 % (e.g. 520 → 380 Hz), attack 1-2 ms, gain 0.35-0.5 |
| clear / beam / merge | sine sweep up (300 → 1200 Hz) over 200-300 ms plus 150 ms of soft noise (gain ≤ 0.15, attack 4 ms) |
| hit / crash | square, 100-150 ms, falling an octave (180 → 90 Hz); `minIntervalMs: 60` for rapid hits |
| combo / big clear | the clear sweep plus a second, higher layer offset by 60-80 ms |
| win | three rising triangle notes C5-E5-G5 (523.25, 659.25, 783.99 Hz), 110 ms apart, the last one longest |
| lose | square falling a sixth (330 → 196 Hz) over about 400 ms |
| rejected move | two short low square blips (e.g. 220 Hz, 40 ms each, 60 ms apart), quiet (gain ≤ 0.25) |

The Shell's own menu sounds, for reference: `ui.tap` (triangle 1400 → 900 Hz, 45 ms), `ui.toggle` (two sine blips 660 and 990 Hz), `ui.win` (C5-E5-G5), `ui.lose` (square 330 → 196 Hz, 420 ms).

Keep the palette small: 3-6 effects per game is typical (the product spec asks each game for a "sound set": which sound for which event). Make the most repeated action (place, move) the most pleasant and the quietest; save the loud, long sounds for rare events (win, big combo).

## Ids and banks

- Sound ids are kebab-case nouns named after what happened: `'place'`, `'clear'`, `'hit'`, `'win'`, `'lose'`, `'tap'`. Never after an animation (`'play-clear-animation'`).
- The Shell owns the `ui.` namespace; a game id never starts with `ui.` (`composeSoundBank` throws, the checker fails).
- Every id in a game's bank is cued somewhere in the game (usually `buildTimeline`), and every cued id is in the bank. Music entries are exempt from "cued": the Home screen starts them.
- Categories: game effects are `'sfx'`; at most one `'music'` entry with `isLoop: true`. `'ui'` is the Shell's.
- `minIntervalMs` on a spec overrides the 30 ms repeat limit for that sound.

## From events to cues

`applyMove` returns events that say what happened (`'column-cleared'`, `'monster-hit'`); `buildTimeline(events, motion)` turns them into tracks; a track may carry `cue: { sound?: string; haptic?: HapticCue }`, fired once when the track starts. The view pushed with the tracks is the final state; sounds describe how the board gets there.

```ts
// from a game's build-timeline.ts: the beam track starts at 120 ms and plays 'beam' with a medium pulse
const beam: Track = {
  channel: 'beam',
  entityId: event.col,
  startMs: BEAM_AT_MS * timing.scale,
  durationMs: 260 * timing.scale,
  easing: 'out-quad',
  from: [0],
  to: [1],
  cue: { sound: 'beam', haptic: 'medium' },
};
```

- The cue scheduler plays `audio.play(cue.sound, track.startMs)` on the audio clock and fires haptics with timers at `startMs`.
- A new move fast-forwards the running animation and cancels its unfired cues first; pause and leaving the screen cancel them too.
- Reduced motion scales the timeline (`timing.scale` 0.5), so the cues move with the tracks; sounds are not removed.
- One event, one cue. Put the cue on the track that shows the event, not on every particle track, or a cascade fires dozens of starts (the voice policy would drop most of them anyway).

## Real-time games

A real-time sim runs on the UI thread in fixed ticks and must never touch a port. The sim appends `[kind, value, tick]` events; the loop drains them once per frame and sends one batch to JS, where the host maps event kinds to `audio.play(id)` and `haptics.play(cue)`. Give frequent sounds a `minIntervalMs` so a burst of hits in one frame plays once, and never fire haptics per tick.

Write the sound ids in that host as literals (`audio.play('hit')`, or a table of `{ sound: 'hit', haptic: 'light' }` entries): `check-sound-banks.mjs` finds cues by these two shapes, and an id hidden in a variable reads as an unused sound.

## The WAV preview and tuning by ear

Two ways to hear every sound before a build:

1. **In the repo:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/audio/render-sfx-wav.ts --app <game-id>` writes `apps/<game-id>/sfx-preview/<id>.wav` (48 kHz, 16-bit mono; `apps/*/sfx-preview/` is gitignored). Verified: two runs give identical bytes; `afinfo` reports `1 ch, 48000 Hz, Int16`.
2. **From this skill:** `node ${CLAUDE_SKILL_DIR}/scripts/check-sound-banks.mjs . --wav-dir /tmp/sfx` writes `/tmp/sfx/<game-or-shell>/<id>.wav` for every clean sound, byte-identical to the app's synth (the checker verifies a pinned hash of Line Siege's `beam` at startup).

Tuning loop: change one number, re-render, listen next to the neighbouring sounds (open them in Finder and press space), keep it or revert. Ask the owner to listen before calling the sound set done; Claude cannot hear.

## Worked example: Line Siege

Line Siege v1 has exactly six game sounds, one per visible event kind, and the bank holds exactly the ids its board cues (its test compares the cued ids with the bank keys):

| Event | Track (start, full motion) | Sound | Haptic |
|---|---|---|---|
| `block-placed` | `pop` on the first placed cell, 0 ms | `place`: triangle 520 → 380 Hz, 70 ms, the quietest (most repeated) | `light` |
| `beam-fired` (a cleared column) | `beam` on the lane, 160 ms | `beam`: sine 300 → 1200 Hz 240 ms + noise 160 ms (seed 3) | `medium` |
| `shockwave-sent` (cleared rows) | `shock` on the turn, 160 ms | `shock`: sine 180 → 90 Hz 260 ms + a soft noise swell | none |
| `monster-hit` | `flash` on the monster, 380 ms | `hit`: square 180 → 90 Hz, 120 ms, `minIntervalMs: 60` | none |
| `monster-defeated` | `vanish` + `burst`, 480 ms | `pop`: rising triangle 660 → 990 Hz + a 1320 Hz blip | `success` |
| `wall-breached` | `vanish` into the wall, 620 ms | `breach`: square 330 → 196 Hz, 320 ms | `warning` |
| `monster-moved`, `monster-spawned`, `tray-refilled`, `score-added` | `row`, `spawn`, `tray` | none | none |
| the continue (`heart-restored`, `monsters-pushed-back`, `rows-emptied`) | `heart`, `push`, `clear` | none (it follows the Shell's continue dialog) | none |
| level won / lost | the game host's result step | Shell `ui.win` / `ui.lose` (`playUiFeedback`) | `success` / `error` |

The bank and its test are in `examples/line-siege/sounds/`; the timeline that carries the cues is `examples/line-siege/board/build-timeline.ts` with `monster-tracks.ts` (all synced from the library's one canonical Line Siege).
