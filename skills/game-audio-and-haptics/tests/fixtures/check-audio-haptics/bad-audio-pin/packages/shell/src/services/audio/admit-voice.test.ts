// packages/shell/src/services/audio/admit-voice.test.ts
import { EMPTY_VOICES, MAX_VOICES, admitVoice, channelGain, releaseVoices } from './admit-voice.ts';

import type { VoiceState } from './admit-voice.ts';

const tap = (atMs: number) => ({
  soundId: 'tap',
  atMs,
  durationMs: 50,
  minIntervalMs: 30,
  nowMs: 1000,
});

/** Admits `count` different sounds starting at `atMs`; returns the state. */
function fill(count: number, atMs: number): VoiceState {
  let state = EMPTY_VOICES;
  for (let i = 0; i < count; i += 1)
    state = admitVoice(state, { ...tap(atMs), soundId: `s${String(i)}` }).state;
  return state;
}

describe('voice policy', () => {
  it('drops a repeat of the same sound inside its minimum interval', () => {
    const first = admitVoice(EMPTY_VOICES, tap(1000));
    expect(admitVoice(first.state, tap(1010)).isAdmitted).toBe(false);
    expect(admitVoice(first.state, tap(1031)).isAdmitted).toBe(true);
  });

  it('judges cues scheduled out of order by their distance, not their order', () => {
    const later = admitVoice(EMPTY_VOICES, tap(1600));
    expect(admitVoice(later.state, tap(1000)).isAdmitted).toBe(true);
    expect(admitVoice(later.state, tap(1590)).isAdmitted).toBe(false);
  });

  it('caps polyphony at MAX_VOICES overlapping voices', () => {
    const state = fill(MAX_VOICES, 1000);
    expect(admitVoice(state, { ...tap(1001), soundId: 'extra' }).isAdmitted).toBe(false);
    expect(admitVoice(state, { ...tap(1100), soundId: 'extra' }).isAdmitted).toBe(true);
  });

  it('does not count voices scheduled after the new one has ended', () => {
    const state = fill(MAX_VOICES, 1500);
    expect(admitVoice(state, { ...tap(1000), soundId: 'now' }).isAdmitted).toBe(true);
  });

  it('frees the voices a cancel released, so the next move sounds again', () => {
    const pending = admitVoice(EMPTY_VOICES, tap(1300));
    expect(admitVoice(pending.state, tap(1300)).isAdmitted).toBe(false);
    const released = releaseVoices(pending.state, [pending.voice]);
    expect(admitVoice(released, tap(1300)).isAdmitted).toBe(true);
  });

  it('maps an off channel to silence and squares the slider', () => {
    expect(channelGain({ isOn: false, volume: 1 })).toBe(0);
    expect(channelGain({ isOn: true, volume: 0.5 })).toBe(0.25);
  });
});
