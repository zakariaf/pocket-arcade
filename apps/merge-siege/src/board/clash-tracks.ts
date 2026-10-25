// apps/merge-siege/src/board/clash-tracks.ts
// The clashes of a turn for build-timeline.ts. Pure. A smashed enemy fades with a burst: in the
// slide where the tile passes it, in the march or at the gate as it steps onto the tile that holds
// (from the cell above). A lost tile fades and shrinks where the bigger enemy beat it.
import { ENEMY_KIND, TILE_KIND } from './board-ids.ts';
import { AT, MS, burstTrack, pieceTrack, placeOf } from './turn-beats.ts';

import type { Timing } from './turn-beats.ts';
import type { Track, TrackCue } from '@e07/game-kit/timeline/track.ts';
import type { ClashPhase, Loss, Smash, Step } from '@e07/merge-siege/rules/merge-siege-types.ts';

/** What the clash tracks need from the rest of the turn: how far each tile slid. */
export type ClashContext = {
  readonly timing: Timing;
  readonly tileSteps: ReadonlyMap<number, Step>;
};

const SMASH_CUE: TrackCue = { sound: 'smash', haptic: 'medium' };
/** When an enemy steps onto a tile: in the march, or as it enters from the gate. */
const STEP_AT: Readonly<Record<ClashPhase, number>> = {
  slide: AT.slide,
  march: AT.march,
  gate: AT.gate,
};
const LOSS_CUE: TrackCue = { sound: 'crack', haptic: 'heavy' };

/** Rows between two cells of one column or columns of one row (a slide is straight). */
function distance(from: number, to: number): number {
  const [fromCol, fromRow] = placeOf(from);
  const [toCol, toRow] = placeOf(to);
  return Math.abs(toCol - fromCol) + Math.abs(toRow - fromRow);
}

/** When, in the slide, the smashing tile reaches the enemy's cell. */
function slideReachMs(smash: Smash, context: ClashContext): number {
  const step = context.tileSteps.get(smash.tileId);
  const whole = step === undefined ? 0 : distance(step.from, step.to);
  const share = step === undefined || whole === 0 ? 1 : distance(step.from, smash.cell) / whole;
  return AT.slide + MS.slide * share;
}

/** One smashed enemy: its fading piece and its burst. */
function smashTracks(
  smash: Smash,
  how: { readonly phase: ClashPhase; readonly cue?: TrackCue },
  context: ClashContext,
): Track[] {
  const { timing } = context;
  const [col, row] = placeOf(smash.cell);
  const isSlide = how.phase === 'slide';
  const startMs = isSlide ? slideReachMs(smash, context) : STEP_AT[how.phase];
  const durationMs = isSlide ? MS.vanish : MS.march;
  const fromRow = isSlide ? row : row - 1;
  const toRow = isSlide ? row : row - 0.5;
  const vanish = pieceTrack(
    {
      id: smash.id,
      startMs,
      durationMs,
      easing: 'out-quad',
      from: [col, fromRow, smash.value, ENEMY_KIND, 1, 1],
      to: [col, toRow, smash.value, ENEMY_KIND, 0, 1],
    },
    timing,
    how.cue,
  );
  const impactMs = isSlide ? startMs : startMs + durationMs / 2;
  return [vanish, ...burstTrack(smash.id, { at: [col, toRow], startMs: impactMs }, timing)];
}

export function smashedTracks(
  event: { readonly phase: ClashPhase; readonly smashes: readonly Smash[] },
  context: ClashContext,
): Track[] {
  return event.smashes.flatMap((smash, order) =>
    smashTracks(smash, { phase: event.phase, ...(order === 0 ? { cue: SMASH_CUE } : {}) }, context),
  );
}

/** When a lost tile fades: at the end of the slide, or as the enemy steps onto it. */
const LOSS_AT: Readonly<Record<ClashPhase, number>> = {
  slide: AT.merge,
  march: AT.march + MS.march / 2,
  gate: AT.gate + MS.entry / 2,
};

export function lostTracks(
  event: { readonly phase: ClashPhase; readonly losses: readonly Loss[] },
  context: ClashContext,
): Track[] {
  return event.losses.map((loss, order) => {
    const [col, row] = placeOf(loss.cell);
    return pieceTrack(
      {
        id: loss.id,
        startMs: LOSS_AT[event.phase],
        durationMs: MS.vanish,
        easing: 'in-quad',
        from: [col, row, loss.value, TILE_KIND, 1, 1],
        to: [col, row, loss.value, TILE_KIND, 0, 0.6],
      },
      context.timing,
      order === 0 ? LOSS_CUE : undefined,
    );
  });
}
