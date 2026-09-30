// packages/shell/src/screens/debug/debug-actions.ts
// What each S15 chevron row does (use-debug-model.ts gathers the deps). Every change goes through
// the debug link handler (links.apply) or the debug services, the same code the debug link runs,
// so a tool and a flow never disagree about what "level 12" or "offline" means.
import {
  dateChoices,
  errorLogText,
  giveStarsRequest,
  levelChoices,
  LOCALE_CHOICES,
  packChoices,
  stateText,
  unlockAllRequest,
} from './debug-tools.ts';

import type { DebugLinkRequest } from './debug-link.ts';
import type { DebugAction } from './debug-rows.ts';
import type { DebugServices } from './debug-services.ts';
import type { DebugSheets } from './debug-sheets.ts';
import type { Choice } from './debug-tools.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { DebugLinkHandler } from '@e07/shell/app/debug-link-handler.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';

export type DebugToolDeps = {
  readonly services: DebugServices;
  readonly links: Pick<DebugLinkHandler, 'apply'>;
  readonly sheets: DebugSheets;
  readonly save: Pick<SaveService, 'doc'>;
  readonly errorLog: ErrorLogPort;
  /** ClockPort.today of the app's one (simulated) clock. */
  readonly today: () => DateKey;
  /** The game's packs (expo.extra.game.levels). */
  readonly levels: { readonly packCount: number; readonly levelsPerPack: number };
  /** Re-render S15 after a change no store publishes (a debug flag, the simulated date). */
  readonly onChanged: () => void;
};

/** Shown instead of a tool whose screen part S15 does not have yet. */
export const NOT_BUILT = {
  importSave:
    'Not available yet: S15 has no text field to paste a save into. Export save as text works.',
  fontTest:
    'Not available yet: the font test page (every letter and digit in every font) is not built.',
} as const;

type Sheet<T> = { readonly title: string; readonly choices: readonly Choice<T>[] };

function chooseFrom<T>(deps: DebugToolDeps, sheet: Sheet<T>, onValue: (value: T) => void): void {
  const labels = sheet.choices.map((choice) => choice.label);
  deps.sheets.choose(sheet.title, labels, (index) => {
    const choice = sheet.choices[index];
    if (choice !== undefined) onValue(choice.value);
  });
}

function applyRequest(deps: DebugToolDeps, request: DebugLinkRequest | null): void {
  if (request !== null) deps.links.apply(request);
  deps.onChanged();
}

function jumpToLevel(deps: DebugToolDeps): void {
  const { packCount, levelsPerPack } = deps.levels;
  const title = 'Jump to level';
  chooseFrom(deps, { title, choices: packChoices(packCount, levelsPerPack) }, (pack) => {
    chooseFrom(deps, { title, choices: levelChoices(pack, levelsPerPack) }, (level) => {
      applyRequest(deps, { level, screen: 'game' });
    });
  });
}

function setDate(deps: DebugToolDeps): void {
  chooseFrom(deps, { title: 'Set date', choices: dateChoices(deps.today()) }, (date) => {
    deps.clock.setSimulatedToday(date);
    deps.onChanged();
  });
}

function forceLocale(deps: DebugToolDeps): void {
  const sheet = { title: 'Force language, direction and digits', choices: LOCALE_CHOICES };
  chooseFrom(deps, sheet, (request) => {
    applyRequest(deps, request);
  });
}

function exportSave(deps: DebugToolDeps): void {
  deps.sheets.share(JSON.stringify(deps.save.doc(), null, 1)).catch((error: unknown) => {
    deps.errorLog.record('save', error);
  });
}

function showState(deps: DebugToolDeps): void {
  const text = stateText(deps.services.seedOverride(), deps.save.doc().run);
  deps.sheets.show('Level seed and game state', text);
}

function unlockAll(deps: DebugToolDeps): void {
  const { packCount, levelsPerPack } = deps.levels;
  const levels = deps.save.doc().progress.levels;
  applyRequest(deps, unlockAllRequest(levels, packCount * levelsPerPack));
}

function giveStars(deps: DebugToolDeps): void {
  applyRequest(deps, giveStarsRequest(deps.save.doc().progress.levels));
}

function importSave(deps: DebugToolDeps): void {
  deps.sheets.show('Import save from text', NOT_BUILT.importSave);
}

function showErrorLog(deps: DebugToolDeps): void {
  deps.sheets.show('Error log', errorLogText(deps.errorLog.entries()));
}

function fontTest(deps: DebugToolDeps): void {
  deps.sheets.show('Font test page', NOT_BUILT.fontTest);
}

/** One tool per chevron row; the Record makes a new DebugAction a type error until it has one. */
const TOOLS: Readonly<Record<DebugAction, (deps: DebugToolDeps) => void>> = {
  'jump-to-level': jumpToLevel,
  'unlock-all': unlockAll,
  'give-stars': giveStars,
  'set-date': setDate,
  'show-state': showState,
  'force-locale': forceLocale,
  'export-save': exportSave,
  'import-save': importSave,
  'error-log': showErrorLog,
  'font-test': fontTest,
};

/** Runs one S15 tool (a chevron row). */
export function runDebugAction(deps: DebugToolDeps, action: DebugAction): void {
  TOOLS[action](deps);
}
