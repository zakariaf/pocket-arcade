// packages/game-kit/src/testing/contract-intents.ts
// The input half of engineContractProblems: panMode and selectRegions are valid, every move
// intentToMove makes is listed (taps with a selection included), a tap inside a select region only
// selects, and no intent is accepted that the board's pan mode never sends.
import { jsonOf } from './json-shape.ts';

import type { GameEngine, PanMode } from '@e07/game-kit/contract/game-engine.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';

/** The engine members the input checks read. */
export type IntentEngine<TState, TMove> = Pick<
  GameEngine<TState, TMove, unknown>,
  'panMode' | 'selectRegions' | 'intentToMove'
>;

/** One explored position: the state and the moves listMoves offers there. */
export type IntentStep<TState, TMove> = {
  readonly state: TState;
  readonly moves: readonly TMove[];
};

/** The pan mode the board must be in to send each intent kind (null: taps and long presses, always). */
const MODE_FOR_INTENT: Readonly<Record<InputIntent['kind'], PanMode | null>> = {
  tap: null,
  'long-press': null,
  swipe: 'swipe',
  'drag-end': 'drag',
  aim: 'aim',
};
const PAN_MODES: readonly unknown[] = ['none', 'swipe', 'drag', 'aim'];

/** A panMode outside the four, or none at all (a JavaScript caller, a missing member). */
function panModeProblem(panMode: unknown): string | null {
  return PAN_MODES.includes(panMode)
    ? null
    : `panMode '${String(panMode)}' is not 'none', 'swipe', 'drag' or 'aim'`;
}

/** The select regions as a list; anything else (a JavaScript caller) is reported and ignored. */
function regionsOf(selectRegions: unknown): readonly string[] {
  return Array.isArray(selectRegions) && selectRegions.every((id) => typeof id === 'string')
    ? selectRegions
    : [];
}

function selectRegionsProblem(selectRegions: unknown): string | null {
  return regionsOf(selectRegions) === selectRegions
    ? null
    : `selectRegions ${String(selectRegions)} is not a list of region ids ([] when every tap acts)`;
}

function isSelectTap(intent: InputIntent, regions: readonly string[]): boolean {
  return intent.kind === 'tap' && regions.includes(intent.target.regionId);
}

/** Every tap outside the select regions again, once per tapped target inside them as selection. */
function withSelections(
  intents: readonly InputIntent[],
  regions: readonly string[],
): InputIntent[] {
  const selectable = intents.flatMap((intent) =>
    intent.kind === 'tap' && isSelectTap(intent, regions) ? [intent.target] : [],
  );
  return intents.flatMap((intent) =>
    intent.kind === 'tap' && !isSelectTap(intent, regions)
      ? selectable.map((selected): InputIntent => ({ ...intent, selected }))
      : [],
  );
}

function isListed<TMove>(moves: readonly TMove[], move: TMove): boolean {
  const wanted = jsonOf(move);
  return moves.some((candidate) => jsonOf(candidate) === wanted);
}

function intentProblem<TState, TMove>(
  engine: IntentEngine<TState, TMove>,
  step: IntentStep<TState, TMove>,
  intent: InputIntent,
): string | null {
  const move = engine.intentToMove(step.state, intent);
  if (move === null) return null;
  if (isSelectTap(intent, regionsOf(engine.selectRegions))) {
    return `intentToMove(${jsonOf(intent)}) returned ${jsonOf(move)}, but a tap in a select region only selects (return null)`;
  }
  const needed = MODE_FOR_INTENT[intent.kind];
  if (needed !== null && needed !== engine.panMode) {
    return `intentToMove accepts a ${intent.kind} intent, but with panMode '${engine.panMode}' the board never sends one (panMode '${needed}')`;
  }
  return isListed(step.moves, move)
    ? null
    : `intentToMove(${jsonOf(intent)}) returned ${jsonOf(move)}, which listMoves does not list`;
}

/** A panMode outside the four or selectRegions that is not a list of ids, or []. */
export function engineMemberProblems<TState, TMove>(
  engine: IntentEngine<TState, TMove>,
): readonly string[] {
  const problems = [panModeProblem(engine.panMode), selectRegionsProblem(engine.selectRegions)];
  return problems.filter((problem): problem is string => problem !== null);
}

/**
 * Every problem of the moves intentToMove makes from `intents` in one position. Taps outside the
 * select regions are also tried with each tapped target inside them as the selection.
 */
export function contractIntentProblems<TState, TMove>(
  engine: IntentEngine<TState, TMove>,
  step: IntentStep<TState, TMove>,
  intents: readonly InputIntent[],
): readonly string[] {
  const all = [...intents, ...withSelections(intents, regionsOf(engine.selectRegions))];
  return all.flatMap((intent) => intentProblem(engine, step, intent) ?? []);
}
