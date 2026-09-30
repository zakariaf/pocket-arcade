// packages/shell/src/screens/result/result-win-view.tsx (planted: the retired moves-count line)
import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';

import type { ReactNode } from 'react';

export function ResultMovesLine({ movesCount }: { readonly movesCount: number }): ReactNode {
  const t = useT();
  return <AppText text={t('result.win.moves-count', { movesCount })} testID="result.score-card.moves-line" />;
}
