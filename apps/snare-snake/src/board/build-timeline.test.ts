// apps/snare-snake/src/board/build-timeline.test.ts
// Spec 10 BOARD AND CONTROLS: "Animates the events (and respects Reduce motion)".
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';

import { cellEntity, critterEntity, HEAD_ENTITY, TURN_ENTITY } from './board-ids.ts';
import { buildTimeline, TURN_BUDGET_MS } from './build-timeline.ts';

import type { SnareSnakeEvent } from '@e07/snare-snake/rules/snare-snake-types.ts';

/** The busiest turn the rules can produce: a loop that catches two critters, hops and the bonus. */
const TURN: readonly SnareSnakeEvent[] = [
  { kind: 'loop-closed', loop: [9, 10, 17, 16], enclosed: [], spent: 3, length: 6 },
  { kind: 'critters-caught', critterIds: [0, 2], cells: [8, 24], count: 2, points: 40 },
  { kind: 'critters-moved', hops: [{ critterId: 1, from: 40, to: 41 }] },
  { kind: 'bonus-added', points: 60, total: 100 },
];
const STEP: readonly SnareSnakeEvent[] = [
  { kind: 'snake-moved', from: 9, to: 16, vacated: 30, length: 5 },
];

const channelsOf = (events: readonly SnareSnakeEvent[]): string[] =>
  buildTimeline(events, 'full').map((track) => track.channel);

describe('buildTimeline', () => {
  it('keeps the busiest turn within the animation budget', () => {
    expect(timelineEndMs(buildTimeline(TURN, 'full'))).toBeLessThanOrEqual(TURN_BUDGET_MS);
  });

  it('slides the head from its old cell to its new one and fades the cell the tail left', () => {
    const tracks = buildTimeline(STEP, 'full');
    expect(tracks.map((track) => [track.channel, track.entityId])).toStrictEqual([
      ['head', HEAD_ENTITY],
      ['tail', cellEntity(30)],
    ]);
    // The timeline knows no grid width: a slide carries both cells and its progress.
    expect(tracks[0]?.from).toStrictEqual([9, 16, 0]);
    expect(tracks[0]?.to).toStrictEqual([9, 16, 1]);
  });

  it('flashes the loop, fades its spent segments and pops each caught critter with a burst', () => {
    expect(channelsOf(TURN)).toStrictEqual([
      'loop',
      'spent',
      'spent',
      'spent',
      'caught',
      'burst',
      'caught',
      'burst',
      'hop',
      'bonus',
    ]);
    const caught = buildTimeline(TURN, 'full').filter((track) => track.channel === 'caught');
    expect(caught.map((track) => track.entityId)).toStrictEqual([
      critterEntity(0),
      critterEntity(2),
    ]);
    expect(caught[0]?.from).toStrictEqual([8, 1]);
    expect(caught[0]?.to).toStrictEqual([8, 0]);
  });

  it('drops particles and overshoot under reduced motion, and is shorter', () => {
    const tracks = buildTimeline([...TURN, { kind: 'moves-added', count: 3 }], 'reduced');
    expect(tracks.some((track) => track.channel === 'burst')).toBe(false);
    expect(tracks.some((track) => track.easing === 'out-back')).toBe(false);
    expect(timelineEndMs(tracks)).toBeLessThan(timelineEndMs(buildTimeline(TURN, 'full')));
  });

  it('cues each beat with its sound and haptic', () => {
    const events = [...STEP, ...TURN, { kind: 'moves-added', count: 3 } as const];
    const cues = buildTimeline(events, 'full')
      .map((track) => track.cue)
      .filter((cue) => cue !== undefined);
    expect(cues).toStrictEqual([
      { sound: 'step' },
      { sound: 'loop', haptic: 'light' },
      { sound: 'catch', haptic: 'success' },
      { sound: 'bonus', haptic: 'medium' },
    ]);
  });

  it('turns a step back into a fading head and the moves badge pop', () => {
    const back: readonly SnareSnakeEvent[] = [
      { kind: 'snake-stepped-back', from: 6, to: 5, length: 2 },
      { kind: 'moves-added', count: 3 },
    ];
    const tracks = buildTimeline(back, 'full');
    expect(tracks.map((track) => [track.channel, track.entityId])).toStrictEqual([
      ['tail', cellEntity(6)],
      ['bonus', TURN_ENTITY],
    ]);
  });

  it('returns the same tracks for the same events', () => {
    expect(buildTimeline(TURN, 'full')).toStrictEqual(buildTimeline(TURN, 'full'));
  });
});
