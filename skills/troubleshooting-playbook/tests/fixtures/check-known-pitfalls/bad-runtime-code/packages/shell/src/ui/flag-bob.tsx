// A decorative loop that never reads reduce motion: the parity capture never settles.
import { useEffect } from 'react';
import { useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

export function useFlagBob(): { readonly value: number } {
  const offset = useSharedValue(0);
  useEffect(() => {
    offset.set(withRepeat(withTiming(3, { duration: 600 }), -1, true));
  }, [offset]);
  return { value: offset.get() };
}
