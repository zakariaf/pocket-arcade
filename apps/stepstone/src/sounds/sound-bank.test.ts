// apps/stepstone/src/sounds/sound-bank.test.ts
// Spec 8.7: every meaningful event has a short synthesised sound, and there is no music (L1).
import {
  MAX_EFFECT_MS,
  MAX_MUSIC_MS,
  recipeProblems,
} from '@e07/shell/services/audio/synth/recipe-problems.ts';
import { buildTimeline } from '@e07/stepstone/board/build-timeline.ts';

import { SOUND_BANK } from './sound-bank.ts';

import type { SoundRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';
import type { StepstoneEvent } from '@e07/stepstone/rules/stepstone-types.ts';

/** One of every event the rules emit, so every cue the board can play shows up. */
const EVERY_EVENT: readonly StepstoneEvent[] = [
  { kind: 'player-stepped', from: 2, to: 12, moveKind: 'rook', kindsUsed: 2 },
  { kind: 'stone-sank', cell: 2, stone: 'rook' },
  { kind: 'move-kind-changed', cell: 12, from: 'rook', to: 'king', isNewKind: true },
  { kind: 'goal-reached', cell: 14, moves: 3, par: 3 },
  { kind: 'frog-stranded', cell: 4 },
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
    expect(Object.keys(SOUND_BANK).sort()).toStrictEqual([
      'hop',
      'kind-change',
      'sink',
      'stuck',
      'win',
    ]);
  });

  it('makes the hop, the most repeated sound, the quietest', () => {
    const hop = peakGain(SOUND_BANK['hop']?.recipe ?? []);
    const others = Object.entries(SOUND_BANK).filter(([id]) => id !== 'hop');
    expect(others.every(([, spec]) => peakGain(spec.recipe) >= hop)).toBe(true);
  });

  it('keeps every sound an effect, so Stepstone has no music and hides the Music rows (L1)', () => {
    expect(Object.values(SOUND_BANK).filter((spec) => spec.category !== 'sfx')).toStrictEqual([]);
  });
});
