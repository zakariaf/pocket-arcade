// packages/game-kit/src/testing/teaching-contract.ts
import { jsonOf } from './json-shape.ts';

import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';
import type { TeachingSpec } from '@e07/game-kit/contract/teaching.ts';

/** What the tutorial save check needs; all of it comes from the game module. */
export type TutorialSaveInput<TState, TMove, TEvent> = {
  readonly teaching: Pick<TeachingSpec<TState, TMove>, 'tutorial'>;
  readonly engine: Pick<GameEngine<TState, TMove, TEvent>, 'listMoves' | 'applyMove'>;
  readonly persistence: Pick<PersistenceSpec<TState, TMove>, 'parseState'>;
};

/**
 * The tutorial run's states in play order, as the Shell saves them: its start, then the state
 * after each scripted step (an 'any-move' step plays the first legal move).
 */
export function tutorialStates<TState, TMove, TEvent>(
  input: TutorialSaveInput<TState, TMove, TEvent>,
): TState[] {
  const { start, steps } = input.teaching.tutorial;
  const states = [start];
  let state = start;
  for (const step of steps) {
    const move = step.expect.kind === 'move' ? step.expect.move : input.engine.listMoves(state)[0];
    if (move === undefined) break;
    state = input.engine.applyMove(state, move).state;
    states.push(state);
  }
  return states;
}

function labelOf(index: number): string {
  return index === 0 ? 'the tutorial start' : `the state after tutorial step ${String(index)}`;
}

/**
 * Spec S13, 8.6 and N10: the tutorial is a run the Shell saves after every move like any other,
 * so a kill mid-tutorial must bring it back where it was. Every tutorial state must pass the
 * game's parseState unchanged, as JSON text (the Shell compares the replayed run with the parsed
 * snapshot as JSON text, so the key order counts too). One problem per state that does not.
 */
export function tutorialSaveProblems<TState, TMove, TEvent>(
  input: TutorialSaveInput<TState, TMove, TEvent>,
): string[] {
  return tutorialStates(input).flatMap((state, index) => {
    const saved: unknown = JSON.parse(jsonOf(state));
    return jsonOf(input.persistence.parseState(saved)) === jsonOf(state)
      ? []
      : [`${labelOf(index)}: parseState does not return the saved state unchanged`];
  });
}
