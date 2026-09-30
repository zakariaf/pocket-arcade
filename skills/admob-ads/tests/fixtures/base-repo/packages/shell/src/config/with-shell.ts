// packages/shell/src/config/with-shell.ts (fixture: only the extra matters here; the plugin list is shell-plugins.ts)
import { adUnitsExtra } from './ads-config.ts';

import type { AdsMode } from './app-variant.ts';
import type { AdmobGameIds } from './ads-config.ts';

export function shellExtra(ids: AdmobGameIds, adsMode: AdsMode): Record<string, unknown> {
  const adUnits = adUnitsExtra(adsMode, ids); // null unless ADS_MODE=live
  return { appVariant: 'test', adsMode, ...(adUnits === null ? {} : { adUnits }) };
}
