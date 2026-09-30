// packages/shell/src/screens/debug/debug-save-recipe.ts
// Pure: what a debug link writes into the save document, as one recipe for one validated write
// (the composition root runs it through updateAndPublish, so every section store re-reads it):
// the settings rows, the first-run milestones, and the progress fixtures (level, stars).
import type { DebugLinkRequest, LevelStars } from './debug-link.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

type Progress = SaveDoc['progress'];
type Stars = 1 | 2 | 3;

/** stars=demo: the screenshot fixture: levels 1-11 won with these stars (28), level 12 next. */
export const DEMO_STARS: readonly Stars[] = [3, 3, 2, 3, 1, 3, 3, 2, 3, 2, 3];

const SAVE_PARAMS = [
  'lang',
  'digits',
  'theme',
  'reduceMotion',
  'firstRun',
  'stars',
  'level',
] as const;

export function hasSaveChanges(request: DebugLinkRequest): boolean {
  return SAVE_PARAMS.some((name) => request[name] !== undefined);
}

function withSettings(doc: SaveDoc, request: DebugLinkRequest): SaveDoc {
  const { lang, digits, theme, reduceMotion: isReducedMotion } = request;
  return {
    ...doc,
    settings: {
      ...doc.settings,
      ...(lang === undefined ? {} : { language: lang }),
      ...(digits === undefined ? {} : { digits }),
      ...(theme === undefined ? {} : { theme }),
      ...(isReducedMotion === undefined ? {} : { reduceMotion: isReducedMotion ? 'on' : 'off' }),
    },
  };
}

/** firstRun=1: S2 next; firstRun=0: language chosen and tutorial done. A lang= also chooses. */
function withFirstRun(doc: SaveDoc, request: DebugLinkRequest): SaveDoc {
  if (request.firstRun === true) {
    return { ...doc, firstRun: { languageChosen: false, tutorialDone: false } };
  }
  if (request.firstRun === false) {
    return { ...doc, firstRun: { languageChosen: true, tutorialDone: true } };
  }
  if (request.lang === undefined) return doc;
  return { ...doc, firstRun: { ...doc.firstRun, languageChosen: true } };
}

function withStars(progress: Progress, entry: LevelStars, today: DateKey): Progress {
  const key = String(entry.level);
  const { [key]: previous, ...others } = progress.levels;
  if (entry.stars === 0) return { ...progress, levels: others };
  const result = previous ?? {
    stars: entry.stars,
    bestScore: 0,
    bestMoves: null,
    completions: 1,
    firstCompletedOn: today,
  };
  return { ...progress, levels: { ...others, [key]: { ...result, stars: entry.stars } } };
}

/** level=N makes N the next level: 1..N-1 are won (1 star unless already won), N.. are cleared. */
function atLevel(progress: Progress, level: number, today: DateKey): Progress {
  const cleared = Object.keys(progress.levels)
    .filter((key) => Number(key) >= level)
    .reduce((next, key) => withStars(next, { level: Number(key), stars: 0 }, today), progress);
  return Array.from({ length: level - 1 }, (_, index) => index + 1)
    .filter((earlier) => cleared.levels[String(earlier)] === undefined)
    .reduce((next, earlier) => withStars(next, { level: earlier, stars: 1 }, today), cleared);
}

function starEntries(stars: DebugLinkRequest['stars']): readonly LevelStars[] {
  if (stars === undefined) return [];
  if (stars === 'demo')
    return DEMO_STARS.map((count, index) => ({ level: index + 1, stars: count }));
  return stars;
}

function withProgress(doc: SaveDoc, request: DebugLinkRequest, today: DateKey): SaveDoc {
  const { level } = request;
  const base = level === undefined ? doc.progress : atLevel(doc.progress, level, today);
  const progress = starEntries(request.stars).reduce(
    (next, entry) => withStars(next, entry, today),
    base,
  );
  // A jump drops the saved level run, so "Continue" never resumes a level the jump cleared.
  return { ...doc, progress, ...(level === undefined ? {} : { run: null }) };
}

/** The whole write of one link; today is the day after the link's own date= was applied. */
export function debugSaveRecipe(
  request: DebugLinkRequest,
  today: DateKey,
): (doc: SaveDoc) => SaveDoc {
  return (doc) => withProgress(withFirstRun(withSettings(doc, request), request), request, today);
}
