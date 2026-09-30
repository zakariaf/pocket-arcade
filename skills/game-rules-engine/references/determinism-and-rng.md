# Determinism and the seeded RNG

Why game code may only use a small set of operations, and how the one random number generator (sfc32) works, with the golden values that make it a compatibility contract.

## Contents

- The determinism policy
- Why these operations and no others
- Practical consequences
- sfc32: the algorithm
- The API
- The golden values (compatibility contract)
- Using randomness in rules
- Randomness outside rules (sims, particles, bots)
- The daily seed is a different function

## The determinism policy

Applies to `packages/game-kit/src/**` and `apps/*/src/{rules,levels,sim,geom}/**`:

- Allowed: `+ - * /`, `%`, bitwise operators, `Math.sqrt`, `Math.imul`, `Math.floor`, `Math.round`, `Math.abs`, `Math.min`, `Math.max`, `Math.PI`.
- Not allowed: `**` (it is `Math.pow`), every other `Math.*` (`sin`, `cos`, `atan2`, `exp`, `log`, `pow`, `hypot`, ...), `Math.random`, `Date` (`Date.now`, `new Date`), `performance.now`, `Intl`.
- Tests in those folders may use `**` (for example `2 ** 31 - 1` as a fast-check bound) but never `Math.random`, `Date.now`, `new Date()` or `performance.now()`: tests never read real time or real randomness either.

The project's ESLint config enforces this (`DETERMINISTIC` block, `no-restricted-properties`); `check-rules-engine.mjs` checks it again for the rules folder and game-kit.

## Why these operations and no others

Hermes (the phone) computes `sin`, `cos`, `exp` and `pow` with the platform's C maths library while Jest runs on V8, so the last bits of a result can differ between the phone, the Mac and a future OS update. A replay, a daily challenge ("same level for every player on the same date", spec 8.3) or a saved undo history would then diverge. `+ - * /`, `%` and `Math.sqrt` are exactly specified by IEEE 754 and ECMA-262 (correctly rounded), and the integer operations are exact, so they give identical bits everywhere.

## Practical consequences

- **No angles in simulation.** Reflect with dot products (`v - 2(v·n)n`); take directions from committed tables (for example 16 unit vectors generated once and pasted as literals); normalise an aim vector with `Math.sqrt`.
- **Integers where possible.** HP, scores, grid positions, ticks and moves are integers. Floats are fine for positions because `+ - * /` and `sqrt` are exact everywhere.
- **Clocks never enter rules.** Time arrives as a tick count, a move count, or a value the Shell passes in (from `ClockPort`). Fuseban's "timed" charges count turns.
- **`Intl` never enters rules.** Localised digits are produced by the board's `toView`, not by the rules.
- **Rendering may use trigonometry** (it is not simulation, and pixel goldens compare Jest with Jest), but board code stays within the policy anyway so particles and shake replay identically.

## sfc32: the algorithm

sfc32 (Chris Doty-Humphrey, PractRand) passes PractRand, has 128 bits of state and uses only 32-bit integer operations, so every JavaScript engine produces the same sequence. The state is four unsigned 32-bit integers, JSON-serialisable, stored inside the game state; `nextU32` returns the value and the next state without hidden mutation:

```ts
export function nextU32(state: RngState): RngDraw {
  const [a, b, c, d] = state;
  const t = (((a + b) | 0) + d) | 0;           // tmp = a + b + counter
  const nextD = (d + 1) | 0;                   // counter++
  const nextA = b ^ (b >>> 9);
  const nextB = (c + (c << 3)) | 0;
  const rotated = (c << 21) | (c >>> 11);
  const nextC = (rotated + t) | 0;
  return { value: t >>> 0, state: [nextA >>> 0, nextB >>> 0, nextC >>> 0, nextD >>> 0] };
}
```

`seedRng(seed)` expands any integer seed: four words `mix32(s + k * 0x9e3779b9)` for k = 1..4 (`mix32` is the murmur3 finaliser: only `Math.imul`, xor and shifts), then 12 warm-up draws. The file carries a file-level `'worklet';` directive because the real-time sim calls it on the UI thread.

