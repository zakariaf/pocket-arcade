import { useReducedMotion } from 'react-native-reanimated';

export function useShake(): boolean {
  return !useReducedMotion();
}
