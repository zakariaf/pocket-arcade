// apps/stepstone/src/board/build-timeline.test.ts
// Spec 8.11: everything moving respects Reduce motion (half durations, no particles or shake).
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';

import { cellEntity, FROG_ENTITY } from './board-ids.ts';
import { buildTimeline, TURN_BUDGET_MS } from './build-timeline.ts';

import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { StepstoneEvent } from '@e07/stepstone/rules/stepstone-types.ts';

/** The busiest turn: the rook at 3 hops down its column onto the flag at 45. */
const WIN: readonly StepstoneEvent[] = [
  { kind: 'player-stepped', from: 3, to: 45, moveKind: 'rook', kindsUsed: 4 },
  { kind: 'stone-sank', cell: 3, stone: 'rook' },
  { kind: 'goal-reached', cell: 45, moves: 12, par: 9 },
];
/** The golden pond's first hop: rook to a king, a hop kind not used yet this run. */
const NEW_KIND: readonly StepstoneEvent[] = [
  { kind: 'player-stepped', from: 2, to: 12, moveKind: 'rook', kindsUsed: 2 },
  { kind: 'stone-sank', cell: 2, stone: 'rook' },
  { kind: 'move-kind-changed', cell: 12, from: 'rook', to: 'king', isNewKind: true },
];
/** A rook hop onto a king with nothing around it: the frog is stranded. */
const STRANDED: readonly StepstoneEvent[] = [
  { kind: 'player-stepped', from: 0, to: 4, moveKind: 'rook', kindsUsed: 2 },
  { kind: 'stone-sank', cell: 0, stone: 'rook' },
  { kind: 'move-kind-changed', cell: 4, from: 'rook', to: 'king', isNewKind: false },
  { kind: 'frog-stranded', cell: 4 },
];
const TURNS = [WIN, NEW_KIND, STRANDED];

function channel(tracks: readonly Track[], name: string): Track[] {
  return tracks.filter((track) => track.channel === name);
}

function cuesOf(tracks: readonly Track[]): unknown[] {
  return tracks.map((track) => track.cue).filter((cue) => cue !== undefined);
}

describe('buildTimeline', () => {
  it('keeps every kind of turn within the animation budget', () => {
    for (const turn of TURNS) {
      expect(timelineEndMs(buildTimeline(turn, 'full'))).toBeLessThanOrEqual(TURN_BUDGET_MS);
    }
  });

  it('jumps the frog from its stone to the target, the hop sound at take-off', () => {
    expect(channel(buildTimeline(WIN, 'full'), 'hop')).toStrictEqual([
      {
        channel: 'hop',
        entityId: FROG_ENTITY,
        startMs: 0,
        durationMs: 320,
        easing: 'in-out-quad',
        from: [3, 45],
        to: [3, 45],
        cue: { sound: 'hop', haptic: 'light' },
      },
    ]);
  });

  it('sinks the stone the frog left while the frog is in the air, carrying its hop kind', () => {
    const [sink] = channel(buildTimeline(WIN, 'full'), 'sink');
    expect(sink?.entityId).toBe(cellEntity(3));
    expect([sink?.from, sink?.to]).toStrictEqual([
      [1, 4],
      [0, 4],
    ]);
    expect(sink?.startMs).toBeGreaterThan(0);
  });

  it('pops the glyph of the landing stone only when its hop kind is new this run', () => {
    const pops = channel(buildTimeline(NEW_KIND, 'full'), 'pop');
    expect(pops.map((track) => track.entityId)).toStrictEqual([cellEntity(12)]);
    expect(channel(buildTimeline(STRANDED, 'full'), 'pop')).toStrictEqual([]);
  });

  it('drops particles, shake and overshoot under reduced motion, and runs shorter', () => {
    const all = TURNS.flat();
    const reduced = buildTimeline(all, 'reduced');
    expect(channel(reduced, 'burst')).toStrictEqual([]);
    expect(reduced.some((track) => track.easing === 'out-back')).toBe(false);
    expect(channel(reduced, 'stranded').map((track) => track.from)).toStrictEqual([[0]]);
    expect(timelineEndMs(buildTimeline(WIN, 'reduced'))).toBeLessThan(
      timelineEndMs(buildTimeline(WIN, 'full')),
    );
  });

  it('cues each beat with its sound and haptic', () => {
    expect(cuesOf(buildTimeline(WIN, 'full'))).toStrictEqual([
      { sound: 'hop', haptic: 'light' },
      { sound: 'sink' },
      { sound: 'win', haptic: 'success' },
    ]);
    expect(cuesOf(buildTimeline(NEW_KIND, 'full')).at(-1)).toStrictEqual({
      sound: 'kind-change',
      haptic: 'selection',
    });
    expect(cuesOf(buildTimeline(STRANDED, 'reduced')).at(-1)).toStrictEqual({
      sound: 'stuck',
      haptic: 'warning',
    });
  });

  it('returns the same tracks for the same events', () => {
    expect(buildTimeline(WIN, 'full')).toStrictEqual(buildTimeline(WIN, 'full'));
  });
});
