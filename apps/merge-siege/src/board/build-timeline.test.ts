// apps/merge-siege/src/board/build-timeline.test.ts
// A turn plays as a short film built from its events (board-rendering-skia): the slide, the
// merges and smashes, the march, the entry and the new tile; Reduce motion halves every duration,
// drops the particles and the overshoot (spec 8.11).
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';

import { NEXT_ENTITY } from './board-ids.ts';
import { TURN_BUDGET_MS, buildTimeline } from './build-timeline.ts';

import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { MergeSiegeEvent } from '@e07/merge-siege/rules/merge-siege-types.ts';

/** Cell 20 is col 0, row 4; cell 5 is col 0, row 1; the board is 5 wide. */
const SLIDE: MergeSiegeEvent = { kind: 'tiles-slid', steps: [{ id: 3, from: 20, to: 0 }] };
const SMASH: MergeSiegeEvent = {
  kind: 'enemies-smashed',
  phase: 'slide',
  smashes: [{ id: 1, tileId: 3, cell: 5, value: 2 }],
};
const MERGE: MergeSiegeEvent = {
  kind: 'tiles-merged',
  merges: [{ id: 4, intoId: 2, cell: 25, value: 8 }],
};
const MARCH: MergeSiegeEvent = { kind: 'enemies-marched', steps: [{ id: 7, from: 2, to: 7 }] };
const ENTRY: MergeSiegeEvent = { kind: 'enemy-entered', id: 9, cell: 3, value: 4 };
const SPAWN: MergeSiegeEvent = { kind: 'tile-spawned', id: 10, cell: 24, value: 2 };
const BUSIEST = [
  {
    kind: 'tiles-slid',
    steps: [
      { id: 3, from: 20, to: 0 },
      { id: 4, from: 26, to: 25 },
    ],
  },
  MERGE,
  SMASH,
  MARCH,
  ENTRY,
  SPAWN,
] as const satisfies readonly MergeSiegeEvent[];

const tracksOf = (tracks: readonly Track[], channel: string, entityId: number): Track[] =>
  tracks.filter((track) => track.channel === channel && track.entityId === entityId);

const startOf = (track: Track | undefined): number => track?.startMs ?? 0;
const endOf = (track: Track | undefined): number => startOf(track) + (track?.durationMs ?? 0);

