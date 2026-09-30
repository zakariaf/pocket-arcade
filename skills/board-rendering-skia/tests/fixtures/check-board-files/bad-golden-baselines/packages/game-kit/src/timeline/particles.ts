// packages/game-kit/src/timeline/particles.ts
'worklet';

import { hashU32 } from '@e07/game-kit/rng/sfc32.ts';

/**
 * A particle burst is stateless: every particle's position is a pure function of
 * (burst, index, age). Nothing is stored per frame, so bursts replay identically,
 * render at any t in goldens, and cost nothing when the clock is stopped.
 */
export type BurstSpec = {
  readonly seed: number;
  readonly x: number;
  readonly y: number;
  readonly count: number;
  /** Speed range in px/s. */
  readonly minSpeed: number;
  readonly maxSpeed: number;
  /** Downward acceleration in px/s². */
  readonly gravity: number;
  readonly lifeMs: number;
};

/** One particle at one age: position in canvas points and opacity. */
export type ParticleSample = { readonly x: number; readonly y: number; readonly alpha: number };

/**
 * 16 unit vectors (cos, sin of k·22.5°), precomputed once with Node and committed as
 * literals so the kit never calls Math.cos/Math.sin (determinism policy).
 */
const DIRECTIONS = [
  1, 0, 0.9238795325112867, 0.3826834323650898, 0.7071067811865476, 0.7071067811865476,
  0.3826834323650898, 0.9238795325112867, 0, 1, -0.3826834323650898, 0.9238795325112867,
  -0.7071067811865476, 0.7071067811865476, -0.9238795325112867, 0.3826834323650898, -1, 0,
  -0.9238795325112867, -0.3826834323650898, -0.7071067811865476, -0.7071067811865476,
  -0.3826834323650898, -0.9238795325112867, 0, -1, 0.3826834323650898, -0.9238795325112867,
  0.7071067811865476, -0.7071067811865476, 0.9238795325112867, -0.3826834323650898,
] as const;
const DIRECTION_COUNT = 16;

/** Pure: particle `index` of a burst at `ageMs`; direction and speed come from hashU32. */
export function sampleParticle(burst: BurstSpec, index: number, ageMs: number): ParticleSample {
  const bits = hashU32(burst.seed, index);
  const direction = bits % DIRECTION_COUNT;
  const speedT = ((bits >>> 8) & 0xff) / 255;
  const speed = burst.minSpeed + (burst.maxSpeed - burst.minSpeed) * speedT;
  const dx = DIRECTIONS[direction * 2] ?? 0;
  const dy = DIRECTIONS[direction * 2 + 1] ?? 0;
  const t = ageMs / 1000;
  return {
    x: burst.x + dx * speed * t,
    y: burst.y + dy * speed * t + 0.5 * burst.gravity * t * t,
    alpha: Math.max(0, 1 - ageMs / burst.lifeMs),
  };
}
