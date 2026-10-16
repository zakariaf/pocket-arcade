// apps/demo-game/src/board/build-timeline.ts
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { DemoEvent } from '@e07/demo-game/rules/demo-types.ts';

/** Pure: events to tracks; sounds and haptics ride on the track cues (the Tap Flip template game). */
export function buildTimeline(events: readonly DemoEvent[], motion: Motion): readonly Track[] {
  const scale = motion === 'full' ? 1 : 0.5;
  return events.map((event, index): Track => {
    switch (event.kind) {
      case 'cells-flipped':
        return { channel: 'flip', entityId: index, startMs: 0, durationMs: 200 * scale, easing: 'in-out-quad', from: [-1], to: [1], cue: { sound: 'flip', haptic: 'light' } };
      case 'board-cleared':
        return { channel: 'glow', entityId: index, startMs: 320 * scale, durationMs: 400 * scale, easing: 'out-quad', from: [1], to: [0], cue: { sound: 'clear', haptic: 'success' } };
      case 'moves-added':
        return { channel: 'bonus', entityId: index, startMs: 0, durationMs: 600 * scale, easing: 'out-back', from: [0.6], to: [1], cue: { sound: 'bonus', haptic: 'medium' } };
    }
  });
}
