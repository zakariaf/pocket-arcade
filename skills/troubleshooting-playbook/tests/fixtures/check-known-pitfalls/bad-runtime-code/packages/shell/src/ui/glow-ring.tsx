// A loop whose only reduce-motion check is commented out: the capture never settles.
import { useEffect } from 'react';
import { useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

export function useGlowRing(): { readonly value: number } {
  const glow = useSharedValue(0);
  useEffect(() => {
    // if (isReducedMotion) return;
    glow.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
  }, [glow]);
  return { value: glow.get() };
}
