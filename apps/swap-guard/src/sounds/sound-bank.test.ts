// apps/swap-guard/src/sounds/sound-bank.test.ts
import {
  MAX_EFFECT_MS,
  MAX_MUSIC_MS,
  recipeProblems,
} from '@e07/shell/services/audio/synth/recipe-problems.ts';
import { buildTimeline } from '@e07/swap-guard/board/build-timeline.ts';

import { SOUND_BANK } from './sound-bank.ts';

import type { SoundRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';
import type { SwapGuardEvent } from '@e07/swap-guard/rules/swap-guard-types.ts';

/** One of every event the rules emit, so every cue the board can play shows up. */
const EVERY_EVENT: readonly SwapGuardEvent[] = [
  { kind: 'pieces-swapped', from: 22, to: 17, enemyId: 1 },
  { kind: 'strikes-landed', strikes: [{ enemyId: 0, cells: [22] }] },
  { kind: 'enemies-defeated', enemyIds: [0], cells: [22] },
  { kind: 'guard-hit', cell: 17, enemyIds: [3] },
  { kind: 'swap-reversed', from: 17, to: 22, enemyId: 1, restoredIds: [0] },
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
    expect(Object.keys(SOUND_BANK).sort()).toStrictEqual(['hit', 'strike', 'swap']);
  });

  it('keeps the swap, played on every move, the quietest sound', () => {
    const swap = peakGain(SOUND_BANK['swap']?.recipe ?? []);
    const others = Object.entries(SOUND_BANK)
      .filter(([id]) => id !== 'swap')
      .map(([, spec]) => peakGain(spec.recipe));
    expect(others.every((gain) => gain > swap)).toBe(true);
  });

  it('keeps every sound an effect, so Swap Guard has no music and hides the Music rows (spec 8.7, lead decision L1)', () => {
    expect(Object.values(SOUND_BANK).filter((spec) => spec.category !== 'sfx')).toStrictEqual([]);
  });
});
