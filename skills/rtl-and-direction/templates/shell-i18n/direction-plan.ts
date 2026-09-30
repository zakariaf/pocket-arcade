// packages/shell/src/i18n/direction-plan.ts
import { directionOf, isLanguage } from './languages.ts';

import type { Direction, Language } from './languages.ts';

export type DirectionPlan = 'keep' | 'restart' | 'give-up';

export type DirectionPlanInput = {
  readonly language: Language;
  readonly layout: Direction; // what I18nManager reports for this JS run
  readonly pendingRestart: Direction | null; // set just before our previous reload
};

// Pure decision, run first at every startup and after S2/Settings language changes.
export function planDirection({
  language,
  layout,
  pendingRestart,
}: DirectionPlanInput): DirectionPlan {
  const desired = directionOf(language);
  if (desired === layout) return 'keep';
  // We already reloaded for this direction and it still does not match: never loop.
  if (pendingRestart === desired) return 'give-up';
  return 'restart';
}

// Reads settings.language from an unvalidated, un-migrated save document (read-only peek).
export function languageFromRawSave(raw: unknown): Language | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const settings: unknown = Reflect.get(raw, 'settings');
  if (typeof settings !== 'object' || settings === null) return null;
  const language: unknown = Reflect.get(settings, 'language');
  return isLanguage(language) ? language : null;
}
