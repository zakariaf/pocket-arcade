// packages/shell/src/app/debug-services-context.tsx
// How the S15 debug screen reaches the debug services and the debug link handler: the composition
// root builds both once through the test-only entry (createDebugParts; null in store builds, where
// S15 does not exist) and the app root provides them. Only types are imported from the debug
// module, so a store bundle carries none of its code.
import { createContext, use } from 'react';

import type { DebugLinkHandler } from '@e07/shell/app/debug-link-handler.ts';
import type { DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { ReactNode } from 'react';

type DebugTools = {
  readonly services: DebugServices | null;
  readonly links: DebugLinkHandler | null;
};

const DebugServicesContext = createContext<DebugTools>({ services: null, links: null });

export type DebugServicesProviderProps = {
  readonly services: DebugServices | null;
  /** The debug link handler: S15's tools apply their requests through it (null in store builds). */
  readonly links?: DebugLinkHandler | null;
  readonly children: ReactNode;
};

export function DebugServicesProvider(props: DebugServicesProviderProps): ReactNode {
  const tools: DebugTools = { services: props.services, links: props.links ?? null };
  return <DebugServicesContext value={tools}>{props.children}</DebugServicesContext>;
}

/** For S15 and the debug link only; outside a test build (or without the provider) it throws. */
export function useDebugServices(): DebugServices {
  const { services } = use(DebugServicesContext);
  if (services === null) {
    throw new Error('useDebugServices() needs a test build and a <DebugServicesProvider> above it');
  }
  return services;
}

/**
 * For any hook in any build: the test build's debug services, or null (store builds, and tests
 * without the provider). The ad policy reads the debug ad switches through it.
 */
export function useOptionalDebugServices(): DebugServices | null {
  return use(DebugServicesContext).services;
}

/** For S15 only: the link handler's apply(); outside a test build (or without links) it throws. */
export function useDebugLinks(): DebugLinkHandler {
  const { links } = use(DebugServicesContext);
  if (links === null) {
    throw new Error('useDebugLinks() needs a test build and <DebugServicesProvider links={...}>');
  }
  return links;
}
