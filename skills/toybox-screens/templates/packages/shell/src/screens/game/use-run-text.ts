// packages/shell/src/screens/game/use-run-text.ts
// How the Game screen and Pause turn run data into text: the Shell's t(), numbers in the chosen
// digits, and the game's own messages through gameMessageText.
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { useNumberFormatter } from '@e07/shell/i18n/use-number-formatter.ts';

import type { RunText } from '@e07/shell/game-host/top-bar-model.ts';

export function useRunText(): RunText {
  const t = useT();
  const formatNumber = useNumberFormatter();
  return { t, formatNumber, gameText: (message) => gameMessageText(t, message) };
}
