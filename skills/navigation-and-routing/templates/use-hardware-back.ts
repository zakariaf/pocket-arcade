// packages/shell/src/navigation/use-hardware-back.ts
// Android's system back (the back button and the back gesture) reaches JavaScript as one
// 'hardwareBackPress' event. React Navigation's container listens to it and calls goBack(), so on a
// route the system back already does what the Back control does (and on Game, usePreventRemove turns
// it into Pause). What lies above the navigator, an S14 dialog, takes the press with this hook: its
// handler runs instead of goBack() and the screen behind stays (spec 5). iOS has no system back: there
// the listener is never called.
// BackHandler asks the newest listener first, but subscription time is not layer order: a dialog that
// re-subscribes (a new handler) or opens while the S3 cover is up would become newest and answer from
// under the cover. So the order follows the layers: a ModalLayer that is up marks what lies behind it
// as covered (HardwareBackCoverContext), and a covered handler does not listen until it is uncovered.
import { createContext, use, useEffect } from 'react';
import { BackHandler } from 'react-native';

/** True inside what an open layer covers (ModalLayer's `behind`): the system back is not its own. */
export const HardwareBackCoverContext = createContext(false);

/**
 * While mounted with a handler and not covered by an open layer, the system back runs `onBack` and
 * goes no further; null (or a cover) leaves it to the others.
 */
export function useHardwareBack(onBack: (() => void) | null): void {
  const isCovered = use(HardwareBackCoverContext);
  const handler = isCovered ? null : onBack;
  // Allowed effect: subscribes to an outside system (the system back), returns the unsubscribe.
  useEffect(() => {
    if (handler === null) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handler();
      return true;
    });
    return () => {
      subscription.remove();
    };
  }, [handler]);
}
