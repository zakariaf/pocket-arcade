// packages/game-kit/src/testing/bot-policies.ts
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';

import type { BotPolicy } from './play-bot.ts';
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** How good a state looks to a bot: higher is better. Pure; reads only the state. */
export type Evaluate<TState> = (state: TState) => number;

/** The engine members a searching bot needs; any GameModule's engine satisfies it. */
export type SearchRules<TState, TMove, TEvent> = Pick<
  GameEngine<TState, TMove, TEvent>,
  'listMoves' | 'applyMove' | 'outcome'
>;

/** Search depth and width of the lookahead bot. */
export type LookaheadOptions = {
  /** Plies searched: 2 = my move plus my best follow-up. */
  readonly depth: number;
  /** Moves kept per ply after a one-ply ranking (keeps a decision under a few thousand applyMoves). */
  readonly beam: number;
};

const WIN_BONUS = 1_000_000;
const LOSS_PENALTY = -1_000_000;

/** Evaluation that also knows the outcome: a win beats any position, a loss is worse than any. */
function judge<TState, TMove, TEvent>(
  rules: SearchRules<TState, TMove, TEvent>,
  evaluate: Evaluate<TState>,
  state: TState,
): number {
  const outcome = rules.outcome(state);
  if (outcome.kind === 'won') return WIN_BONUS + evaluate(state);
  if (outcome.kind === 'lost') return LOSS_PENALTY + evaluate(state);
  return evaluate(state);
}

/** Uniform choice among the best-scoring moves: the seeded RNG breaks ties, so no first-move bias. */
function pickBest<TMove>(
  moves: readonly TMove[],
  scores: readonly number[],
  rng: RngState,
): { readonly move: TMove; readonly rng: RngState } {
  const best = Math.max(...scores);
  const tied = moves.filter((_, index) => scores[index] === best);
  const draw = nextInt(rng, tied.length);
  const move = tied[draw.value];
  if (move === undefined) throw new Error('bot called without legal moves');
  return { move, rng: draw.state };
}

/** Indices of the `beam` highest scores, best first (ties keep list order). */
function topIndices(scores: readonly number[], beam: number): number[] {
  return scores
    .map((score, index) => ({ score, index }))
    .sort((a, b) => (a.score === b.score ? a.index - b.index : b.score - a.score))
    .slice(0, beam)
    .map((entry) => entry.index);
}

/** Greedy: the move whose next state evaluates best (one ply). The usual "reasonable player". */
export function greedyPolicy<TState, TMove, TEvent>(
  rules: SearchRules<TState, TMove, TEvent>,
  evaluate: Evaluate<TState>,
): BotPolicy<TState, TMove> {
  return (state, moves, rng) => {
    const scores = moves.map((move) => judge(rules, evaluate, rules.applyMove(state, move).state));
    return pickBest(moves, scores, rng);
  };
}

/**
 * Lookahead: best value over `depth` plies of its own moves, searching only the `beam` best moves
 * per ply. It sees the seeded future (next draws), so it is an upper bound of skill, not a human.
 */
export function lookaheadPolicy<TState, TMove, TEvent>(
  rules: SearchRules<TState, TMove, TEvent>,
  evaluate: Evaluate<TState>,
  options: LookaheadOptions,
): BotPolicy<TState, TMove> {
  /** Value of a state with `plies` of its own moves still to search (0 = just evaluate it). */
  const valueOf = (state: TState, plies: number): number => {
    const here = judge(rules, evaluate, state);
    if (plies <= 0 || rules.outcome(state).kind !== 'playing') return here;
    const next = rules.listMoves(state).map((move) => rules.applyMove(state, move).state);
    if (next.length === 0) return here;
    const scores = next.map((child) => judge(rules, evaluate, child));
    const kept = topIndices(scores, options.beam);
    return Math.max(...kept.map((index) => valueOf(next[index] ?? state, plies - 1)));
  };
  return (state, moves, rng) => {
    const children = moves.map((move) => rules.applyMove(state, move).state);
    const oneply = children.map((child) => judge(rules, evaluate, child));
    const kept = new Set(topIndices(oneply, options.beam));
    const scores = children.map((child, index) =>
      kept.has(index) ? valueOf(child, options.depth - 1) : LOSS_PENALTY * 2,
    );
    return pickBest(moves, scores, rng);
  };
}
