// packages/shell/src/services/audio/audio-api-audio-adapter.android.test.ts
// Runs in the unit-android Jest project (jest-expo/android): Platform.OS is 'android' here.
import { Platform } from 'react-native';

import { UI_SOUNDS } from '@e07/shell/services/audio/synth/ui-sounds.ts';

import { createAudioApiAudioAdapter } from './audio-api-audio-adapter.ts';
import { DEFAULT_AUDIO_SETTINGS } from './audio-port.ts';

// The root manual mock (__mocks__/react-native-audio-api.ts) wraps the library's own mock and
// adds the AudioManager methods it lacks. jest.mock + requireMock read the SAME instance.
jest.mock('react-native-audio-api');

type AudioApiMock = {
  readonly AudioManager: {
    readonly observeAudioInterruptions: jest.Mock;
    readonly addSystemEventListener: jest.Mock;
  };
};

const { AudioManager } = jest.requireMock<AudioApiMock>('react-native-audio-api');

const TAP_BANK = { 'ui.tap': { category: 'ui', recipe: UI_SOUNDS['ui.tap'] } } as const;

// spec 8.7: audio "never plays over the player's own music". On Android,
// AudioManager.observeAudioInterruptions(true) requests AUDIOFOCUS_GAIN, which stops the
// player's music app; the adapter therefore asks Android for no audio focus at all.
describe('audio-api adapter on Android (spec 8.7)', () => {
  beforeEach(() => {
    AudioManager.observeAudioInterruptions.mockClear();
    AudioManager.addSystemEventListener.mockClear();
  });

  it('runs on the Android platform', () => {
    expect(Platform.OS).toBe('android');
  });

  it('asks Android for no audio focus, so the player keeps their own music', () => {
    const audio = createAudioApiAudioAdapter({ reportError: jest.fn() });
    audio.load(TAP_BANK);
    audio.applySettings(DEFAULT_AUDIO_SETTINGS);
    audio.play('ui.tap');
    expect(AudioManager.observeAudioInterruptions).not.toHaveBeenCalled();
    expect(AudioManager.addSystemEventListener).not.toHaveBeenCalled();
  });

  it('disposes without a focus to give back', async () => {
    const audio = createAudioApiAudioAdapter({ reportError: jest.fn() });
    audio.load(TAP_BANK);
    await expect(audio.dispose()).resolves.toBeUndefined();
    expect(AudioManager.observeAudioInterruptions).not.toHaveBeenCalled();
  });
});
