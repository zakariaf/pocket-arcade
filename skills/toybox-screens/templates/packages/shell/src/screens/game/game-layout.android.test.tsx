// packages/shell/src/screens/game/game-layout.android.test.tsx
// The Android half of game-layout.test.tsx, run by the unit-android project (jest-expo/android),
// where react-native's BackHandler is the real Android module: the system back (button or gesture)
// arrives as one 'hardwareBackPress' event, which the navigation container answers with goBack().
import { act, screen } from '@testing-library/react-native';
import { BackHandler, DeviceEventEmitter, View } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { GameLayout } from './game-layout.tsx';

// Spec 5 and S6, S7: with Pause or Result up, the system back is Game's own Back (it opens Pause
// or resumes through usePreventRemove), so the layout leaves the press to the navigator.
describe('GameLayout and the Android system back', () => {
  it.each([
    ['with Pause or Result up', <View key="overlay" testID="probe.overlay" />],
    ['with nothing over the board', null],
  ])('hands the system back on to the navigator %s', async (_when, overlay) => {
    const navigatorBack = jest.fn(() => true);
    const subscription = BackHandler.addEventListener('hardwareBackPress', navigatorBack);
    try {
      await renderWithShell(
        <GameLayout topBar={null} board={<View testID="probe.board" />} overlay={overlay} />,
      );

      await act(() => {
        DeviceEventEmitter.emit('hardwareBackPress', {});
      });

      expect(navigatorBack).toHaveBeenCalledTimes(1);
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    } finally {
      subscription.remove();
    }
  });
});
