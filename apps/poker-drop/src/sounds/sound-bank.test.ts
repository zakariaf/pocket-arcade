// apps/poker-drop/src/sounds/sound-bank.test.ts
import { buildTimeline } from '@e07/poker-drop/board/build-timeline.ts';
import {
  MAX_EFFECT_MS,
  MAX_MUSIC_MS,
  RECIPE_TEST_RATE,
  recipeProblems,
} from '@e07/shell/services/audio/synth/recipe-problems.ts';
import { synthesizeRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';

import { SOUND_BANK } from './sound-bank.ts';

import type { BurstingHand, PokerDropEvent } from '@e07/poker-drop/rules/poker-drop-types.ts';
import type { SoundRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';

const HANDS: readonly BurstingHand[] = [
  'two-pair',
  'three-of-a-kind',
  'straight',
  'flush',
  'full-house',
  'four-of-a-kind',
  'straight-flush',
];

/** One hand of each kind, each leading its own cascade step, so every burst sound is cued. */
const BURSTS: readonly PokerDropEvent[] = HANDS.map((hand, index) => ({
  kind: 'hand-burst',
  step: index + 1,
  hand,
  lineKind: 'row',
  line: [0, 1, 2, 3, 4],
  cells: [0, 1, 2, 3, 4],
  cards: [0, 1, 2, 3, 4],
  points: 20,
  atMs: 400 * index,
}));

/** Every other event the rules emit: a drop, a rise, an overflow, a deal and a continue. */
const OTHERS: readonly PokerDropEvent[] = [
  { kind: 'card-dropped', card: 5, col: 2, fromRow: 6, row: 0, atMs: 0, landMs: 400 },
  { kind: 'row-rose', cards: [6, 7, 8, 9, 10], atMs: 0, landMs: 300 },
  { kind: 'well-overflowed', atMs: 300 },
  { kind: 'card-dealt', hand: 11, next: 12, atMs: 400 },
];
const CONTINUE: readonly PokerDropEvent[] = [
  { kind: 'top-row-cleared', cells: [25, 26], cards: [13, 14], atMs: 0 },
];

function cuedSounds(events: readonly PokerDropEvent[]): string[] {
  return buildTimeline(events, 'full').flatMap((track) =>
    track.cue?.sound === undefined ? [] : [track.cue.sound],
  );
}

function peakOf(recipe: SoundRecipe): number {
  return synthesizeRecipe(recipe, RECIPE_TEST_RATE).reduce(
    (peak, sample) => Math.max(peak, Math.abs(sample)),
    0,
  );
}

describe('SOUND_BANK', () => {
  // spec 8.7: short synthesised sounds for the game's events; no music (lead decision L1).
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
    const cued = [...cuedSounds([...BURSTS, ...OTHERS]), ...cuedSounds(CONTINUE)];
    expect([...new Set(cued)].sort()).toStrictEqual(Object.keys(SOUND_BANK).sort());
    expect(Object.keys(SOUND_BANK).sort()).toStrictEqual([
      'burst-flush',
      'burst-four-of-a-kind',
      'burst-full-house',
      'burst-straight',
      'burst-straight-flush',
      'burst-three-of-a-kind',
      'burst-two-pair',
      'cascade',
      'continue',
      'drop',
      'overflow',
      'rise',
    ]);
  });

  it('makes the drop, the most repeated sound, the quietest and the shortest', () => {
    const drop = SOUND_BANK['drop']?.recipe ?? [];
    const others = Object.entries(SOUND_BANK).filter(([id]) => id !== 'drop');
    const endOf = (recipe: SoundRecipe) =>
      Math.max(...recipe.map((voice) => voice.offsetMs + voice.durationMs));
    expect(others.filter(([, spec]) => peakOf(spec.recipe) <= peakOf(drop))).toStrictEqual([]);
    expect(others.filter(([, spec]) => endOf(spec.recipe) <= endOf(drop))).toStrictEqual([]);
  });

  it('lets a stronger hand sound longer than a weaker one', () => {
    const lengths = HANDS.map((hand) => {
      const recipe = SOUND_BANK[`burst-${hand}`]?.recipe ?? [];
      return Math.max(...recipe.map((voice) => voice.offsetMs + voice.durationMs));
    });
    expect(lengths.slice(1).every((length, index) => length > (lengths[index] ?? 0))).toBe(true);
  });

  it('keeps every sound an effect, so Poker Drop has no music and hides the Music rows (spec 8.7, lead decision L1)', () => {
    expect(Object.values(SOUND_BANK).filter((spec) => spec.category !== 'sfx')).toStrictEqual([]);
  });
});
