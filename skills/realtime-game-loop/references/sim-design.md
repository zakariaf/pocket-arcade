# Designing a real-time sim

What `apps/<game-id>/src/sim/<game-id>-sim.ts` must look like so it runs on the UI thread without allocating, replays bit-exactly, and saves cleanly. Read this before writing or changing a sim.

## Contents

- State: typed arrays in one shared value
- One tick
- Events
- Randomness: the sim's own sfc32 words
- The determinism policy
- Input: integer commands and the (tick, command) log
- Tests: replay and frame grouping
- Save points and the debug export
- Plugging the sim into the game module

## State: typed arrays in one shared value

```ts
export type HaloSim = {
  readonly body: Float32Array;   // per entity, stride 4: x, y, vx, vy (entity 0 = the player)
  readonly ints: Int32Array;     // header [tick, entityCount, lastCommand, eventCount], then event triples
  readonly rng: Uint32Array;     // the sim's own sfc32 state (4 words)
};
```

- One plain object of typed arrays in `useSharedValue(createSim(seed, level))`. On the UI thread `sim.get()` is the live object; the loop mutates it in place and calls `sim.modify()`. JS reads with `sim.get()` receive a copy (use it for save points).
- Allocate every buffer once in `create…Sim` (sized for the maximum: `MAX_ENTITIES`, `MAX_EVENTS`), never per tick. A full event queue drops the event rather than growing.
- Mutating arrays in place is allowed only under `apps/*/src/sim/**` (and the spatial hash's scratch buffers); the lint config exempts exactly those files from `no-param-reassign`.
- Positions and velocities are world units (for example a 1000 × 1000 arena) and speeds are per tick. The view scales the world to the canvas.
- The file starts with `'worklet';` and imports values only from other `'worklet'` modules (`@e07/game-kit/rng/sfc32.ts`, `@e07/game-kit/geom/*`).

## One tick

`step…Sim(sim, command)` advances exactly one tick:

1. If `command` differs from `ints[LAST_COMMAND]`, push an input event and store it (this is the replay log).
2. Move the player from the command's direction table.
3. Move every other entity (the gameplay: chase, collide via the spatial hash, spawn from the RNG).
4. `ints[TICK] += 1`.

No allocation (no `new`, no `Array.from`, no `.map`/`.filter`/`.push`, no object or array literals, no `vec2`/`sweep` calls in the hot path: they return new objects, so write the maths with scalars on the typed arrays, see [geom-kit.md](geom-kit.md)), no module-level variables, no clock, no `scheduleOnRN`, no React, no Shell imports. The loop calls it 1–30 times per frame.

## Events

- The sim appends `[kind, value, tick]` integer triples to `ints` (after the header): `EVENT_INPUT` (value = command), `EVENT_HIT` (value = entity), wave end, death.
- `drain…Events(sim)` copies the triples out as a flat number array and clears the count. `runLoopFrame` calls it once per frame and sends the batch to JS with one `scheduleOnRN`; JS plays sounds, updates the HUD and stats through the session store, and takes save points.
- Event kinds are small integer constants exported by the sim file; JS maps them to sound ids and store actions.

## Randomness: the sim's own sfc32 words

The sim takes every random number from game-kit's seeded integer PRNG (sfc32), keeping its 4-word state in `sim.rng`:

```ts
import { nextU32, seedRng } from '@e07/game-kit/rng/sfc32.ts';   // 'worklet' module (game-rules-engine skill)
// seedRng(seed) → RngState (4 uint32 words); nextU32(state) → { value: 0 … 2^32-1, state }

function drawU32(sim: Sim): number {
  const state: RngState = [sim.rng[0] ?? 0, sim.rng[1] ?? 0, sim.rng[2] ?? 0, sim.rng[3] ?? 0];
  const draw = nextU32(state);
  sim.rng.set(draw.state);
  return draw.value;
}
```

`Uint32Array.from(seedRng(seed))` initialises it. Never `Math.random`. For per-index randomness without state (particle directions, tile variants) use `hashU32(a, b)` from the same module.

## The determinism policy

In `apps/*/src/{rules,levels,sim,geom}/**` and `packages/game-kit/src/**`:

- allowed: `+ - * /`, `%`, bitwise operators, `Math.sqrt`, `Math.imul`, `Math.floor`, `Math.round`, `Math.abs`, `Math.min`, `Math.max`, `Math.PI`;
- banned: `**`, every other `Math.*` (`sin`, `cos`, `atan2`, `exp`, `pow` …), `Math.random`, `Date`, `performance.now`, `Intl`.

Why: Hermes computes `sin`/`cos`/`exp`/`pow` with the platform libm while Jest runs V8, so replays and daily seeds would diverge; `+ - * /`, `%` and `sqrt` are exactly specified by IEEE 754 / ECMA-262. Consequences: no angles in simulation (directions come from committed tables of unit vectors, reflection uses dot products), integers where possible (HP, scores, ticks), floats for positions are fine.

## Input: integer commands and the (tick, command) log

- Gesture worklets write an integer command into the loop's `command` shared value (the input skill's stick: 0 idle, 1…16 directions). The sim never sees a float from a gesture.
- Command k (1…16) = `(cos((k-1)·22.5°), sin((k-1)·22.5°))` with y pointing down; the table is committed as literals and must match the stick gesture's table in value and order (`check-realtime-loop.mjs` checks the sim's `STICK` table against the formula).
- The sim records every change as `EVENT_INPUT (tick, command)`; `commandLog(events, EVENT_INPUT)` turns drained events into the log, and `replayCommands({ sim, step, ticks }, log)` replays it.

