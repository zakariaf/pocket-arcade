// apps/toggle-drop/src/board/drop-tracks.test.ts
import fc from 'fast-check';

import { applyMove } from '@e07/toggle-drop/rules/apply-move.ts';
import { create } from '@e07/toggle-drop/rules/create.ts';
import { listMoves } from '@e07/toggle-drop/rules/list-moves.ts';

import { BALL_CHANNEL, dropTracks } from './drop-tracks.ts';

import type { ToggleDropEvent } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

type FallEvent = Exclude<ToggleDropEvent, { readonly kind: 'cup-filled' }>;

const EVENTS: readonly ToggleDropEvent[] = [
  { kind: 'ball-dropped', col: 1, x: 180, y: 0, atMs: 0 },
  { kind: 'switch-flipped', col: 1, row: 0, side: 0, x: 180, y: 120, atMs: 167 },
  { kind: 'ball-passed', col: 2, row: 1, x: 300, y: 240, atMs: 333 },
  { kind: 'ball-landed', col: 2, x: 300, y: 360, isInCup: true, wasRedirected: false, atMs: 500 },
  { kind: 'cup-filled', col: 2, atMs: 500 },
];

describe('dropTracks', () => {
  // Simulate-then-replay: the events of the simulated fall become the tracks the board plays.
  it('moves the ball in a straight line from each point of its fall to the next', () => {
    expect(dropTracks(EVENTS)).toStrictEqual([
      {
        channel: BALL_CHANNEL,
        entityId: 0,
        startMs: 0,
        durationMs: 167,
        easing: 'linear',
        from: [180, 0],
        to: [180, 120],
      },
      {
        channel: BALL_CHANNEL,
        entityId: 0,
        startMs: 167,
        durationMs: 166,
        easing: 'linear',
        from: [180, 120],
        to: [300, 240],
      },
      {
        channel: BALL_CHANNEL,
        entityId: 0,
        startMs: 333,
        durationMs: 167,
        easing: 'linear',
        from: [300, 240],
        to: [300, 360],
      },
    ]);
  });

  it('gives no track without a fall', () => {
    expect(dropTracks([])).toStrictEqual([]);
  });

  it('replays the path the events describe, from the drop to the landing (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 99 }),
        fc.nat(),
        (seed, difficulty, pick) => {
          const start = create(seed, difficulty);
          const moves = listMoves(start);
          const move = moves[pick % moves.length] ?? { kind: 'drop', col: 0 };
          const { events } = applyMove(start, move);
          const points = events.filter((event): event is FallEvent => event.kind !== 'cup-filled');
          const tracks = dropTracks(events);
          expect(tracks).toHaveLength(points.length - 1);
          tracks.forEach((track, index) => {
            const from = points[index];
            const to = points[index + 1];
            expect(track.from).toStrictEqual([from?.x, from?.y]);
            expect(track.to).toStrictEqual([to?.x, to?.y]);
            expect(track.startMs + track.durationMs).toBe(to?.atMs);
          });
        },
      ),
    );
  });
});
