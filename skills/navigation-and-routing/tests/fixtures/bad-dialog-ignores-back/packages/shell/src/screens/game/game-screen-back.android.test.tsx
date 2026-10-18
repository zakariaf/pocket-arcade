// packages/shell/src/screens/game/game-screen-back.android.test.tsx
// no-shell-context: the test mounts its own static navigator and stubs the session controls, the screen model and the layout; GameScreen reads nothing else.
// The Android half of game-screen-back.test.tsx, run by the unit-android project (jest-expo/android).
// Here react-native's BackHandler is the real Android module, so the test presses the system back
// exactly as the back button and the back gesture deliver it (a 'hardwareBackPress' device event)
// and lets React Navigation's own listener turn it into goBack() (spec 5: the system back always
// does what Back does; on Game it opens Pause). A press nobody handles reaches BackHandler.exitApp(),
// which hands it to Android: on Home the app goes to the background.
import { createNavigationContainerRef, createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { BackHandler, DeviceEventEmitter, View } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';

import { GameScreen } from './game-screen.tsx';

import type { SessionStatus } from '@e07/shell/game-host/game-session-types.ts';
import type { NavigationContainerRefWithCurrent, ParamListBase } from '@react-navigation/native';
import type { ReactNode } from 'react';
import type { StoreApi } from 'zustand/vanilla';

type FakeSession = { readonly status: SessionStatus; readonly homeCalls: number };

// The session is faked: this test is about the system back, not about the game host.
jest.mock('@e07/shell/game-host/use-game-session-controls.ts', () => {
  const { useStore } = require('zustand');
  const { createStore } = require('zustand/vanilla');
  const store = createStore(() => ({ status: 'playing', homeCalls: 0 }));
  const set = (status: string) => () => store.setState({ status });
  return {
    mockSessionStore: store,
    useGameSessionControls: () => ({
      status: useStore(store, (state: { status: string }) => state.status),
      view: null,
      BoardHost: null,
      pause: set('paused'),
      resume: set('playing'),
      leaveToHome: () => {
        const { homeCalls }: { readonly homeCalls: number } = store.getState();
        store.setState({ homeCalls: homeCalls + 1 });
      },
    }),
  };
});

// The real Pause overlay is a Toybox screen; here it only exposes its Home button.
jest.mock('@e07/shell/screens/pause/pause-overlay.tsx', () => {
  const { Pressable } = require('react-native');
  function MockPauseOverlay({ onHome }: { readonly onHome: () => void }): ReactNode {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Home"
        onPress={onHome}
        testID="pause.home-button"
      />
    );
  }
  return { PauseOverlay: MockPauseOverlay };
});

// The top bar and the result are the model's (use-game-screen-model.test.tsx); none here.
jest.mock('@e07/shell/screens/game/use-game-screen-model.ts', () => ({
  useGameScreenModel: () => ({ topBar: null, result: null }),
}));

// GameLayout is a Toybox frame (theme, safe area); here it only draws its slots.
jest.mock('@e07/shell/screens/game/game-layout.tsx', () => {
  const { View } = require('react-native');
  function MockGameLayout(props: { readonly board: ReactNode; readonly overlay: ReactNode }) {
    return (
      <View testID="game.screen">
        {props.board}
        {props.overlay}
      </View>
    );
  }
  return { GameLayout: MockGameLayout };
});

const { mockSessionStore } = jest.requireMock<{ mockSessionStore: StoreApi<FakeSession> }>(
  '@e07/shell/game-host/use-game-session-controls.ts',
);

function HomeProbe(): ReactNode {
  return <View testID="home.screen" />;
}

const testStack = createNativeStackNavigator({
  screenOptions: { headerShown: false },
  screens: {
    Home: HomeProbe,
    Game: { screen: GameScreen, options: { gestureEnabled: false } },
  },
});
const Navigation = createStaticNavigation(testStack);
const INITIAL = {
  index: 1,
  routes: [{ name: 'Home' }, { name: 'Game', params: { start: 'resume' } }],
};

type TestRef = NavigationContainerRefWithCurrent<ParamListBase>;

async function openGame(): Promise<TestRef> {
  const ref = createNavigationContainerRef<ParamListBase>();
  await render(<Navigation ref={ref} initialState={INITIAL} />);
  return ref;
}

function currentRouteName(ref: TestRef): string {
  return ref.getCurrentRoute()?.name ?? 'none';
}

/** The system back (button or gesture), as Android delivers it to JavaScript. */
async function pressSystemBack(): Promise<void> {
  await act(() => {
    DeviceEventEmitter.emit('hardwareBackPress', {});
  });
}

/** Records the presses no listener handled; Android would then background the app. */
function watchExitApp(): jest.SpyInstance {
  return jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => undefined);
}

describe('GameScreen and the Android system back (spec 5, S5, S6)', () => {
  beforeEach(() => {
    mockSessionStore.setState({ status: 'playing', homeCalls: 0 });
  });

  it('opens Pause when the system back is pressed while playing', async () => {
    const exitApp = watchExitApp();
    const ref = await openGame();

    await pressSystemBack();

    expect(currentRouteName(ref)).toBe('Game');
    expect(mockSessionStore.getState().status).toBe('paused');
    expect(screen.getByTestId('pause.home-button')).toBeOnTheScreen();
    expect(exitApp).not.toHaveBeenCalled();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('resumes when the system back is pressed inside Pause', async () => {
    const exitApp = watchExitApp();
    const ref = await openGame();
    await pressSystemBack();
    expect(mockSessionStore.getState().status).toBe('paused');

    await pressSystemBack();

    expect(currentRouteName(ref)).toBe('Game');
    expect(mockSessionStore.getState().status).toBe('playing');
    expect(screen.queryByTestId('pause.home-button')).not.toBeOnTheScreen();
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('keeps a live run however often the system back is pressed', async () => {
    const ref = await openGame();

    for (let press = 0; press < 5; press += 1) await pressSystemBack();

    expect(currentRouteName(ref)).toBe('Game');
    expect(mockSessionStore.getState()).toStrictEqual({ status: 'paused', homeCalls: 0 });
  });

  it('leaves to Home only through the Pause Home button', async () => {
    const user = userEvent.setup();
    const ref = await openGame();
    await pressSystemBack();

    await user.press(screen.getByTestId('pause.home-button'));

    expect(currentRouteName(ref)).toBe('Home');
    expect(mockSessionStore.getState().homeCalls).toBe(1);
  });

  it('lets a finished run leave with the system back', async () => {
    const ref = await openGame();
    await act(() => {
      mockSessionStore.setState({ status: 'won' });
    });

    await pressSystemBack();

    expect(currentRouteName(ref)).toBe('Home');
  });

  it('leaves the press to Android on Home, which sends the app to the background', async () => {
    const exitApp = watchExitApp();
    const ref = await openGame();
    await act(() => {
      mockSessionStore.setState({ status: 'won' });
    });
    await pressSystemBack();
    expect(exitApp).not.toHaveBeenCalled();

    await pressSystemBack();

    expect(currentRouteName(ref)).toBe('Home');
    expect(exitApp).toHaveBeenCalledTimes(1);
  });
});
