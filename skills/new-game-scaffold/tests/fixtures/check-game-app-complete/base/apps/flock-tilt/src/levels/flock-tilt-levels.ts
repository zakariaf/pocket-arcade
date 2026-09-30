// apps/flock-tilt/src/levels/flock-tilt-levels.ts (self-test fixture: loadable, no imports)
const pack = { levelCount: 30 };

export const FLOCK_TILT_LEVELS = {
  packs: [pack, pack, pack],
  daily: { kind: 'daily', difficulty: 40, salt: 1 },
  endless: { kind: 'none' },
};
