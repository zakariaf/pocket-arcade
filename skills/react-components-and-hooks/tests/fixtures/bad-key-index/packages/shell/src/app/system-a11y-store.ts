// packages/shell/src/app/system-a11y-store.ts
import { AccessibilityInfo } from 'react-native';
import { createStore } from 'zustand/vanilla';

export type SystemA11yState = {
  readonly isReduceMotionOn: boolean;
  readonly isScreenReaderOn: boolean;
};

/** Mirror of the OS accessibility switches. Not persisted; filled by watchSystemA11y(). */
export const systemA11yStore = createStore<SystemA11yState>()(() => ({
  isReduceMotionOn: false,
  isScreenReaderOn: false,
}));

function setMotion(isOn: boolean): void {
  systemA11yStore.setState({ isReduceMotionOn: isOn });
}

function setReader(isOn: boolean): void {
  systemA11yStore.setState({ isScreenReaderOn: isOn });
}

/** Starts listening; returns the unsubscribe function. Call once from ShellProviders. */
export function watchSystemA11y(onError: (error: unknown) => void): () => void {
  const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setMotion);
  const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
  AccessibilityInfo.isReduceMotionEnabled().then(setMotion).catch(onError);
  AccessibilityInfo.isScreenReaderEnabled().then(setReader).catch(onError);
  return () => {
    motion.remove();
    reader.remove();
  };
}
