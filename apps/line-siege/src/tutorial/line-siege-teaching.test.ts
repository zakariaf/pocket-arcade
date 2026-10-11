// apps/line-siege/src/tutorial/line-siege-teaching.test.ts
import ckb from '@e07/line-siege/i18n/ckb.json';
import de from '@e07/line-siege/i18n/de.json';
import en from '@e07/line-siege/i18n/en.json';
import fa from '@e07/line-siege/i18n/fa.json';
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';
import { listMoves } from '@e07/line-siege/rules/list-moves.ts';
import { outcome } from '@e07/line-siege/rules/outcome.ts';

import { LINE_SIEGE_TEACHING } from './line-siege-teaching.ts';

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
