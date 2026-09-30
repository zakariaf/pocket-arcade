// packages/shell/src/ui/pulse.ts
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export function usePulse(onDone: () => void): () => void {
  const scale = useSharedValue(1);
  return () => {
    scale.set(scale.get() + 1);
    scheduleOnRN(onDone);
  };
}
