import { Pressable } from 'react-native';

import { useHoldToConfirm } from './use-hold-to-confirm.ts';

import type { ReactNode } from 'react';

export function HoldButton({ label, onConfirm }: { readonly label: string; readonly onConfirm: () => void }): ReactNode {
  const hold = useHoldToConfirm(onConfirm);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={onConfirm}
      onPressIn={hold.handlePressIn}
      onPressOut={hold.handlePressOut}
    />
  );
}
