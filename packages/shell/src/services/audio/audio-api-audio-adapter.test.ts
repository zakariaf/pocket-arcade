// packages/shell/src/services/audio/audio-api-audio-adapter.test.ts
import { UI_SOUNDS } from '@e07/shell/services/audio/synth/ui-sounds.ts';

import { createAudioApiAudioAdapter } from './audio-api-audio-adapter.ts';
import { DEFAULT_AUDIO_SETTINGS } from './audio-port.ts';

// The root manual mock (__mocks__/react-native-audio-api.ts) wraps the library's own mock and
// adds the AudioManager methods it lacks. jest.mock + requireMock read the SAME instance.
jest.mock('react-native-audio-api');

type SourceMethods = { start: (when?: number) => void; stop: (when?: number) => void };
type AudioApiMock = {
  readonly AudioManager: { readonly setAudioSessionOptions: jest.Mock };
  readonly AudioBufferSourceNode: { readonly prototype: SourceMethods };
};

const { AudioManager, AudioBufferSourceNode } =
  jest.requireMock<AudioApiMock>('react-native-audio-api');

const TAP_BANK = { 'ui.tap': { category: 'ui', recipe: UI_SOUNDS['ui.tap'] } } as const;

describe('audio-api adapter (library mock)', () => {
  it('loads a bank, plays, schedules, cancels and disposes without throwing', async () => {
    const audio = createAudioApiAudioAdapter({ reportError: jest.fn() });
    audio.load(TAP_BANK);
    audio.applySettings(DEFAULT_AUDIO_SETTINGS);
    audio.play('ui.tap');
    audio.play('ui.tap', 120);
    audio.play('unknown.id');
    audio.cancelPending();
    await audio.suspend();
    await audio.resume();
    await expect(audio.dispose()).resolves.toBeUndefined();
  });

  it('configures the ambient session before it creates the context', () => {
    const audio = createAudioApiAudioAdapter({ reportError: jest.fn() });
    audio.load({});
    expect(AudioManager.setAudioSessionOptions).toHaveBeenCalledWith({
      iosCategory: 'ambient',
      iosMode: 'default',
      iosOptions: [],
    });
  });

  // spec 8.7: "Audio follows the phone's silent switch where the platform allows, and never plays
  // over the player's own music". The session takes effect only when it is set before the context.
  it('sets the ambient session before the AudioContext exists', () => {
    const api = jest.requireMock<{ AudioContext: new () => object }>('react-native-audio-api');
    const order: string[] = [];
    const libraryContext = api.AudioContext;
    AudioManager.setAudioSessionOptions.mockImplementationOnce(() => order.push('session'));
    const created = jest.spyOn(api, 'AudioContext').mockImplementation(() => {
      order.push('context');
      return Reflect.construct(libraryContext, []);
    });
    createAudioApiAudioAdapter({ reportError: jest.fn() }).load({});
    created.mockRestore();
    expect(order).toStrictEqual(['session', 'context']);
  });

  it('stops cancelled cues and frees them, so the next move can schedule the sound again', () => {
    const start = jest.spyOn(AudioBufferSourceNode.prototype, 'start');
    const stop = jest.spyOn(AudioBufferSourceNode.prototype, 'stop');
    const audio = createAudioApiAudioAdapter({ reportError: jest.fn() });
    audio.load(TAP_BANK);
    audio.play('ui.tap', 300);
    audio.play('ui.tap', 300); // the same start again: dropped by the repeat rule
    audio.cancelPending();
    audio.play('ui.tap', 300);
    expect(start).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('ignores play, music and settings calls before anything is loaded', async () => {
    const audio = createAudioApiAudioAdapter({ reportError: jest.fn() });
    audio.play('ui.tap');
    audio.startMusic('ui.win');
    audio.applySettings(DEFAULT_AUDIO_SETTINGS);
    audio.stopMusic();
    await expect(audio.dispose()).resolves.toBeUndefined();
  });
});
