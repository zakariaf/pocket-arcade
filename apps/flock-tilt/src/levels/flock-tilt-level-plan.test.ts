// apps/flock-tilt/src/levels/flock-tilt-level-plan.test.ts
import { create } from '@e07/flock-tilt/rules/create.ts';
import { parseField } from '@e07/flock-tilt/rules/field-text.ts';
import { TUNING } from '@e07/flock-tilt/rules/flock-tilt-tuning.ts';

import {
  FLOCK_TILT_LEVEL_PLAN,
  LEVELS_PER_PACK,
  MAX_RANDOM_WIN_SHARE,
  difficultyFor,
  minParFor,
  randomWinShare,
} from './flock-tilt-level-plan.ts';

import type { FlockTiltState } from '@e07/flock-tilt/rules/flock-tilt-types.ts';

const LEVELS = Array.from({ length: 3 * LEVELS_PER_PACK }, (_, index) => index + 1);

describe('difficultyFor', () => {
  it('rises from 0 at level 1 to 99 at level 90 without ever falling', () => {
    const curve = LEVELS.map(difficultyFor);
    expect(curve[0]).toBe(0);
    expect(curve.at(-1)).toBe(99);
    expect(curve).toStrictEqual([...curve].sort((a, b) => a - b));
  });

  it('clamps level numbers outside the table', () => {
    expect(difficultyFor(0)).toBe(0);
    expect(difficultyFor(500)).toBe(99);
  });
});

describe('randomWinShare ("naive bots should lose")', () => {
  it('is high for a field one tilt wins and zero for a field random tilts cannot win', () => {
    const easy: FlockTiltState = {
      ...parseField(['o.sss', '.....', '....w']),
      tilts: 0,
      tiltLimit: TUNING.tiltLimit,
      par: 1,
      hasContinued: false,
      beforeLoss: null,
    };
    expect(randomWinShare(easy, 1)).toBeGreaterThan(MAX_RANDOM_WIN_SHARE);
    const stuck = { ...easy, ...parseField(['s#...', '#...o', '....w']) };
    expect(randomWinShare(stuck, 3)).toBe(0);
  });

  it('gives the same share for the same field (seeded swipers)', () => {
    const start = create(8, 30);
    expect(randomWinShare(start, start.par)).toBe(randomWinShare(start, start.par));
  });
});

describe('FLOCK_TILT_LEVEL_PLAN', () => {
  it('asks more tilts in later packs: 3, 4, then 5', () => {
    expect([1, 30, 31, 60, 61, 90].map(minParFor)).toStrictEqual([3, 3, 4, 4, 5, 5]);
  });

  it('rates a level against par and rejects one too easy for its pack', () => {
    const start = create(1, 70);
    const candidate = { level: 61, seed: 1, difficulty: 70, start, line: [], final: start };
    const rated = FLOCK_TILT_LEVEL_PLAN.rate({ ...candidate, par: start.par });
    expect(rated === null || rated.kind === 'par').toBe(true);
    expect(FLOCK_TILT_LEVEL_PLAN.rate({ ...candidate, par: 4 })).toBeNull();
  });

  it('rejects a field random swipers win too often', () => {
    const easy: FlockTiltState = {
      ...parseField(['o.sss', '.....', '....w']),
      tilts: 0,
      tiltLimit: TUNING.tiltLimit,
      par: 3,
      hasContinued: false,
      beforeLoss: null,
    };
    const candidate = { level: 1, seed: 1, difficulty: 0, start: easy, line: [], final: easy };
    expect(FLOCK_TILT_LEVEL_PLAN.rate({ ...candidate, par: 3 })).toBeNull();
  });

  it('declares three packs of thirty levels with the copy deck pack names', () => {
    expect(FLOCK_TILT_LEVEL_PLAN.packs.map((pack) => pack.nameId)).toStrictEqual([
      'flock-tilt.pack-name.1',
      'flock-tilt.pack-name.2',
      'flock-tilt.pack-name.3',
    ]);
    expect(FLOCK_TILT_LEVEL_PLAN.levelsPerPack).toBe(30);
  });
});
