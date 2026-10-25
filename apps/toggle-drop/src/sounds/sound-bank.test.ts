// apps/toggle-drop/src/sounds/sound-bank.test.ts
import {
  MAX_EFFECT_MS,
  MAX_MUSIC_MS,
  RECIPE_TEST_RATE,
  recipeProblems,
} from '@e07/shell/services/audio/synth/recipe-problems.ts';
import { synthesizeRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';
import { buildTimeline } from '@e07/toggle-drop/board/build-timeline.ts';

import { SOUND_BANK } from './sound-bank.ts';

import type { ToggleDropEvent } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

/** One of every event the rules emit (a landing in a cup and one in the gutter), so every cue shows. */
const EVERY_EVENT: readonly ToggleDropEvent[] = [
  { kind: 'ball-dropped', col: 1, x: 180, y: 0, atMs: 0 },
  { kind: 'switch-flipped', col: 1, row: 0, side: 1, x: 180, y: 120, atMs: 167 },
  { kind: 'ball-passed', col: 2, row: 1, x: 300, y: 240, atMs: 333 },
  { kind: 'ball-landed', col: 2, x: 300, y: 360, isInCup: true, wasRedirected: true, atMs: 500 },
  { kind: 'cup-filled', col: 2, atMs: 500 },
  { kind: 'ball-landed', col: 3, x: 420, y: 360, isInCup: false, wasRedirected: false, atMs: 700 },
];

/** The loudest sample of a sound as the synth renders it. */
function peakOf(id: string): number {
  const spec = SOUND_BANK[id];
  if (spec === undefined) return 0;
  return Math.max(...synthesizeRecipe(spec.recipe, RECIPE_TEST_RATE).map(Math.abs));
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
    expect(Object.keys(SOUND_BANK).sort()).toStrictEqual([
      'catch',
      'click',
      'cup',
      'drop',
      'gutter',
    ]);
  });

  it('makes the switch click, heard most often in a drop, the quietest sound', () => {
    const others = Object.keys(SOUND_BANK).filter((id) => id !== 'click');
    expect(others.every((id) => peakOf(id) > peakOf('click'))).toBe(true);
  });

  it('keeps every sound an effect, so Toggle Drop has no music and hides the Music rows (spec 8.7, lead decision L1)', () => {
    expect(Object.values(SOUND_BANK).filter((spec) => spec.category !== 'sfx')).toStrictEqual([]);
  });
});
