// apps/jump-chain/src/sounds/sound-bank.test.ts
// Spec 8.7: every meaningful event has a short synthesised sound; no music (L1).
import { buildTimeline } from '@e07/jump-chain/board/build-timeline.ts';
import {
  MAX_EFFECT_MS,
  MAX_MUSIC_MS,
  recipeProblems,
} from '@e07/shell/services/audio/synth/recipe-problems.ts';
import { synthesizeRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';

import { SOUND_BANK } from './sound-bank.ts';

import type { JumpChainEvent } from '@e07/jump-chain/rules/jump-chain-types.ts';

/** One of every event the rules emit, so every cue the board can play shows up. */
const EVERY_EVENT: readonly JumpChainEvent[] = [
  { kind: 'piece-stepped', from: { col: 3, row: 7 }, to: { col: 2, row: 6 } },
  { kind: 'piece-jumped', from: { col: 2, row: 6 }, to: { col: 0, row: 4 }, enemyId: 0, jump: 1 },
  { kind: 'enemies-captured', enemyIds: [0], chain: 1, points: 10 },
  { kind: 'rank-cleared', rank: 0, points: 50 },
  { kind: 'ranks-advanced', shifts: [{ enemyId: 1, col: 1, fromRow: 7, toRow: 9 }] },
  { kind: 'rank-spawned', rank: 2, enemies: [{ id: 2, rank: 2, col: 3, row: -1 }] },
  { kind: 'side-reached', enemyIds: [1] },
  { kind: 'ranks-stepped-back', shifts: [{ enemyId: 1, col: 1, fromRow: 9, toRow: 7 }] },
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
    expect(Object.keys(SOUND_BANK).sort()).toStrictEqual([
      'capture',
      'clear',
      'march',
      'overrun',
      'step',
    ]);
  });

  it('makes the most repeated sound, the step, the quietest', () => {
    const others = ['capture', 'clear', 'march', 'overrun'].map(peakOf);
    expect(peakOf('step')).toBeLessThan(Math.min(...others));
  });

  it('keeps every sound an effect, so Jump Chain has no music and hides the Music rows (spec 8.7, lead decision L1)', () => {
    expect(Object.values(SOUND_BANK).filter((spec) => spec.category !== 'sfx')).toStrictEqual([]);
  });
});
