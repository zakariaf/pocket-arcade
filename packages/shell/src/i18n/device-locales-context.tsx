// packages/shell/src/i18n/device-locales-context.tsx
// The phone's languages (expo-localization getLocales(), read once by the composition root's
// device adapters) for the screens that resolve "System" against them (S11a). LocalizedRoot
// provides them; renderWithShell provides an English phone unless a test seeds others. Screens
// never call expo-localization themselves, so their tests need no module mock.
import { createContext, use } from 'react';

import type { DeviceLocale } from './resolve-language.ts';

export const DeviceLocalesContext = createContext<readonly DeviceLocale[]>([]);

export function useDeviceLocales(): readonly DeviceLocale[] {
  return use(DeviceLocalesContext);
}
