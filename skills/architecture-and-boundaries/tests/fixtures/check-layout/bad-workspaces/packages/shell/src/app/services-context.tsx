// packages/shell/src/app/services-context.tsx
import { createContext } from 'react';

import type { AdsPort } from '@demo/shell/services/ads/ads-port.ts';
import type { ClockPort } from '@demo/shell/services/clock/clock-port.ts';

/** Every port the UI may use. */
export type Services = { readonly ads: AdsPort; readonly clock: ClockPort };

export const ServicesContext = createContext<Services | null>(null);
