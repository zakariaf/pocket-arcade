// packages/shell/src/screens/first-run/use-tutorial-model.ts
// The Tutorial route's model hook (spec S13, FirstRun group): opens the game host's scripted
// tutorial run, follows it step by step, and ends the FirstRun group with finish-tutorial (Skip
// from the second step, or the last step's continue key). TutorialView only draws what this returns.
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useEffect, useEffectEvent, useRef } from 'react';

import { useAnnounce } from '@e07/shell/app/use-announce.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { isRunLive } from '@e07/shell/game-host/session-view.ts';
import { useGameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';
import { useHintsDuringPlay } from '@e07/shell/game-host/use-hints-during-play.ts';
import { usePauseOnBackground } from '@e07/shell/game-host/use-pause-on-background.ts';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { selectDispatch } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import { tutorialCoachOf } from './tutorial-coach.ts';

import type { TutorialCoach } from './tutorial-coach.ts';
import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { BoardHostProps } from '@e07/shell/game-host/game-host.ts';
import type { SessionView } from '@e07/shell/game-host/session-view.ts';
import type { GameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';
import type { TFunction } from '@e07/shell/i18n/create-t.ts';
import type { GameParams } from '@e07/shell/navigation/route-params.ts';
import type { ComponentType } from 'react';

/** The tutorial level: the game's teaching.tutorial.start, played through its scripted steps. */
export const TUTORIAL_RUN: GameParams = { start: 'new', ref: { kind: 'tutorial' } };

export type TutorialModel = {
  /** The tutorial run's board, or null when no run opened (the coach then offers only continue). */
  readonly BoardHost: ComponentType<BoardHostProps> | null;
  /** "Welcome to <game>!" above the first step, else null. */
  readonly welcomeText: string | null;
  /** The step's sentence, "Tap to continue" while paused, "Nice! ..." once the script is over. */
  readonly coachText: string;
  /**
   * The step's pointer while the stage is 'step', else null. The board host resolves it through
   * the game (coachPointerOf): a drag marks the slot and every cell the block fills, and the
   * pointing hand moves from the slot to the gap.
   */
  readonly coachPointer: TutorialPointer | null;
  /**
   * The nudge over the step's sentence while the step has refused a try (spec S13 is silent:
   * never a silent no-op, never an auto-skip): "Follow the hand." where the step draws a hand (a
   * target or drag pointer), "Try again" where it draws none ('hud', 'none'). Null otherwise, and
   * while Hints during play (S11: tutorial tips and nudges) is off.
   */
  readonly nudgeText: string | null;
  /** The refused tries at this step: each one makes the board's pointing hand play again. */
  readonly coachReplay: number;
  /** The continue key: resume while paused, leave the tutorial once it is over; else hidden. */
  readonly continueKey: { readonly label: string; readonly onPress: () => void } | null;
  /** Skip, shown from the second step on (spec S13); null while hidden. */
  readonly skipKey: { readonly label: string; readonly onPress: () => void } | null;
  readonly isReducedMotion: boolean;
};

function coachTextOf(t: TFunction, coach: TutorialCoach): string {
  if (coach.stage === 'paused') return t('tutorial.tap-to-continue');
  if (coach.messageId === null) return t('tutorial.done');
  return gameMessageText(t, { id: coach.messageId });
}

/**
 * finish-tutorial ends the FirstRun group (useIsFirstRun turns false and the navigator lands on
 * Home); the tutorial run is ended first, so no half-played tutorial stays in the save.
 */
function useFinishTutorial(controls: GameSessionControls): {
  readonly finish: () => void;
  readonly isLeaving: () => boolean;
} {
  const dispatch = useSettingsStore(selectDispatch);
  const isLeavingRef = useRef(false);
  return {
    finish: () => {
      isLeavingRef.current = true;
      controls.send({ type: 'finish' });
      dispatch({ type: 'finish-tutorial' });
    },
    isLeaving: () => isLeavingRef.current,
  };
}

/** Back never leaves the tutorial (the FirstRun group has no Home): it pauses or resumes. */
function useBackPauses(controls: GameSessionControls, isLeaving: () => boolean): void {
  const navigation = useNavigation();
  usePreventRemove(isRunLive(controls.status), ({ data }) => {
    if (isLeaving()) navigation.dispatch(data.action);
    else if (controls.status === 'playing') controls.pause();
    else controls.resume();
  });
}

type CoachNudge = Pick<TutorialModel, 'nudgeText' | 'coachReplay'>;

/** Only a target or drag pointer draws the hand; any other step gets the pointer-neutral line. */
function nudgeKeyOf(pointer: TutorialPointer | null): 'tutorial.follow-hand' | 'common.try-again' {
  return pointer?.kind === 'target' || pointer?.kind === 'drag'
    ? 'tutorial.follow-hand'
    : 'common.try-again';
}

/**
 * The nudge after a try the step on screen refused, counted only while Hints during play is on
 * (S11): "Follow the hand." (or "Try again" where no hand is drawn) and the replay count, and
 * VoiceOver and TalkBack hear the nudge and the step's sentence once per refusal.
 */
function useCoachNudge(
  coach: TutorialCoach,
  view: SessionView | null,
  coachText: string,
): CoachNudge {
  const t = useT();
  const announce = useAnnounce();
  const isNudgeOn = useHintsDuringPlay();
  const refused = isNudgeOn && coach.stage === 'step' ? (view?.refusedMoves ?? 0) : 0;
  const nudgeText = refused > 0 ? t(nudgeKeyOf(coach.pointer)) : null;
  const speak = useEffectEvent(() => {
    if (nudgeText !== null) announce(`${nudgeText} ${coachText}`);
  });
  useEffect(() => {
    if (refused > 0) speak();
  }, [refused]);
  return { nudgeText, coachReplay: refused };
}

export function useTutorialModel(): TutorialModel {
  const t = useT();
  const host = useGameHost();
  const controls = useGameSessionControls(TUTORIAL_RUN);
  const coach = tutorialCoachOf(host.tutorialSteps, controls.view);
  const { finish, isLeaving } = useFinishTutorial(controls);
  usePauseOnBackground(controls.status, controls.pause);
  useBackPauses(controls, isLeaving);
  const gameName = gameMessageText(t, { id: host.nameId });
  const isFirstStep = coach.stage === 'step' && coach.stepIndex === 0;
  const coachText = coachTextOf(t, coach);
  const nudge = useCoachNudge(coach, controls.view, coachText);
  const continueLabel = t('tutorial.tap-to-continue');
  return {
    BoardHost: controls.BoardHost,
    welcomeText:
      isFirstStep && nudge.nudgeText === null ? t('tutorial.welcome', { gameName }) : null,
    coachText,
    ...nudge,
    coachPointer: coach.pointer,
    continueKey:
      coach.stage === 'step'
        ? null
        : { label: continueLabel, onPress: coach.stage === 'paused' ? controls.resume : finish },
    skipKey: coach.isSkipShown ? { label: t('tutorial.skip-button'), onPress: finish } : null,
    isReducedMotion: useReduceMotion(),
  };
}
