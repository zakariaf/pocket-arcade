// packages/shell/src/game-host/create-game-board-host.tsx
// device-only: covered by the simulator kill test and the e2e level flow (unit Jest has no Skia)
import { useIsFocused } from '@react-navigation/native';
import { Skia } from '@shopify/react-native-skia';

import { useAnnounce } from '@e07/shell/app/use-announce.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { BoardDirectionView } from '@e07/shell/game-host/board-direction-view.tsx';
import { boardCoachHandOf, boardKitOf } from '@e07/shell/game-host/board-host-kit.ts';
import {
  boardHandlersFor,
  createMoveResultSelector,
  motionOf,
} from '@e07/shell/game-host/board-host-model.ts';
import { makeBoardColors } from '@e07/shell/game-host/board-kit.ts';
import { boardCoachOf, coachGameOf } from '@e07/shell/game-host/coach-pointer.ts';
import { GameBoardHost } from '@e07/shell/game-host/game-board-host.tsx';
import { useGameSession } from '@e07/shell/game-host/game-session-store.ts';
import { useBoardSelection } from '@e07/shell/game-host/use-board-selection.ts';
import { useIsFullscreenAdShowing } from '@e07/shell/game-host/use-is-fullscreen-ad-showing.ts';
import { useDirection } from '@e07/shell/i18n/direction-context.tsx';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { useNumberFormatter } from '@e07/shell/i18n/use-number-formatter.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import type { BoardColors, ViewFormat } from '@e07/shell/game-host/board-types.ts';
import type { BoardClockTrace, BoardFrameTime } from '@e07/shell/game-host/game-board-host.tsx';
import type {
  BoardHostFactory,
  BoardHostInput,
  BoardHostProps,
} from '@e07/shell/game-host/game-host.ts';
import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';
import type { ComponentType, ReactNode } from 'react';

/** The ports the board needs: timeline cues (sound, haptics) and the local error log. */
export type BoardPorts = {
  readonly audio: AudioPort;
  readonly haptics: HapticsPort;
  readonly errorLog: ErrorLogPort;
  /**
   * Test builds only: () => debugServices?.isBoardLayoutOn() === true (the debug link's
   * boardLayout=1), read when the board draws. Store builds leave it out: never a layout probe.
   */
  readonly isLayoutProbeOn?: () => boolean;
  /**
   * Test builds only: the board-clock trace while boardLayout=1 is on (perf-log kind 'board-clock')
   * and S15's frame recorder, both read when the board draws. Store builds leave them out.
   */
  readonly traceClock?: () => BoardClockTrace | undefined;
  readonly frameTime?: () => BoardFrameTime | undefined;
};

/**
 * Hover previews are drawn on the UI thread from the pointer sample (frame.fx.pointer), so hover
 * changes need no JS work; the selection and the hint reach the board as its highlight.
 */
const ignoreHover = (): void => undefined;

const ANNOUNCEMENTS = {
  selected: 'game-screen.board.selected.a11y-announcement',
  unselected: 'game-screen.board.unselected.a11y-announcement',
} as const;

type BoardLook<TToken extends string> = {
  readonly colors: BoardColors<TToken>;
  readonly format: ViewFormat;
  readonly label: string;
};

/** The board's colours, number format and spoken label at `state`, for the theme and language. */
function useBoardLook<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
  state: T['state'],
): BoardLook<T['token']> {
  const theme = useTheme();
  const t = useT();
  const format = { formatNumber: useNumberFormatter() };
  const { board } = game.presentation;
  // React Compiler memoizes these on their inputs (theme, colour-blind mode, the number format).
  const colors = makeBoardColors(Skia, game.presentation.art.palettes, {
    scheme: theme.scheme,
    isColorBlind: theme.mode === 'colorBlind',
  });
  const label = gameMessageText(t, board.describe(board.toView(state, format)));
  return { colors, format, label };
}

function boardHostFor<T extends ShellGameTypes>(
  input: BoardHostInput<T>,
  ports: BoardPorts,
): ComponentType<BoardHostProps> {
  const { game, controller, lifecycle } = input;
  const board = game.presentation.board;
  const selectResult = createMoveResultSelector<T['state'], T['event']>();
  const handlers = boardHandlersFor(controller.handle, ports.errorLog);
  // Once per opened run, on the JS thread: unit paths and scratch paints, never per frame.
  const kit = boardKitOf(board);
  const coachGame = coachGameOf(game);
  return function BoardHost(props: BoardHostProps): ReactNode {
    const result = useGameSession(controller.store, (state) => selectResult(state.session));
    const coach = boardCoachOf(coachGame, result.state, props.coachPointer);
    const t = useT();
    const announce = useAnnounce();
    const selection = useBoardSelection({
      game,
      controller,
      send: handlers.onIntent,
      announce: (change) => {
        announce(t(ANNOUNCEMENTS[change]));
      },
      coachTargets: coach.cells,
    });
    const { colors, format, label } = useBoardLook(game, result.state);
    const hand = boardCoachHandOf(coach, useTheme().colors);
    const isRtl = useDirection() === 'rtl';
    const motion = motionOf(useReduceMotion());
    const isFocused = useIsFocused();
    const isFullscreenAdShowing = useIsFullscreenAdShowing(lifecycle);
    const traceClock = ports.traceClock?.();
    const onFrameTime = ports.frameTime?.();
    return (
      <BoardDirectionView isMirroredInRtl={board.isMirroredInRtl} testID={props.testID}>
        <GameBoardHost
          board={board}
          buildTimeline={game.engine.buildTimeline}
          result={result}
          format={format}
          motion={motion}
          colors={colors}
          kit={kit}
          highlight={selection.highlight}
          isRtl={isRtl}
          panMode={game.engine.panMode}
          accessibilityLabel={label}
          audio={ports.audio}
          haptics={ports.haptics}
          isFocused={isFocused}
          isFullscreenAdShowing={isFullscreenAdShowing}
          onIntent={selection.onIntent}
          onHover={ignoreHover}
          onMiss={selection.clearSelection}
          onFailure={handlers.onFailure}
          reportError={handlers.reportError}
          isLayoutProbeOn={ports.isLayoutProbeOn?.() === true}
          {...(traceClock === undefined ? {} : { traceClock })}
          {...(onFrameTime === undefined ? {} : { onFrameTime })}
          coach={hand}
          coachReplay={props.coachReplay ?? 0}
        />
      </BoardDirectionView>
    );
  };
}

/**
 * The board layer behind GameHostDeps.createBoardHost: the composition root passes
 * createGameBoardHost({ audio, haptics, errorLog }). Each opened run gets one BoardHost component
 * that draws the saved state with the game's board, pan mode, palettes and timeline.
 */
export function createGameBoardHost(ports: BoardPorts): BoardHostFactory {
  return (input) => boardHostFor(input, ports);
}