describe('buildTimeline', () => {
  it('slides each tile from its cell to where it stops, with the slide sound once', () => {
    const tracks = buildTimeline([SLIDE], 'full');
    const [slide] = tracksOf(tracks, 'piece', 3);
    expect(slide).toMatchObject({ startMs: 0, from: [0, 4, 0, 0, 1, 1], to: [0, 0, 0, 0, 1, 1] });
    expect(slide?.cue).toStrictEqual({ sound: 'slide' });
  });

  it('smashes an enemy when the tile reaches its cell, with a burst and the smash cue', () => {
    const tracks = buildTimeline([SLIDE, SMASH], 'full');
    const [vanish] = tracksOf(tracks, 'piece', 1);
    const [burst] = tracksOf(tracks, 'burst', 1);
    const [slide] = tracksOf(tracks, 'piece', 3);
    expect(vanish).toMatchObject({ from: [0, 1, 2, 1, 1, 1], to: [0, 1, 2, 1, 0, 1] });
    expect(vanish?.cue).toStrictEqual({ sound: 'smash', haptic: 'medium' });
    expect(vanish?.startMs).toBeGreaterThan(startOf(slide));
    expect(vanish?.startMs).toBeLessThan(endOf(slide));
    expect(burst).toMatchObject({ from: [0, 1], to: [0, 1] });
  });

  it('merges a tile into its partner, which pops with its new number', () => {
    const tracks = buildTimeline([MERGE], 'full');
    const [gone] = tracksOf(tracks, 'piece', 4);
    const [pop] = tracksOf(tracks, 'piece', 2);
    expect(gone).toMatchObject({ from: [0, 5, 4, 0, 1, 1], to: [0, 5, 4, 0, 0, 1] });
    expect(pop).toMatchObject({
      from: [0, 5, 8, 0, 1, 1.2],
      to: [0, 5, 8, 0, 1, 1],
      easing: 'out-back',
    });
    expect(pop?.cue).toStrictEqual({ sound: 'merge', haptic: 'light' });
  });

  it('marches after the slide, lets the next enemy in from the gate after that, then shows the next one', () => {
    const tracks = buildTimeline([SLIDE, MARCH, ENTRY], 'full');
    const [march] = tracksOf(tracks, 'piece', 7);
    const [entry] = tracksOf(tracks, 'piece', 9);
    const [next] = tracksOf(tracks, 'next', NEXT_ENTITY);
    const [slide] = tracksOf(tracks, 'piece', 3);
    expect(march).toMatchObject({ from: [2, 0, 0, -1, 1, 1], to: [2, 1, 0, -1, 1, 1] });
    expect(march?.startMs).toBeGreaterThanOrEqual(endOf(slide));
    expect(entry).toMatchObject({ from: [3, -1, 4, 1, 1, 1], to: [3, 0, 4, 1, 1, 1] });
    expect(entry?.startMs).toBeGreaterThan(startOf(march));
    expect(next).toMatchObject({ from: [0], to: [1] });
    expect(next?.startMs).toBeGreaterThanOrEqual(endOf(entry));
  });

  it('fades a tile lost to a bigger enemy where it stopped, with the crack cue', () => {
    const lost: MergeSiegeEvent = {
      kind: 'tiles-lost',
      phase: 'slide',
      losses: [{ id: 3, enemyId: 1, cell: 10, value: 2 }],
    };
    const tracks = buildTimeline(
      [{ kind: 'tiles-slid', steps: [{ id: 3, from: 20, to: 10 }] }, lost],
      'full',
    );
    const [slide, fade] = tracksOf(tracks, 'piece', 3);
    expect(slide).toMatchObject({ from: [0, 4, 2, 0, 1, 1], to: [0, 2, 2, 0, 1, 1] });
    expect(fade).toMatchObject({ from: [0, 2, 2, 0, 1, 1], to: [0, 2, 2, 0, 0, 0.6] });
    expect(fade?.startMs).toBeGreaterThanOrEqual(endOf(slide));
    expect(fade?.cue).toStrictEqual({ sound: 'crack', haptic: 'heavy' });
  });

  it('crushes a tile as a marching enemy steps onto it', () => {
    const tracks = buildTimeline(
      [
        { kind: 'enemies-marched', steps: [{ id: 7, from: 2, to: 7 }] },
        { kind: 'tiles-lost', phase: 'march', losses: [{ id: 5, enemyId: 7, cell: 7, value: 2 }] },
      ],
      'full',
    );
    const [march] = tracksOf(tracks, 'piece', 7);
    const [crushed] = tracksOf(tracks, 'piece', 5);
    expect(crushed).toMatchObject({ from: [2, 1, 2, 0, 1, 1] });
    expect(crushed?.startMs).toBeGreaterThan(startOf(march));
    expect(crushed?.startMs).toBeLessThan(endOf(march));
  });

  it('smashes an enemy stepping from the gate onto a tile, and then shows the next one', () => {
    const tracks = buildTimeline(
      [
        {
          kind: 'enemies-smashed',
          phase: 'gate',
          smashes: [{ id: 6, tileId: 5, cell: 4, value: 4 }],
        },
      ],
      'full',
    );
    const [stepIn] = tracksOf(tracks, 'piece', 6);
    const [burst] = tracksOf(tracks, 'burst', 6);
    const [next] = tracksOf(tracks, 'next', NEXT_ENTITY);
    expect(stepIn).toMatchObject({ from: [4, -1, 4, 1, 1, 1], to: [4, -0.5, 4, 1, 0, 1] });
    expect(burst?.startMs).toBeGreaterThan(startOf(stepIn));
    expect(next?.startMs).toBeGreaterThanOrEqual(endOf(stepIn));
  });

  it('pops the new tile in last', () => {
    const tracks = buildTimeline(BUSIEST, 'full');
    const [spawn] = tracksOf(tracks, 'piece', 10);
    expect(spawn).toMatchObject({ from: [4, 4, 2, 0, 0, 0.4], to: [4, 4, 2, 0, 1, 1] });
    expect(spawn?.startMs).toBe(
      Math.max(...tracks.filter((track) => track !== spawn).map((track) => track.startMs)),
    );
  });

  it('plays the busiest turn within the turn budget', () => {
    expect(timelineEndMs(buildTimeline(BUSIEST, 'full'))).toBeLessThanOrEqual(TURN_BUDGET_MS);
  });

  it('halves every duration under Reduce motion, with no burst and no overshoot', () => {
    const full = buildTimeline(BUSIEST, 'full');
    const reduced = buildTimeline(BUSIEST, 'reduced');
    expect(reduced.some((track) => track.channel === 'burst')).toBe(false);
    expect(reduced.some((track) => track.easing === 'out-back')).toBe(false);
    expect(timelineEndMs(reduced)).toBeLessThanOrEqual(timelineEndMs(full) / 2 + 1);
    const [pop] = tracksOf(reduced, 'piece', 2);
    expect(pop?.from[5]).toBe(1);
  });

  it('pushes every enemy back on a continue, and draws nothing for the score', () => {
    const tracks = buildTimeline(
      [
        { kind: 'enemies-pushed-back', steps: [{ id: 3, from: 11, to: 6 }], drivenOff: [1] },
        { kind: 'score-added', points: 10, total: 10 },
      ],
      'full',
    );
    expect(tracksOf(tracks, 'piece', 3)).toHaveLength(1);
    expect(tracksOf(tracks, 'piece', 3)[0]).toMatchObject({
      from: [1, 2, 0, -1, 1, 1],
      to: [1, 1, 0, -1, 1, 1],
    });
    expect(tracks).toHaveLength(1);
  });

  it('gives the same tracks for the same events', () => {
    expect(buildTimeline(BUSIEST, 'full')).toStrictEqual(buildTimeline(BUSIEST, 'full'));
  });
});
