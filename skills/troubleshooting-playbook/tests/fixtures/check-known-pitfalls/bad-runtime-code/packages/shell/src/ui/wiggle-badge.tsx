// A loop whose props only declare an optional reduce-motion flag it never tests: the capture never settles.
import { useEffect } from 'react';
import { useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

type WiggleBadgeProps = { readonly isReducedMotion?: boolean };

export function useWiggleBadge(props: WiggleBadgeProps): { readonly value: number; readonly props: WiggleBadgeProps } {
  const angle = useSharedValue(0);
  useEffect(() => {
    angle.set(withRepeat(withTiming(4, { duration: 400 }), -1, true));
  }, [angle]);
  return { value: angle.get(), props };
}
