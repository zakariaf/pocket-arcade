// apps/flock-tilt/src/rules/flock-tilt-engine.ts (self-test fixture: loadable, no imports)
export const FLOCK_TILT_ENGINE = {
  panMode: 'swipe',
  listMoves: () => [],
  intentToMove: () => null,
};

export const FLOCK_TILT_RULES = {
  undo: { kind: 'unlimited' },
  hints: { kind: 'none' },
  continueRun: { kind: 'once', descriptionId: 'flock-tilt.goal' },
};
