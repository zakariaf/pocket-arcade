// packages/shell/src/screens/home/home-view.test.tsx
import { fireEvent, screen, userEvent, within } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { Panel } from '@e07/shell/ui/panel.tsx';

import { HomeView } from './home-view.tsx';

import type { HomeModel } from './home-model.ts';
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

const LOGO: LogoArt = { layers: [{ role: 'p', d: 'M22 2.5H26V17.5H22Z' }] };

const ALWAYS = [
  'home.screen',
  'home.top-bar',
  'home.brand-lock',
  'home.logo',
  'home.game-name',
  'home.settings-button',
  'home.play-button',
  'home.daily-card',
  'home.daily-card.icon',
  'home.daily-card.title',
  'home.daily-card.date',
  'home.daily-card.streak',
  'home.levels-button',
  'home.stats-button',
  'home.how-to-play-button',
];

function modelWith(overrides: Partial<HomeModel> = {}): HomeModel {
  return {
    logo: LOGO,
    gameName: 'Line Siege',
    tagline: 'Clear lines. Fire beams. Hold the wall.',
    hasEndless: true,
    isPremium: false,
    isReducedMotion: false,
    play: { isContinue: true, level: 12 },
    daily: { dateText: 'Sunday, 27 Sep', streakDays: 5, isDoneToday: false },
    bestEndlessScore: 4210,
    banner: { renderBanner: () => null, isAllowed: true },
    actions: {
      onPlay: jest.fn(),
      onOpenDaily: jest.fn(),
      onPlayDaily: jest.fn(),
      onPlayEndless: jest.fn(),
      onOpenSettings: jest.fn(),
      onOpenLevels: jest.fn(),
      onOpenStats: jest.fn(),
      onOpenHowToPlay: jest.fn(),
      onOpenPremium: jest.fn(),
    },
    ...overrides,
  };
}

