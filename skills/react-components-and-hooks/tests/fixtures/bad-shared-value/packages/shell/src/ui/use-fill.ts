import { useSharedValue } from 'react-native-reanimated';

export function useFill(): () => void {
  const progress = useSharedValue(0);
  return () => {
    progress.value = 1;
  };
}
