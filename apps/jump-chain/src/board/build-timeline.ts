// apps/jump-chain/src/board/build-timeline.ts
// Pure: the events of one move become the short film the board plays. Your move first, then the
// ranks. Channels:
//   piece  (turn)       [col, row]: the piece slides a step, or jumps the chain one jump at a time
//   pop    (per enemy)  [col, row, size 1 -> 0]: a jumped enemy shrinks away as the piece passes
//   burst  (per enemy)  [col, row]: particles where it stood (full motion only)
//   clear  (turn)       [1 -> 0]: the board glows when a rank is cleared
//   march  (per enemy)  [row]: an enemy advances, or steps back for the continue
//   spawn  (per enemy)  [size 0 -> 1]: a new endless rank grows in above the board
//   breach (per enemy)  [1 -> 0]: an enemy that reached your side flashes
import { enemyEntity, TURN_ENTITY } from './board-ids.ts';

import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { JumpChainEvent } from '@e07/jump-chain/rules/jump-chain-types.ts';

/** Longest a turn may animate; build-timeline.test.ts enforces it. */
export const TURN_BUDGET_MS = 3200;
const STEP_MS = 160;
const JUMP_MS = 180;
/** A chain of any length jumps within this time: a long chain jumps faster. */
const CHAIN_MS = 1400;
const POP_MS = 220;
const BURST_MS = 520;
const CLEAR_MS = 420;
/** The pause between your move and the ranks' advance. */
const GAP_MS = 80;
const MARCH_MS = 280;
/** Every advance of one move fits in this time (an empty board pulls the waiting ranks in). */
const MARCHES_MS = 840;
const SPAWN_MS = 260;
const BREACH_MS = 480;
const STEP_BACK_MS = 420;
const ADVANCED = 'ranks-advanced';
const CLEARED = 'rank-cleared';

/** Reduced motion: half durations, no particles, no overshoot. */
type Timing = { readonly scale: number; readonly isFull: boolean };

/** The turn's pace (full-motion ms): one jump, the end of your move, one advance. */
type Beats = { readonly jumpMs: number; readonly moveEndMs: number; readonly marchMs: number };

/** What a beat needs: the pace, and how many advances of this turn came before it. */
type Beat = { readonly timing: Timing; readonly beats: Beats; readonly advances: number };

type EventOf<TKind extends JumpChainEvent['kind']> = Extract<JumpChainEvent, { kind: TKind }>;

function beatsOf(events: readonly JumpChainEvent[]): Beats {
  const jumps = events.filter((event) => event.kind === 'piece-jumped').length;
  const advances = events.filter((event) => event.kind === ADVANCED).length;
  const jumpMs = jumps === 0 ? 0 : Math.min(JUMP_MS, CHAIN_MS / jumps);
  const isStep = events.some((event) => event.kind === 'piece-stepped');
  return {
    jumpMs,
    moveEndMs: isStep ? STEP_MS : jumps * jumpMs,
    marchMs: advances === 0 ? 0 : Math.min(MARCH_MS, MARCHES_MS / advances),
  };
}

/** When the ranks' beat after `advances` earlier advances starts (scaled). */
function ranksAt(beat: Beat): number {
  const { beats } = beat;
  return (beats.moveEndMs + GAP_MS + beat.advances * beats.marchMs) * beat.timing.scale;
}

function stepped(event: EventOf<'piece-stepped'>, beat: Beat): Track[] {
  return [
    {
      channel: 'piece',
      entityId: TURN_ENTITY,
      startMs: 0,
      durationMs: STEP_MS * beat.timing.scale,
      easing: 'out-quad',
      from: [event.from.col, event.from.row],
      to: [event.to.col, event.to.row],
      cue: { sound: 'step', haptic: 'selection' },
    },
  ];
}

