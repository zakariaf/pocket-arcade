// A decorative loop that rests while reduce motion is on (true while a parity launch freezes motion).
import { useEffect } from 'react';
import { useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

export function useFlagBob(isReducedMotion: boolean): { readonly value: number } {
  const offset = useSharedValue(0);
  useEffect(() => {
    offset.set(isReducedMotion ? 0 : withRepeat(withTiming(3, { duration: 600 }), -1, true));
  }, [isReducedMotion, offset]);
  return { value: offset.get() };
}
