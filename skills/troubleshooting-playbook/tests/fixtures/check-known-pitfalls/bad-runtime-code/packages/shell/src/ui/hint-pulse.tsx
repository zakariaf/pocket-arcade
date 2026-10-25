// A loop whose file only names 'reduced' in a string it never tests: the parity capture never settles.
import { useEffect } from 'react';
import { useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

export const HINT_PULSE_KIND = 'reduced';

export function useHintPulse(): { readonly value: number } {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.set(withRepeat(withTiming(1.1, { duration: 500 }), -1, true));
  }, [scale]);
  return { value: scale.get() };
}
