// packages/shell/src/services/audio/recording-feedback.test.ts
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';

import { createFakeAudio } from './fake-audio.ts';
import { recordAudioFeedback, recordHapticsFeedback } from './recording-feedback.ts';
import { playUiFeedback } from './ui-feedback.ts';

import type { FeedbackEntry, FeedbackRecorder } from './recording-feedback.ts';

function recorder(): FeedbackRecorder & { readonly entries: FeedbackEntry[] } {
  const entries: FeedbackEntry[] = [];
  let now = 1_000;
  return {
    entries,
    perfLog: {
      append: (entry) => {
        entries.push(entry);
      },
    },
    nowMs: () => {
      now += 1;
      return now;
    },
  };
}

describe('recording feedback (test builds)', () => {
  it('passes a win through both ports and records the win sound and the success haptic', () => {
    const log = recorder();
    const audio = createFakeAudio();
    const haptics = createFakeHaptics();
    playUiFeedback(
      { audio: recordAudioFeedback(audio, log), haptics: recordHapticsFeedback(haptics, log) },
      'win',
    );
    expect(audio.calls).toStrictEqual([{ kind: 'play', soundId: 'ui.win', delayMs: 0 }]);
    expect(haptics.played).toStrictEqual(['success']);
    expect(log.entries).toStrictEqual([
      { kind: 'feedback', label: 'ui.win', atEpochMs: 1_001, data: { delayMs: 0 } },
      { kind: 'feedback', label: 'success', atEpochMs: 1_002, data: {} },
    ]);
  });

  it('keeps a timeline cue delay and leaves every other audio call untouched', async () => {
    const log = recorder();
    const audio = createFakeAudio();
    const recorded = recordAudioFeedback(audio, log);
    recorded.play('pop', 120);
    recorded.cancelPending();
    await recorded.suspend();
    expect(audio.calls).toStrictEqual([
      { kind: 'play', soundId: 'pop', delayMs: 120 },
      { kind: 'cancel-pending' },
      { kind: 'suspend' },
    ]);
    expect(log.entries.map((entry) => [entry.label, entry.data])).toStrictEqual([
      ['pop', { delayMs: 120 }],
    ]);
  });

  it('keeps whether the device has a Taptic Engine', () => {
    const log = recorder();
    expect(recordHapticsFeedback(createFakeHaptics(false), log).isSupported).toBe(false);
    expect(recordHapticsFeedback(createFakeHaptics(true), log).isSupported).toBe(true);
  });
});
