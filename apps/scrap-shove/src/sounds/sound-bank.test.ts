// apps/scrap-shove/src/sounds/sound-bank.test.ts
import { buildTimeline } from '@e07/scrap-shove/board/build-timeline.ts';
import { applyMove } from '@e07/scrap-shove/rules/apply-move.ts';
import { stateFromText } from '@e07/scrap-shove/rules/board-text.ts';
import {
  MAX_EFFECT_MS,
  MAX_MUSIC_MS,
  recipeProblems,
} from '@e07/shell/services/audio/synth/recipe-problems.ts';

import { SOUND_BANK } from './sound-bank.ts';

import type { ScrapShoveEvent, ScrapShoveMove } from '@e07/scrap-shove/rules/scrap-shove-types.ts';

function eventsOf(floor: readonly string[], move: ScrapShoveMove): readonly ScrapShoveEvent[] {
  return applyMove(stateFromText(floor), move).events;
}

/** Turns that between them show every event the rules emit, so every cue the board plays shows up. */
const EVERY_TURN: readonly (readonly ScrapShoveEvent[])[] = [
  eventsOf(
    [
      'h......f',
      '........',
      '........',
      '.....n..',
      'h#n#@...',
      '..#..n..',
      '.n......',
      '......n.',
    ],
    { kind: 'shove', col: 3, row: 4 },
  ),
  eventsOf(['.....', '.n...', 'h#..@', '.....', '.....'], { kind: 'wait' }),
  eventsOf(['....', '.n..', '..@.', '....'], { kind: 'wait' }),
  eventsOf(['n.n.', '....', '....', '.@..'], { kind: 'wait' }),
  [{ kind: 'step-reverted' }],
];

/** Peak level of a recipe: the loudest layer's gain (layers that overlap add up in the gate). */
function loudest(id: string): number {
  return Math.max(...(SOUND_BANK[id]?.recipe ?? []).map((voice) => voice.gain));
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

  it('holds exactly the sounds the board cues, no more and no fewer (spec 8.7: a sound for every meaningful event)', () => {
    const cued = EVERY_TURN.flatMap((events) =>
      buildTimeline(events, 'full').flatMap((track) =>
        track.cue?.sound === undefined ? [] : [track.cue.sound],
      ),
    );
    expect([...new Set(cued)].sort()).toStrictEqual(Object.keys(SOUND_BANK).sort());
    expect(Object.keys(SOUND_BANK).sort()).toStrictEqual([
      'caught',
      'crash',
      'crush',
      'robot-step',
      'shove',
      'smash',
      'step',
    ]);
  });

  it('keeps the two sounds of every turn, the steps, the quietest', () => {
    const others = Object.keys(SOUND_BANK).filter((id) => id !== 'step' && id !== 'robot-step');
    const quietest = Math.min(...others.map(loudest));
    expect(Math.max(loudest('step'), loudest('robot-step'))).toBeLessThan(quietest);
  });

  it('keeps every sound an effect, so Scrap Shove has no music and hides the Music rows (spec 8.7, lead decision L1)', () => {
    expect(Object.values(SOUND_BANK).filter((spec) => spec.category !== 'sfx')).toStrictEqual([]);
  });
});
