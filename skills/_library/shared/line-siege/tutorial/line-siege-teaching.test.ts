// apps/line-siege/src/tutorial/line-siege-teaching.test.ts
import { lineSiegeBoard } from '@e07/line-siege/board/line-siege-board.ts';
import ckb from '@e07/line-siege/i18n/ckb.json';
import de from '@e07/line-siege/i18n/de.json';
import en from '@e07/line-siege/i18n/en.json';
import fa from '@e07/line-siege/i18n/fa.json';
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';
import { intentToMove } from '@e07/line-siege/rules/intent-to-move.ts';
import { listMoves } from '@e07/line-siege/rules/list-moves.ts';
import { outcome } from '@e07/line-siege/rules/outcome.ts';
import { coachPointerOf } from '@e07/shell/game-host/coach-pointer.ts';

import { LINE_SIEGE_TEACHING } from './line-siege-teaching.ts';

import type { LineSiegeMove, LineSiegeState } from '@e07/line-siege/rules/line-siege-types.ts';

describe('LINE_SIEGE_TEACHING', () => {
  it('teaches in 3 to 5 how-to-play pages drawn from playing examples', () => {
    const pages = LINE_SIEGE_TEACHING.howToPlay;
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(pages.length).toBeLessThanOrEqual(5);
    expect(pages.every((page) => outcome(page.example).kind === 'playing')).toBe(true);
  });

  it('expects a legal first placement that fills the prepared column and fires its beam', () => {
    const { start, steps } = LINE_SIEGE_TEACHING.tutorial;
    const [first] = steps;
    if (first?.expect.kind !== 'move') throw new Error('the first step expects a move');
    expect(listMoves(start)).toContainEqual(first.expect.move);
    const kinds = applyMove(start, first.expect.move).events.map((event) => event.kind);
    expect(kinds).toContain('beam-fired');
  });

  it("points step 1 at the slot and BOTH empty cells of the column's two-cell gap", () => {
    // Spec S13: one pointer, a drag from tray slot 1 to the gap. The vertical two fills column 7
    // rows 3 and 4; marking only row 3 made the gap look one cell tall (2026-10-18).
    const { start, steps } = LINE_SIEGE_TEACHING.tutorial;
    const game = {
      intentToMove,
      targetsOfMove: (state: LineSiegeState, move: LineSiegeMove) =>
        lineSiegeBoard.targetsOfMove?.(state, move) ?? [],
    };
    const coach = coachPointerOf(game, start, steps[0]?.pointer ?? null);
    expect(coach).toStrictEqual({
      cells: [
        { regionId: 'tray', col: 1, row: 0 },
        { regionId: 'board', col: 7, row: 3 },
        { regionId: 'board', col: 7, row: 4 },
      ],
      hand: {
        from: { regionId: 'tray', col: 1, row: 0 },
        to: { regionId: 'board', col: 7, row: 3 },
      },
    });
    const board = coach.cells.filter((cell) => cell.regionId === 'board');
    expect(board.map((cell) => start.cells[cell.row * 8 + cell.col])).toStrictEqual([0, 0]);
  });
});

// Lead decision L4 (spec S13): step 4 describes the game as tuned. The monsters march every few
// placements, never after every block, so tutorial step 4 and how-to-play page 4 both say so in
// all four languages.
const CATALOGS = { en, de, fa, ckb } as const;
const MARCH_PHRASES = {
  en: 'every few blocks',
  de: 'Alle paar Blöcke',
  fa: 'هر چند بلوک',
  ckb: 'هەر چەند بلۆکێک',
} as const;

describe('LINE_SIEGE_TEACHING step 4 (lead decision L4)', () => {
  const tutorialStep = LINE_SIEGE_TEACHING.tutorial.steps[3]?.messageId ?? '';
  const howToPlayPage = LINE_SIEGE_TEACHING.howToPlay[3]?.bodyId ?? '';

  it.each(Object.keys(CATALOGS) as (keyof typeof CATALOGS)[])(
    'says the monsters march closer every few blocks in %s, in the tutorial and on how-to-play page 4 (spec S13, L4)',
    (language) => {
      const catalog: Readonly<Record<string, string>> = CATALOGS[language];
      expect([tutorialStep, howToPlayPage]).toStrictEqual([
        'line-siege.tutorial.step-4',
        'line-siege.how-to-play.step-4',
      ]);
      expect(catalog[tutorialStep]).toContain(MARCH_PHRASES[language]);
      expect(catalog[howToPlayPage]).toContain(MARCH_PHRASES[language]);
    },
  );

  it('pins the English texts of L4', () => {
    expect([
      en[tutorialStep as keyof typeof en],
      en[howToPlayPage as keyof typeof en],
    ]).toStrictEqual([
      'Careful: the monsters march closer every few blocks.',
      'The monsters march closer every few blocks.',
    ]);
  });

  it('leaves no catalog saying the monsters march after every block', () => {
    const texts = Object.values(CATALOGS).flatMap((catalog) => Object.values(catalog));
    expect(texts.filter((text) => text.includes('after every block'))).toStrictEqual([]);
  });
});
