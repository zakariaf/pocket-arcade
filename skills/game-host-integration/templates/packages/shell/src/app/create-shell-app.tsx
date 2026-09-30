// packages/shell/src/app/create-shell-app.tsx
import { createShellParts } from '@e07/shell/app/create-shell-parts.ts';
import { createDeviceAdapters } from '@e07/shell/app/device-adapters.ts';
import { ShellApp } from '@e07/shell/app/shell-app.tsx';

import type { CreateShellAppInput } from '@e07/shell/app/create-shell-parts.ts';
import type { ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';
import type { ComponentType, ReactNode } from 'react';

export type { CreateShellAppInput, ShellLaunch } from '@e07/shell/app/create-shell-parts.ts';

/**
 * The composition root, called by startShell only AFTER the direction check: the device's
 * adapters once, then createShellParts (save, game host, stores, services) once, then the root
 * component registerRootComponent renders (wrapped by a test-build launch, if it asks).
 */
export function createShellApp<T extends ShellGameTypes>(
  input: CreateShellAppInput<T>,
): ComponentType {
  const parts = createShellParts(input, createDeviceAdapters());
  function ShellRoot(): ReactNode {
    return <ShellApp parts={parts} />;
  }
  return input.launch?.wrapRoot?.(ShellRoot) ?? ShellRoot;
}
