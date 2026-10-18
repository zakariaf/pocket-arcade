import { View } from 'react-native';

import { DialogHost } from '@e07/shell/screens/dialogs/dialog-host.tsx';

import type { ReactNode } from 'react';

// Planted bug: the screens behind an open dialog stay visible to TalkBack (no Android focus trap;
// the dialogs' accessibilityViewIsModal is iOS-only).
export function DialogProvider({ isOpen, children }: { readonly isOpen: boolean; readonly children: ReactNode }): ReactNode {
  return (
    <View>
      <View>{children}</View>
      <DialogHost isOpen={isOpen} />
    </View>
  );
}
