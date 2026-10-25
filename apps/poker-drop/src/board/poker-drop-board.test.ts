// apps/poker-drop/src/board/poker-drop-board.test.ts
import { cardOf } from '@e07/poker-drop/rules/cards.ts';

import { EMPTY_CELL } from './board-ids.ts';
import { BOARD_PALETTES } from './board-palettes.ts';
import { pokerDropBoard } from './poker-drop-board.ts';

import type { PokerDropView } from './to-view.ts';
import type { SkiaApi } from '@e07/shell/game-host/board-types.ts';

const VIEW: PokerDropView = {
  cols: 5,
  rows: 6,
  cells: Array.from({ length: 30 }, (_, index) => (index < 7 ? index : EMPTY_CELL)),
  hand: cardOf(7, 1),
  next: cardOf(14, 0),
  riseDrops: 1,
  riseText: '1',
  stepTexts: [],
};

/** A PathBuilder stand-in: every call chains, build() returns a marker per path. */
function fakeSkia(): SkiaApi {
  let built = 0;
  const builder: Record<string, unknown> = {};
  for (const name of ['moveTo', 'lineTo', 'cubicTo', 'quadTo', 'close', 'addCircle']) {
    builder[name] = () => builder;
  }
  builder['build'] = () => ({ built: (built += 1) });
  // Skia's own spelling (PathBuilder.Make), built as data so the naming rule stays on.
  const factory = Object.fromEntries([['Make', () => builder]]);
  return { PathBuilder: factory } as unknown as SkiaApi;
}

describe('pokerDropBoard', () => {
  // spec 8.11: "Game boards give a short spoken summary ... where practical".
  it('describes the well, the card in hand and the drops before the next rise for VoiceOver', () => {
    expect(pokerDropBoard.describe(VIEW)).toStrictEqual({
      id: 'poker-drop.board.summary',
      values: { cardsCount: 7, handRank: 'seven', handSuit: 'hearts', dropsCount: 1 },
    });
    expect(pokerDropBoard.describe({ ...VIEW, hand: cardOf(10, 3) }).values).toMatchObject({
      handRank: 'ten',
      handSuit: 'clubs',
    });
  });

  it('falls back to the ace of spades for a value that is no card', () => {
    expect(pokerDropBoard.describe({ ...VIEW, hand: -1 }).values).toMatchObject({
      handRank: 'ace',
      handSuit: 'spades',
    });
  });

  // spec 7.5: a board is a physical space and never mirrors in fa and ckb.
  it('keeps the well unmirrored in right-to-left languages', () => {
    expect(pokerDropBoard.isMirroredInRtl).toBe(false);
  });

  it('builds the four suit shapes and the rising-row arrow once, at unit size', () => {
    expect(Object.keys(pokerDropBoard.buildPaths(fakeSkia())).sort()).toStrictEqual([
      'club',
      'diamond',
      'heart',
      'rise',
      'spade',
    ]);
  });

  it('gives all four palette sets the same tokens', () => {
    const keys = Object.values(BOARD_PALETTES).map((set) => Object.keys(set).sort().join());
    expect(new Set(keys).size).toBe(1);
  });
});
