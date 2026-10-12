// packages/shell/src/screens/game/game-screen-back.test.tsx
// no-shell-context: the test mounts its own static navigator and stubs the session controls, the screen model and the layout; GameScreen reads nothing else.
// Runs GameScreen inside a real React Navigation static native stack (Home + Game) and drives
// Back through a container ref, the way the Android back button and navigation.goBack() do.
import {
  createNavigationContainerRef,
  createStaticNavigation,
  StackActions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { View } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';

import { GameScreen } from './game-screen.tsx';

import type { SessionStatus } from '@e07/shell/game-host/game-session-types.ts';
import type { NavigationContainerRefWithCurrent, ParamListBase } from '@react-navigation/native';
import type { ReactNode } from 'react';
import type { StoreApi } from 'zustand/vanilla';

type FakeSession = { readonly status: SessionStatus; readonly homeCalls: number };

// The session is faked: this test is about navigation, not about the game host.
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

describe('GameScreen back handling', () => {
  beforeEach(() => {
    mockSessionStore.setState({ status: 'playing', homeCalls: 0 });
  });

  it('opens Pause when Back is pressed while playing', async () => {
    const ref = await openGame();
    await act(() => {
      ref.goBack();
    });
    expect(currentRouteName(ref)).toBe('Game');
    expect(screen.getByTestId('pause.home-button')).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('resumes when Back is pressed inside Pause', async () => {
    const ref = await openGame();
    await act(() => {
      ref.goBack();
    });
    await act(() => {
      ref.goBack();
    });
    expect(currentRouteName(ref)).toBe('Game');
    expect(mockSessionStore.getState().status).toBe('playing');
    expect(screen.queryByTestId('pause.home-button')).not.toBeOnTheScreen();
  });

  it('leaves to Home only through the Pause Home button', async () => {
    const user = userEvent.setup();
    const ref = await openGame();
    await act(() => {
      ref.goBack();
    });
    await user.press(screen.getByTestId('pause.home-button'));
    expect(currentRouteName(ref)).toBe('Home');
    expect(mockSessionStore.getState().homeCalls).toBe(1);
  });

  it('lets a finished run leave normally', async () => {
    const ref = await openGame();
    await act(() => {
      mockSessionStore.setState({ status: 'won' });
    });
    await act(() => {
      ref.dispatch(StackActions.pop());
    });
    expect(currentRouteName(ref)).toBe('Home');
  });
});
