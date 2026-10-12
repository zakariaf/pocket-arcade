// packages/shell/src/app/use-announce.ts
import { AccessibilityInfo } from 'react-native';
import { useStore } from 'zustand';

import { systemA11yStore } from './system-a11y-store.ts';

/** Returns announce(text): speaks through VoiceOver only when VoiceOver is running. */
export function useAnnounce(): (text: string) => void {
  const isScreenReaderOn = useStore(systemA11yStore, (state) => state.isScreenReaderOn);
  return (text) => {
    if (isScreenReaderOn) AccessibilityInfo.announceForAccessibility(text);
  };
}
