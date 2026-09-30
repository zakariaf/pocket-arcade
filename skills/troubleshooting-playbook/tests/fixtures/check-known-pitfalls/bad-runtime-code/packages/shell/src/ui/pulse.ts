// packages/shell/src/ui/pulse.ts
import { runOnJS, useSharedValue } from 'react-native-reanimated';

export function usePulse(onDone: () => void): () => void {
  const scale = useSharedValue(1);
  return () => {
    scale.value = scale.value + 1;
    runOnJS(onDone)();
  };
}
