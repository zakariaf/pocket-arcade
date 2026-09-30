// apps/tap-flip/src/rules/tap-flip-engine.ts
// Stand-in for game-rules-engine's Tap Flip engine: only the rules policies check-game-host
// cross-checks with game.config.ts (no hints, one continue that adds moves).
export const TAP_FLIP_RULES = {
  undo: { kind: 'unlimited' },
  hints: { kind: 'none' },
  continueRun: {
    kind: 'once',
    descriptionId: 'tap-flip.continue.more-moves',
  },
};
