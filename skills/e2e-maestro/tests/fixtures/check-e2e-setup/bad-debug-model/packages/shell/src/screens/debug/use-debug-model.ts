// packages/shell/src/screens/debug/use-debug-model.ts
// S15's model hook, the only code of the debug menu that reads stores, services and navigation.
// The switches and the tools change the app only through the debug services and the debug link
// handler's apply() (useDebugServices / useDebugLinks), exactly what the debug link does, so a
// flow and a tester reach the same state. DebugView only draws what this returns.
import { useNavigation } from '@react-navigation/native';
import { useReducer } from 'react';

import { useDebugLinks, useDebugServices } from '@e07/shell/app/debug-services-context.tsx';
import { useServices } from '@e07/shell/app/services-context.tsx';
import { levelCountOf, useGameExtra } from '@e07/shell/app/use-game-extra.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
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

/** DebugModel plus the JS network guard's counter (debug.network-attempts, flows assert "0"). */
export type DebugScreenModel = DebugModel & { readonly networkAttempts: string };

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

/** The chevron rows: each runs one tool of debug-actions.ts with the app's own services. */
function useDebugActions(onChanged: () => void): (action: DebugAction) => void {
  const services = useDebugServices();
  const links = useDebugLinks();
  const { clock, errorLog, save } = useServices();
  const { levels } = useGameExtra();
  const deps = { services, links, sheets: DEBUG_SHEETS, save, errorLog, levels, onChanged };
  return (action) => {
    runDebugAction({ ...deps, today: clock.today }, action);
  };
}

export function useDebugModel(): DebugScreenModel {
  const t = useT();
  const navigation = useNavigation();
  const services = useDebugServices();
  const { clock, errorLog } = useServices();
  // Debug flags and the simulated date live outside the stores: a change re-renders by hand.
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const levelCount = levelCountOf(useGameExtra());
  const nextLevel = useProgressStore((state) => selectNextLevel(state, levelCount));
  const switches = switchesOf(
    services,
    usePremiumStore((state) => state.isPremium),
  );
  const entries = errorLog.entries();
  return {
    values: {
      level: String(nextLevel),
      date: formatWeekdayDayMonth(clock.today(), t),
      locale: useLocaleValue(),
      errors: String(entries.length),
    },
    switches,
    isReducedMotion: useReduceMotion(),
    onBack: () => {
      navigation.goBack();
    },
    onAction: useDebugActions(refresh),
    onToggle: (id) => {
      toggle(services, id, switches);
      refresh();
    },
  };
}
