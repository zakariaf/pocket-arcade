// apps/scrap-shove/src/board/build-timeline.ts
// Pure: the events of one move become the short film the board plays, in the beats of
// timeline-beats.ts. Channels:
//   player (player)  [col, row]: the player's step       wait  (player) [0 -> 1]: the wait pulse
//   robot  (robot)   [col, row]: a robot's step           heap  (heap)   [col, row]: a shoved heap
//   ghost  (robot)   [col, row, kind, alpha]: a robot that left the view fades where it broke
//   smash  (heap)    [col, row, alpha]: a heap a heavy robot smashed   appear (heap) [0 -> 1]
//   spark  (crash)   [col, row]: sparks of a crash (full motion)        badge (crash) [col, row, n]
//   caught (player)  [1 -> 0]   glow / burst (turn): the floor cleared  revert (turn) [1 -> 0]
//   arrows (turn)    [0 -> 1]: the next-step arrows fade in once everything stands still
import { heapEntity, PLAYER_ENTITY, robotEntity, TURN_ENTITY } from './board-ids.ts';
import {
  floorCleared,
  playerCaught,
  robotCrushed,
  robotsCrashed,
  scrapSmashed,
  stepReverted,
} from './crash-tracks.ts';
import { FADE_MS, phaseEnd, phaseLength, phaseStart, valuesOf } from './timeline-beats.ts';

import type { EventOf, Pass, Timing } from './timeline-beats.ts';
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { ScrapShoveEvent } from '@e07/scrap-shove/rules/scrap-shove-types.ts';

/** Longest a turn may animate; build-timeline.test.ts enforces it. */
export const TURN_BUDGET_MS = 1200;

/** The player's step (phase 0). */
function playerStepped(event: EventOf<'player-stepped'>, timing: Timing): Track[] {
  return [
    {
      channel: 'player',
      entityId: PLAYER_ENTITY,
      startMs: 0,
      durationMs: phaseLength(0, timing),
      easing: 'out-quad',
      from: valuesOf(event.from),
      to: valuesOf(event.to),
      cue: { sound: 'step' },
    },
  ];
}

/** The player waited: one pulse ring around the player. */
function playerWaited(timing: Timing): Track[] {
  const durationMs = phaseLength(0, timing);
  return [
    {
      channel: 'wait',
      entityId: PLAYER_ENTITY,
      startMs: 0,
      durationMs,
      easing: 'linear',
      from: [0],
      to: [1],
    },
  ];
}

/** A heap slides one square (the player's shove sounds; a heavy robot's push is in its step). */
function scrapShoved(event: EventOf<'scrap-shoved'>, pass: Pass, timing: Timing): Track[] {
  const byPlayer = event.byRobotId === null ? { cue: { sound: 'shove' } } : {};
  return [
    {
      channel: 'heap',
      entityId: heapEntity(event.heapId),
      startMs: phaseStart(pass.phase, timing),
      durationMs: phaseLength(pass.phase, timing),
      easing: 'out-quad',
      from: valuesOf(event.from),
      to: valuesOf(event.to),
      ...byPlayer,
    },
  ];
}

/** One phase of robot steps; the first step carries the phase's sound. */
function robotsStepped(event: EventOf<'robots-stepped'>, phase: number, timing: Timing): Track[] {
  return event.steps.map((step, order) => ({
    channel: 'robot',
    entityId: robotEntity(step.robotId),
    startMs: phaseStart(phase, timing),
    durationMs: phaseLength(phase, timing),
    easing: 'in-out-quad',
    from: valuesOf(step.from),
    to: valuesOf(step.to),
    ...(order === 0 ? { cue: { sound: 'robot-step' } } : {}),
  }));
}

/** The tracks of one event, given what the earlier events of the turn said. */
function tracksOf(event: ScrapShoveEvent, pass: Pass, timing: Timing): readonly Track[] {
  switch (event.kind) {
    case 'player-stepped':
      return playerStepped(event, timing);
    case 'player-waited':
      return playerWaited(timing);
    case 'scrap-shoved':
      return scrapShoved(event, pass, timing);
    case 'robots-stepped':
      return robotsStepped(event, pass.phase + 1, timing);
    case 'robots-crashed':
      return robotsCrashed(event, pass, timing);
    case 'robot-crushed':
      return robotCrushed(event, pass, timing);
    case 'scrap-smashed':
      return scrapSmashed(event, pass, timing);
    case 'player-caught':
      return playerCaught(pass, timing);
    case 'floor-cleared':
      return floorCleared(pass, timing);
    case 'step-reverted':
      return stepReverted(timing);
  }
}

/** The pass after one event: robot steps open a phase and name the robots' kinds; crashes count. */
function advance(pass: Pass, event: ScrapShoveEvent, timing: Timing): Pass {
  const tracks = [...pass.tracks, ...tracksOf(event, pass, timing)];
  if (event.kind === 'robots-stepped') {
    const named = Object.fromEntries(event.steps.map((step) => [step.robotId, step.robotKind]));
    return { ...pass, phase: pass.phase + 1, kinds: { ...pass.kinds, ...named }, tracks };
  }
  const isCrash = event.kind === 'robots-crashed' || event.kind === 'robot-crushed';
  return { ...pass, crashes: pass.crashes + (isCrash ? 1 : 0), tracks };
}

/** Pure: events -> tracks. The same events always give the same tracks. */
export function buildTimeline(
  events: readonly ScrapShoveEvent[],
  motion: Motion,
): readonly Track[] {
  if (events.length === 0) return [];
  const timing = { scale: motion === 'full' ? 1 : 0.5, isFull: motion === 'full' };
  const start: Pass = { phase: 0, crashes: 0, kinds: {}, tracks: [] };
  const done = events.reduce((pass, event) => advance(pass, event, timing), start);
  const arrows: Track = {
    channel: 'arrows',
    entityId: TURN_ENTITY,
    startMs: phaseEnd(done.phase, timing),
    durationMs: FADE_MS * timing.scale,
    easing: 'linear',
    from: [0],
    to: [1],
  };
  return [...done.tracks, arrows];
}
