// packages/shell/src/screens/home/use-home-actions.ts
// S4's navigation, exactly as navigation-and-routing's table says. Every key navigates normally;
// in a partial Shell a route outside shell-slice.json shows NotBuiltScreen (never a no-op).
import { useNavigation } from '@react-navigation/native';

import type { HomeActions } from './home-model.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

export function useHomeActions(onPlay: () => void, today: DateKey): HomeActions {
  const navigation = useNavigation();
  return {
    onPlay,
    onPlayDaily: () => {
      navigation.navigate('Game', { start: 'new', ref: { kind: 'daily', date: today } });
    },
    onPlayEndless: () => {
      navigation.navigate('Game', { start: 'new', ref: { kind: 'endless' } });
    },
    onOpenSettings: () => {
      navigation.navigate('Settings');
    },
    onOpenLevels: () => {
      navigation.navigate('Levels');
    },
    onOpenStats: () => {
      navigation.navigate('Stats');
    },
    onOpenHowToPlay: () => {
      navigation.navigate('HowToPlay');
    },
    onOpenPremium: () => {
      navigation.navigate('Premium');
    },
  };
}
