// packages/shell/src/app/connect-audio-settings.test.ts
import { createFakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';
import { planLoad } from '@e07/shell/services/save/load-plan.ts';
import { createSaveService } from '@e07/shell/services/save/save-service.ts';
import { createSettingsStore } from '@e07/shell/stores/settings-store.ts';

import { connectAudioSettings, toAudioSettings } from './connect-audio-settings.ts';

import type { AudioPort, AudioSettings } from '@e07/shell/services/audio/audio-port.ts';

function createRecordingAudio(): AudioPort & {
  readonly applied: AudioSettings[];
  readonly stops: number[];
} {
  const applied: AudioSettings[] = [];
  const stops: number[] = [];
  const noop = (): void => undefined;
  const done = (): Promise<void> => Promise.resolve();
  return {
    applied,
    stops,
    load: noop,
    play: noop,
    cancelPending: noop,
    applySettings: (settings) => applied.push(settings),
    startMusic: noop,
    stopMusic: () => stops.push(applied.length),
    suspend: done,
    resume: done,
    dispose: done,
  };
}

function setup(): { readonly store: ReturnType<typeof createSettingsStore> } {
  const plan = planLoad({ current: null, backup: null, gameId: 'line-siege' });
  const deps = {
    store: createFakeSaveStore(),
    clock: { nowMs: () => 1_790_000_000_000, today: () => '2026-09-26' },
    errorLog: { record: jest.fn(), entries: () => [] },
    appVersion: '1.0.0',
    isStrict: true,
  };
  const save = createSaveService(deps, plan, 0);
  save.applyLoadWrites();
  return { store: createSettingsStore(save) };
}

describe('connectAudioSettings', () => {
  it('scales the saved percent to the 0..1 volume the audio port takes', () => {
    const { store } = setup();
    expect(toAudioSettings(store.getState().settings)).toStrictEqual({
      effects: { isOn: true, volume: 0.8 },
      music: { isOn: false, volume: 0.6 },
    });
  });

  it('applies the saved settings at once and again after each audio change', () => {
    const { store } = setup();
    const audio = createRecordingAudio();
    connectAudioSettings(store, audio);
    store.getState().dispatch({ type: 'set-sound', enabled: true, volume: 30 });
    expect(audio.applied.map((settings) => settings.effects.volume)).toStrictEqual([0.8, 0.3]);
  });

  it('ignores changes that do not touch audio', () => {
    const { store } = setup();
    const audio = createRecordingAudio();
    connectAudioSettings(store, audio);
    store.getState().dispatch({ type: 'set-theme', theme: 'dark' });
    expect(audio.applied).toHaveLength(1);
  });

  it('stops the music when the Music row is switched off', () => {
    const { store } = setup();
    const audio = createRecordingAudio();
    const disconnect = connectAudioSettings(store, audio);
    store.getState().dispatch({ type: 'set-music', enabled: true, volume: 60 });
    store.getState().dispatch({ type: 'set-music', enabled: false, volume: 60 });
    disconnect();
    store.getState().dispatch({ type: 'set-music', enabled: true, volume: 60 });
    expect(audio.stops).toStrictEqual([3]);
    expect(audio.applied).toHaveLength(3);
  });
});
