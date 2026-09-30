import { useReducedMotion } from 'react-native-reanimated';

export function useFadeMs(): number {
  return useReducedMotion() ? 0 : 150;
}
