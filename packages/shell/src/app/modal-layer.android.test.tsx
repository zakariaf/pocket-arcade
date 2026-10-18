// packages/shell/src/app/modal-layer.android.test.tsx
// The Android half of modal-layer.test.tsx, run by the unit-android project (jest-expo/android),
// where react-native's BackHandler is the real Android module: the system back (button or gesture)
// arrives as one 'hardwareBackPress' event, which the navigation container answers with goBack().
import { act, screen } from '@testing-library/react-native';
import { BackHandler, DeviceEventEmitter, View } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { ModalLayer } from './modal-layer.tsx';

/** The system back, as Android delivers it to JavaScript. */
async function pressSystemBack(): Promise<void> {
  await act(() => {
    DeviceEventEmitter.emit('hardwareBackPress', {});
  });
}

/** Stands in for the navigation container's listener, registered before any layer opens. */
const added: { remove: () => void }[] = [];

function containerBack(): jest.Mock<boolean> {
  const listener = jest.fn(() => true);
  added.push(BackHandler.addEventListener('hardwareBackPress', listener));
  return listener;
}

// Spec 5 (the system back does what Back does) and S3, S14: a layer above the navigator takes the
// system back itself, so it never reaches the screen underneath.
describe('ModalLayer and the Android system back', () => {
  afterEach(() => {
    for (const subscription of added.splice(0)) subscription.remove();
  });

  it("runs the layer's back while it is up, and the navigator underneath gets none", async () => {
    const navigator = containerBack();
    const onBack = jest.fn();
    await renderWithShell(
      <ModalLayer behind={null} layer={<View testID="probe.layer" />} onBack={onBack} />,
    );

    await pressSystemBack();

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(navigator).not.toHaveBeenCalled();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('leaves the system back to the navigator while no layer is up', async () => {
    const navigator = containerBack();
    const onBack = jest.fn();
    await renderWithShell(<ModalLayer behind={null} layer={null} onBack={onBack} />);

    await pressSystemBack();

    expect(onBack).not.toHaveBeenCalled();
    expect(navigator).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('leaves the system back to the navigator for a layer without a back of its own', async () => {
    // Pause and Result: Game's own Back (usePreventRemove) opens Pause or resumes.
    const navigator = containerBack();
    await renderWithShell(<ModalLayer behind={null} layer={<View testID="probe.layer" />} />);

    await pressSystemBack();

    expect(navigator).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
