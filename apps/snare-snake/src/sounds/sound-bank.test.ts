// apps/snare-snake/src/sounds/sound-bank.test.ts
import {
  MAX_EFFECT_MS,
  MAX_MUSIC_MS,
  recipeProblems,
} from '@e07/shell/services/audio/synth/recipe-problems.ts';
import { buildTimeline } from '@e07/snare-snake/board/build-timeline.ts';

import { SOUND_BANK } from './sound-bank.ts';

import type { SoundRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';
import type { SnareSnakeEvent } from '@e07/snare-snake/rules/snare-snake-types.ts';

/** One of every event the rules emit, so every cue the board can play shows up. */
const EVERY_EVENT: readonly SnareSnakeEvent[] = [
  { kind: 'snake-moved', from: 10, to: 11, vacated: 6, length: 5 },
  { kind: 'loop-closed', loop: [11, 12, 17, 16, 11], enclosed: [], spent: 4, length: 4 },
  { kind: 'critters-caught', critterIds: [1, 2], cells: [13, 14], count: 2, points: 20 },
  { kind: 'critters-moved', hops: [{ critterId: 3, from: 20, to: 21 }] },
  { kind: 'bonus-added', points: 30, total: 50 },
  { kind: 'snake-stepped-back', from: 11, to: 10, length: 5 },
  { kind: 'moves-added', count: 3 },
];

/** The loudest layer gain of a recipe. */
function peakGain(recipe: SoundRecipe): number {
  return Math.max(...recipe.map((layer) => layer.gain));
}

describe('SOUND_BANK', () => {
  it.each(Object.entries(SOUND_BANK))('renders %s as a clean, click-free sound', (_id, spec) => {
    const limit = spec.category === 'music' ? MAX_MUSIC_MS : MAX_EFFECT_MS;
    expect(recipeProblems(spec.recipe, limit)).toStrictEqual([]);
  });

  it('keeps its ids out of the Shell ui. namespace and in kebab case', () => {
    expect(
      Object.keys(SOUND_BANK).filter((id) => !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id)),
    ).toStrictEqual([]);
  });

  it('holds exactly the sounds the board cues, no more and no fewer', () => {
    const cued = buildTimeline(EVERY_EVENT, 'full').flatMap((track) =>
      track.cue?.sound === undefined ? [] : [track.cue.sound],
    );
    expect([...new Set(cued)].sort()).toStrictEqual(Object.keys(SOUND_BANK).sort());
    expect(Object.keys(SOUND_BANK).sort()).toStrictEqual(['bonus', 'catch', 'loop', 'step']);
  });

  it('keeps the step, played on every move, the quietest sound', () => {
    const step = peakGain(SOUND_BANK['step']?.recipe ?? []);
    const others = Object.entries(SOUND_BANK)
      .filter(([id]) => id !== 'step')
      .map(([, spec]) => peakGain(spec.recipe));
    expect(others.every((gain) => gain > step)).toBe(true);
  });

  it('keeps every sound an effect, so Snare Snake has no music and hides the Music rows (spec 8.7, lead decision L1)', () => {
    expect(Object.values(SOUND_BANK).filter((spec) => spec.category !== 'sfx')).toStrictEqual([]);
  });
});
