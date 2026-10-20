// packages/shell/src/game-host/create-example-picture.tsx
// device-only: covered by the S13 How to play screen on the simulator (its pictures are Skia canvases; unit Jest has no Skia).
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { boardCoachHandOf, boardKitOf } from '@e07/shell/game-host/board-host-kit.ts';
import { makeBoardColors } from '@e07/shell/game-host/board-kit.ts';
import { makeScene } from '@e07/shell/game-host/board-scene.ts';
import { IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';
import { coachGameOf, coachPointerOf } from '@e07/shell/game-host/coach-pointer.ts';
import { examplePictureAspectOf } from '@e07/shell/game-host/example-picture-aspect.ts';
import { recordBoard } from '@e07/shell/game-host/record-board.ts';
import { useDirection } from '@e07/shell/i18n/direction-context.tsx';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { useNumberFormatter } from '@e07/shell/i18n/use-number-formatter.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import type { RenderKit } from '@e07/shell/game-host/board-types.ts';
import type { ExamplePictureFactory, ExamplePictureProps } from '@e07/shell/game-host/game-host.ts';
import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';
import type { ComponentType, ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

// The canvas fills the picture; the picture keeps its aspect (the S13 size contract), so it never
// measures 0 whatever its container does.
const styles = StyleSheet.create({ fill: { flex: 1 }, picture: { alignSelf: 'stretch' } });

type Size = { readonly width: number; readonly height: number };

/**
 * The unit paths and scratch paints (as the board host does per run), built on the JS thread when
 * S13 first draws a picture and kept for the life of the app: never at boot, where the host is
 * created for every cold start.
 */
function lazyKitOf<T extends ShellGameTypes>(game: ShellGameModule<T>): () => RenderKit {
  const board = game.presentation.board;
  let kit: RenderKit | null = null;
  return () => {
    kit ??= boardKitOf(board);
    return kit;
  };
}

function examplePictureFor<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
): ComponentType<ExamplePictureProps> {
  const board = game.presentation.board;
  const aspectRatio = examplePictureAspectOf(board);
  const kitOf = lazyKitOf(game);
  // A page's pointer marks what the tutorial's does: the slot and every cell the move fills.
  const coach = coachGameOf(game);
  return function ExamplePicture({ pageIndex }: ExamplePictureProps): ReactNode {
    const kit = kitOf();
    const theme = useTheme();
    const t = useT();
    const format = { formatNumber: useNumberFormatter() };
    const isMirrored = useDirection() === 'rtl' && board.isMirroredInRtl;
    const [size, setSize] = useState<Size>({ width: 0, height: 0 });
    const page = game.teaching.howToPlay[pageIndex];
    if (page === undefined) return null;
    const view = board.toView(page.example, format);
    const pointed = coachPointerOf(coach, page.example, page.pointer);
    const colors = makeBoardColors(Skia, game.presentation.art.palettes, {
      scheme: theme.scheme,
      isColorBlind: theme.mode === 'colorBlind',
    });
    const handleLayout = (event: LayoutChangeEvent): void => {
      const { width, height } = event.nativeEvent.layout;
      setSize({ width, height });
    };
    const picture =
      size.width === 0
        ? null
        : recordBoard(Skia.PictureRecorder(), {
            scene: makeScene(0, view, []),
            now: 0,
            layout: board.layout({ ...size, view, isMirrored }),
            pointer: IDLE_POINTER,
            highlight: { selected: null, hinted: pointed.cells },
            colors,
            kit,
            draw: board.draw,
            onError: () => undefined,
            // The page's pointing hand rests at its end, as under reduced motion.
            restingHand: boardCoachHandOf(pointed, theme.colors),
          });
    return (
      <View
        style={[styles.picture, { aspectRatio }]}
        onLayout={handleLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel={gameMessageText(t, board.describe(view))}
      >
        {picture === null ? null : (
          <Canvas style={styles.fill}>
            <Picture picture={picture} />
          </Canvas>
        )}
      </View>
    );
  };
}

/**
 * The S13 pictures behind GameHostDeps.createExamplePicture: each how-to-play page's example
 * state drawn once by the game's own board (the same draw() as the game, no animation, the page's
 * pointer cells outlined like a hinted move). The composition root passes createExamplePicture().
 */
export function createExamplePicture(): ExamplePictureFactory {
  return (game) => examplePictureFor(game);
}
