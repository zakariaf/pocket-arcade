// packages/shell/src/screens/how-to-play/use-how-to-play-model.ts
// S13's model hook: the game's pages from the host (goal and step sentence as catalog keys, the
// picture drawn by the game's own board at the host's picture aspect), the page shown (local
// state, clamped to the pages), Done going back to where the player came from (Home, or Pause
// with the run still paused), and "Play the tutorial again" as a new tutorial run (FirstRun is
// gone after the first launch).
// A parity capture of s13-how-to-play (test builds) opens on step 2, the page one Next shows.
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';

import { TEST_ONLY } from '@e07/shell/app/test-only.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';

import type { HowToPlayModel } from './how-to-play-view.tsx';

/** The page Next shows after `index`: one further, never past the last page. */
function nextStepOf(index: number, lastIndex: number): number {
  return Math.min(lastIndex, index + 1);
}

export function useHowToPlayModel(): HowToPlayModel {
  const t = useT();
  const navigation = useNavigation();
  const {
    howToPlayPages: pages,
    renderHowToPlayPicture,
    howToPlayPictureAspect: pictureAspect,
  } = useGameHost();
  const lastIndex = Math.max(0, pages.length - 1);
  const [stepIndex, setStepIndex] = useState(() =>
    TEST_ONLY?.parityFrameState() === 'how-to-play-step-2' ? nextStepOf(0, lastIndex) : 0,
  );
  const page = pages[stepIndex];
  const goBack = (): void => {
    navigation.goBack();
  };
  return {
    goal: page === undefined ? '' : gameMessageText(t, { id: page.titleId }),
    steps: pages.map((each) => gameMessageText(t, { id: each.bodyId })),
    stepIndex,
    renderPicture: renderHowToPlayPicture,
    pictureAspect,
    isReducedMotion: useReduceMotion(),
    onBack: goBack,
    onPrevious: () => {
      setStepIndex((index) => Math.max(0, index - 1));
    },
    onNext: () => {
      setStepIndex((index) => nextStepOf(index, lastIndex));
    },
    onDone: goBack,
    onReplayTutorial: () => {
      navigation.navigate('Game', { start: 'new', ref: { kind: 'tutorial' } });
    },
  };
}
