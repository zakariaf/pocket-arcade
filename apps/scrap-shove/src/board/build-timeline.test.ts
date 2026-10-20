// apps/scrap-shove/src/board/build-timeline.test.ts
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { applyMove } from '@e07/scrap-shove/rules/apply-move.ts';
import { stateFromText } from '@e07/scrap-shove/rules/board-text.ts';

import { heapEntity, kindIndex, PLAYER_ENTITY, robotEntity } from './board-ids.ts';
import { buildTimeline, TURN_BUDGET_MS } from './build-timeline.ts';

import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { ScrapShoveMove } from '@e07/scrap-shove/rules/scrap-shove-types.ts';

/**
 * The busiest turn: the player shoves a heap onto a robot (a crush), two robots crash into a new
 * heap, one drives into scrap, a heavy robot smashes a heap it cannot shove, and the fast robot
 * steps twice.
 */
const BUSY_FLOOR = [
  'h......f',
  '........',
  '........',
  '.....n..',
  'h#n#@...',
  '..#..n..',
  '.n......',
  '......n.',
];
const BUSY = applyMove(stateFromText(BUSY_FLOOR), { kind: 'shove', col: 3, row: 4 }).events;

function eventsOf(
  floor: readonly string[],
  move: ScrapShoveMove,
): ReturnType<typeof applyMove>['events'] {
  return applyMove(stateFromText(floor), move).events;
}

function on(tracks: readonly Track[], channel: string): Track[] {
  return tracks.filter((track) => track.channel === channel);
}

/** When a track ends (0 for no track). */
function endOf(track: Track | undefined): number {
  return track === undefined ? 0 : track.startMs + track.durationMs;
}

/** The moments the tracks start, sorted. */
function startsOf(tracks: readonly Track[]): number[] {
  return tracks.map((track) => track.startMs).sort((a, b) => a - b);
}

