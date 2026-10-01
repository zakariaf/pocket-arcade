// packages/shell/src/screens/debug/use-debug-model.ts
// S15's model hook, the only code of the debug menu that reads stores, services and navigation.
// The switches and the tools change the app only through the debug services and the debug link
// handler's apply() and importSave() (useDebugServices / useDebugLinks), exactly what the debug
// link does, so a flow and a tester reach the same state. DebugView only draws what this returns:
// the Import save row opens importField (a paste field the view draws under the list), the Font
// test row opens the FontTest route, and the Performance section draws perf (the switch
// debug.perf-record-switch, the rows debug.perf-share-row and debug.perf-benchmark-row, the value
// debug.perf-summary), all through services.perf over the perf log.
// S15 is a design frame like every other (lead decision L12): its labels stay English in every
// language (L13, the debug.* catalog texts), while its numbers and dates follow the language's digits
// as the design draws them (Persian ۱۲ and ۰ in fa): createNumberFormatter, never String(n). A parity
// capture of s15-debug-menu opens its frame state 'debug-ads-always-test' once, through the
// "Always show test ads" switch's own handler (debug ads override 'always-test'). S15 is reached only
// through the test-only entry, so it reads parityFrameState() from app/parity/parity-session.ts:
// useParityOpener (which reads the gate, app/test-only.ts) would close an import loop through the
// gate's require() (check-boundaries rule import-cycle).
import { useNavigation } from '@react-navigation/native';
import { useEffect, useEffectEvent, useReducer, useState } from 'react';

import { useDebugLinks, useDebugServices } from '@e07/shell/app/debug-services-context.tsx';
import { parityFrameState } from '@e07/shell/app/parity/parity-session.ts';
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
import { perfSummaryOf, perfSummaryText } from './debug-perf.ts';
import { DEBUG_SHEETS } from './debug-sheets.ts';
import { localeValue, networkAttemptsOf } from './debug-tools.ts';

