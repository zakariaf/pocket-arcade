import { View } from 'react-native';

import { DialogHost } from '@e07/shell/screens/dialogs/dialog-host.tsx';

import type { ReactNode } from 'react';

// The screens are the content behind every dialog: hidden from TalkBack while one is open.
export function DialogProvider({ isOpen, children }: { readonly isOpen: boolean; readonly children: ReactNode }): ReactNode {
  return (
    <View>
      <View importantForAccessibility={isOpen ? 'no-hide-descendants' : 'auto'}>{children}</View>
      <DialogHost isOpen={isOpen} />
    </View>
  );
}
