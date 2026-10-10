// packages/shell/src/screens/game/use-run-text.ts
// How the Game screen turns run data into text (the same RunText Pause builds): the Shell's t(),
// numbers in the chosen digits, and the game's own messages through gameMessageText.
import { createNumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';
import { localeTagFor } from '@e07/shell/i18n/digits.ts';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useLanguage } from '@e07/shell/i18n/language-context.tsx';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import type { RunText } from '@e07/shell/game-host/top-bar-model.ts';

export function useRunText(): RunText {
  const t = useT();
  const digits = useSettingsStore((state) => state.settings.digits);
  const formatNumber = createNumberFormatter(localeTagFor(useLanguage(), digits));
  return { t, formatNumber, gameText: (message) => gameMessageText(t, message) };
}
