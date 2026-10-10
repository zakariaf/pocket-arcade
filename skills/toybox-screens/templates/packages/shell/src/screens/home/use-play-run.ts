// packages/shell/src/screens/home/use-play-run.ts
// The one resume-or-new rule of every key that plays a run: Home's Play, daily card Play key and
// Endless row, S8's level tiles and S9's Play and Replay. The save holds one run, so the saved run
// resumes when it is the run the key asks for (the same level, the same day's daily, the endless
// run), and a new run starts only for another one (N10, spec 8.6: a key never throws away saved
// progress). The save is read when the key is pressed. Restart level, Replay, Try again and Next
// level start fresh on purpose: they open their run in the Game screen (startRun), not here.
import { useNavigation } from '@react-navigation/native';

import { useServices } from '@e07/shell/app/services-context.tsx';

import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';

/** The saved run is the run a key asks for: the same level, the same day's daily, or endless. */
export function isSameRun(saved: RunRef, wanted: RunRef): boolean {
  if (saved.kind === 'level' && wanted.kind === 'level') return saved.level === wanted.level;
  if (saved.kind === 'daily' && wanted.kind === 'daily') return saved.date === wanted.date;
  return saved.kind === wanted.kind;
}

/** Opens the Game route for `ref`: the saved run when it is that run, else a new one. */
export function usePlayRun(): (ref: RunRef) => void {
  const navigation = useNavigation();
  const { save } = useServices();
  return (ref) => {
    const saved = save.doc().run?.ref;
    if (saved !== undefined && isSameRun(saved, ref))
      navigation.navigate('Game', { start: 'resume' });
    else navigation.navigate('Game', { start: 'new', ref });
  };
}
