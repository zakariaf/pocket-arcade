// packages/shell/src/testing/render-with-shell.tsx
// Fixture stand-in for renderWithShell (unit-and-component-tests ships the real one).
import { render } from '@testing-library/react-native';

import type { ReactElement } from 'react';

export async function renderWithShell(ui: ReactElement): Promise<unknown> {
  return render(ui);
}
