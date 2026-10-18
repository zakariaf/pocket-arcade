// packages/shell/src/navigation/use-hardware-back.android.test.tsx
// no-shell-context: the hook renders nothing and reads no Shell context; a bare probe component holds it.
// Runs in the unit-android project (jest-expo/android), where react-native's BackHandler is the real
// Android module: a 'hardwareBackPress' device event is what the system back button and the back
// gesture send, and with no listener handling it BackHandler.exitApp() lets Android background the app.
import { act, render } from '@testing-library/react-native';
import { BackHandler, DeviceEventEmitter } from 'react-native';

import { HardwareBackCoverContext, useHardwareBack } from './use-hardware-back.ts';

import type { ReactNode } from 'react';

function BackProbe({ onBack }: { readonly onBack: (() => void) | null }): ReactNode {
  useHardwareBack(onBack);
  return null;
}

/** The system back, as Android delivers it to JavaScript. */
async function pressSystemBack(): Promise<void> {
  await act(() => {
    DeviceEventEmitter.emit('hardwareBackPress', {});
  });
}

/** Listeners a test adds by hand, removed after each test even when an expectation fails. */
const added: { remove: () => void }[] = [];

describe('useHardwareBack on Android (spec 5, S14)', () => {
  afterEach(() => {
    for (const subscription of added.splice(0)) subscription.remove();
  });

  it('runs the handler and consumes the press, so the screen behind stays', async () => {
    const exitApp = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => undefined);
    const onBack = jest.fn();
    await render(<BackProbe onBack={onBack} />);

    await pressSystemBack();

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('answers before a listener registered earlier, such as the navigation container', async () => {
    jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => undefined);
    const containerBack = jest.fn(() => true);
    added.push(BackHandler.addEventListener('hardwareBackPress', containerBack));
    const onBack = jest.fn();
    await render(<BackProbe onBack={onBack} />);

    await pressSystemBack();

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(containerBack).not.toHaveBeenCalled();
  });

  it('leaves the press to the others when the handler is null', async () => {
    const exitApp = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => undefined);
    await render(<BackProbe onBack={null} />);

    await pressSystemBack();

    expect(exitApp).toHaveBeenCalledTimes(1);
  });

  it('leaves the press to the layer above while an open layer covers it, and answers again after', async () => {
    jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => undefined);
    const onBack = jest.fn();
    const coverBack = jest.fn(() => true);
    added.push(BackHandler.addEventListener('hardwareBackPress', coverBack));
    const view = await render(
      <HardwareBackCoverContext value>
        <BackProbe onBack={onBack} />
      </HardwareBackCoverContext>,
    );

    await pressSystemBack();
    await view.rerender(
      <HardwareBackCoverContext value={false}>
        <BackProbe onBack={onBack} />
      </HardwareBackCoverContext>,
    );
    await pressSystemBack();

    expect([coverBack.mock.calls.length, onBack.mock.calls.length]).toStrictEqual([1, 1]);
  });

  it('stops answering once its component unmounts', async () => {
    const exitApp = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => undefined);
    const onBack = jest.fn();
    const view = await render(<BackProbe onBack={onBack} />);
    await view.unmount();

    await pressSystemBack();

    expect(onBack).not.toHaveBeenCalled();
    expect(exitApp).toHaveBeenCalledTimes(1);
  });
});
