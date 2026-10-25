// apps/snare-snake/src/rules/apply-move.ts
// Spec 10 RULES "Apply a move: returns the new state plus a list of events". The head moves one
// cell (design notes, rule 3); onto its own body it closes a loop that catches the critters inside
// it or touching it and spends the loop's segments (rule 4); the snake grows (rule 5); then the
// critters hop (rule 6); the last critter caught adds the bonus for the moves left (rule 7).
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { DIRECTIONS } from './board-grid.ts';
import { hopCritters } from './critter-hops.ts';
import { outcome } from './outcome.ts';
import { enclosedBy, snaredBy } from './snare-loop.ts';
import { TUNING, knobsFor } from './snare-snake-tuning.ts';
import { targetOf } from './steering.ts';

import type {
  Direction,
  SnareSnakeEvent,
  SnareSnakeMove,
  SnareSnakeResult,
  SnareSnakeState,
} from './snare-snake-types.ts';

/** The head moves onto a free cell; the tail follows unless the snake is growing. */
function slither(state: SnareSnakeState, target: number): SnareSnakeResult {
  const isGrowing = state.growth > 0;
  const body = isGrowing ? state.snake : state.snake.slice(0, -1);
  const snake = [target, ...body];
  const event: SnareSnakeEvent = {
    kind: 'snake-moved',
    from: pickAt(state.snake, 0),
    to: target,
    vacated: isGrowing ? null : pickAt(state.snake, state.snake.length - 1),
    length: snake.length,
  };
  const growth = isGrowing ? state.growth - 1 : state.growth;
  return { state: { ...state, snake, growth, heading: null }, events: [event] };
}

/**
 * The head bites its body: the loop catches what is inside or touching it and is spent. The head
 * keeps facing the way it was steered (the bitten segment's neck points elsewhere).
 */
function closeLoop(state: SnareSnakeState, target: number, heading: Direction): SnareSnakeResult {
  const bitten = state.snake.indexOf(target);
  const loop = state.snake.slice(0, bitten + 1);
  const enclosed = enclosedBy(state, loop);
  const snared = snaredBy(state, loop, enclosed);
  const caught = state.critters.filter((critter) => snared.has(critter.cell));
  const snake = state.snake.slice(bitten);
  const events: SnareSnakeEvent[] = [
    { kind: 'loop-closed', loop, enclosed, spent: bitten, length: snake.length },
  ];
  const count = caught.length;
  if (count === 0) return { state: { ...state, snake, heading }, events };
  const points = TUNING.catchPoints * count * count;
  events.push({
    kind: 'critters-caught',
    critterIds: caught.map((critter) => critter.id),
    cells: caught.map((critter) => critter.cell),
    count,
    points,
  });
  const critters = state.critters.filter((critter) => !snared.has(critter.cell));
  const next = {
    ...state,
    snake,
    heading,
    critters,
    caught: state.caught + count,
    score: state.score + points,
    growth: state.growth + TUNING.growPerCritter * count,
  };
  return { state: next, events };
}

/** After the head's step: the move counted, time growth, the critters' hops and the win's bonus. */
function finishTurn(stepped: SnareSnakeResult): SnareSnakeResult {
  const knobs = knobsFor(stepped.state.difficulty);
  const moves = stepped.state.moves + 1;
  const growth = stepped.state.growth + (moves % knobs.growEvery === 0 ? 1 : 0);
  const events = [...stepped.events];
  let state: SnareSnakeState = { ...stepped.state, moves, growth };
  if (state.critters.length > 0 && moves % knobs.hopEvery === 0) {
    const hopped = hopCritters(state);
    state = { ...state, critters: hopped.critters, rng: hopped.rng };
    if (hopped.hops.length > 0) events.push({ kind: 'critters-moved', hops: hopped.hops });
  }
  if (state.critters.length === 0) {
    const points = (state.maxMoves - moves) * TUNING.pointsPerSpareMove;
    state = { ...state, score: state.score + points };
    events.push({ kind: 'bonus-added', points, total: state.score });
  }
  return { state, events };
}

export function applyMove(state: SnareSnakeState, move: SnareSnakeMove): SnareSnakeResult {
  // A saved or replayed move is checked again: only the four directions, only while playing.
  const isKnown = DIRECTIONS.includes(move.direction);
  const isPlaying = isKnown && outcome(state).kind === 'playing';
  const target = isPlaying ? targetOf(state, move.direction) : null;
  if (target === null) throw new RangeError(`illegal move ${JSON.stringify(move)}`);
  const stepped = state.snake.includes(target)
    ? closeLoop(state, target, move.direction)
    : slither(state, target);
  return finishTurn(stepped);
}
