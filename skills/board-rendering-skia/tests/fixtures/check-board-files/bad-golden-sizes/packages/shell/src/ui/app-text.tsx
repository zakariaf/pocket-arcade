// packages/shell/src/ui/app-text.tsx
// Fixture stand-in for AppText: the board checkers only need this path to exist (the layout
// probe imports it). It mirrors the real component's props (AppTextProps, text required) as
// toybox-design-system ships it; the real one also keeps Persian and Sorani lines inside their
// design line box (an overflow guard View that carries the testID) and balances display text
// (ui/use-balanced-wrap.ts). The repo's board-layout-probe test runs against the real one.
import { Text } from 'react-native';

import type { ReactNode } from 'react';

export type AppTextProps = {
  readonly text: string;
  readonly variant?: string;
  readonly tone?: string;
  readonly align?: 'start' | 'center' | 'end';
  readonly numberOfLines?: number;
  readonly isHeader?: boolean;
  readonly testID?: string;
  readonly onLineCount?: (lines: number) => void;
};

export function AppText(props: AppTextProps): ReactNode {
  return <Text testID={props.testID}>{props.text}</Text>;
}
