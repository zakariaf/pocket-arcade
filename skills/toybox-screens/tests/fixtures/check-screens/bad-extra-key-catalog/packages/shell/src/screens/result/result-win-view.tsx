// packages/shell/src/screens/result/result-win-view.tsx (planted: the fa catalog lacks the extra key)
import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';

import type { ReactNode } from 'react';

export function ResultScoreLine(props: { readonly score: number; readonly bestScore: number }): ReactNode {
  const t = useT();
  return <AppText text={t('result.win.score-line', props)} testID="result.score-card.score-line" />;
}
