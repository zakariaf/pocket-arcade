// packages/shell/src/services/audio/ui-feedback.test.ts
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';

import { createFakeAudio } from './fake-audio.ts';
import { UI_SOUNDS } from './synth/ui-sounds.ts';
import { UI_FEEDBACK, playUiFeedback } from './ui-feedback.ts';

function ports() {
  return { audio: createFakeAudio(), haptics: createFakeHaptics() };
}

describe('playUiFeedback', () => {
  it('plays the tap sound and never pulses for a button', () => {
    const fakes = ports();
    playUiFeedback(fakes, 'tap');
    expect(fakes.audio.calls).toStrictEqual([{ kind: 'play', soundId: 'ui.tap', delayMs: 0 }]);
    expect(fakes.haptics.played).toStrictEqual([]);
  });

  it('pairs toggle, win and lose with selection, success and error', () => {
    const fakes = ports();
    playUiFeedback(fakes, 'toggle');
    playUiFeedback(fakes, 'win');
    playUiFeedback(fakes, 'lose');
    expect(
      fakes.audio.calls.map((call) => (call.kind === 'play' ? call.soundId : '')),
    ).toStrictEqual(['ui.toggle', 'ui.win', 'ui.lose']);
    expect(fakes.haptics.played).toStrictEqual(['selection', 'success', 'error']);
  });

  it('gives every Shell UI sound exactly one moment', () => {
    const sounds = Object.values(UI_FEEDBACK).map((feedback) => feedback.sound);
    expect([...sounds].sort()).toStrictEqual(Object.keys(UI_SOUNDS).sort());
  });
});
