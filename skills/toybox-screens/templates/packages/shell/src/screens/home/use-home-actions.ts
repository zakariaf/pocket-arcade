// packages/shell/src/screens/home/use-home-actions.ts
// S4's navigation, exactly as navigation-and-routing's table says. Every key navigates normally;
// in a partial Shell a route outside shell-slice.json shows NotBuiltScreen (never a no-op). The
// daily card's Play key and the Endless row play through usePlayRun: the saved run resumes when it
// is that same run (today's daily, the endless run), as a new one would replace it (N10, 8.6).
// Today is read from the clock when the key is pressed (S9: the day changes at local midnight,
// also while Home stays open).
import { useNavigation } from '@react-navigation/native';

import { useServices } from '@e07/shell/app/services-context.tsx';

import { usePlayRun } from './use-play-run.ts';

import type { HomeActions } from './home-model.ts';

export function useHomeActions(onPlay: () => void): HomeActions {
  const navigation = useNavigation();
  const { clock } = useServices();
  const playRun = usePlayRun();
  return {
    onPlay,
    onOpenDaily: () => {
      navigation.navigate('Daily');
    },
    onPlayDaily: () => {
      playRun({ kind: 'daily', date: clock.today() });
    },
    onPlayEndless: () => {
      playRun({ kind: 'endless' });
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
