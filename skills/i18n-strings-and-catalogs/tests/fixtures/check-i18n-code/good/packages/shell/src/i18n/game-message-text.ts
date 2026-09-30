// packages/shell/src/i18n/game-message-text.ts
import { asGameKey } from './messages.ts';

import type { TFunction } from './create-t.ts';

/**
 * A text the game module hands to the Shell: the game-kit contract's Message ({ id, values }) or a
 * bare MessageId ({ id }). Ids are plain strings there, because pure game code cannot import the
 * Shell's branded key type.
 */
export type GameMessage = {
  readonly id: string;
  readonly values?: Readonly<Record<string, number | string>>;
};

/**
 * The one place a game's MessageId becomes a key t() accepts. Each game's contract test proves that
 * every id it hands over exists in all four catalogs, so no other Shell code builds or casts a game
 * key. The game host wires it as RunText.gameText = (message) => gameMessageText(t, message).
 */
export function gameMessageText(t: TFunction, message: GameMessage): string {
  const key = asGameKey(message.id);
  return message.values === undefined ? t(key) : t(key, message.values);
}
