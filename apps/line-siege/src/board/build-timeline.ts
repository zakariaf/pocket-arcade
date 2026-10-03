// apps/line-siege/src/board/build-timeline.ts
// Pure: the events of one placement (or of the continue) become the short film the board plays.
// The view is always the final state, so anything that vanishes (cleared blocks, defeated or
// breaching monsters) carries its own position in its track. Channels: pop, clear (cells); beam
// (lane); shock, push, shake (turn); flash, vanish, burst, row, spawn (monster); tray (slot);
// heart (heart slot). Cues: place, beam, shock, hit, pop, breach: the sound bank's six ids.
import { TUNING } from '@e07/line-siege/rules/line-siege-tuning.ts';

import { cellEntity, heartEntity, TURN_ENTITY } from './board-ids.ts';
import { AT, breached, defeated, hit, moved, spawned, timingFor } from './monster-tracks.ts';

import type { EventOf, Seen, Timing } from './monster-tracks.ts';
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { LineSiegeEvent } from '@e07/line-siege/rules/line-siege-types.ts';

/** The busiest placement plays within this many milliseconds (full motion). */
export const TURN_BUDGET_MS = 1200;

function placed(event: EventOf<'block-placed'>, timing: Timing): Track[] {
  return event.cells.map((index, order) => ({
    channel: 'pop',
    entityId: cellEntity(index % TUNING.boardSize, Math.floor(index / TUNING.boardSize)),
    startMs: 0,
    durationMs: 140 * timing.scale,
    easing: timing.isFull ? 'out-back' : 'linear',
    from: [0.6],
    to: [1],
    ...(order === 0 ? { cue: { sound: 'place', haptic: 'light' as const } } : {}),
  }));
}

function clearedCells(cells: readonly number[], timing: Timing): Track[] {
  return cells.map((index) => ({
    channel: 'clear',
    entityId: cellEntity(index % TUNING.boardSize, Math.floor(index / TUNING.boardSize)),
    startMs: AT.clear * timing.scale,
    durationMs: 220 * timing.scale,
    easing: 'out-quad',
    from: [1],
    to: [0],
  }));
}

/** Rows the move cleared (a line, or the continue emptying the fullest rows). */
function rowsOf(event: LineSiegeEvent): readonly number[] {
  if (event.kind === 'row-cleared') return [event.row];
  return event.kind === 'rows-emptied' ? event.rows : [];
}

function lineCells(events: readonly LineSiegeEvent[]): number[] {
  const size = TUNING.boardSize;
  const cells = new Set<number>();
  for (const event of events) {
    for (let i = 0; i < size; i += 1) {
      for (const row of rowsOf(event)) cells.add(row * size + i);
      if (event.kind === 'column-cleared') cells.add(i * size + event.col);
    }
  }
  return [...cells].sort((a, b) => a - b);
}

function beam(event: EventOf<'beam-fired'>, timing: Timing): Track[] {
  const cue = { sound: 'beam', haptic: 'medium' as const };
  const startMs = AT.beam * timing.scale;
  return [
    {
      channel: 'beam',
      entityId: event.lane,
      startMs,
      durationMs: 260 * timing.scale,
      easing: 'out-quad',
      from: [0],
      to: [1],
      cue,
    },
  ];
}

function shock(timing: Timing): Track[] {
  const startMs = AT.beam * timing.scale;
  return [
    {
      channel: 'shock',
      entityId: TURN_ENTITY,
      startMs,
      durationMs: 300 * timing.scale,
      easing: 'out-quad',
      from: [0],
      to: [1],
      cue: { sound: 'shock' },
    },
  ];
}

function refilled(event: EventOf<'tray-refilled'>, timing: Timing): Track[] {
  return event.tray.map((_piece, slot) => ({
    channel: 'tray',
    entityId: slot,
    startMs: (AT.tray + slot * 60) * timing.scale,
    durationMs: 160 * timing.scale,
    easing: timing.isFull ? 'out-back' : 'linear',
    from: [0],
    to: [1],
  }));
}

/** The continue: the monsters fall back up their lanes (a wave sweeps up from the wall). */
function pushed(timing: Timing): Track[] {
  return [
    {
      channel: 'push',
      entityId: TURN_ENTITY,
      startMs: 0,
      durationMs: 420 * timing.scale,
      easing: 'out-quad',
      from: [0],
      to: [1],
    },
  ];
}

/** The continue gave a heart back: the heart pops on the wall (hearts is the new count). */
function restored(event: EventOf<'heart-restored'>, timing: Timing): Track[] {
  return [
    {
      channel: 'heart',
      entityId: heartEntity(event.hearts - 1),
      startMs: 0,
      durationMs: 360 * timing.scale,
      easing: timing.isFull ? 'out-back' : 'linear',
      from: [0.3],
      to: [1],
    },
  ];
}

function tracksFor(event: LineSiegeEvent, timing: Timing, seen: Seen): Track[] {
  switch (event.kind) {
    case 'block-placed':
      return placed(event, timing);
    case 'beam-fired':
      return beam(event, timing);
    case 'shockwave-sent':
      return shock(timing);
    case 'monster-hit':
      return hit(event, timing);
    case 'monster-defeated':
      return defeated(event, timing);
    case 'monster-moved':
      return moved(event, timing, seen);
    case 'wall-breached':
      return breached(event, timing, seen);
    case 'monster-spawned':
      return spawned(event, timing);
    case 'tray-refilled':
      return refilled(event, timing);
    case 'monsters-pushed-back':
      return pushed(timing);
    case 'heart-restored':
      return restored(event, timing);
    case 'row-cleared':
    case 'column-cleared':
    case 'rows-emptied':
    case 'score-added':
      return [];
  }
}

/** Pure: events -> tracks. Reduced motion halves durations and drops particles, shake and overshoot. */
export function buildTimeline(events: readonly LineSiegeEvent[], motion: Motion): readonly Track[] {
  const timing = timingFor(motion);
  const seen: Seen = new Map();
  const perEvent = events.flatMap((event) => tracksFor(event, timing, seen));
  return [...perEvent, ...clearedCells(lineCells(events), timing)];
}