/** One jump of the chain; the enemy it jumps pops (with a burst) as the piece passes over it. */
function jumped(event: EventOf<'piece-jumped'>, beat: Beat): Track[] {
  const { scale, isFull } = beat.timing;
  const jumpMs = beat.beats.jumpMs * scale;
  const startMs = (event.jump - 1) * jumpMs;
  const over = [(event.from.col + event.to.col) / 2, (event.from.row + event.to.row) / 2];
  const slide: Track = {
    channel: 'piece',
    entityId: TURN_ENTITY,
    startMs,
    durationMs: jumpMs,
    easing: 'in-out-quad',
    from: [event.from.col, event.from.row],
    to: [event.to.col, event.to.row],
  };
  const at = { entityId: enemyEntity(event.enemyId), startMs: startMs + jumpMs / 2 } as const;
  const pop: Track = {
    ...at,
    channel: 'pop',
    durationMs: POP_MS * scale,
    easing: 'in-quad',
    from: [...over, 1],
    to: [...over, 0],
    cue: { sound: 'capture', haptic: 'light' },
  };
  const burst: Track = {
    ...at,
    channel: 'burst',
    durationMs: BURST_MS,
    easing: 'linear',
    from: over,
    to: over,
  };
  return isFull ? [slide, pop, burst] : [slide, pop];
}

function cleared(beat: Beat): Track {
  return {
    channel: 'clear',
    entityId: TURN_ENTITY,
    startMs: beat.beats.moveEndMs * beat.timing.scale,
    durationMs: CLEAR_MS * beat.timing.scale,
    easing: 'out-quad',
    from: [1],
    to: [0],
    cue: { sound: 'clear', haptic: 'success' },
  };
}

/** The ranks move (an advance, or the continue's step back); the first enemy carries the cue. */
function shifted(
  event: EventOf<'ranks-advanced'> | EventOf<'ranks-stepped-back'>,
  beat: Beat,
): Track[] {
  const { scale, isFull } = beat.timing;
  const isAdvance = event.kind === ADVANCED;
  return event.shifts.map((shift, order) => ({
    channel: 'march',
    entityId: enemyEntity(shift.enemyId),
    startMs: isAdvance ? ranksAt(beat) : 0,
    durationMs: (isAdvance ? beat.beats.marchMs : STEP_BACK_MS) * scale,
    easing: isAdvance && isFull ? 'out-back' : 'in-out-quad',
    from: [shift.fromRow],
    to: [shift.toRow],
    ...(order === 0 ? { cue: { sound: 'march', haptic: 'medium' as const } } : {}),
  }));
}

function spawned(event: EventOf<'rank-spawned'>, beat: Beat): Track[] {
  return event.enemies.map((enemy) => ({
    channel: 'spawn',
    entityId: enemyEntity(enemy.id),
    startMs: ranksAt(beat),
    durationMs: SPAWN_MS * beat.timing.scale,
    easing: beat.timing.isFull ? 'out-back' : 'linear',
    from: [0],
    to: [1],
  }));
}

function reached(event: EventOf<'side-reached'>, beat: Beat): Track[] {
  return event.enemyIds.map((enemyId, order) => ({
    channel: 'breach',
    entityId: enemyEntity(enemyId),
    startMs: ranksAt(beat),
    durationMs: BREACH_MS * beat.timing.scale,
    easing: 'linear',
    from: [1],
    to: [0],
    ...(order === 0 ? { cue: { sound: 'overrun', haptic: 'error' as const } } : {}),
  }));
}

function tracksFor(event: JumpChainEvent, beat: Beat): Track[] {
  switch (event.kind) {
    case 'piece-stepped':
      return stepped(event, beat);
    case 'piece-jumped':
      return jumped(event, beat);
    case 'enemies-captured':
      return [];
    case 'rank-cleared':
      return [cleared(beat)];
    case 'ranks-advanced':
    case 'ranks-stepped-back':
      return shifted(event, beat);
    case 'rank-spawned':
      return spawned(event, beat);
    case 'side-reached':
      return reached(event, beat);
  }
}

/** Pure: events -> tracks. The same events always give the same tracks. */
export function buildTimeline(events: readonly JumpChainEvent[], motion: Motion): readonly Track[] {
  const timing = { scale: motion === 'full' ? 1 : 0.5, isFull: motion === 'full' };
  const beats = beatsOf(events);
  const tracks: Track[] = [];
  let advances = 0;
  let hasCleared = false;
  for (const event of events) {
    // Two ranks cleared by one chain glow once.
    if (event.kind === CLEARED && hasCleared) continue;
    hasCleared ||= event.kind === CLEARED;
    tracks.push(...tracksFor(event, { timing, beats, advances }));
    if (event.kind === ADVANCED) advances += 1;
  }
  return tracks;
}