describe('buildTimeline', () => {
  it('keeps the busiest turn within the animation budget', () => {
    expect(timelineEndMs(buildTimeline(BUSY, 'full'))).toBeLessThanOrEqual(TURN_BUDGET_MS);
  });

  it('plays the turn in beats: the player, every robot, then the fast robots again', () => {
    const tracks = buildTimeline(BUSY, 'full');
    const player = on(tracks, 'player')[0];
    const robots = on(tracks, 'robot');
    const fast = robots.filter((track) => track.entityId === robotEntity(2));
    expect(player).toMatchObject({ startMs: 0, from: [4, 4], to: [3, 4] });
    expect(new Set(robots.map((track) => track.startMs)).size).toBe(2);
    expect(fast.map((track) => [track.from, track.to])).toStrictEqual([
      [
        [7, 0],
        [6, 1],
      ],
      [
        [6, 1],
        [5, 2],
      ],
    ]);
    const [first = 0, second = 0] = startsOf(fast);
    expect([first >= endOf(player), second >= endOf(fast[0])]).toStrictEqual([true, true]);
  });

  it('slides the shoved heap with the player and fades every robot that broke where it broke', () => {
    const tracks = buildTimeline(BUSY, 'full');
    expect(on(tracks, 'heap')).toMatchObject([
      { entityId: heapEntity(7), startMs: 0, from: [3, 4], to: [2, 4] },
    ]);
    const ghosts = on(tracks, 'ghost').map((track) => [track.entityId, track.from]);
    expect(ghosts).toStrictEqual([
      [robotEntity(6), [2, 4, kindIndex('normal'), 1]],
      [robotEntity(3), [4, 4, kindIndex('normal'), 1]],
      [robotEntity(9), [4, 4, kindIndex('normal'), 1]],
      [robotEntity(10), [2, 5, kindIndex('normal'), 1]],
    ]);
    expect(on(tracks, 'ghost').every((track) => track.to[3] === 0)).toBe(true);
  });

  it('grows a new heap where two robots crashed, with a badge counting them, but none on old scrap', () => {
    const tracks = buildTimeline(BUSY, 'full');
    expect(on(tracks, 'appear').map((track) => track.entityId)).toStrictEqual([heapEntity(12)]);
    expect(on(tracks, 'badge').map((track) => track.from)).toStrictEqual([[4, 4, 2]]);
  });

  it('fades the heap a heavy robot smashed while the robots step', () => {
    const smash = on(buildTimeline(BUSY, 'full'), 'smash');
    expect(smash).toMatchObject([{ entityId: heapEntity(5), from: [1, 4, 1], to: [1, 4, 0] }]);
  });

  it('slides a heap a heavy robot shoves during the robots beat and crushes the robot behind it', () => {
    const events = eventsOf(['.....', '.n...', 'h#..@', '.....', '.....'], { kind: 'wait' });
    const tracks = buildTimeline(events, 'full');
    const robotStart = on(tracks, 'robot')[0]?.startMs;
    expect(on(tracks, 'heap')).toMatchObject([{ startMs: robotStart, from: [1, 2], to: [2, 2] }]);
    expect(on(tracks, 'ghost').map((track) => track.entityId)).toStrictEqual([robotEntity(1)]);
  });

  it('pulses a ring when the player waits', () => {
    const tracks = buildTimeline([{ kind: 'player-waited', at: { col: 1, row: 1 } }], 'full');
    expect(on(tracks, 'wait')).toMatchObject([{ entityId: PLAYER_ENTITY, from: [0], to: [1] }]);
  });

  it('flashes the catch at the end of the robots beat', () => {
    const tracks = buildTimeline(
      eventsOf(['....', '.n..', '..@.', '....'], { kind: 'wait' }),
      'full',
    );
    const [step] = on(tracks, 'robot');
    expect(on(tracks, 'caught')).toMatchObject([{ startMs: endOf(step), from: [1], to: [0] }]);
  });

  it('glows and bursts when the floor is cleared, and blinks once for an undo', () => {
    const cleared = buildTimeline(
      eventsOf(['n.n.', '....', '....', '.@..'], { kind: 'wait' }),
      'full',
    );
    expect(on(cleared, 'glow')).toHaveLength(1);
    expect(on(cleared, 'burst')).toHaveLength(1);
    expect(on(buildTimeline([{ kind: 'step-reverted' }], 'full'), 'revert')).toHaveLength(1);
  });

  it('fades the next-step arrows in once everything stands still', () => {
    const tracks = buildTimeline(BUSY, 'full');
    const settled = Math.max(...on(tracks, 'robot').map(endOf));
    expect(on(tracks, 'arrows')).toMatchObject([{ startMs: settled, from: [0], to: [1] }]);
  });

  it('falls back to a normal robot for a crash of a robot it saw no step of', () => {
    const crash = {
      kind: 'robots-crashed',
      robotIds: [5],
      at: { col: 1, row: 1 },
      cause: 'heavy',
      heapId: 6,
      isShovedScrap: false,
    } as const;
    expect(on(buildTimeline([crash], 'full'), 'ghost')[0]?.from[2]).toBe(kindIndex('normal'));
  });

  it('drops sparks, bursts and overshoot under reduced motion and plays faster', () => {
    const cleared = eventsOf(['n.n.', '....', '....', '.@..'], { kind: 'wait' });
    const tracks = buildTimeline([...BUSY, ...cleared], 'reduced');
    expect(tracks.some((track) => ['spark', 'burst'].includes(track.channel))).toBe(false);
    expect(tracks.some((track) => track.easing === 'out-back')).toBe(false);
    expect(timelineEndMs(buildTimeline(BUSY, 'reduced'))).toBeLessThan(
      timelineEndMs(buildTimeline(BUSY, 'full')),
    );
  });

  it('cues each beat with its sound and haptic', () => {
    const lost = eventsOf(['....', '.n..', '..@.', '....'], { kind: 'wait' });
    const won = eventsOf(['n.n.', '....', '....', '.@..'], { kind: 'wait' });
    const cues = [BUSY, lost, won, [{ kind: 'step-reverted' } as const]].map((events) =>
      buildTimeline(events, 'full').flatMap((track) =>
        track.cue === undefined ? [] : [track.cue],
      ),
    );
    expect(cues).toStrictEqual([
      [
        { sound: 'step' },
        { sound: 'shove' },
        { sound: 'crush', haptic: 'heavy' },
        { sound: 'robot-step' },
        { sound: 'crash', haptic: 'medium' },
        { sound: 'crash', haptic: 'medium' },
        { sound: 'smash' },
        { sound: 'robot-step' },
      ],
      [{ sound: 'robot-step' }, { sound: 'lose', haptic: 'error' }],
      [
        { sound: 'robot-step' },
        { sound: 'crash', haptic: 'medium' },
        { sound: 'win', haptic: 'success' },
      ],
      [{ haptic: 'medium' }],
    ]);
  });

  it('returns no tracks for no events, and the same tracks for the same events', () => {
    expect(buildTimeline([], 'full')).toStrictEqual([]);
    expect(buildTimeline(BUSY, 'full')).toStrictEqual(buildTimeline(BUSY, 'full'));
  });
});