## The API

| Function | Use |
|---|---|
| `seedRng(seed)` | A warmed-up `RngState` from any integer seed (level seed, daily seed). |
| `nextU32(state)` | `{ value: 0..2^32-1, state }`. |
| `nextInt(state, n)` | Unbiased integer in `[0, n)`, `n` in 1..2^32, by rejection sampling (the top of the range that would bias `% n` is redrawn). |
| `nextUnit(state)` | Float in `[0, 1)`: `value / 2^32` (division is correctly rounded, so deterministic). |
| `hashSeed(text)` | FNV-1a over UTF-16 code units: a text key into a seed. |
| `hashU32(a, b)` / `mix32(x)` | Stateless per-index randomness (particle directions, tile variants) with no state to carry. |
| `pickAt(items, index)` | `rng/pick-at.ts`: the one place that turns `noUncheckedIndexedAccess`'s `T \| undefined` into `T` (throws `RangeError` outside the list), so rules stay branch-free and fully covered. |

## The golden values (compatibility contract)

These values are pinned in `rng/sfc32.test.ts` and checked by running the real module in `check-rules-engine.mjs`. Changing the algorithm, the seeding, the warm-up count or these numbers changes every generated level, every daily challenge and every saved replay on every player's phone.

| Call | Golden value |
|---|---|
| `seedRng(1)`, first five `nextU32` values | `1828152527, 3394835397, 2967886022, 2251045104, 4148684523` |
| `hashSeed('line-siege:2026-09-26')` | `2224665572` |
| `nextU32` from `[1, 2, 3, 4]` | equals an independent transcription of PractRand's C code for 50 draws |

If a change to `sfc32.ts` ever seems necessary, stop and ask the owner: it is a new RNG under a new name, never an edit, and existing levels keep the old one.

## Using randomness in rules

- **Only in `create`** (a scrambled start): seed locally, draw, and drop the RNG. The template game does this; nothing random happens afterwards, so the state needs no RNG.
- **During play** (tray refills, spawns, card draws): the state carries `rng: RngState` and every draw threads it: `const draw = nextInt(state.rng, PIECES.length); ... { ...state, rng: draw.state }`. Line Siege's tray refill (`drawTray` in `examples/line-siege/rules/pieces.ts`) and its monster spawns (`examples/line-siege/rules/monster-march.ts`) are the examples. Never re-seed from the move count or anything else: the stream must continue.
- **Never** a module-level RNG, `Math.random`, or a seed from the clock inside rules. An endless run's fresh seed comes from the Shell (it is saved with the run).
- A different seed for a second stream (for example the level generator scattering blocks) is derived with xor: `seedRng(seed ^ 0x5bd1e995)`.

## Randomness outside rules (sims, particles, bots)

- A real-time sim keeps the four words in its own `Uint32Array` and advances them with `nextU32` plus `rng.set(draw.state)` (realtime-game-loop skill).
- Particles use `hashU32(burstSeed, index)`: stateless, so a burst renders identically at any time in goldens.
- Bots get their own RNG from `playBot` (`seedRng(seed ^ 0x5bd1e995)`) and return the advanced state; a bot that needs no randomness passes it through unchanged.
- Property tests pass fixed fast-check seeds where a test must be reproducible (`{ seed: 42, numRuns: 300 }`).

## The daily seed is a different function

`dailySeed(dateKey, salt)` in `packages/game-kit/src/dates/daily-seed.ts` is FNV-1a over the `'YYYY-MM-DD'` key mixed with the game's salt; its goldens (`dailySeed('2026-09-26', 17) = 2599028541`, `dailySeed('2026-09-27', 17) = 2582250922`) are the level-generation-and-solvers and daily-and-statistics skills' contract. The daily level is `create(dailySeed(today, levels.daily.salt), levels.daily.difficulty)`, which then draws from sfc32 like any other level.
