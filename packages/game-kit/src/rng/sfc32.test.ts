// packages/game-kit/src/rng/sfc32.test.ts
import fc from 'fast-check';

import { hashSeed, hashU32, nextInt, nextU32, nextUnit, seedRng } from './sfc32.ts';

import type { RngState } from './sfc32.ts';

function drawMany(state: RngState, count: number): number[] {
  const values: number[] = [];
  let current = state;
  for (let i = 0; i < count; i += 1) {
    const draw = nextU32(current);
    values.push(draw.value);
    current = draw.state;
  }
  return values;
}

/** Independent transcription of PractRand's C sfc32, used as the oracle. */
function referenceSfc32(seed: readonly number[], count: number): number[] {
  let [a = 0, b = 0, c = 0, d = 0] = seed;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const tmp = (a + b + d) >>> 0;
    d = (d + 1) >>> 0;
    a = (b ^ (b >>> 9)) >>> 0;
    b = (c + (c << 3)) >>> 0;
    c = ((((c << 21) | (c >>> 11)) >>> 0) + tmp) >>> 0;
    out.push(tmp);
  }
  return out;
}

describe('sfc32', () => {
  it('matches the PractRand reference algorithm', () => {
    const state: RngState = [1, 2, 3, 4];
    expect(drawMany(state, 50)).toStrictEqual(referenceSfc32(state, 50));
  });

  it('keeps the pinned golden sequence for seed 1 (daily-challenge compatibility contract)', () => {
    expect(drawMany(seedRng(1), 5)).toStrictEqual(GOLDEN_SEED_1);
  });

  it('returns the same sequence for the same seed', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        expect(drawMany(seedRng(seed), 20)).toStrictEqual(drawMany(seedRng(seed), 20));
      }),
      { seed: 42, numRuns: 300 },
    );
  });

  it('keeps nextInt inside its range', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 1000 }), (seed, max) => {
        const { value } = nextInt(seedRng(seed), max);
        expect(Number.isInteger(value) && value >= 0 && value < max).toBe(true);
      }),
      { seed: 7, numRuns: 500 },
    );
  });

  it('rejects the biased top draw and uses the next one', () => {
    const top: RngState = [0xffffffff, 0, 0, 0];
    const next = nextU32(nextU32(top).state);
    expect(nextU32(top).value).toBe(4_294_967_295);
    expect(nextInt(top, 3)).toStrictEqual({ value: next.value % 3, state: next.state });
  });

  it('keeps nextUnit inside [0, 1)', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const { value } = nextUnit(seedRng(seed));
        expect(value >= 0 && value < 1).toBe(true);
      }),
      { seed: 9, numRuns: 300 },
    );
  });

  it('gives hashU32 the same value for the same pair and spreads neighbouring indices', () => {
    expect(hashU32(7, 3)).toBe(hashU32(7, 3));
    const values = new Set(Array.from({ length: 64 }, (_, index) => hashU32(7, index)));
    expect(values.size).toBe(64);
  });

  it('hashes daily keys stably', () => {
    expect(hashSeed('line-siege:2026-09-26')).toBe(GOLDEN_DAILY_HASH);
  });
});

const GOLDEN_SEED_1 = [1828152527, 3394835397, 2967886022, 2251045104, 4148684523];
const GOLDEN_DAILY_HASH = 2224665572;
