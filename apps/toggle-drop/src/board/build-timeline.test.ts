// apps/toggle-drop/src/board/build-timeline.test.ts
import fc from 'fast-check';

import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { applyMove } from '@e07/toggle-drop/rules/apply-move.ts';
import { create } from '@e07/toggle-drop/rules/create.ts';
import { listMoves } from '@e07/toggle-drop/rules/list-moves.ts';

import { cupEntity, switchEntity } from './board-ids.ts';
import { TURN_BUDGET_MS, buildTimeline } from './build-timeline.ts';

import type { ToggleDropEvent } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

/** A drop that flips a switch, lands in a cup and fills it. */
const FILLING: readonly ToggleDropEvent[] = [
  { kind: 'ball-dropped', col: 1, x: 180, y: 0, atMs: 0 },
  { kind: 'switch-flipped', col: 1, row: 0, side: 0, x: 180, y: 120, atMs: 167 },
  { kind: 'ball-passed', col: 2, row: 1, x: 300, y: 240, atMs: 333 },
  { kind: 'ball-landed', col: 2, x: 300, y: 360, isInCup: true, wasRedirected: true, atMs: 500 },
  { kind: 'cup-filled', col: 2, atMs: 500 },
];

describe('buildTimeline', () => {
  // Simulate-then-replay: the move's timed events become the film the board plays.
  it('replays the fall, swings the switch and pops the cup at their times, with sounds', () => {
    const tracks = buildTimeline(FILLING, 'full');
    expect(tracks.filter((track) => track.channel === 'ball')).toHaveLength(3);
    expect(tracks.find((track) => track.channel === 'ball')?.cue).toStrictEqual({ sound: 'drop' });
    expect(tracks.find((track) => track.channel === 'switch')).toMatchObject({
      entityId: switchEntity(0, 1),
      startMs: 167,
      from: [1],
      to: [-1],
      cue: { sound: 'click' },
    });
    expect(tracks.find((track) => track.channel === 'catch')).toMatchObject({
      entityId: cupEntity(2),
      startMs: 500,
      cue: { sound: 'catch', haptic: 'light' },
    });
    expect(tracks.find((track) => track.channel === 'burst')?.cue).toStrictEqual({
      sound: 'cup',
      haptic: 'success',
    });
    expect(tracks.find((track) => track.channel === 'fade')?.startMs).toBe(500);
  });

  it('leaves a puff, not a pop, for a ball lost in the gutter', () => {
    const lost = FILLING.slice(0, 3).concat({
      kind: 'ball-landed',
      col: 2,
      x: 300,
      y: 360,
      isInCup: false,
      wasRedirected: false,
      atMs: 500,
    });
    const channels = buildTimeline(lost, 'full').map((track) => track.channel);
    expect(channels).toContain('miss');
    expect(channels).not.toContain('catch');
  });

  it('halves every time and drops the particles under Reduce motion', () => {
    const full = buildTimeline(FILLING, 'full');
    const reduced = buildTimeline(FILLING, 'reduced');
    expect(reduced.map((track) => track.channel)).not.toContain('burst');
    expect(timelineEndMs(reduced)).toBeLessThanOrEqual(timelineEndMs(full) / 2);
  });

  it('keeps every real move inside the turn budget (property)', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), fc.nat(), (seed, difficulty, pick) => {
        const start = create(seed, difficulty);
        const moves = listMoves(start);
        const move = moves[pick % moves.length] ?? { kind: 'drop', col: 0 };
        const tracks = buildTimeline(applyMove(start, move).events, 'full');
        expect(timelineEndMs(tracks)).toBeLessThanOrEqual(TURN_BUDGET_MS);
      }),
      { seed: 3, numRuns: 80 },
    );
  });

  it('gives the same tracks for the same events', () => {
    expect(buildTimeline(FILLING, 'full')).toStrictEqual(buildTimeline(FILLING, 'full'));
  });
});