## Tests: replay and frame grouping

Every sim ships a `*.test.ts` next to it (template `__GAME_ID__-sim.test.ts`) with at least:

1. **Replay:** play N ticks with a scripted bot, grouping ticks into frames of varying size, collect the input log; replay the log tick by tick into a fresh sim; the fingerprints (every body value, the header, the RNG words) are identical.
2. **Frame grouping:** the same bot stepped one tick at a time and grouped into 1–3 tick frames gives the identical world (60 vs 120 Hz cannot change the outcome).
3. **Time is ticks, events drain once.**

Bots for balance (thousands of seeded runs, difficulty curves) belong to the balance skill; they reuse the same `step` function headless.

## Save points and the debug export

At a save point the host takes `sim.get()` on JS (a copy of the typed arrays) and hands it to the save service with the input log: at pause, background, blur or an ad it stops the loop first; at the end of a wave (a drained batch for which `isSavePoint(events)` is true) it copies between two frames and the loop keeps running. Restoring creates the shared value from the saved arrays. Never save per frame: the save write budget is for moves and settings, and a frame is 8.3 ms.

## Plugging the sim into the game module

The game module (the `game-rules-engine` skill owns the full type) exposes a real-time game's sim as `realtime: RealtimeSpec<TState, TSim>`; turn-based and simulate-then-replay games set `realtime: null`:

```ts
export type RealtimeSpec<TState, TSim> = {
  readonly createSim: (state: TState) => TSim;            // JS: typed-array sim from a fresh or saved state
  readonly step: (sim: TSim, command: number) => void;     // worklet: one tick (the sim file's step…Sim)
  readonly drainEvents: (sim: TSim) => readonly number[];  // worklet: the sim file's drain…Events
  readonly snapshot: (sim: TSim) => TState;                // JS: JSON state from a sim copy, at save points only
  readonly savePoints: readonly SavePoint[];               // e.g. wave end, pause, background
  readonly isSavePoint: (events: readonly number[]) => boolean; // a drained batch holds a save-point event
};
```

- `step` and `drainEvents` match the Shell's `FixedStepSim`, so the Game screen passes `game={realtime}` to `RealtimeBoardHost` unchanged, with `initialSim={realtime.createSim(state)}` and `isSavePoint={realtime.isSavePoint}`.
- `snapshot` turns the typed arrays into plain number arrays (`Array.from(copy.body)`) so the state stays JSON; `createSim` rebuilds the typed arrays from them. Test the round trip: `snapshot(createSim(snapshot(sim)))` equals `snapshot(sim)`.
- The input log is built on JS from each batch's `EVENT_INPUT` triples (the filtering `commandLog` does in tests) and saved next to the snapshot, so a restored run can be replayed from its start.
- The copy can be a few ticks newer than the batch that triggered it (the loop keeps running while JS handles a wave-end batch), so the log may end before the snapshot's tick (`ints[TICK]`). Restoring uses the snapshot alone and is exact. A debug replay of that log can diverge after the last batch JS handled, so export replays from a paused game (loop stopped, its last batch arrived), never straight from a wave-end save.
- `persistence.savePolicy` is `{ kind: 'save-points', points: [...] }` for real-time games (turn-based games use `{ kind: 'after-every-move' }`).
- Allocation note: `drawU32` builds a 4-word array and a result object per draw. That is fine for occasional draws (spawns, respawns); for randomness per entity per tick use `hashU32(a, b)` (for example `hashU32(runSeed + tick, entity)`, with the run's seed kept in the sim header), which allocates nothing.

