// packages/shell/src/services/audio/fake-audio.test.ts
import { DEFAULT_AUDIO_SETTINGS } from './audio-port.ts';
import { createFakeAudio } from './fake-audio.ts';

describe('createFakeAudio', () => {
  it('records every call in order, as the Shell tests read them', async () => {
    const audio = createFakeAudio();
    audio.load({ place: { category: 'sfx', recipe: [] }, beam: { category: 'sfx', recipe: [] } });
    audio.play('place');
    audio.play('beam', 160);
    audio.cancelPending();
    audio.applySettings(DEFAULT_AUDIO_SETTINGS);
    audio.startMusic('theme');
    audio.stopMusic();
    await audio.suspend();
    await audio.resume();
    await audio.dispose();

    expect(audio.loadedIds).toStrictEqual(['place', 'beam']);
    expect(audio.calls).toStrictEqual([
      { kind: 'play', soundId: 'place', delayMs: 0 },
      { kind: 'play', soundId: 'beam', delayMs: 160 },
      { kind: 'cancel-pending' },
      { kind: 'settings', settings: DEFAULT_AUDIO_SETTINGS },
      { kind: 'music', soundId: 'theme' },
      { kind: 'music', soundId: null },
      { kind: 'suspend' },
      { kind: 'resume' },
      { kind: 'dispose' },
    ]);
  });
});
