// packages/shell/src/navigation/use-hardware-back.ts
// Android's system back (the back button and the back gesture) reaches JavaScript as one
// 'hardwareBackPress' event. React Navigation's container listens to it and calls goBack(), so on a
// route the system back already does what the Back control does (and on Game, usePreventRemove turns
// it into Pause). What lies above the navigator, an S14 dialog, takes the press with this hook: its
// handler runs instead of goBack() and the screen behind stays (spec 5). BackHandler asks the newest
// listener first, so the one open dialog answers before the container. iOS has no system back: there
// the listener is never called.
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

/** While mounted with a handler, the system back runs `onBack` and goes no further; null leaves it. */
export function useHardwareBack(onBack: (() => void) | null): void {
  // Allowed effect: subscribes to an outside system (the system back), returns the unsubscribe.
  useEffect(() => {
    if (onBack === null) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => {
      subscription.remove();
    };
  }, [onBack]);
}
