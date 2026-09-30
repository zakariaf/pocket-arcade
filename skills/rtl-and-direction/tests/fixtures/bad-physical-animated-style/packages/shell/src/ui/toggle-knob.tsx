import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export type ToggleKnobProps = { readonly progress: SharedValue<number> };

// Planted bug: the knob is pushed with a physical margin, so it slides the wrong way in fa/ckb.
export function ToggleKnob({ progress }: ToggleKnobProps): ReactNode {
  const knobStyle = useAnimatedStyle(() => ({
    marginLeft: withTiming(progress.get() * 20),
  }));
  return <Animated.View style={knobStyle} />;
}
