// packages/game-kit/src/testing/engine-contract.ts
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { contractIntentProblems, engineMemberProblems } from './contract-intents.ts';
import { jsonOf, jsonShapeProblems } from './json-shape.ts';

import type { GameEngine, Outcome } from '@e07/game-kit/contract/game-engine.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** One level start to explore: the same (seed, difficulty) pair the Shell passes to create. */
export type ContractStart = { readonly seed: number; readonly difficulty: number };

/** The game's LevelsSpec.endless: with an endless mode, create(seed, difficulty) is never won. */
export type ContractEndless =
  { readonly kind: 'none' } | { readonly kind: 'endless'; readonly difficulty: number };

/** Everything the engine contract test needs; all of it comes from the game module. */
export type EngineContractInput<TState, TMove, TEvent> = {
  readonly gameId: string;
  readonly engine: Omit<GameEngine<TState, TMove, TEvent>, 'buildTimeline'>;
  readonly persistence: Pick<PersistenceSpec<TState, TMove>, 'parseState' | 'parseMove'>;
  readonly starts: readonly ContractStart[];
  /** Moves per explored game; a game that is still playing after this many just stops. */
  readonly maxMoves: number;
  /**
   * Intents to try in a state (tap every cell, every swipe, every drag): each move they yield must
   * be legal. Taps outside the engine's selectRegions are also tried with every tapped target
   * inside them as the selection.
   */
  readonly intents: (state: TState) => readonly InputIntent[];
  /** levels.endless of a game with an endless mode: seeded play from that difficulty never wins. */
  readonly endless?: ContractEndless;
};

type Walk<TState, TMove, TEvent> = {
  readonly input: EngineContractInput<TState, TMove, TEvent>;
  readonly problems: string[];
  /** The endless difficulty when the game has an endless mode, else null. */
  readonly endless: number | null;
};

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function outcomeProblem(outcome: Outcome, moveCount: number, gameId: string): string | null {
  if (outcome.kind === 'lost' && !outcome.reasonKey.startsWith(`${gameId}.`)) {
    return `lost reasonKey "${outcome.reasonKey}" is not a ${gameId}.* catalog key`;
  }
  if (outcome.kind === 'won' && !(Number.isInteger(outcome.score) && outcome.score >= 0)) {
    return `won score ${String(outcome.score)} is not a whole number >= 0`;
  }
  return moveCount > 0 === (outcome.kind === 'playing')
    ? null
    : `listMoves has ${String(moveCount)} moves while outcome is ${outcome.kind}`;
}

function intentProblems<TState, TMove, TEvent>(
  walk: Walk<TState, TMove, TEvent>,
  state: TState,
  moves: readonly TMove[],
): readonly string[] {
  const { engine, intents } = walk.input;
  return contractIntentProblems(engine, { state, moves }, intents(state));
}

/** With an endless mode, a won outcome at the endless difficulty is a contract break. */
function endlessProblem(endless: number | null, start: ContractStart, outcome: Outcome) {
  return endless === start.difficulty && outcome.kind === 'won'
    ? `the endless run was won (score ${String(outcome.score)}); an endless run only ever ends lost`
    : null;
}

function roundTripProblems<TState, TMove, TEvent>(
  walk: Walk<TState, TMove, TEvent>,
  state: TState,
  move: TMove,
): string[] {
  const { parseState, parseMove } = walk.input.persistence;
  const problems = [...jsonShapeProblems(state), ...jsonShapeProblems(move, 'move')];
  if (jsonOf(parseState(JSON.parse(jsonOf(state)))) !== jsonOf(state)) {
    problems.push('parseState does not return a saved state unchanged');
  }
  if (jsonOf(parseMove(JSON.parse(jsonOf(move)))) !== jsonOf(move)) {
    problems.push(`parseMove does not return ${jsonOf(move)} unchanged`);
  }
  return problems;
}

/** Applies one move and checks purity, events and the JSON round trip. */
function stepProblems<TState, TMove, TEvent>(
  walk: Walk<TState, TMove, TEvent>,
  state: TState,
  move: TMove,
): { readonly next: TState; readonly problems: string[] } {
  const before = jsonOf(state);
  const result = walk.input.engine.applyMove(state, move);
  const problems = roundTripProblems(walk, result.state, move);
  if (jsonOf(state) !== before) problems.push('applyMove changed its input state (must be pure)');
  for (const event of result.events) {
    const kind: unknown =
      typeof event === 'object' && event !== null ? Reflect.get(event, 'kind') : undefined;
    if (typeof kind !== 'string' || !KEBAB.test(kind))
      problems.push(`event ${jsonOf(event)} has no kebab-case kind`);
  }
  return { next: result.state, problems };
}

