// packages/shell/src/game-host/create-game-board-host.tsx
// device-only: covered by the simulator kill test and the e2e level flow (unit Jest has no Skia)
import { useIsFocused } from '@react-navigation/native';
import { Skia } from '@shopify/react-native-skia';

import { useAnnounce } from '@e07/shell/app/use-announce.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { BoardDirectionView } from '@e07/shell/game-host/board-direction-view.tsx';
import {
  boardHandlersFor,
  createMoveResultSelector,
  motionOf,
} from '@e07/shell/game-host/board-host-model.ts';
import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { GameBoardHost } from '@e07/shell/game-host/game-board-host.tsx';
import { useGameSession } from '@e07/shell/game-host/game-session-store.ts';
import { useBoardSelection } from '@e07/shell/game-host/use-board-selection.ts';
import { useIsFullscreenAdShowing } from '@e07/shell/game-host/use-is-fullscreen-ad-showing.ts';
import { createNumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';
import { localeTagFor } from '@e07/shell/i18n/digits.ts';
import { useDirection } from '@e07/shell/i18n/direction-context.tsx';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useLanguage } from '@e07/shell/i18n/language-context.tsx';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { selectDigits } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type {
  BoardHostFactory,
  BoardHostInput,
  BoardHostProps,
} from '@e07/shell/game-host/game-host.ts';
import type { ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';
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
};

/** Digits and Latin labels on the canvas: the embedded Vazirmatn (the expo-font plugin ships it). */
const NUMBER_FAMILY = 'Vazirmatn';
const NUMBER_STYLE = { weight: 400, width: 5, slant: 0 } as const;
const NUMBER_SIZE = 18;

/**
 * Hover previews are drawn on the UI thread from the pointer sample (frame.fx.pointer), so hover
 * changes need no JS work; the selection and the hint reach the board as its highlight.
 */
const ignoreHover = (): void => undefined;

const NO_COACH: readonly BoardTarget[] = [];

const ANNOUNCEMENTS = {
  selected: 'game-screen.board.selected.a11y-announcement',
  unselected: 'game-screen.board.unselected.a11y-announcement',
} as const;

function boardHostFor<T extends ShellGameTypes>(
  input: BoardHostInput<T>,
  ports: BoardPorts,
): ComponentType<BoardHostProps> {
  const { game, controller, lifecycle } = input;
  const board = game.presentation.board;
  const selectResult = createMoveResultSelector<T['state'], T['event']>();
  const handlers = boardHandlersFor(controller.handle, ports.errorLog);
  // Once per opened run, on the JS thread: unit paths and scratch paints, never per frame.
  const kit = makeBoardKit(Skia, {
    paths: board.buildPaths(Skia),
    numberTypeface: Skia.FontMgr.System().matchFamilyStyle(NUMBER_FAMILY, NUMBER_STYLE),
    numberSize: NUMBER_SIZE,
  });
  return function BoardHost({ testID, coachTargets = NO_COACH }: BoardHostProps): ReactNode {
    const result = useGameSession(controller.store, (state) => selectResult(state.session));
    const theme = useTheme();
    const t = useT();
    const announce = useAnnounce();
    const selection = useBoardSelection({
      game,
      controller,
      send: handlers.onIntent,
      announce: (change) => {
        announce(t(ANNOUNCEMENTS[change]));
      },
      coachTargets,
    });
    const language = useLanguage();
    const digits = useSettingsStore(selectDigits);
    const isRtl = useDirection() === 'rtl';
    const motion = motionOf(useReduceMotion());
    const isFocused = useIsFocused();
    const isFullscreenAdShowing = useIsFullscreenAdShowing(lifecycle);
    // React Compiler memoizes these on their inputs (theme, colour-blind mode, language, digits).
    const colors = makeBoardColors(Skia, game.presentation.art.palettes, {
      scheme: theme.scheme,
      isColorBlind: theme.mode === 'colorBlind',
    });
    const format = { formatNumber: createNumberFormatter(localeTagFor(language, digits)) };
    const label = gameMessageText(t, board.describe(board.toView(result.state, format)));
    return (
      <BoardDirectionView isMirroredInRtl={board.isMirroredInRtl} testID={testID}>
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
