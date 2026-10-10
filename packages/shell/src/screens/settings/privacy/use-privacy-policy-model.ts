// packages/shell/src/screens/settings/privacy/use-privacy-policy-model.ts
// S11c's model hook: the policy is offline text in the catalogs; the model adds the game's name,
// the support address and the date of the policy's last change in the Shell's date format.
import { useNavigation } from '@react-navigation/native';

import { useGameExtra } from '@e07/shell/app/use-game-extra.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { stripIsolates } from '@e07/shell/i18n/bidi.ts';
import { formatMonthShort } from '@e07/shell/i18n/format-date.ts';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';

import type { PrivacyPolicyModel } from './privacy-policy-view.tsx';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { TFunction } from '@e07/shell/i18n/create-t.ts';

/** Chosen: the day the policy text last changed. Change it with the privacy.* texts. */
export const PRIVACY_POLICY_UPDATED: DateKey = '2026-09-27';

/** date.day-month-year: "27 Sep 2026" (digits and month names in the player's language). */
/**
 * "27 Sep 2026" for the privacy.updated sentence, which isolates it as dateText. The month (a
 * *Name placeholder) comes back isolated too; nested, that isolate hid the only strong letter
 * from the outer one, which then ran left to right ("۲۰۲۶ سپتامبر ۲۷" in fa). A date is one run of
 * its language: drop the inner isolate.
 */
export function formatDayMonthYear(date: DateKey, t: TFunction): string {
  return stripIsolates(
    t('date.day-month-year', {
      day: Number(date.slice(8, 10)),
      monthName: formatMonthShort(date, t),
      year: Number(date.slice(0, 4)),
    }),
  );
}

export function usePrivacyPolicyModel(): PrivacyPolicyModel {
  const t = useT();
  const navigation = useNavigation();
  const host = useGameHost();
  return {
    gameName: gameMessageText(t, { id: host.nameId }),
    emailText: useGameExtra().links.supportEmail,
    updatedDateText: formatDayMonthYear(PRIVACY_POLICY_UPDATED, t),
    isReducedMotion: useReduceMotion(),
    onBack: () => {
      navigation.goBack();
    },
  };
}
