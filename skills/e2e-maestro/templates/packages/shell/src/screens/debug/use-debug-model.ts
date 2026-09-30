// packages/shell/src/screens/debug/use-debug-model.ts
// S15's model hook, the only code of the debug menu that reads stores, services and navigation.
// The switches and the tools change the app only through the debug services and the debug link
// handler's apply() and importSave() (useDebugServices / useDebugLinks), exactly what the debug
// link does, so a flow and a tester reach the same state. DebugView only draws what this returns:
// the Import save row opens importField (a paste field the view draws under the list), the Font
// test row opens the FontTest route.
import { useNavigation } from '@react-navigation/native';
import { useReducer, useState } from 'react';

import { useDebugLinks, useDebugServices } from '@e07/shell/app/debug-services-context.tsx';
import { useServices } from '@e07/shell/app/services-context.tsx';
import { levelCountOf, useGameExtra } from '@e07/shell/app/use-game-extra.ts';
import { useReduceMotionSetting } from '@e07/shell/app/use-reduce-motion-setting.ts';
import { createNumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';
import { localeTagFor } from '@e07/shell/i18n/digits.ts';
import { useDirection } from '@e07/shell/i18n/direction-context.tsx';
import { formatWeekdayDayMonth } from '@e07/shell/i18n/format-date.ts';
import { useLanguage } from '@e07/shell/i18n/language-context.tsx';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import { selectNextLevel } from '@e07/shell/stores/progress-selectors.ts';
import { useProgressStore } from '@e07/shell/stores/progress-store.ts';
import { selectDigits } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import { runDebugAction } from './debug-actions.ts';
import { DEBUG_SHEETS } from './debug-sheets.ts';
import { localeValue, networkAttemptsOf } from './debug-tools.ts';

import type { DebugAction, DebugSwitch } from './debug-rows.ts';
import type { DebugServices } from './debug-services.ts';
import type { DebugModel } from './debug-view.tsx';
import type { DebugImportResult } from '@e07/shell/app/debug-link-handler.ts';

/** "Import save from text": the paste field the Import save row opens. */
export type DebugImportField = {
  readonly isOpen: boolean;
  readonly text: string;
  /** Why the last import failed, as one sentence, or null. */
  readonly error: string | null;
  readonly onChangeText: (text: string) => void;
  /** Imports the pasted text; closes the field when it worked. */
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
};

/** DebugModel plus the JS network guard's counter (debug.network-attempts, flows assert "0"). */
export type DebugScreenModel = DebugModel & {
  readonly networkAttempts: string;
  readonly importField: DebugImportField;
  /** A save exported as text (Export save), read through the save codec, then one write. */
  readonly importSave: (text: string) => DebugImportResult;
  /** The font test page (the FontTest route of the Debug group). */
  readonly openFontTest: () => void;
};

type ImportFieldState = {
  readonly field: DebugImportField;
  readonly open: () => void;
};

function switchesOf(services: DebugServices, isPremium: boolean): DebugModel['switches'] {
  const ads = services.adsOverride();
  return {
    'ads-always-test': ads === 'always-test',
    'ads-never': ads === 'never',
    premium: isPremium,
    offline: services.isOffline(),
  };
}

function toggle(services: DebugServices, id: DebugSwitch, switches: DebugModel['switches']): void {
  if (id === 'premium') services.setPremium(!switches.premium);
  if (id === 'offline') services.setOffline(!switches.offline);
  if (id === 'ads-always-test') services.setAdsOverride(switches[id] ? null : 'always-test');
  if (id === 'ads-never') services.setAdsOverride(switches[id] ? null : 'never');
}

/** "en · ltr · 123": the language, the layout direction and 123 in the digit setting. */
function useLocaleValue(): string {
  const language = useLanguage();
  const formatNumber = createNumberFormatter(
    localeTagFor(language, useSettingsStore(selectDigits)),
  );
  return localeValue(language, useDirection(), formatNumber(123));
}

/** The paste field: open, typed text, the last error, and the submit through importSave. */
function useImportField(importSave: (text: string) => DebugImportResult): ImportFieldState {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const close = (): void => {
    setIsOpen(false);
    setText('');
    setError(null);
  };
  const onSubmit = (): void => {
    const result = importSave(text);
    if (result.kind === 'imported') close();
    else setError(result.message);
  };
  const open = (): void => {
    setIsOpen(true);
  };
  return { open, field: { isOpen, text, error, onChangeText: setText, onSubmit, onCancel: close } };
}

type ActionHooks = {
  readonly onChanged: () => void;
  readonly openImport: () => void;
  readonly openFontTest: () => void;
};

/** The chevron rows: each runs one tool of debug-actions.ts with the app's own services. */
function useDebugActions(hooks: ActionHooks): (action: DebugAction) => void {
  const services = useDebugServices();
  const links = useDebugLinks();
  const { clock, errorLog, save } = useServices();
  const { levels } = useGameExtra();
  const deps = { services, links, sheets: DEBUG_SHEETS, save, errorLog, levels, ...hooks };
  return (action) => {
    runDebugAction({ ...deps, today: clock.today }, action);
  };
}

/** The value column of the rows (next level, simulated day, locale, error count). */
function useValues(errorCount: number): DebugModel['values'] {
  const t = useT();
  const { clock } = useServices();
  const levelCount = levelCountOf(useGameExtra());
  const nextLevel = useProgressStore((state) => selectNextLevel(state, levelCount));
  return {
    level: String(nextLevel),
    date: formatWeekdayDayMonth(clock.today(), t),
    locale: useLocaleValue(),
    errors: String(errorCount),
  };
}

export function useDebugModel(): DebugScreenModel {
  const navigation = useNavigation();
  const services = useDebugServices();
  const links = useDebugLinks();
  const { errorLog } = useServices();
  // Debug flags and the simulated date live outside the stores: a change re-renders by hand.
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const switches = switchesOf(
    services,
    usePremiumStore((state) => state.isPremium),
  );
  const entries = errorLog.entries();
  const importSave = (text: string): DebugImportResult => {
    const result = links.importSave(text);
    refresh(); // the error log grew, or the imported save changed the rows
    return result;
  };
  const imports = useImportField(importSave);
  const openFontTest = (): void => {
    navigation.navigate('FontTest');
  };
  return {
    values: useValues(entries.length),
    switches,
    networkAttempts: String(networkAttemptsOf(entries)),
    // The saved choice: this model is reached from the test-only entry, so importing
    // use-reduce-motion.ts (which reads TEST_ONLY) would close an import loop.
    isReducedMotion: useReduceMotionSetting(),
    onBack: () => {
      navigation.goBack();
    },
    onAction: useDebugActions({ onChanged: refresh, openImport: imports.open, openFontTest }),
    onToggle: (id) => {
      toggle(services, id, switches);
      refresh();
    },
    importField: imports.field,
    importSave,
    openFontTest,
  };
}
