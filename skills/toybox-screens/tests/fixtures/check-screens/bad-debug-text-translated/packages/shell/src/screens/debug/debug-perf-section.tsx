// packages/shell/src/screens/debug/debug-perf-section.tsx (fixture: the Performance heading only)
import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';

import type { ReactNode } from 'react';

export function DebugPerfSection(): ReactNode {
  const t = useT();
  return <AppText text={t('debug.perf.heading')} variant="heading" isHeader />;
}
