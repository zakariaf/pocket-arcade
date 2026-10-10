// packages/shell/src/screens/home/use-level-play.ts
// Home's Play key, which S10's empty state repeats: "Continue – Level 12" while a level run is
// saved (save.doc().run?.ref of kind 'level'; the game host writes a new run at once), else
// "Play – Level 13", the first level never won (the level count from useGameExtra()). The run is
// read from the save on every render, and the screen re-renders when it gains focus again: the
// Game screen that covered it is where a run starts or ends.
import { useIsFocused } from '@react-navigation/native';

import { useServices } from '@e07/shell/app/services-context.tsx';
import { levelCountOf, useGameExtra } from '@e07/shell/app/use-game-extra.ts';
import { selectNextLevel } from '@e07/shell/stores/progress-selectors.ts';
import { useProgressStore } from '@e07/shell/stores/progress-store.ts';

import { usePlayRun } from './use-play-run.ts';

import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

export type LevelPlay = {
  readonly isContinue: boolean;
  readonly level: number;
  /** usePlayRun for `level`: the saved level run resumes, else a new run of the next level. */
  readonly onPlay: () => void;
};

/** The saved level run; daily and endless runs are resumed from their own screens, not here. */
function savedLevelOf(doc: SaveDoc): number | null {
  const ref = doc.run?.ref;
  return ref?.kind === 'level' ? ref.level : null;
}

export function useLevelPlay(): LevelPlay {
  const playRun = usePlayRun();
  useIsFocused(); // subscribes to focus: Home is covered while the Game screen writes the run
  const { save } = useServices();
  const levelCount = levelCountOf(useGameExtra());
  const nextLevel = useProgressStore((state) => selectNextLevel(state, levelCount));
  const savedLevel = savedLevelOf(save.doc());
  const level = savedLevel ?? nextLevel;
  return {
    isContinue: savedLevel !== null,
    level,
    onPlay: () => {
      playRun({ kind: 'level', level });
    },
  };
}
