// apps/merge-siege/src/rules/apply-move.ts
// Spec 10 RULES: "Apply a move: returns the new state plus a list of events". One swipe of Merge
// Siege, in order: the tiles slide (merging, smashing, being lost); the enemies march on every
// marchEvery-th swipe; the next enemy enters on every spawnEvery-th swipe while the wave lasts; a
// new tile appears in the bottom rows. Pure: the input state is never changed.
import { isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';

import { CELL_COUNT, COLS, emptyCells } from './board-cells.ts';
import { listMoves } from './list-moves.ts';
import { marchEnemies } from './march-enemies.ts';
import { TUNING, knobsFor } from './merge-siege-tuning.ts';
import { drawNextEnemy } from './next-enemy.ts';
import { beats, slideTiles } from './slide-tiles.ts';

import type {
  ClashPhase,
  Loss,
  MergeSiegeEvent,
  MergeSiegeMove,
  MergeSiegeResult,
  MergeSiegeState,
  Smash,
} from './merge-siege-types.ts';

/** A turn in progress: the state so far and the events that explain it. */
type Turn = { readonly state: MergeSiegeState; readonly events: readonly MergeSiegeEvent[] };

/** The smash and loss events of one phase (none when nothing clashed). */
function clashEvents(
  phase: ClashPhase,
  smashes: readonly Smash[],
  losses: readonly Loss[],
): MergeSiegeEvent[] {
  return [
    ...(smashes.length > 0 ? [{ kind: 'enemies-smashed' as const, phase, smashes }] : []),
    ...(losses.length > 0 ? [{ kind: 'tiles-lost' as const, phase, losses }] : []),
  ];
}

/** The player's slide, as a turn. */
function slide(state: MergeSiegeState, move: MergeSiegeMove): Turn {
  const slid = slideTiles(state.cells, move.direction);
  const events: MergeSiegeEvent[] = [
    ...(slid.steps.length > 0 ? [{ kind: 'tiles-slid' as const, steps: slid.steps }] : []),
    ...(slid.merges.length > 0 ? [{ kind: 'tiles-merged' as const, merges: slid.merges }] : []),
    ...clashEvents('slide', slid.smashes, slid.losses),
  ];
  const next = {
    ...state,
    cells: slid.cells,
    swipes: state.swipes + 1,
    smashed: state.smashed + slid.smashes.length,
    score: state.score + slid.points,
  };
  return { state: next, events };
}

/** On every marchEvery-th swipe every enemy steps one row down. */
function march(turn: Turn): Turn {
  const { state } = turn;
  if (state.swipes % knobsFor(state.difficulty).marchEvery !== 0) return turn;
  const marched = marchEnemies(state.cells);
  const events = [
    ...(marched.steps.length > 0
      ? [{ kind: 'enemies-marched' as const, steps: marched.steps }]
      : []),
    ...clashEvents('march', marched.smashes, marched.losses),
  ];
  const next = {
    ...state,
    cells: marched.cells,
    smashed: state.smashed + marched.smashes.length,
    score: state.score + marched.points,
  };
  return { state: next, events: [...turn.events, ...events] };
}

/** The entering enemy meets the top cell of its column: empty, a tile it fights, or an enemy (it waits). */
function gateOf(state: MergeSiegeState, value: number, cell: number): Turn {
  const occupant = state.cells[cell] ?? null;
  const id = state.nextId;
  const cells = [...state.cells];
  if (occupant !== null && beats(occupant.value, value)) {
    const smashes = [{ id, tileId: occupant.id, cell, value }];
    return {
      state: {
        ...state,
        smashed: state.smashed + 1,
        score: state.score + value * TUNING.smashPoints,
      },
      events: clashEvents('gate', smashes, []),
    };
  }
  cells[cell] = { id, kind: 'enemy', value };
  const losses =
    occupant === null ? [] : [{ id: occupant.id, enemyId: id, cell, value: occupant.value }];
  return {
    state: { ...state, cells },
    events: [...clashEvents('gate', [], losses), { kind: 'enemy-entered', id, cell, value }],
  };
}

/** On every spawnEvery-th swipe the next enemy enters, then the next one is drawn (until the wave has entered). */
function enter(turn: Turn): Turn {
  const { state } = turn;
  const { next } = state;
  const isDue = state.swipes % knobsFor(state.difficulty).spawnEvery === 0;
  if (next === null || !isDue || state.cells[next.col]?.kind === 'enemy') return turn;
  const gated = gateOf(state, next.value, next.col);
  const entered = state.entered + 1;
  const isWaveIn =
    !isEndlessDifficulty(state.difficulty) && entered >= knobsFor(state.difficulty).goal;
  const after = isWaveIn
    ? { next: null, rng: state.rng }
    : drawNextEnemy({ rng: state.rng, difficulty: state.difficulty, swipes: state.swipes });
  const arrived = {
    ...gated.state,
    entered,
    nextId: state.nextId + 1,
    next: after.next,
    rng: after.rng,
  };
  return { state: arrived, events: [...turn.events, ...gated.events] };
}

/** A new 2 (one time in fourIn a 4) in a random empty cell of the bottom rows, while there is room. */
function spawnTile(turn: Turn): Turn {
  const { state } = turn;
  const empty = emptyCells(state.cells);
  const bottom = empty.filter((cell) => cell >= CELL_COUNT - TUNING.spawnRows * COLS);
  if (empty.length < TUNING.minFreeCells || bottom.length === 0) return turn;
  const at = nextInt(state.rng, bottom.length);
  const four = nextInt(at.state, TUNING.fourIn);
  const cell = pickAt(bottom, at.value);
  const value = four.value === 0 ? 4 : 2;
  const cells = [...state.cells];
  cells[cell] = { id: state.nextId, kind: 'tile', value };
  const next = { ...state, cells, nextId: state.nextId + 1, rng: four.state };
  return {
    state: next,
    events: [...turn.events, { kind: 'tile-spawned', id: state.nextId, cell, value }],
  };
}

export function applyMove(state: MergeSiegeState, move: MergeSiegeMove): MergeSiegeResult {
  if (!listMoves(state).some((legal) => legal.direction === move.direction)) {
    throw new RangeError(
      `merge-siege: the swipe ${move.direction} changes nothing, or the run is over`,
    );
  }
  const done = spawnTile(enter(march(slide(state, move))));
  const points = done.state.score - state.score;
  const scored: MergeSiegeEvent[] =
    points > 0 ? [{ kind: 'score-added', points, total: done.state.score }] : [];
  return { state: done.state, events: [...done.events, ...scored] };
}
