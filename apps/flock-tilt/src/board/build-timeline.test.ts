// apps/flock-tilt/src/board/build-timeline.test.ts
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';

import { sheepEntity, TURN_ENTITY, wolfEntity } from './board-ids.ts';
import { buildTimeline, TURN_BUDGET_MS } from './build-timeline.ts';

import type { FlockTiltEvent } from '@e07/flock-tilt/rules/flock-tilt-types.ts';

/** The busiest tilt: three sheep and a wolf slide, two sheep drop into the pen, the field clears. */
const BUSIEST: readonly FlockTiltEvent[] = [
  {
    kind: 'animals-slid',
    direction: 'left',
    slides: [
      { animal: 'sheep', id: 2, from: 30, to: 29, stoppedBy: 'pen' },
      { animal: 'sheep', id: 0, from: 34, to: 29, stoppedBy: 'pen' },
      { animal: 'sheep', id: 1, from: 13, to: 7, stoppedBy: 'fence' },
      { animal: 'wolf', id: 0, from: 48, to: 42, stoppedBy: 'fence' },
    ],
  },
  { kind: 'sheep-penned', id: 2, cell: 29 },
  { kind: 'sheep-penned', id: 0, cell: 29 },
  { kind: 'field-cleared', tilts: 4, par: 4 },
];

const LOST: readonly FlockTiltEvent[] = [
  {
    kind: 'animals-slid',
    direction: 'right',
    slides: [{ animal: 'sheep', id: 0, from: 0, to: 3, stoppedBy: 'wolf' }],
  },
  { kind: 'sheep-lost', id: 0, cell: 3, wolfId: 0, wolfCell: 4 },
];

describe('buildTimeline', () => {
  it('keeps the busiest tilt within the animation budget', () => {
    expect(timelineEndMs(buildTimeline(BUSIEST, 'full'))).toBeLessThanOrEqual(TURN_BUDGET_MS);
  });

  it('slides every animal from its old cell to its new one as (col, row), farther ones for longer', () => {
    const moves = buildTimeline(BUSIEST, 'full').filter((track) => track.channel === 'pos');
    expect(moves.map((track) => track.entityId)).toStrictEqual([
      sheepEntity(2),
      sheepEntity(0),
      sheepEntity(1),
      wolfEntity(0),
    ]);
    expect(moves[1]?.from).toStrictEqual([6, 4]);
    expect(moves[1]?.to).toStrictEqual([1, 4]);
    expect(moves[0]?.durationMs).toBeLessThan(moves[1]?.durationMs ?? 0);
  });

  it('drops each penned sheep into the pen when it arrives, with a burst in full motion', () => {
    const tracks = buildTimeline(BUSIEST, 'full');
    const slide = tracks.find((t) => t.channel === 'pos' && t.entityId === sheepEntity(0));
    const drop = tracks.find((t) => t.channel === 'drop' && t.entityId === sheepEntity(0));
    expect(drop?.startMs).toBe((slide?.startMs ?? 0) + (slide?.durationMs ?? 0));
    expect(tracks.filter((track) => track.channel === 'burst')).toHaveLength(2);
  });

  it('flashes a lost sheep after the slide, and glows the cleared field', () => {
    const lost = buildTimeline(LOST, 'full').find((track) => track.channel === 'lost');
    expect(lost?.entityId).toBe(sheepEntity(0));
    const glow = buildTimeline(BUSIEST, 'full').find((track) => track.channel === 'glow');
    expect(glow?.entityId).toBe(TURN_ENTITY);
  });

  it('drops particles, bumps and overshoot under reduced motion, and halves the times', () => {
    const tracks = buildTimeline(BUSIEST, 'reduced');
    expect(tracks.some((track) => track.channel === 'burst' || track.channel === 'bump')).toBe(
      false,
    );
    expect(tracks.some((track) => track.easing === 'out-back')).toBe(false);
    expect(timelineEndMs(tracks)).toBeLessThan(timelineEndMs(buildTimeline(BUSIEST, 'full')));
  });

  it('cues each beat once with its sound and haptic, and leaves the win to the Shell', () => {
    const cues = buildTimeline([...BUSIEST], 'full')
      .map((track) => track.cue)
      .filter((cue) => cue !== undefined);
    expect(cues).toStrictEqual([
      { sound: 'tilt', haptic: 'light' },
      { sound: 'bump' },
      { sound: 'pen', haptic: 'medium' },
      { sound: 'pen', haptic: 'medium' },
    ]);
    const lostCues = buildTimeline(LOST, 'reduced')
      .map((track) => track.cue)
      .filter(Boolean);
    expect(lostCues).toContainEqual({ sound: 'bleat', haptic: 'warning' });
  });

  it('plays no cue of its own for the end of the tilts and the continue (the Shell sounds them)', () => {
    const ranOut = buildTimeline([{ kind: 'tilts-ran-out', tilts: 40 }], 'full');
    expect(ranOut.map((track) => [track.channel, track.cue])).toStrictEqual([['tired', undefined]]);
    const back = buildTimeline([{ kind: 'tilt-taken-back', tiltsAdded: 10 }], 'full');
    expect(back.map((track) => [track.channel, track.cue])).toStrictEqual([['rewind', undefined]]);
  });

  it('squashes a wolf the pen stopped, with the thud, but never a sheep that dropped in', () => {
    const wolfAtPen = buildTimeline(
      [
        {
          kind: 'animals-slid',
          direction: 'right',
          slides: [{ animal: 'wolf', id: 0, from: 7, to: 12, stoppedBy: 'pen' }],
        },
      ],
      'full',
    ).filter((track) => track.channel === 'bump');
    expect(wolfAtPen.map((track) => [track.entityId, track.cue])).toStrictEqual([
      [wolfEntity(0), { sound: 'bump' }],
    ]);
    const bumped = buildTimeline(BUSIEST, 'full').filter((track) => track.channel === 'bump');
    expect(bumped.map((track) => track.entityId)).toStrictEqual([sheepEntity(1), wolfEntity(0)]);
  });

  it('returns the same tracks for the same events', () => {
    expect(buildTimeline(BUSIEST, 'full')).toStrictEqual(buildTimeline(BUSIEST, 'full'));
  });
});
