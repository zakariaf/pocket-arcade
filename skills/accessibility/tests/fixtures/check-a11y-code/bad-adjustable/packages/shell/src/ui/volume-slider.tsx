import { Pressable } from 'react-native';

import type { AccessibilityActionEvent } from 'react-native';
import type { ReactNode } from 'react';

export function VolumeSlider(props: { readonly label: string; readonly value: number; readonly onAction: (event: AccessibilityActionEvent) => void }): ReactNode {
  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityLabel={props.label}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={props.onAction}
      style={{ minHeight: 44 }}
    />
  );
}
