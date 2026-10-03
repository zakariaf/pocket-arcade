// packages/shell/src/i18n/t.tsx
import { AppText } from '@e07/shell/ui/app-text.tsx';

import { useT } from './t-context.ts';

import type { MessageValues } from './create-t.ts';
import type { MessageKey } from './messages.ts';
import type { AppTextProps } from '@e07/shell/ui/app-text.tsx';
import type { ReactNode } from 'react';

export type TProps = Omit<AppTextProps, 'text' | 'language'> & {
  readonly id: MessageKey;
  readonly values?: MessageValues;
};

// <T id="home.play-button.continue" values={{ level: 12 }} variant="heading" />
export function T({ id, values, ...textProps }: TProps): ReactNode {
  const t = useT();
  return <AppText text={t(id, values)} {...textProps} />;
}
