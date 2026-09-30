// apps/line-siege/src/sounds/sound-bank.test.ts
import { buildTimeline } from '@e07/line-siege/board/build-timeline.ts';
import {
  MAX_EFFECT_MS,
  MAX_MUSIC_MS,
  recipeProblems,
} from '@e07/shell/services/audio/synth/recipe-problems.ts';

import { SOUND_BANK } from './sound-bank.ts';

import type { LineSiegeEvent } from '@e07/line-siege/rules/line-siege-types.ts';

/** One of every event the rules emit, so every cue the board can play shows up. */
const EVERY_EVENT: readonly LineSiegeEvent[] = [
  { kind: 'block-placed', trayIndex: 0, piece: 0, cells: [0] },
  { kind: 'row-cleared', row: 0 },
  { kind: 'column-cleared', col: 0 },
  { kind: 'beam-fired', lane: 0, targetId: 1 },
  { kind: 'shockwave-sent', rows: 1, damage: 2 },
  { kind: 'monster-hit', monsterId: 1, damage: 8, hpLeft: 0 },
  { kind: 'monster-defeated', monsterId: 1, monsterKind: 'normal', lane: 0, row: 2 },
  { kind: 'monster-moved', monsterId: 2, fromRow: 5, toRow: 6 },
  { kind: 'wall-breached', monsterId: 2, monsterKind: 'fast', lane: 3, heartsLeft: 2 },
  { kind: 'monster-spawned', monsterId: 3, monsterKind: 'armoured', lane: 1, hp: 6 },
  { kind: 'score-added', points: 65, total: 65 },
  { kind: 'tray-refilled', tray: [0, 1, 2] },
  { kind: 'heart-restored', hearts: 1 },
  { kind: 'monsters-pushed-back', rows: 3 },
  { kind: 'rows-emptied', rows: [6, 7] },
];

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
      'beam',
      'breach',
      'hit',
      'place',
      'pop',
      'shock',
    ]);
  });
});
