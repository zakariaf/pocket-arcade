// packages/shell/src/app/services-context.tsx
import { createContext, use } from 'react';

import type { AdsPort } from '@e07/shell/services/ads/ads-port.ts';
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ConnectivityPort } from '@e07/shell/services/connectivity/connectivity-port.ts';
import type { ConsentPort } from '@e07/shell/services/consent/consent-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';
import type { PurchasePort } from '@e07/shell/services/purchase/purchase-port.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { JSX, ReactNode } from 'react';

/** Every port the UI may use, created once in the composition root (fakes in tests). */
export type Services = {
  readonly ads: AdsPort;
  readonly audio: AudioPort;
  readonly clock: ClockPort;
  readonly connectivity: ConnectivityPort;
  readonly consent: ConsentPort;
  readonly errorLog: ErrorLogPort;
  readonly haptics: HapticsPort;
  readonly purchase: PurchasePort;
  readonly save: SaveService;
};

const ServicesContext = createContext<Services | null>(null);

export type ServicesProviderProps = {
  readonly services: Services;
  readonly children: ReactNode;
};

export function ServicesProvider({ services, children }: ServicesProviderProps): JSX.Element {
  return <ServicesContext value={services}>{children}</ServicesContext>;
}

/** Returns the ports. A missing provider is a programmer error, so it throws. */
export function useServices(): Services {
  const services = use(ServicesContext);
  if (services === null) throw new Error('useServices() needs a <ServicesProvider> above it');
  return services;
}
