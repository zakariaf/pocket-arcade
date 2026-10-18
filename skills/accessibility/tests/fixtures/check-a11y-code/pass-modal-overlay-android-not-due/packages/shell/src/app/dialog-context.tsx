import { View } from 'react-native';

import { DialogHost } from '@e07/shell/screens/dialogs/dialog-host.tsx';

import type { ReactNode } from 'react';

// Before Android step 4 (no game-screen-back.android.test.tsx yet) the Android focus trap is not
// due: the check prints a SKIP line for it and still requires the iOS half.
export function DialogProvider({ isOpen, children }: { readonly isOpen: boolean; readonly children: ReactNode }): ReactNode {
  return (
    <View>
      <View>{children}</View>
      <DialogHost isOpen={isOpen} />
    </View>
  );
}
