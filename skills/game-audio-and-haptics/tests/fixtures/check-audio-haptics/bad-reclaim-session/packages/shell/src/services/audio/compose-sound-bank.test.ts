// packages/shell/src/services/audio/compose-sound-bank.test.ts
import { UI_SOUND_BANK, composeSoundBank } from './compose-sound-bank.ts';

import type { SoundBank } from './audio-port.ts';

const PLACE: SoundBank = {
  place: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 520,
        endHz: 380,
        offsetMs: 0,
        durationMs: 70,
        attackMs: 2,
        gain: 0.5,
      },
    ],
  },
};

describe('composeSoundBank', () => {
  it('loads the Shell UI sounds as the ui category beside the game bank', () => {
    const bank = composeSoundBank(PLACE);
    expect(Object.keys(bank).sort()).toStrictEqual([
      'place',
      'ui.lose',
      'ui.tap',
      'ui.toggle',
      'ui.win',
    ]);
    expect(Object.values(UI_SOUND_BANK).every((spec) => spec.category === 'ui')).toBe(true);
  });

  it('throws when a game sound uses the ui. namespace', () => {
    const recipe = PLACE['place']?.recipe ?? [];
    expect(() => composeSoundBank({ 'ui.tap': { category: 'sfx', recipe } })).toThrow(
      "Game sound ids use the Shell's ui. namespace: ui.tap",
    );
  });
});
