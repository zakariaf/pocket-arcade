// packages/shell/src/services/audio/audio-api-audio-adapter.ts
// The ONLY file that imports react-native-audio-api (pinned exactly: 0.13.6).
import { AudioContext, AudioManager } from 'react-native-audio-api';

import { synthesizeRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';

import {
  DEFAULT_MIN_INTERVAL_MS,
  EMPTY_VOICES,
  admitVoice,
  channelGain,
  releaseVoices,
} from './admit-voice.ts';

import type { Voice } from './admit-voice.ts';
import type {
  AudioPort,
  AudioSettings,
  SoundBank,
  SoundCategory,
  SoundSpec,
} from './audio-port.ts';
import type {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioEventSubscription,
  GainNode,
} from 'react-native-audio-api';

type Loaded = {
  readonly buffer: AudioBuffer;
  readonly spec: SoundSpec;
  readonly durationMs: number;
};
/** A voice scheduled for later: stopped and released again if its cue is cancelled. */
type Pending = { readonly source: AudioBufferSourceNode; readonly voice: Voice };
type Graph = {
  readonly ctx: AudioContext;
  readonly gains: Readonly<Record<SoundCategory, GainNode>>;
};

const RAMP_S = 0.05;

/** ONE AudioContext per app. The session must be configured BEFORE the context exists. */
function createGraph(): Graph {
  const ctx = new AudioContext();
  AudioManager.setAudioSessionOptions({
    iosCategory: 'ambient',
    iosMode: 'default',
    iosOptions: [],
  });
  const gains = { sfx: ctx.createGain(), ui: ctx.createGain(), music: ctx.createGain() };
  for (const gain of Object.values(gains)) gain.connect(ctx.destination);
  return { ctx, gains };
}

/** Click-free gain change: hold the current value, then ramp linearly for 50 ms. */
function rampTo(ctx: AudioContext, gain: GainNode, value: number): void {
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(value, now + RAMP_S);
}

export type AudioAdapterDeps = {
  /** `(error) => errorLog.record('audio', error)`: logged, never thrown into gameplay. */
  readonly reportError: (error: unknown) => void;
};

class AudioApiAudioAdapter implements AudioPort {
  private readonly reportError: (error: unknown) => void;
  private graph: Graph | null = null;
  private readonly loaded = new Map<string, Loaded>();
  private voices = EMPTY_VOICES;
  private pending: Pending[] = [];
  private music: AudioBufferSourceNode | null = null;
  private interruptions: AudioEventSubscription | null = null;

  constructor(deps: AudioAdapterDeps) {
    this.reportError = deps.reportError;
  }

  readonly load = (bank: SoundBank): void => {
    const graph = this.ensureGraph();
    for (const [id, spec] of Object.entries(bank)) {
      const samples = synthesizeRecipe(spec.recipe, graph.ctx.sampleRate);
      const buffer = graph.ctx.createBuffer(1, samples.length, graph.ctx.sampleRate);
      buffer.copyToChannel(samples, 0, 0);
      this.loaded.set(id, {
        buffer,
        spec,
        durationMs: (samples.length / graph.ctx.sampleRate) * 1000,
      });
    }
  };

  readonly play = (soundId: string, delayMs = 0): void => {
    const item = this.loaded.get(soundId);
    if (item === undefined || this.graph === null) return;
    const nowS = this.graph.ctx.currentTime;
    const startS = nowS + delayMs / 1000;
    const decision = admitVoice(this.voices, {
      soundId,
      atMs: startS * 1000,
      durationMs: item.durationMs,
      minIntervalMs: item.spec.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS,
      nowMs: nowS * 1000,
    });
    this.voices = decision.state;
    this.pending = this.pending.filter((entry) => entry.voice.startMs > nowS * 1000);
    if (!decision.isAdmitted) return;
    const source = this.graph.ctx.createBufferSource();
    source.buffer = item.buffer;
    source.connect(this.graph.gains[item.spec.category]);
    source.start(startS);
    if (delayMs > 0) this.pending.push({ source, voice: decision.voice });
  };

  readonly cancelPending = (): void => {
    const nowMs = (this.graph?.ctx.currentTime ?? 0) * 1000;
    const future = this.pending.filter((entry) => entry.voice.startMs > nowMs);
    for (const { source } of future) source.stop(0);
    // A cancelled voice never sounds: free its slot and its repeat window for the next move.
    this.voices = releaseVoices(
      this.voices,
      future.map((entry) => entry.voice),
    );
    this.pending = [];
  };

  readonly applySettings = (settings: AudioSettings): void => {
    const graph = this.graph;
    if (graph === null) return;
    rampTo(graph.ctx, graph.gains.sfx, channelGain(settings.effects));
    rampTo(graph.ctx, graph.gains.ui, channelGain(settings.effects));
    rampTo(graph.ctx, graph.gains.music, channelGain(settings.music));
  };

  readonly startMusic = (soundId: string): void => {
    const item = this.loaded.get(soundId);
    if (item === undefined || this.graph === null || this.music !== null) return;
    const source = this.graph.ctx.createBufferSource();
    source.buffer = item.buffer;
    source.loop = true;
    source.connect(this.graph.gains.music);
    source.start(this.graph.ctx.currentTime);
    this.music = source;
  };

  readonly stopMusic = (): void => {
    this.music?.stop(0);
    this.music = null;
  };

  readonly suspend = async (): Promise<void> => {
    this.cancelPending();
    await this.graph?.ctx.suspend();
  };

  readonly resume = async (): Promise<void> => {
    await this.graph?.ctx.resume();
  };

  readonly dispose = async (): Promise<void> => {
    this.interruptions?.remove();
    this.stopMusic();
    await this.graph?.ctx.close();
    this.graph = null;
  };

  private ensureGraph(): Graph {
    if (this.graph !== null) return this.graph;
    this.graph = createGraph();
    AudioManager.observeAudioInterruptions(true);
    this.interruptions = AudioManager.addSystemEventListener('interruption', (event) => {
      if (event.type === 'began') this.suspend().catch(this.reportError);
      else if (event.shouldResume) this.resume().catch(this.reportError);
    });
    return this.graph;
  }
}

/** Create exactly ONE per app, in the composition root (one AudioContext per app). */
export function createAudioApiAudioAdapter(deps: AudioAdapterDeps): AudioPort {
  return new AudioApiAudioAdapter(deps);
}
