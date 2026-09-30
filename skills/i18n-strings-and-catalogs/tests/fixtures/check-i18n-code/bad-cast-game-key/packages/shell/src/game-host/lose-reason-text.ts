import { asGameKey } from '@e07/shell/i18n/messages.ts';

import type { TFunction } from '@e07/shell/i18n/create-t.ts';

// Planted bug: a game MessageId is cast at a call site instead of going through gameMessageText.
export function loseReasonText(t: TFunction, reasonId: string): string {
  return t(asGameKey(reasonId));
}