import type { DebugAction, DebugSwitch } from './debug-rows.ts';
import type { DebugServices } from './debug-services.ts';
import type { DebugModel } from './debug-view.tsx';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { DebugImportResult } from '@e07/shell/app/debug-link-handler.ts';
import type { PerfEntry } from '@e07/shell/app/perf/perf-log.ts';
import type { NumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';

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

/** S15's Performance section (test builds): frame recording, the report, the save benchmark. */
export type DebugPerfModel = {
  /** debug.perf-record-switch: frame times are recorded into the perf log while it is on. */
  readonly isRecording: boolean;
  readonly onToggleRecording: () => void;
  /** debug.perf-share-row: the iOS share sheet with the perf log as JSON (nothing is sent). */
  readonly onShare: () => void;
  /** debug.perf-benchmark-row: 300 save writes into a scratch database, one save-benchmark entry. */
  readonly onRunBenchmark: () => void;
  /** PerfLog.entries().length: the count S15's debug.perf.summary text names. */
  readonly entriesCount: number;
  /** debug.perf-summary: "cold 3 · 1049 ms · save p95 0.41 ms". */
  readonly summary: string;
};

/** DebugModel plus the JS network guard's counter (debug.network-attempts, flows assert "0"). */
export type DebugScreenModel = DebugModel & {
  readonly networkAttempts: string;
  readonly importField: DebugImportField;
  /** A save exported as text (Export save), read through the save codec, then one write. */
  readonly importSave: (text: string) => DebugImportResult;
  /** The font test page (the FontTest route of the Debug group). */
  readonly openFontTest: () => void;
  readonly perf: DebugPerfModel;
};

type ImportFieldState = {
  readonly field: DebugImportField;
  readonly open: () => void;
};

/** S15's "Always show test ads" switch (debug ads override 'always-test'). */
const ALWAYS_TEST_SWITCH = 'ads-always-test' satisfies DebugSwitch;

function switchesOf(services: DebugServices, isPremium: boolean): DebugModel['switches'] {
  const ads = services.adsOverride();
  return {
    [ALWAYS_TEST_SWITCH]: ads === 'always-test',
    'ads-never': ads === 'never',
    premium: isPremium,
    offline: services.isOffline(),
  };
}

function toggle(services: DebugServices, id: DebugSwitch, switches: DebugModel['switches']): void {
  if (id === 'premium') services.setPremium(!switches.premium);
  if (id === 'offline') services.setOffline(!switches.offline);
  if (id === ALWAYS_TEST_SWITCH) services.setAdsOverride(switches[id] ? null : 'always-test');
  if (id === 'ads-never') services.setAdsOverride(switches[id] ? null : 'never');
}

/** The switches' handler; the s15-debug-menu parity frame turns "Always show test ads" on through it, once. */
function useToggle(services: DebugServices, isPremium: boolean, refresh: () => void) {
  const onToggle = (id: DebugSwitch): void => {
    toggle(services, id, switchesOf(services, isPremium));
    refresh();
  };
  useFrameStateOnce(() => {
    if (!switchesOf(services, isPremium)[ALWAYS_TEST_SWITCH]) onToggle(ALWAYS_TEST_SWITCH);
  });
  return onToggle;
}

/** The s15-debug-menu capture's state, opened once on mount; a normal launch does nothing. */
function useFrameStateOnce(open: () => void): void {
  const [isDue] = useState(() => parityFrameState() === 'debug-ads-always-test');
  const openOnce = useEffectEvent(open);
  useEffect(() => {
    if (isDue) openOnce();
  }, [isDue]);
}

/** Numbers in the language's digits and the digit setting (Persian ۱۲ in fa), as the design draws S15. */
function useFormatNumber(): NumberFormatter {
  return createNumberFormatter(localeTagFor(useLanguage(), useSettingsStore(selectDigits)));
}

/** "en · ltr · 123": the language, the layout direction and 123 in the digit setting. */
function useLocaleValue(formatNumber: NumberFormatter): string {
  return localeValue(useLanguage(), useDirection(), formatNumber(123));
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

/** What S15 shows that lives outside React: the debug flags, the simulated day and the two logs. */
export type DebugState = {
  readonly switches: DebugModel['switches'];
  readonly today: DateKey;
  readonly errorEntries: ReturnType<ErrorLogPort['entries']>;
  readonly perfEntries: readonly PerfEntry[];
  readonly isRecording: boolean;
};

type DebugSources = {
  readonly services: DebugServices;
  readonly errorLog: ErrorLogPort;
  readonly clock: ClockPort;
};

/**
 * Reads S15's outside state in one place. `_version` is the refresh counter: an argument, so the
 * React Compiler (on in app builds, off in Jest) reads again after every change instead of keeping
 * the value it memoized by the service objects, which never change. These sources have no
 * subscription: on the simulator "Simulate offline" saved true while its switch still drew off, and
 * the summary kept "Performance log: empty" after the benchmark wrote its entry (round 5).
 */
export function readDebugState(
  sources: DebugSources,
  isPremium: boolean,
  _version: number,
): DebugState {
  const { services, errorLog, clock } = sources;
  return {
    switches: switchesOf(services, isPremium),
    today: clock.today(),
    errorEntries: errorLog.entries(),
    perfEntries: services.perfLog.entries(),
    isRecording: services.perf.isRecording(),
  };
}

/** The value column of the rows (next level, simulated day, locale, error count), in the language's digits. */
function useValues(state: DebugState): DebugModel['values'] {
  const t = useT();
  const formatNumber = useFormatNumber();
  const levelCount = levelCountOf(useGameExtra());
  const nextLevel = useProgressStore((progress) => selectNextLevel(progress, levelCount));
  return {
    level: formatNumber(nextLevel),
    date: formatWeekdayDayMonth(state.today, t),
    locale: useLocaleValue(formatNumber),
    errors: formatNumber(state.errorEntries.length),
  };
}

type PerfHooks = { readonly onChanged: () => void; readonly errorLog: ErrorLogPort };

/** The Performance section over services.perf; a failed share goes to the error log. */
function perfModelOf(services: DebugServices, state: DebugState, hooks: PerfHooks): DebugPerfModel {
  const { perf } = services;
  return {
    isRecording: state.isRecording,
    onToggleRecording: () => {
      perf.setRecording(!perf.isRecording());
      hooks.onChanged();
    },
    onShare: () => {
      perf.share().catch((error: unknown) => {
        hooks.errorLog.record('boot', error);
      });
    },
    onRunBenchmark: () => {
      perf.runSaveBenchmark();
      hooks.onChanged();
    },
    entriesCount: state.perfEntries.length,
    summary: perfSummaryText(perfSummaryOf(state.perfEntries)),
  };
}

export function useDebugModel(): DebugScreenModel {
  const navigation = useNavigation();
  const services = useDebugServices();
  const links = useDebugLinks();
  const { errorLog, clock } = useServices();
  // Debug flags, the simulated date and the logs live outside the stores: a change re-renders by
  // hand, and the new version makes readDebugState read them again.
  const [version, refresh] = useReducer((count: number) => count + 1, 0);
  const isPremium = usePremiumStore((premium) => premium.isPremium);
  const onToggle = useToggle(services, isPremium, refresh);
  const state = readDebugState({ services, errorLog, clock }, isPremium, version);
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
    values: useValues(state),
    switches: state.switches,
    // Latin digits in every language: every smoke flow asserts '0' (the design draws no counter).
    networkAttempts: String(networkAttemptsOf(state.errorEntries)),
    // The saved choice: this model is reached from the test-only entry, so importing
    // use-reduce-motion.ts (which reads TEST_ONLY) would close an import loop.
    isReducedMotion: useReduceMotionSetting(),
    onBack: () => {
      navigation.goBack();
    },
    onAction: useDebugActions({ onChanged: refresh, openImport: imports.open, openFontTest }),
    onToggle,
    importField: imports.field,
    importSave,
    openFontTest,
    perf: perfModelOf(services, state, { onChanged: refresh, errorLog }),
  };
}
