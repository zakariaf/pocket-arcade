// packages/shell/src/services/audio/compose-sound-bank.ts
import { UI_SOUNDS } from './synth/ui-sounds.ts';

import type { SoundBank, SoundSpec } from './audio-port.ts';

/** The Shell's menu sounds as a bank: category 'ui', so they follow the Sound effects setting. */
export const UI_SOUND_BANK: SoundBank = Object.fromEntries(
  Object.entries(UI_SOUNDS).map(([id, recipe]): [string, SoundSpec] => [
    id,
    { category: 'ui', recipe },
  ]),
);

/**
 * The one bank the composition root passes to AudioPort.load: the Shell's UI sounds plus the
 * game's SOUND_BANK. A game id in the Shell's `ui.` namespace would silently replace a menu sound,
 * so it throws instead.
 */
export function composeSoundBank(gameBank: SoundBank): SoundBank {
  const clashes = Object.keys(gameBank).filter(
    (id) => id.startsWith('ui.') || Object.hasOwn(UI_SOUND_BANK, id),
  );
  if (clashes.length > 0)
    throw new Error(`Game sound ids use the Shell's ui. namespace: ${clashes.join(', ')}`);
  return { ...UI_SOUND_BANK, ...gameBank };
}
