# Simulate-then-replay

How turn-based games with a continuous phase (Bank Shot volleys, Toggle Drop ball runs, Poker Drop cascades) compute that phase inside `applyMove` and replay it on screen as an ordinary timeline. Read this before building such a game.

## Contents

- The idea
- The fixed step inside applyMove
- Timed events
- From events to tracks
- The collision recipe (Bank Shot)
- Discrete runs (Toggle Drop, cascades)
- Tests

## The idea

The player's move (a shot, a dropped ball) starts a continuous process. Instead of running it live, `applyMove` runs it to the end with the same fixed step the real-time loop uses and returns an event list with timestamps: `{ kind: 'ball-bounced', ballId, x, y, atMs }`. The game stays turn-based: saves, undo, bots, solvers and goldens all work on `applyMove` as usual; only the pictures move in real time, driven by the board clock and `buildTimeline`.

## The fixed step inside applyMove

- Advance in ticks of `STEP_MS = 1000 / 120` (import it from `@e07/game-kit/timeline/fixed-step.ts`), with velocities in world units per tick.
- Loop until every body is done or a hard `maxTicks` cap is reached (a volley always ends; a bot must never hang).
- The code lives in `apps/<game-id>/src/rules/` (pure and deterministic): no React, Skia or Shell, no clock, no `Math.random` (the RNG state lives in the game state), only the allowed `Math.*` functions.
- It runs on the JS thread, so it may allocate normally (arrays of events, immutable vectors); only the real-time sim has the no-allocation rule.

## Timed events

- `atMs = Math.round(tick × STEP_MS)`: integer milliseconds on the timeline.
- Emit an event at every point where motion changes: launch, each bounce, exit or stop. For straight-line motion between events, that is enough to reproduce the path exactly.
- With gravity, curves or friction, the path between events is not straight: also emit a position event every few ticks (for example every 6 ticks, 50 ms) so linear tracks stay within a pixel of the true path.
- Events carry every id and coordinate the animation needs; `buildTimeline` never looks at state.

## From events to tracks

`volleyTracks(events)` (example `volley-timeline.ts`): for each ball, one linear `ball` track from each event point to the next, starting at the earlier `atMs` and lasting until the later one; a sound cue on bounces. Under reduced motion keep the tracks (they carry the outcome) but drop particle bursts. Then the rendering skill's clock plays them like any turn: the view pushed with the tracks is the final state.

## The collision recipe (Bank Shot)

Per fixed step, for each ball:

1. Sweep the circle's motion for this step against every wall segment and brick edge (a brick is 4 segments): `sweepCircleSegment({ center, motion, radius }, segment)` returns the contact fraction `t` (0…1) and the surface normal, including the rounded segment ends.
2. Take the earliest hit; move to it (`pos + motion × t`).
3. Reflect the velocity: `reflect(v, n) = v − 2(v·n)n` (no angles).
4. Spend the remaining fraction of the step (`remaining × (1 − t)`); repeat at most 4 times per step.
5. With many balls, use the spatial hash for ball-ball overlap (`circlesOverlap(a, b, radiusSum)` compares squared distances, no `sqrt`).

`examples/bank-shot/simulate-volley.ts` implements steps 1–4 for an open-bottom box.

## Discrete runs (Toggle Drop, cascades)

Not everything continuous needs geometry. A ball dropping through flip-flops, or a cascade of falling cards, is a discrete sequence: compute it step by step in `applyMove`, emit one timed event per step (`atMs = step × STEP_DURATION`), and let `buildTimeline` chain the tracks with delays. Same rules: pure, capped, deterministic.

## Tests

`examples/bank-shot/simulate-volley.test.ts` shows the required properties (fast-check with fixed seeds):

- every contact stays inside the arena;
- a ball never speeds up (distance between consecutive events ≤ speed × ticks);
- the same shot always gives the same events (replays, daily challenges and goldens depend on it);
- the tracks built from the events replay the path (one track per consecutive event pair, starting at the launch point).
