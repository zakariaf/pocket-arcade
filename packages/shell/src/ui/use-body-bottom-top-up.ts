// packages/shell/src/ui/use-body-bottom-top-up.ts
import { use } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { LAYOUT } from '@e07/shell/theme/tokens.ts';

/** Under the home indicator: max(34, inset). Otherwise ScreenFrame insets it; top up to 34. */
export function bodyBottomPaddingOf(isUnderHomeIndicator: boolean, insetBottom: number): number {
  return isUnderHomeIndicator
    ? Math.max(LAYOUT.bodyPaddingBottom, insetBottom)
    : Math.max(0, LAYOUT.bodyPaddingBottom - insetBottom);
}

/**
 * What a page that is not a ScreenBody keeps under its last block beyond the bottom inset, so it ends
 * 34 pt above the screen's edge as every Toybox page does: 0 above the iPhone's 34 pt home
 * indicator, 10 above Android's 24 dp gesture bar (the startup splash).
 */
export function useBodyBottomTopUp(): number {
  const insetBottom = use(SafeAreaInsetsContext)?.bottom ?? 0;
  return bodyBottomPaddingOf(false, insetBottom);
}
