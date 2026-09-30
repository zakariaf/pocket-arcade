// packages/shell/src/screens/game/game-screen.tsx
import { StackActions, useNavigation } from '@react-navigation/native';
import { useEffect, useRef } from 'react';

import { GameTopBar } from '@e07/shell/game-host/game-top-bar.tsx';
import { useGameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';
import { usePauseOnBackground } from '@e07/shell/game-host/use-pause-on-background.ts';
import { PauseOverlay } from '@e07/shell/screens/pause/pause-overlay.tsx';
import { ResultOverlay } from '@e07/shell/screens/result/result-overlay.tsx';

import { GameLayout } from './game-layout.tsx';
import { GameMovesProbe } from './game-moves-probe.tsx';
import { useGameScreenModel } from './use-game-screen-model.ts';

import type { GameParams } from '@e07/shell/navigation/route-params.ts';
import type { StaticScreenProps } from '@react-navigation/native';
import type { ReactNode } from 'react';

export type GameScreenProps = StaticScreenProps<GameParams>;

/**
 * S5 with the game host wired in (spec S5, S6, S7): the run opens from the route params, the board
 * host fills GameLayout's board area under the top bar, Pause and Result are overlays so the board
 * stays mounted, and the run pauses when the app leaves the foreground. Back never leaves a live
 * run (it opens Pause, and Back in Pause resumes); only Pause -> Home does. A finished run leaves
 * normally; with no run to open the screen goes back to Home.
 */
export function GameScreen({ route }: GameScreenProps): ReactNode {
  const navigation = useNavigation();
  const controls = useGameSessionControls(route.params);
  const isLeavingRef = useRef(false);
  const isRunLive = controls.status === 'playing' || controls.status === 'paused';
  const { BoardHost, status } = controls;
  usePauseOnBackground(status, controls.pause);
  const model = useGameScreenModel(controls, {
    onLevels: () => {
      navigation.dispatch(StackActions.popTo('Levels'));
    },
    onHome: () => {
      navigation.dispatch(StackActions.popTo('Home'));
    },
    onOpenPremium: () => {
      navigation.navigate('Premium');
    },
  });

  useEffect(() => {
    if (status === 'missing') navigation.dispatch(StackActions.popTo('Home'));
  }, [status, navigation]);

  const handleHome = (): void => {
    isLeavingRef.current = true;
    controls.leaveToHome();
    navigation.dispatch(StackActions.popTo('Home'));
  };

  const pause =
    status === 'paused' ? (
      <PauseOverlay session={controls} onResume={controls.resume} onHome={handleHome} />
    ) : null;
  return (
    <GameLayout
      topBar={model.topBar === null ? null : <GameTopBar {...model.topBar} />}
      board={
        <>
          {BoardHost === null ? null : <BoardHost testID="game.board-canvas" />}
          <GameMovesProbe moveCount={controls.view?.moveCount ?? null} />
        </>
      }
      overlay={model.result === null ? pause : <ResultOverlay model={model.result} />}
    />
  );
}