describe('HomeView', () => {
  it('draws the normal S4 frame with its design testIDs', async () => {
    await renderWithShell(<HomeView model={modelWith()} />);

    for (const testID of ALWAYS)
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('home.endless-card')).toBeOnTheScreen();
    expect(screen.getByTestId('home.premium-button')).toBeOnTheScreen();
    expect(screen.getByTestId('home.banner-ad')).toBeOnTheScreen();
    expect(screen.queryByTestId('home.tagline')).toBeNull();
    expect(screen.getByText('Continue – Level 12')).toBeOnTheScreen();

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws the Premium variant: badge and tagline, no Premium key, no banner', async () => {
    await renderWithShell(<HomeView model={modelWith({ isPremium: true })} />);

    expect(screen.getByTestId('home.premium-badge')).toBeOnTheScreen();
    expect(screen.getByTestId('home.tagline')).toBeOnTheScreen();
    expect(screen.queryByTestId('home.premium-button')).toBeNull();
    expect(screen.queryByTestId('home.banner-ad')).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('gives the tilted tagline room above the body only while it shows', async () => {
    // The body is the one scroll view (the only node with a contentContainerStyle).
    const bodyTop = (): unknown =>
      screen.container
        .queryAll((node) => node.props['contentContainerStyle'] !== undefined)
        .map((node) => StyleSheet.flatten(node.props['style']).marginTop)[0];
    await renderWithShell(<HomeView model={modelWith({ isPremium: true })} />);
    expect(bodyTop()).toBe(-10);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);

    await renderWithShell(<HomeView model={modelWith()} />);
    expect(bodyTop()).toBeUndefined();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('replaces the daily play button once today is done, and the card still opens S9', async () => {
    const model = modelWith({
      daily: { dateText: 'Sunday, 27 Sep', streakDays: 5, isDoneToday: true },
    });
    const user = userEvent.setup();
    await renderWithShell(<HomeView model={model} />);

    expect(
      screen.getByTestId('home.daily-card.done', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('home.daily-card.play-button')).toBeNull();
    const card = screen.getByRole('button', {
      name: 'Daily challenge, Sunday, 27 Sep, 5 day streak, Done – come back tomorrow',
    });
    await user.press(card);
    expect(model.actions.onOpenDaily).toHaveBeenCalledTimes(1);
    expect(model.actions.onPlayDaily).not.toHaveBeenCalled();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('opens S9 from the daily card body and plays only from its Play key', async () => {
    const model = modelWith();
    const user = userEvent.setup();
    await renderWithShell(<HomeView model={model} />);

    await user.press(screen.getByTestId('home.daily-card'));
    expect(model.actions.onOpenDaily).toHaveBeenCalledTimes(1);
    expect(model.actions.onPlayDaily).not.toHaveBeenCalled();

    await user.press(screen.getByTestId('home.daily-card.play-button'));
    expect(model.actions.onPlayDaily).toHaveBeenCalledTimes(1);
    expect(model.actions.onOpenDaily).toHaveBeenCalledTimes(1);

    // VoiceOver's double tap runs the activate action: it opens S9 wherever the centre falls.
    await fireEvent(screen.getByTestId('home.daily-card'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(model.actions.onOpenDaily).toHaveBeenCalledTimes(2);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('gives VoiceOver exactly two daily elements: the card and its Play key', async () => {
    await renderWithShell(<HomeView model={modelWith()} />);

    const card = screen.getByRole('button', {
      name: 'Daily challenge, Sunday, 27 Sep, 5 day streak',
    });
    expect(card).toBe(screen.getByTestId('home.daily-card'));
    expect(screen.getByRole('button', { name: 'Play today’s challenge' })).toBe(
      screen.getByTestId('home.daily-card.play-button'),
    );
    // The title, date, streak and icon are read in the card's label, never on their own.
    expect(screen.queryByRole('header', { name: 'Daily challenge' })).toBeNull();
    expect(screen.queryByText('Sunday, 27 Sep')).toBeNull();
    expect(screen.queryByText('5 day streak')).toBeNull();
    // The Play key is a sibling above the surface, never nested inside the opener.
    expect(within(card).queryByTestId('home.daily-card.play-button')).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws the daily card exactly as the flat Panel draws it (L7 changes no pixel)', async () => {
    // allow-style-assertion: the opener must keep the design's flat daily panel pixel for pixel.
    const LOOK = ['borderWidth', 'borderColor', 'borderRadius', 'backgroundColor'] as const;
    const pick = (style: object, keys: readonly string[]): Record<string, unknown> =>
      Object.fromEntries(keys.map((key) => [key, (style as Record<string, unknown>)[key]]));
    const styleOf = (node: { readonly props: Record<string, unknown> }): object =>
      StyleSheet.flatten(node.props['style'] as never) ?? {};

    await renderWithShell(
      <Panel testID="probe.panel" padding="daily">
        <View />
      </Panel>,
    );
    const panel = styleOf(screen.getByTestId('probe.panel'));

    await renderWithShell(<HomeView model={modelWith()} />);
    const surface = screen.getByTestId('home.daily-card');
    const [face] = surface.queryAll(
      (node) => (styleOf(node) as { borderWidth?: unknown }).borderWidth !== undefined,
    );
    const card = surface.parent;
    expect(face === undefined ? {} : pick(styleOf(face), LOOK)).toStrictEqual(pick(panel, LOOK));
    // The card's padding keeps the edge the surface draws: the parts sit where the Panel put them.
    const edge = (panel as { borderWidth: number }).borderWidth;
    const { paddingTop, paddingInline, paddingBottom } = panel as Record<string, number>;
    expect(
      pick(card === null ? {} : styleOf(card), ['paddingTop', 'paddingInline', 'paddingBottom']),
    ).toStrictEqual({
      paddingTop: (paddingTop ?? 0) + edge,
      paddingInline: (paddingInline ?? 0) + edge,
      paddingBottom: (paddingBottom ?? 0) + edge,
    });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('starts play from the hero key', async () => {
    const model = modelWith();
    const user = userEvent.setup();
    await renderWithShell(<HomeView model={model} />);

    await user.press(screen.getByTestId('home.play-button'));

    expect(model.actions.onPlay).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
