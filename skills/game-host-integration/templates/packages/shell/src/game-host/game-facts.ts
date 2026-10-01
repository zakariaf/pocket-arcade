// packages/shell/src/game-host/game-facts.ts
// Three facts about a game that the Shell and the parity harness both need, decided in one place:
// does its sound bank hold music (the S6 and S11 Music rows), are its levels rated by score (the
// S7 win line and the null par), and does it give hints (the S5 top bar's hint key).
// GameHost.hasMusic, GameHost.isScoreRated and GameHost.hasHints come from here, and the parity
// pin test (apps/<id>/src/parity-game-facts.test.ts) checks parity/game-facts.json against the
// same three functions, so a capture never picks the wrong reference variant.
import type { StarRule } from '@e07/game-kit/contract/levels.ts';
import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';

type ScoreRule = Extract<StarRule, { readonly kind: 'score' }>;

/** Spec 8.7: a game has at most one sound in category 'music'; most have none. */
export function hasMusicOf<T extends ShellGameTypes>(game: ShellGameModule<T>): boolean {
  return Object.values(game.presentation.sounds).some((spec) => spec.category === 'music');
}

/**
 * The one rule for a score-rated level: its star rule is a score rule. run-summary.ts gives such a
 * level no par (resultModelOf then passes par null and S7 prints the score line).
 */
export function isScoreRule(rule: StarRule | null): rule is ScoreRule {
  return rule !== null && rule.kind === 'score';
}

/**
 * True when the game gives hints: its rules' hint policy is a solver. This is the same rule the
 * session view's isHintSupported uses, so the S5 top bar has a hint key exactly when this is true
 * (Line Siege: false, its rules say hints: { kind: 'none' }).
 */
export function hasHintsOf<T extends ShellGameTypes>(game: ShellGameModule<T>): boolean {
  return game.rules.hints.kind === 'solver';
}

/** True when the game's levels are rated by score (Line Siege), false when by moves against par. */
export function isScoreRatedOf<T extends ShellGameTypes>(game: ShellGameModule<T>): boolean {
  const { table } = game.levels;
  return table.length > 0 && table.every((entry) => isScoreRule(entry.stars));
}
