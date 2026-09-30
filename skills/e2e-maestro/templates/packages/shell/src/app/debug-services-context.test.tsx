// packages/shell/src/app/debug-services-context.test.tsx
// no-shell-context: the context holds one value; the hook is rendered bare on purpose.
import { renderHook } from '@testing-library/react-native';

import {
  DebugServicesProvider,
  useDebugLinks,
  useDebugServices,
  useOptionalDebugServices,
} from './debug-services-context.tsx';

import type { DebugLinkHandler } from './debug-link-handler.ts';
import type { DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { ReactNode } from 'react';

const SERVICES: DebugServices = {
  setOffline: jest.fn(),
  isOffline: () => false,
  setDate: jest.fn(),
  setPremium: jest.fn(),
  createConsent: jest.fn(),
  setBoardLayout: jest.fn(),
  isBoardLayoutOn: () => false,
  setAdsOverride: jest.fn(),
  adsOverride: () => null,
  setSeed: jest.fn(),
  seedOverride: () => null,
  perfLog: { append: jest.fn(), entries: () => [] },
};

const LINKS: DebugLinkHandler = {
  handleUrl: () => ({ kind: 'ignored' }),
  apply: () => ({ kind: 'applied' }),
  importSave: () => ({ kind: 'imported' }),
  listen: () => () => undefined,
  start: () => () => undefined,
};

describe('useDebugServices', () => {
  it('hands S15 the services the composition root built', async () => {
    const wrapper = (props: { readonly children: ReactNode }) => (
      <DebugServicesProvider services={SERVICES}>{props.children}</DebugServicesProvider>
    );
    const { result } = await renderHook(() => useDebugServices(), { wrapper });
    expect(result.current).toBe(SERVICES);
  });

  it('throws in a store build, where there are no debug services', async () => {
    const wrapper = (props: { readonly children: ReactNode }) => (
      <DebugServicesProvider services={null}>{props.children}</DebugServicesProvider>
    );
    await expect(renderHook(() => useDebugServices(), { wrapper })).rejects.toThrow(
      'needs a test build',
    );
  });
});

describe('useDebugLinks', () => {
  it('hands S15 the link handler the composition root built', async () => {
    const wrapper = (props: { readonly children: ReactNode }) => (
      <DebugServicesProvider services={SERVICES} links={LINKS}>
        {props.children}
      </DebugServicesProvider>
    );
    const { result } = await renderHook(() => useDebugLinks(), { wrapper });
    expect(result.current).toBe(LINKS);
  });

  it('throws when the provider was given no handler (a store build)', async () => {
    const wrapper = (props: { readonly children: ReactNode }) => (
      <DebugServicesProvider services={SERVICES}>{props.children}</DebugServicesProvider>
    );
    await expect(renderHook(() => useDebugLinks(), { wrapper })).rejects.toThrow(
      'needs a test build',
    );
  });
});

describe('useOptionalDebugServices', () => {
  it('gives the services in a test build and null without the provider', async () => {
    const wrapper = (props: { readonly children: ReactNode }) => (
      <DebugServicesProvider services={SERVICES}>{props.children}</DebugServicesProvider>
    );
    const { result: provided } = await renderHook(() => useOptionalDebugServices(), { wrapper });
    const { result: bare } = await renderHook(() => useOptionalDebugServices());
    expect([provided.current, bare.current]).toStrictEqual([SERVICES, null]);
  });

  it("gives Home the test build's perf log, and null in a store build", async () => {
    const wrapper = (props: { readonly children: ReactNode }) => (
      <DebugServicesProvider services={SERVICES}>{props.children}</DebugServicesProvider>
    );
    const usePerfLog = () => useOptionalDebugServices()?.perfLog ?? null;
    const { result: testBuild } = await renderHook(usePerfLog, { wrapper });
    const { result: storeBuild } = await renderHook(usePerfLog);
    expect([testBuild.current, storeBuild.current]).toStrictEqual([SERVICES.perfLog, null]);
  });
});
