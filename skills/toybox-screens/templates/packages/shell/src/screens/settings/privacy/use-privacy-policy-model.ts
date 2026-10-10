// packages/shell/src/screens/settings/privacy/use-privacy-policy-model.ts
// S11c's model hook: the policy is offline text in the catalogs; the model adds the game's name,
// the support address and the date of the policy's last change in the Shell's date format
// (formatDayMonthYear, one run of the player's language).
import { useNavigation } from '@react-navigation/native';

import { useGameExtra } from '@e07/shell/app/use-game-extra.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { formatDayMonthYear } from '@e07/shell/i18n/format-date.ts';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';

import type { PrivacyPolicyModel } from './privacy-policy-view.tsx';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

/** Chosen: the day the policy text last changed. Change it with the privacy.* texts. */
export const PRIVACY_POLICY_UPDATED: DateKey = '2026-09-27';

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
