// apps/flock-tilt/src/sounds/sound-bank.test.ts
import { buildTimeline } from '@e07/flock-tilt/board/build-timeline.ts';
import {
  MAX_EFFECT_MS,
  MAX_MUSIC_MS,
  recipeProblems,
} from '@e07/shell/services/audio/synth/recipe-problems.ts';
import { synthesizeRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';

import { SOUND_BANK } from './sound-bank.ts';

import type { FlockTiltEvent } from '@e07/flock-tilt/rules/flock-tilt-types.ts';

/** One of every event the rules emit, so every cue the board can play shows up. */
const EVERY_EVENT: readonly FlockTiltEvent[] = [
  {
    kind: 'animals-slid',
    direction: 'left',
    slides: [
      { animal: 'sheep', id: 0, from: 31, to: 29, stoppedBy: 'pen' },
      { animal: 'wolf', id: 0, from: 46, to: 42, stoppedBy: 'fence' },
    ],
  },
  { kind: 'sheep-penned', id: 0, cell: 29 },
  { kind: 'sheep-lost', id: 1, cell: 4, wolfId: 0, wolfCell: 5 },
  { kind: 'field-cleared', tilts: 4, par: 4 },
  { kind: 'tilts-ran-out', tilts: 40 },
  { kind: 'tilt-taken-back', tiltsAdded: 10 },
];

/** The loudest sample of a sound as the phone renders it. */
function peakOf(id: string): number {
  const spec = SOUND_BANK[id];
  if (spec === undefined) throw new Error(`no sound ${id}`);
  return synthesizeRecipe(spec.recipe, 48_000).reduce(
    (peak, sample) => Math.max(peak, Math.abs(sample)),
    0,
  );
}

describe('SOUND_BANK (spec 8.7)', () => {
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
    expect(Object.keys(SOUND_BANK).sort()).toStrictEqual(['bleat', 'bump', 'pen', 'tilt']);
  });

  it('makes the tilt, heard on every move, the quietest sound', () => {
    const others = ['bump', 'pen', 'bleat'].map(peakOf);
    expect(peakOf('tilt')).toBeLessThan(Math.min(...others));
  });

  it('keeps every sound an effect, so Flock Tilt has no music and hides the Music rows (spec 8.7, L1)', () => {
    expect(Object.values(SOUND_BANK).filter((spec) => spec.category !== 'sfx')).toStrictEqual([]);
  });
});
