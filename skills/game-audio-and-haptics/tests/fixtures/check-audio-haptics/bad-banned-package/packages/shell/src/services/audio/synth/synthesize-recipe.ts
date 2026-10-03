// packages/shell/src/services/audio/synth/synthesize-recipe.ts
// Pure synthesis: data in, Float32Array out. Same code on device, in Jest and in the
// Node WAV preview script. Noise is seeded, so every render is byte-identical.
import { nextU32, seedRng } from '@e07/game-kit/rng/sfc32.ts';

export type Wave = 'sine' | 'triangle' | 'square' | 'noise';

/** One layer of a sound: a pitch glide with a linear attack and a quadratic decay. */
export type VoiceSpec = {
  readonly wave: Wave;
  readonly startHz: number;
  readonly endHz: number;
  readonly offsetMs: number;
  readonly durationMs: number;
  readonly attackMs: number;
  /** Peak amplitude 0…1 before mixing. */
  readonly gain: number;
  /** Only for 'noise'. */
  readonly seed?: number;
};

export type SoundRecipe = readonly VoiceSpec[];

type Samples = Float32Array<ArrayBuffer>;

const TWO_PI = 2 * Math.PI;
const FADE_OUT_MS = 6;
const PEAK_LIMIT = 0.9;

function oscillate(wave: Wave, phase: number, noise: number): number {
  switch (wave) {
    case 'sine':
      return Math.sin(TWO_PI * phase);
    case 'triangle':
      return 1 - 4 * Math.abs(phase - Math.floor(phase + 0.5));
    case 'square':
      return phase % 1 < 0.5 ? 0.6 : -0.6;
    case 'noise':
      return noise;
  }
}

type EnvelopeShape = { readonly total: number; readonly attack: number; readonly fade: number };

/** Attack ramp, quadratic decay, and a short fade so the last sample is exactly 0 (no click). */
function envelope(i: number, shape: EnvelopeShape): number {
  const rise = shape.attack > 0 ? Math.min(1, i / shape.attack) : 1;
  const left = (shape.total - i) / shape.total;
  const tail = Math.max(0, Math.min(1, (shape.total - 1 - i) / shape.fade));
  return rise * left * left * tail;
}

function shapeOf(spec: VoiceSpec, sampleRate: number): EnvelopeShape {
  return {
    total: Math.round((spec.durationMs / 1000) * sampleRate),
    attack: (spec.attackMs / 1000) * sampleRate,
    fade: (FADE_OUT_MS / 1000) * sampleRate,
  };
}

/**
 * The voice's samples in order, one call per sample index (0, 1, 2, ...): the pitch glide keeps
 * its phase between calls, and only a noise voice draws from its seeded generator.
 */
function voiceSampler(spec: VoiceSpec, sampleRate: number): (i: number) => number {
  const shape = shapeOf(spec, sampleRate);
  let rng = seedRng(spec.seed ?? 1);
  let phase = 0;
  return (i) => {
    phase += (spec.startHz + (spec.endHz - spec.startHz) * (i / shape.total)) / sampleRate;
    let noise = 0;
    if (spec.wave === 'noise') {
      const draw = nextU32(rng);
      rng = draw.state;
      noise = draw.value / 2147483648 - 1;
    }
    return oscillate(spec.wave, phase, noise) * spec.gain * envelope(i, shape);
  };
}

/**
 * Mixes all voices at their offsets; if layers sum above 0.9 the whole sound is scaled down. Each
 * voice sample is rounded to 32 bits before it is added, as a voice buffer of its own would hold it.
 */
export function synthesizeRecipe(recipe: SoundRecipe, sampleRate: number): Samples {
  const endMs = Math.max(...recipe.map((voice) => voice.offsetMs + voice.durationMs));
  const mix = new Float32Array(Math.round((endMs / 1000) * sampleRate));
  for (const voice of recipe) {
    const start = Math.round((voice.offsetMs / 1000) * sampleRate);
    const end = Math.min(shapeOf(voice, sampleRate).total, mix.length - start);
    const sampleAt = voiceSampler(voice, sampleRate);
    for (let i = 0; i < end; i += 1) {
      mix[start + i] = (mix[start + i] ?? 0) + Math.fround(sampleAt(i));
    }
  }
  let peak = 0;
  for (const sample of mix) peak = Math.max(peak, Math.abs(sample));
  if (peak > PEAK_LIMIT) {
    for (let i = 0; i < mix.length; i += 1) mix[i] = ((mix[i] ?? 0) * PEAK_LIMIT) / peak;
  }
  return mix;
}
