// packages/shell/src/game-host/create-example-picture.tsx
// device-only: covered by the S13 How to play screen on the simulator (its pictures are Skia canvases; unit Jest has no Skia).
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { makeScene } from '@e07/shell/game-host/board-scene.ts';
import { IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';
import { examplePictureAspectOf } from '@e07/shell/game-host/example-picture-aspect.ts';
import { recordBoard } from '@e07/shell/game-host/record-board.ts';
import { exampleHighlightOf } from '@e07/shell/game-host/tutorial-script.ts';
import { createNumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';
import { localeTagFor } from '@e07/shell/i18n/digits.ts';
import { useDirection } from '@e07/shell/i18n/direction-context.tsx';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useLanguage } from '@e07/shell/i18n/language-context.tsx';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { selectDigits } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import type { ExamplePictureFactory, ExamplePictureProps } from '@e07/shell/game-host/game-host.ts';
import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';
import type { ComponentType, ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

const NUMBER_FAMILY = 'Vazirmatn';
const NUMBER_STYLE = { weight: 400, width: 5, slant: 0 } as const;
const NUMBER_SIZE = 18;

// The canvas fills the picture; the picture keeps its aspect (the S13 size contract), so it never
// measures 0 whatever its container does.
const styles = StyleSheet.create({ fill: { flex: 1 }, picture: { alignSelf: 'stretch' } });

type Size = { readonly width: number; readonly height: number };

function examplePictureFor<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
): ComponentType<ExamplePictureProps> {
  const board = game.presentation.board;
  const aspectRatio = examplePictureAspectOf(board);
  // Once per app, on the JS thread: unit paths and scratch paints (as the board host does per run).
  const kit = makeBoardKit(Skia, {
    paths: board.buildPaths(Skia),
    numberTypeface: Skia.FontMgr.System().matchFamilyStyle(NUMBER_FAMILY, NUMBER_STYLE),
    numberSize: NUMBER_SIZE,
  });
  return function ExamplePicture({ pageIndex }: ExamplePictureProps): ReactNode {
    const theme = useTheme();
    const t = useT();
    const format = {
      formatNumber: createNumberFormatter(
        localeTagFor(useLanguage(), useSettingsStore(selectDigits)),
      ),
    };
    const isMirrored = useDirection() === 'rtl' && board.isMirroredInRtl;
    const [size, setSize] = useState<Size>({ width: 0, height: 0 });
    const page = game.teaching.howToPlay[pageIndex];
    if (page === undefined) return null;
    const view = board.toView(page.example, format);
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
            highlight: exampleHighlightOf(page.pointer),
            colors,
            kit,
            draw: board.draw,
            onError: () => undefined,
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
