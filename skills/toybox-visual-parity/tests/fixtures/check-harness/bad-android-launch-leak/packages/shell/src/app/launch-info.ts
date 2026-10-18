// packages/shell/src/app/launch-info.ts
import { requireOptionalNativeModule } from 'expo';

type LaunchModule = { readonly getLaunchExtra: (key: string) => string | null };

/** Planted: the parity launch extra read outside the test-only harness. */
export function launchFrame(): string | null {
  return requireOptionalNativeModule<LaunchModule>('ParityLaunch')?.getLaunchExtra('parity') ?? null;
}