/** Plays one seeded random game and returns the moves it made. */
function playOnce<TState, TMove, TEvent>(
  walk: Walk<TState, TMove, TEvent>,
  start: ContractStart,
): TMove[] {
  const { engine, maxMoves, gameId } = walk.input;
  let state = engine.create(start.seed, start.difficulty);
  let rng: RngState = seedRng(start.seed ^ 0x2545f491);
  const line: TMove[] = [];
  walk.problems.push(...jsonShapeProblems(state));
  while (line.length < maxMoves && walk.problems.length === 0) {
    const moves = engine.listMoves(state);
    const outcome = engine.outcome(state);
    const problem =
      outcomeProblem(outcome, moves.length, gameId) ?? endlessProblem(walk.endless, start, outcome);
    if (problem !== null) walk.problems.push(problem);
    walk.problems.push(...intentProblems(walk, state, moves));
    const pick = nextInt(rng, Math.max(moves.length, 1));
    const move = moves[pick.value];
    if (move === undefined) break;
    rng = pick.state;
    const step = stepProblems(walk, state, move);
    walk.problems.push(...step.problems);
    state = step.next;
    line.push(move);
  }
  return line;
}

function replayProblem<TState, TMove, TEvent>(
  engine: EngineContractInput<TState, TMove, TEvent>['engine'],
  start: ContractStart,
  line: readonly TMove[],
): string | null {
  const replay = (): string =>
    jsonOf(
      line.reduce(
        (state, move) => engine.applyMove(state, move).state,
        engine.create(start.seed, start.difficulty),
      ),
    );
  return replay() === replay()
    ? null
    : 'replaying the same moves from the same seed gives a different state';
}

/** The starts to walk: the given ones plus, with an endless mode, each seed at its difficulty. */
function startsOf(starts: readonly ContractStart[], endless: number | null): ContractStart[] {
  if (endless === null) return [...starts];
  const seeds = [...new Set(starts.map((start) => start.seed))];
  const extra = seeds
    .filter((seed) => !starts.some((start) => start.seed === seed && start.difficulty === endless))
    .map((seed) => ({ seed, difficulty: endless }));
  return [...starts, ...extra];
}

/**
 * Every way the engine breaks the GameModule contract, or []: a create that starts in play and
 * is deterministic, deterministic replays, JSON-safe states and moves that parseState/parseMove
 * return unchanged, pure applyMove, kebab-case event kinds, listMoves empty exactly when the
 * game is over, catalog lose reasons, a valid panMode and selectRegions, intentToMove never
 * producing a move listMoves does not list (taps with a selection included), never acting on a
 * tap inside a select region, never accepting an intent the board's panMode never sends, and,
 * with an endless mode, seeded play from the endless difficulty never reaching won.
 */
export function engineContractProblems<TState, TMove, TEvent>(
  input: EngineContractInput<TState, TMove, TEvent>,
): readonly string[] {
  const endless = input.endless?.kind === 'endless' ? input.endless.difficulty : null;
  return startsOf(input.starts, endless).flatMap((start) => {
    const label = `seed ${String(start.seed)} difficulty ${String(start.difficulty)}`;
    const created = [0, 1].map(() => jsonOf(input.engine.create(start.seed, start.difficulty)));
    const walk: Walk<TState, TMove, TEvent> = { input, problems: [], endless };
    walk.problems.push(...engineMemberProblems(input.engine));
    if (created[0] !== created[1]) walk.problems.push('create gives two different states');
    const opening = input.engine.outcome(input.engine.create(start.seed, start.difficulty)).kind;
    if (opening !== 'playing')
      walk.problems.push(`create starts a game that is already ${opening}`);
    const line = playOnce(walk, start);
    const replay = replayProblem(input.engine, start, line);
    if (replay !== null) walk.problems.push(replay);
    return [...new Set(walk.problems)].map((problem) => `${label}: ${problem}`);
  });
}
