// apps/merge-siege/src/sounds/sound-bank.test.ts
import { buildTimeline } from '@e07/merge-siege/board/build-timeline.ts';
import {
  MAX_EFFECT_MS,
  MAX_MUSIC_MS,
  recipeProblems,
} from '@e07/shell/services/audio/synth/recipe-problems.ts';

import { SOUND_BANK } from './sound-bank.ts';

import type { MergeSiegeEvent } from '@e07/merge-siege/rules/merge-siege-types.ts';

/** One of every event the rules emit, so every cue the board can play shows up. */
const EVERY_EVENT: readonly MergeSiegeEvent[] = [
  { kind: 'tiles-slid', steps: [{ id: 3, from: 20, to: 0 }] },
  { kind: 'tiles-merged', merges: [{ id: 4, intoId: 2, cell: 25, value: 8 }] },
  { kind: 'enemies-smashed', phase: 'slide', smashes: [{ id: 1, tileId: 3, cell: 5, value: 2 }] },
  { kind: 'tiles-lost', phase: 'slide', losses: [{ id: 6, enemyId: 7, cell: 11, value: 2 }] },
  { kind: 'enemies-marched', steps: [{ id: 7, from: 2, to: 7 }] },
  { kind: 'enemy-entered', id: 9, cell: 3, value: 4 },
  { kind: 'tile-spawned', id: 10, cell: 24, value: 2 },
  { kind: 'enemies-pushed-back', steps: [{ id: 7, from: 7, to: 2 }], drivenOff: [] },
  { kind: 'score-added', points: 28, total: 28 },
];

/** Loudness stand-in: the summed layer gains of a sound. */
const loudnessOf = (id: string): number =>
  (SOUND_BANK[id]?.recipe ?? []).reduce((sum, layer) => sum + layer.gain, 0);

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
      'crack',
      'enter',
      'march',
      'merge',
      'slide',
      'smash',
    ]);
  });

  it('makes the slide, heard on every swipe, the quietest sound', () => {
    const others = Object.keys(SOUND_BANK).filter((id) => id !== 'slide');
    expect(others.every((id) => loudnessOf(id) > loudnessOf('slide'))).toBe(true);
  });

  it('keeps every sound an effect, so Merge Siege has no music and hides the Music rows (spec 8.7, lead decision L1)', () => {
    expect(Object.values(SOUND_BANK).filter((spec) => spec.category !== 'sfx')).toStrictEqual([]);
  });
});
