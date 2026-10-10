// packages/shell/src/screens/home/use-home-actions.ts
// S4's navigation, exactly as navigation-and-routing's table says. Every key navigates normally;
// in a partial Shell a route outside shell-slice.json shows NotBuiltScreen (never a no-op). The
// daily card's Play key and the Endless row resume the saved run when it is that same run (today's
// daily, the endless run): the save holds one run, and a new one would replace it (N10, 8.6).
// Today is read from the clock when the key is pressed (S9: the day changes at local midnight,
// also while Home stays open).
import { useNavigation } from '@react-navigation/native';

import { useServices } from '@e07/shell/app/services-context.tsx';

import type { HomeActions } from './home-model.ts';
import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';

/** The saved run is the run a key asks for: the same level, the same day's daily, or endless. */
function isSameRun(saved: RunRef, wanted: RunRef): boolean {
  if (saved.kind === 'level' && wanted.kind === 'level') return saved.level === wanted.level;
  if (saved.kind === 'daily' && wanted.kind === 'daily') return saved.date === wanted.date;
  return saved.kind === wanted.kind;
}

export function useHomeActions(onPlay: () => void): HomeActions {
  const navigation = useNavigation();
  const { save, clock } = useServices();
  const playRun = (ref: RunRef): void => {
    const saved = save.doc().run?.ref;
    if (saved !== undefined && isSameRun(saved, ref))
      navigation.navigate('Game', { start: 'resume' });
    else navigation.navigate('Game', { start: 'new', ref });
  };
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
