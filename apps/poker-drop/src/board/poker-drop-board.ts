// apps/poker-drop/src/board/poker-drop-board.ts
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { PokerDropView } from './to-view.ts';
import type { PokerDropMove, PokerDropState } from '@e07/poker-drop/rules/poker-drop-types.ts';
import type { A11yMessage, GameBoard, SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SkPath } from '@shopify/react-native-skia';

/** The select keys of the spoken summary: words, so no language reads a digit (catalog rule L7). */
const RANK_WORDS = [
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'jack',
  'queen',
  'king',
  'ace',
] as const;
const SUIT_WORDS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;

function heartPath(skia: SkiaApi): SkPath {
  return skia.PathBuilder.Make()
    .moveTo(0.5, 0.94)
    .cubicTo(0.1, 0.64, 0, 0.42, 0.06, 0.26)
    .cubicTo(0.14, 0.06, 0.4, 0.04, 0.5, 0.24)
    .cubicTo(0.6, 0.04, 0.86, 0.06, 0.94, 0.26)
    .cubicTo(1, 0.42, 0.9, 0.64, 0.5, 0.94)
    .close()
    .build();
}

function spadePath(skia: SkiaApi): SkPath {
  return skia.PathBuilder.Make()
    .moveTo(0.5, 0.02)
    .cubicTo(0.64, 0.2, 0.98, 0.36, 0.96, 0.6)
    .cubicTo(0.94, 0.8, 0.68, 0.86, 0.54, 0.72)
    .lineTo(0.64, 0.98)
    .lineTo(0.36, 0.98)
    .lineTo(0.46, 0.72)
    .cubicTo(0.32, 0.86, 0.06, 0.8, 0.04, 0.6)
    .cubicTo(0.02, 0.36, 0.36, 0.2, 0.5, 0.02)
    .close()
    .build();
}

function clubPath(skia: SkiaApi): SkPath {
  return skia.PathBuilder.Make()
    .addCircle(0.5, 0.28, 0.21)
    .addCircle(0.26, 0.58, 0.21)
    .addCircle(0.74, 0.58, 0.21)
    .moveTo(0.5, 0.5)
    .lineTo(0.64, 0.98)
    .lineTo(0.36, 0.98)
    .close()
    .build();
}

/** A closed polygon through unit-square points. */
function polygonPath(skia: SkiaApi, points: readonly (readonly [number, number])[]): SkPath {
  const [x0, y0] = points[0] ?? [0, 0];
  const start = skia.PathBuilder.Make().moveTo(x0, y0);
  return points
    .slice(1)
    .reduce((builder, [x, y]) => builder.lineTo(x, y), start)
    .close()
    .build();
}

const DIAMOND = [
  [0.5, 0.02],
  [0.88, 0.5],
  [0.5, 0.98],
  [0.12, 0.5],
] as const;
/** The rising row's mark: an arrow pointing up. */
const UP_ARROW = [
  [0.5, 0.04],
  [0.94, 0.5],
  [0.66, 0.5],
  [0.66, 0.96],
  [0.34, 0.96],
  [0.34, 0.5],
  [0.06, 0.5],
] as const;

/**
 * Unit-size (0…1) shapes, built ONCE per kit with the immutable path API (Skia 2.6+): the four
 * suits, so a card's suit differs by shape as well as colour, and the rising-row arrow.
 */
function buildPaths(skia: SkiaApi): Readonly<Partial<Record<string, SkPath>>> {
  return {
    spade: spadePath(skia),
    heart: heartPath(skia),
    diamond: polygonPath(skia, DIAMOND),
    club: clubPath(skia),
    rise: polygonPath(skia, UP_ARROW),
  };
}

/** VoiceOver's summary: the cards in the well, the card in hand, the drops before a row rises. */
function describe(view: PokerDropView): A11yMessage {
  return {
    id: 'poker-drop.board.summary',
    values: {
      cardsCount: view.cells.filter((cell) => cell >= 0).length,
      handRank: RANK_WORDS[view.hand % RANK_WORDS.length] ?? 'ace',
      handSuit: SUIT_WORDS[Math.floor(view.hand / RANK_WORDS.length)] ?? 'spades',
      dropsCount: view.riseDrops,
    },
  };
}

/** The rendering members of the game module (presentation.board of its ShellGameModule). */
export const pokerDropBoard: GameBoard<PokerDropState, PokerDropView, BoardToken, PokerDropMove> = {
  // Spec 7.5: a board is a physical space; the well never mirrors in fa and ckb.
  isMirroredInRtl: false,
  toView,
  layout: layoutBoard,
  draw: drawBoard,
  buildPaths,
  describe,
};
