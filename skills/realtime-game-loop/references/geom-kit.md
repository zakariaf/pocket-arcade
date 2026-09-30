# The geometry kit

The small, deterministic 2D kit in `packages/game-kit/src/geom/` that real-time and simulate-then-replay games use instead of a physics engine. Read this when a game needs vectors, collisions or a broad phase.

## Contents

- vec2.ts
- sweep.ts
- spatial-hash.ts
- Inside a UI-thread sim
- Rules for new geometry

## vec2.ts

Immutable `Vec2 = { x, y }` in world units; every function is a worklet (file-level `'worklet'`).

| Function | Meaning |
|---|---|
| `add(a, b)`, `sub(a, b)`, `scale(a, k)` | component-wise arithmetic |
| `dot(a, b)` | the basis of projection and reflection without angles |
| `length(a)` | `Math.sqrt(dot(a, a))`: `sqrt` is correctly rounded by IEEE 754, so it is deterministic everywhere |
| `normalize(a)` | unit vector, or `ZERO` for zero length |
| `reflect(v, n)` | `v − 2(v·n)n` for a unit normal `n`: bounce without angles; keeps the speed |

## sweep.ts

Continuous collision for one fixed step, so fast balls never tunnel through thin walls:

- `MovingCircle = { center, motion, radius }` where `motion` is velocity × step.
- `sweepCirclePoint(circle, point)`: first contact with a fixed point (a segment end-cap): the smallest `t` in 0…1 with `|center + t·motion − point| = radius`, plus the normal.
- `sweepCircleSegment(circle, { a, b })`: earliest contact with the segment's interior (the line offset by the radius, clipped to the segment) or either rounded end; `null` when there is none this step.
- `circlesOverlap(a, b, radiusSum)`: overlap test by squared distance (no `sqrt`).

Verified by tests: contact time and normal against a wall (`t = 0.5`, normal `y = −1`), the rounded end, and a fast-check property that reflection keeps the speed.

## spatial-hash.ts

A uniform-grid broad phase rebuilt every tick by counting sort into caller-owned typed arrays, so a per-tick rebuild on the UI thread allocates nothing:

- `makeSpatialHash({ cellSize, cols, rows }, capacity)` allocates `cellStart` and `cursor` (`cols × rows + 1` entries) and `items` (one per entity) once, at sim creation.
- `rebuildSpatialHash(hash, positions, count)` from interleaved positions `[x0, y0, x1, y1, …]`.
- `cellOf(hash, x, y)` clamps to the grid. Entities of cell `c` are `items[cellStart[c]] … items[cellStart[c + 1] − 1]`; check a body against its own and the 8 neighbouring cells.
- It is one of only two places allowed to write into buffers passed in (the other is `apps/*/src/sim/**`); writes go through local aliases of the scratch buffers.

## Inside a UI-thread sim

- `vec2` and `sweep` return a new small object on every call (`{ x, y }`, a hit, the `candidates` array). That is right for `applyMove` on the JS thread (simulate-then-replay) and for tests, but a real-time `step` runs up to 30 times a frame for every body and must allocate nothing. There, write the same maths with scalars straight on the typed arrays, as the Halo Drift example's `chase` does: overlap is `dx * dx + dy * dy < r * r`, a bounce off a unit normal `(nx, ny)` is `d = 2 * (vx * nx + vy * ny); vx -= d * nx; vy -= d * ny`. `check-realtime-loop.mjs` reports a vec2 or sweep call reached from a `step…` function (`sim-no-alloc`).
- `spatial-hash` is allocation-free and made for the UI thread: create it once in `create…Sim` and keep it as a field of the sim object. Its positions are stride 2 (`[x0, y0, x1, y1, …]`), while a sim's `body` is stride 4 (`x, y, vx, vy`): passing `body` gives wrong cells without any error. Keep positions in their own `Float32Array` (and velocities in another), or copy `x, y` into a stride-2 scratch buffer allocated once, before `rebuildSpatialHash`.

## Rules for new geometry

- Put it in `packages/game-kit/src/geom/` with a file-level `'worklet'`, next to its caller's first use or its test (unused exports are reported).
- Only the allowed operations of the determinism policy; directions come from committed unit-vector tables, never from `Math.cos`/`Math.sin`/`Math.atan2`.
- A pure function of its inputs, with an example test and a fast-check property (fixed seed) for every invariant it promises.
