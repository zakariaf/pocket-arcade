// packages/shell/src/screens/debug/debug-consent.ts (planted bug)
import { createAdmobConsentAdapter } from '@e07/shell/services/consent/admob-consent-adapter.ts';

import type { PremiumAction } from '@e07/shell/stores/premium/premium-state.ts';

export const eeaConsent = createAdmobConsentAdapter({ debugGeography: 'eea', onError: () => undefined });
export const unlock: PremiumAction = { type: 'premium-granted' };
