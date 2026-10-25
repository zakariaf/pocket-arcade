// apps/trail-clear/src/sounds/sound-bank.test.ts
// Spec 8.7: every meaningful event has a short synthesised sound; no music (L1).
import {
  MAX_EFFECT_MS,
  MAX_MUSIC_MS,
  recipeProblems,
} from '@e07/shell/services/audio/synth/recipe-problems.ts';
import { synthesizeRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';
import { buildTimeline } from '@e07/trail-clear/board/build-timeline.ts';

import { SOUND_BANK } from './sound-bank.ts';

import type { TrailClearEvent } from '@e07/trail-clear/rules/trail-clear-types.ts';

/** One of every event the rules emit, so every cue the board can play shows up. */
const EVERY_EVENT: readonly TrailClearEvent[] = [
  { kind: 'tile-placed', tile: 'ford', turns: 0, cell: 12 },
  { kind: 'loop-closed', terrain: 'road', cells: [7, 12], points: 40 },
  { kind: 'loop-closed', terrain: 'river', cells: [12, 17], points: 40 },
  { kind: 'double-closed', bonus: 80 },
  { kind: 'tiles-wiped', cells: [7, 12, 17] },
  { kind: 'score-added', points: 160, total: 160 },
  { kind: 'tile-dealt', tile: 'bridge' },
  { kind: 'rows-cleared', rows: [0], cells: [1, 3] },
];

function peakOf(id: string): number {
  const spec = SOUND_BANK[id];
  if (spec === undefined) return Number.NaN;
  return Math.max(...Array.from(synthesizeRecipe(spec.recipe, 44_100), Math.abs));
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
    expect(Object.keys(SOUND_BANK).sort()).toStrictEqual(['double', 'loop', 'place', 'wipe']);
  });

  it('makes the most repeated sound, the placement, the quietest', () => {
    const others = ['loop', 'double', 'wipe'].map(peakOf);
    expect(peakOf('place')).toBeLessThan(Math.min(...others));
  });

  it('keeps every sound an effect, so Trail Clear has no music and hides the Music rows (spec 8.7, lead decision L1)', () => {
    expect(Object.values(SOUND_BANK).filter((spec) => spec.category !== 'sfx')).toStrictEqual([]);
  });
});
