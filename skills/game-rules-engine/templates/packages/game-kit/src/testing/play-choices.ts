// packages/game-kit/src/testing/play-choices.ts — drives any pure rules module from a list of
// "choice" integers (fast-check generates them; choice % legalMoves.length picks the move).
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';

/** The engine subset property tests need; any GameModule's engine satisfies it. */
export type PlayableRules<TState, TMove, TEvent> = Pick<
  GameEngine<TState, TMove, TEvent>,
  'listMoves' | 'applyMove'
>;

export type PlayLog<TState, TEvent> = {
  readonly states: readonly TState[];
  readonly events: readonly TEvent[];
};

export function playChoices<TState, TMove, TEvent>(
  rules: PlayableRules<TState, TMove, TEvent>,
  start: TState,
  choices: readonly number[],
): PlayLog<TState, TEvent> {
  const states: TState[] = [start];
  const events: TEvent[] = [];
  let state = start;
  for (const choice of choices) {
    const moves = rules.listMoves(state);
    const move = moves[choice % Math.max(moves.length, 1)];
    if (move === undefined) {
      break;
    }
    const result = rules.applyMove(state, move);
    state = result.state;
    states.push(state);
    events.push(...result.events);
  }
  return { states, events };
}
