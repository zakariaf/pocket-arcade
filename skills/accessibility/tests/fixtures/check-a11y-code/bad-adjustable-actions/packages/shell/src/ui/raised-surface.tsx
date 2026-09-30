import { Pressable } from 'react-native';

import type { ReactNode } from 'react';
import type { AccessibilityState } from 'react-native';

type A11yInput = { readonly label: string; readonly isBusy: boolean };

function a11yProps(input: A11yInput, isInactive: boolean): {
  readonly accessibilityLabel: string;
  readonly accessibilityState: AccessibilityState;
} {
  return { accessibilityLabel: input.label, accessibilityState: { disabled: isInactive, busy: input.isBusy } };
}

// Name and state come from a helper spread: the checker must not ask for them again.
export function RaisedSurface(props: A11yInput & { readonly onPress: () => void; readonly children: ReactNode }): ReactNode {
  return (
    <Pressable accessibilityRole="button" {...a11yProps(props, props.isBusy)} disabled={props.isBusy} onPress={props.onPress} style={{ minHeight: 48, minWidth: 48 }}>
      {props.children}
    </Pressable>
  );
}
