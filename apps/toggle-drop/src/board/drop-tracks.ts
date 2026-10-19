// apps/toggle-drop/src/board/drop-tracks.ts
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { ToggleDropEvent } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

/** The ball's channel on the board: one ball falls per move, entity 0. */
export const BALL_CHANNEL = 'ball';

/** The events that mark a point of the fall (every kind but the cup's). */
type FallEvent = Exclude<ToggleDropEvent, { readonly kind: 'cup-filled' }>;

function isFallEvent(event: ToggleDropEvent): event is FallEvent {
  return event.kind !== 'cup-filled';
}

/**
 * Between two points of the fall the ball moves in a straight line (straight down, or one column
 * across over one peg row), so linear tracks from each point to the next replay the simulated
 * fall exactly.
 */
export function dropTracks(events: readonly ToggleDropEvent[]): Track[] {
  const tracks: Track[] = [];
  let from: FallEvent | null = null;
  for (const to of events.filter(isFallEvent)) {
    if (from !== null) {
      tracks.push({
        channel: BALL_CHANNEL,
        entityId: 0,
        startMs: from.atMs,
        durationMs: to.atMs - from.atMs,
        easing: 'linear',
        from: [from.x, from.y],
        to: [to.x, to.y],
      });
    }
    from = to;
  }
  return tracks;
}
