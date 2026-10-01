// apps/line-siege/src/rules/apply-move.ts
// Spec 13 (line-siege) core loop, one placement: place the block, clear full rows and columns,
// fire the beams and the shockwave, score, then the monsters march and new ones enter.
// Pure: the same state and move always give the same result; the input is never changed.
import { clearLines, coveredCells, fullLines } from './board-lines.ts';
import { TUNING, knobsFor } from './line-siege-tuning.ts';
import { attack } from './monster-attack.ts';
import { march, spawn } from './monster-march.ts';
import { outcome } from './outcome.ts';
import { drawTray, pieceAt } from './pieces.ts';

import type { FullLines } from './board-lines.ts';
import type {
  LineSiegeEvent,
  LineSiegeMove,
  LineSiegeResult,
  LineSiegeState,
} from './line-siege-types.ts';
import type { Attack } from './monster-attack.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

type Placed = { readonly piece: number; readonly cells: readonly number[] };

function placedCells(state: LineSiegeState, move: LineSiegeMove): Placed {
  const piece = outcome(state).kind === 'playing' ? (state.tray[move.trayIndex] ?? null) : null;
  const cells = piece === null ? null : coveredCells(state.cells, pieceAt(piece), move);
  if (piece === null || cells === null)
    throw new RangeError(`illegal move ${JSON.stringify(move)}`);
  return { piece, cells };
}

function lineEvents(lines: FullLines): LineSiegeEvent[] {
  return [
    ...lines.rows.map((row): LineSiegeEvent => ({ kind: 'row-cleared', row })),
    ...lines.cols.map((col): LineSiegeEvent => ({ kind: 'column-cleared', col })),
  ];
}

/** Lines x lines x linePoints (a combo pays more) plus defeatPoints per defeated monster. */
export function pointsFor(lineCount: number, defeated: number): number {
  return lineCount * lineCount * TUNING.linePoints + defeated * TUNING.defeatPoints;
}

function nextTray(state: LineSiegeState, used: number, rng: RngState) {
  const left = state.tray.map((piece, slot) => (slot === used ? null : piece));
  if (left.some((piece) => piece !== null)) return { tray: left, rng, events: [] };
  const drawn = drawTray(rng);
  const events: LineSiegeEvent[] = [{ kind: 'tray-refilled', tray: drawn.tray }];
  return { tray: drawn.tray, rng: drawn.rng, events };
}

/** After the attack: the monsters march, then the next one enters (while hearts remain). */
function monsterTurn(state: LineSiegeState, survivors: Attack['monsters'], placements: number) {
  const front = { monsters: survivors, hearts: state.hearts };
  const marched = march(front, placements, knobsFor(state.difficulty));
  const spawner = {
    monsters: marched.monsters,
    nextId: state.nextId,
    spawned: state.spawned,
    rng: state.rng,
  };
  const when = { placements, difficulty: state.difficulty };
  const entered = marched.hearts > 0 ? spawn(spawner, when) : { ...spawner, events: [] };
  return { ...entered, hearts: marched.hearts, events: [...marched.events, ...entered.events] };
}

export function applyMove(state: LineSiegeState, move: LineSiegeMove): LineSiegeResult {
  const placed = placedCells(state, move);
  const filled = state.cells.map((cell, index) => (placed.cells.includes(index) ? 1 : cell));
  const lines = fullLines(filled);
  const hit = attack(state.monsters, lines);
  const points = pointsFor(lines.rows.length + lines.cols.length, hit.defeated);
  const placements = state.placements + 1;
  const turn = monsterTurn(state, hit.monsters, placements);
  const tray = nextTray(state, move.trayIndex, turn.rng);
  const score = state.score + points;
  const scored: LineSiegeEvent[] =
    points > 0 ? [{ kind: 'score-added', points, total: score }] : [];
  const events: LineSiegeEvent[] = [
    { kind: 'block-placed', trayIndex: move.trayIndex, piece: placed.piece, cells: placed.cells },
    ...lineEvents(lines),
    ...hit.events,
    ...scored,
    ...turn.events,
    ...tray.events,
  ];
  const next: LineSiegeState = {
    ...state,
    cells: clearLines(filled, lines),
    tray: tray.tray,
    monsters: turn.monsters,
    hearts: turn.hearts,
    placements,
    spawned: turn.spawned,
    defeated: state.defeated + hit.defeated,
    score,
    nextId: turn.nextId,
    rng: tray.rng,
  };
  return { state: next, events };
}
