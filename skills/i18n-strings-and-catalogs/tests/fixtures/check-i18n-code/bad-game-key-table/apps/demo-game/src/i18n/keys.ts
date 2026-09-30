import { asGameKey } from '@e07/shell/i18n/messages.ts';

// Planted bug: a branded table bypasses gameMessageText.
export const GAME_TEXT_KEYS = { name: asGameKey('demo-game.name') } as const;
