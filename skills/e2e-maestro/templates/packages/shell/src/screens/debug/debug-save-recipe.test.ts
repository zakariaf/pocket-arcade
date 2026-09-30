// packages/shell/src/screens/debug/debug-save-recipe.test.ts
import { validateSaveDoc } from '@e07/shell/services/save/save-codec.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import { debugSaveRecipe, DEMO_STARS, hasSaveChanges } from './debug-save-recipe.ts';

import type { DebugLinkRequest } from './debug-link.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

const TODAY = '2026-09-26';
const FRESH = createDefaultSaveDoc('line-siege');

function apply(request: DebugLinkRequest, doc: SaveDoc = FRESH): SaveDoc {
  const next = debugSaveRecipe(request, TODAY)(doc);
  // Every recipe result must pass the save's own validation (the write would throw otherwise).
  expect(validateSaveDoc(next)).not.toHaveProperty('error');
  return next;
}

const starsOf = (doc: SaveDoc): Record<string, number> =>
  Object.fromEntries(
    Object.entries(doc.progress.levels).map(([key, result]) => [key, result.stars]),
  );

describe('debugSaveRecipe', () => {
  it('writes the settings rows a link names, and nothing else', () => {
    const doc = apply({ lang: 'fa', digits: 'latin', theme: 'dark', reduceMotion: true });
    expect(doc.settings).toStrictEqual({
      ...FRESH.settings,
      language: 'fa',
      digits: 'latin',
      theme: 'dark',
      reduceMotion: 'on',
    });
    expect(doc.firstRun).toStrictEqual({ languageChosen: true, tutorialDone: false });
  });

  it('sets both first-run milestones either way', () => {
    expect(apply({ firstRun: false }).firstRun).toStrictEqual({
      languageChosen: true,
      tutorialDone: true,
    });
    const done = apply({ firstRun: false });
    expect(apply({ firstRun: true, lang: 'en' }, done).firstRun).toStrictEqual({
      languageChosen: false,
      tutorialDone: false,
    });
  });

  it('writes the screenshot fixture for stars=demo', () => {
    const doc = apply({ stars: 'demo' });
    expect(Object.values(starsOf(doc))).toStrictEqual(DEMO_STARS);
    expect(doc.progress.levels['11']).toStrictEqual({
      stars: 3,
      bestScore: 0,
      bestMoves: null,
      completions: 1,
      firstCompletedOn: TODAY,
    });
  });

  it('changes only the stars of a level already won, and clears a level for 0', () => {
    const won = apply({ stars: [{ level: 1, stars: 1 }] });
    const doc = apply(
      {
        stars: [
          { level: 1, stars: 3 },
          { level: 2, stars: 2 },
        ],
      },
      won,
    );
    expect(starsOf(doc)).toStrictEqual({ '1': 3, '2': 2 });
    expect(starsOf(apply({ stars: [{ level: 2, stars: 0 }] }, doc))).toStrictEqual({ '1': 3 });
  });

  it('makes level= the next level and drops the saved run', () => {
    const played = apply({
      stars: [
        { level: 2, stars: 3 },
        { level: 5, stars: 2 },
      ],
    });
    const doc = apply({ level: 4 }, played);
    expect(starsOf(doc)).toStrictEqual({ '1': 1, '2': 3, '3': 1 });
    expect(doc.run).toBeNull();
  });

  it('knows which links write the save', () => {
    expect(hasSaveChanges({ offline: true, date: TODAY, screen: 'home' })).toBe(false);
    expect(hasSaveChanges({ level: 1 })).toBe(true);
  });
});
