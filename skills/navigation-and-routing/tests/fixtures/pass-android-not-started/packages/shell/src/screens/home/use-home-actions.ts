// packages/shell/src/screens/home/use-home-actions.ts
import { useNavigation } from '@react-navigation/native';

import type { HomeActions } from './home-model.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

/** Every Home key: the daily card's body opens S9 (L7), its Play key starts today's run. */
export function useHomeActions(onPlay: () => void, today: DateKey): HomeActions {
  const navigation = useNavigation();
  return {
    onPlay,
    onOpenDaily: () => {
      navigation.navigate('Daily');
    },
    onPlayDaily: () => {
      navigation.navigate('Game', { start: 'new', ref: { kind: 'daily', date: today } });
    },
    onOpenSettings: () => {
      navigation.navigate('Settings');
    },
  };
}
