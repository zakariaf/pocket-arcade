import { useEffect } from 'react';
import { AppState } from 'react-native';

export function useAppActive(onActive: () => void): void {
  useEffect(() => {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') onActive();
    });
  }, [onActive]);
}
