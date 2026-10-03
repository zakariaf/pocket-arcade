// packages/shell/src/game-host/present-move.test.ts

import { NOT_STARTED, isSceneAnimating } from './board-scene.ts';
import { presentMove } from './present-move.ts';

import type { BoardScene } from './board-scene.ts';
import type { PresenterDeps } from './present-move.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';

const beam: Track = {
  channel: 'beam',
  entityId: 3,
  startMs: 0,
  durationMs: 300,
  easing: 'linear',
  from: [0],
  to: [1],
  cue: { sound: 'beam' },
};

describe('presentMove', () => {
  it('cancels old cues, pushes the final view as scene <seq>, then schedules new cues', () => {
    const pushed: BoardScene<string>[] = [];
    const log: string[] = [];
    const deps: PresenterDeps<number, string, string> = {
      toView: (state) => `view-${String(state)}`,
      buildTimeline: (events) => events.map(() => beam),
      motion: 'full',
      clock: { push: (scene) => pushed.push(scene) },
      cues: {
        cancel: () => log.push('cancel'),
        schedule: (tracks) => log.push(`cues:${String(tracks.length)}`),
      },
    };
    presentMove(deps, { seq: 1, state: 1, events: ['cleared'] });
    presentMove(deps, { seq: 2, state: 2, events: ['cleared'] });
    const summary = pushed.map((scene) => [scene.seq, scene.view, scene.endMs, scene.startAt]);
    expect(summary).toStrictEqual([
      [1, 'view-1', 300, NOT_STARTED],
      [2, 'view-2', 300, NOT_STARTED],
    ]);
    expect(log).toStrictEqual(['cancel', 'cues:1', 'cancel', 'cues:1']);
  });

  it('reports a pushed scene as animating until its end', () => {
    expect(isSceneAnimating({ startAt: NOT_STARTED, endMs: 300 }, 999)).toBe(true);
    expect(isSceneAnimating({ startAt: 1000, endMs: 300 }, 1299)).toBe(true);
    expect(isSceneAnimating({ startAt: 1000, endMs: 300 }, 1300)).toBe(false);
  });
});
