// packages/shell/src/screens/home/use-home-actions.ts
// Planted bug: the round-3 Home, whose daily card only plays; nothing navigates to Daily (S9).
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
    onOpenSettings: () => {
      navigation.navigate('Settings');
    },
  };
}
