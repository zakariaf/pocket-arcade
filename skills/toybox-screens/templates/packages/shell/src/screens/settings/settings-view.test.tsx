// packages/shell/src/screens/settings/settings-view.test.tsx
import { fireEvent, screen, userEvent, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PressFeedbackProvider } from '@e07/shell/app/press-feedback-context.tsx';
import { DEFAULT_SETTINGS } from '@e07/shell/services/save/schema/default-save-doc.ts';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { createPreferenceActions } from './settings-preference-actions.ts';
import { settingsGroupsFor } from './settings-rows.ts';
import { SettingsView } from './settings-view.tsx';

import type { SettingsExtras } from './settings-extras.ts';
import type { SettingsContext } from './settings-rows.ts';
import type { SettingsModel } from './use-settings-model.ts';
import type { SettingsAction } from '@e07/shell/stores/settings-reducer.ts';

const EVERY_ROW: SettingsContext = {
  hasMusic: true,
  canVibrate: true,
  isPrivacyOptionsRequired: true,
  isPremium: false,
};

function modelWith(
  context: SettingsContext,
  dispatch: (action: SettingsAction) => void,
  onToggled: () => void = jest.fn(),
): SettingsModel {
  const settings = { ...DEFAULT_SETTINGS, musicEnabled: true };
  return {
    settings,
    isReduceMotionOn: false,
    isReducedMotion: false,
    groups: settingsGroupsFor(context),
    languageValue: 'System (English)',
    digitPreviews: { automatic: '123', latin: '123', local: '123' },
    actions: createPreferenceActions({ settings, isReduceMotionOn: false, dispatch, onToggled }),
  };
}

function extras(): SettingsExtras {
  return {
    removeAdsPriceText: '€1.99',
    versionText: '1.0.0 (8)',
    onBack: jest.fn(),
    onOpenLanguage: jest.fn(),
    onOpenPremium: jest.fn(),
    onRestorePurchase: jest.fn(),
    onOpenAdPrivacy: jest.fn(),
    onOpenPrivacyPolicy: jest.fn(),
    onResetStats: jest.fn(),
    onResetProgress: jest.fn(),
    onOpenAbout: jest.fn(),
    onOpenLicences: jest.fn(),
    onRate: jest.fn(),
    onContact: jest.fn(),
  };
}

const GROUPS = ['language', 'sound', 'display', 'premium', 'privacy', 'data', 'about'];
const ROWS = [
  'settings.language-row',
  'settings.language-row.value',
  'settings.numbers-row',
  'settings.numbers-control',
  'settings.numbers-segment.automatic',
  'settings.numbers-segment.local.preview',
  'settings.sound-effects-switch',
  'settings.sound-volume-row',
  'settings.sound-volume-slider',
  'settings.music-switch',
  'settings.music-volume-slider',
  'settings.vibration-switch',
  'settings.theme-row',
  'settings.theme-control',
  'settings.theme-segment.dark',
  'settings.colour-blind-switch.description',
  'settings.reduce-motion-switch.toggle',
  'settings.hints-switch',
  'settings.remove-ads-row',
  'settings.restore-purchase-row',
  'settings.ad-privacy-row.description',
  'settings.privacy-policy-row',
  'settings.reset-stats-row',
  'settings.reset-progress-row.description',
  'settings.about-row',
  'settings.licences-row',
  'settings.rate-row',
  'settings.contact-row',
  'settings.footer',
  'settings.autosave-note',
  'settings.autosave-note.icon',
  'settings.version',
];

describe('SettingsView', () => {
  it('draws every S11 group and row with its design testID', async () => {
    await renderWithShell(
      <SettingsView model={modelWith(EVERY_ROW, jest.fn())} extras={extras()} />,
    );

    const tabs = GROUPS.flatMap((id) => [`settings.group.${id}.tab`, `settings.group.${id}.list`]);
    for (const testID of ['settings.screen', 'settings.top-bar.title', ...tabs, ...ROWS]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    expect(screen.getByTestId('settings.remove-ads-row.label')).toHaveTextContent(
      /Remove ads – .?€1\.99/,
    );

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('measures the whole autosave note row and keeps the footer lines as wide as their text', async () => {
    await renderWithShell(
      <SettingsView model={modelWith(EVERY_ROW, jest.fn())} extras={extras()} />,
    );

    // The design's settings.autosave-note is the note row (icon + text), not the text alone.
    const note = screen.getByTestId('settings.autosave-note');
    expect(within(note).getByText('Changes apply right away.')).toBeOnTheScreen();
    expect(
      within(note).getByTestId('settings.autosave-note.icon', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(StyleSheet.flatten(note.props['style'])).toMatchObject({ alignSelf: 'flex-start' });
    const versionLine = screen.getByTestId('settings.version').parent;
    expect(StyleSheet.flatten(versionLine?.props['style'])).toMatchObject({
      alignSelf: 'flex-start',
    });
    // Remove ads is the one strong (Bold) label among the rows.
    // allow-style-assertion: the strong row label (17 Bold) is the design's contract for Remove ads.
    expect(screen.getByTestId('settings.remove-ads-row.label')).toHaveStyle({
      fontFamily: 'Rubik-Bold',
    });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('hides rows that do not apply and shows Premium active to owners', async () => {
    const context = {
      hasMusic: false,
      canVibrate: false,
      isPrivacyOptionsRequired: false,
      isPremium: true,
    };
    await renderWithShell(<SettingsView model={modelWith(context, jest.fn())} extras={extras()} />);

    for (const testID of [
      'settings.music-switch',
      'settings.vibration-switch',
      'settings.ad-privacy-row',
      'settings.remove-ads-row',
    ]) {
      expect(screen.queryByTestId(testID)).toBeNull();
    }
    expect(screen.getByTestId('settings.premium-active')).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('dispatches one settings action per change and opens sub-screens', async () => {
    const dispatch = jest.fn();
    const links = extras();
    const user = userEvent.setup();
    await renderWithShell(<SettingsView model={modelWith(EVERY_ROW, dispatch)} extras={links} />);

    await user.press(screen.getByTestId('settings.theme-segment.dark'));
    await user.press(screen.getByTestId('settings.hints-switch'));
    await user.press(screen.getByTestId('settings.language-row'));

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'set-theme', theme: 'dark' });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'set-hints-during-play', enabled: false });
    expect(links.onOpenLanguage).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('taps on keys and rows, and plays only the toggle feedback on a switch', async () => {
    const feedback: string[] = [];
    const user = userEvent.setup();
    const model = modelWith(EVERY_ROW, jest.fn(), () => feedback.push('toggle'));
    await renderWithShell(
      <PressFeedbackProvider onPress={() => feedback.push('tap')}>
        <SettingsView model={model} extras={extras()} />
      </PressFeedbackProvider>,
    );

    await user.press(screen.getByTestId('settings.theme-segment.dark'));
    await user.press(screen.getByTestId('settings.hints-switch'));
    await user.press(screen.getByTestId('settings.about-row'));

    expect(feedback).toStrictEqual(['tap', 'toggle', 'tap']);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('turns the 0..1 slider into integer percent for the volume actions', async () => {
    const dispatch = jest.fn();
    await renderWithShell(
      <SettingsView model={modelWith(EVERY_ROW, dispatch)} extras={extras()} />,
    );

    // The slider shows the saved 80 % and VoiceOver's increment moves it by 10 %.
    const slider = screen.getByTestId('settings.sound-volume-slider');
    expect(slider).toHaveAccessibilityValue({ min: 0, max: 100, now: 80 });
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });

    expect(dispatch).toHaveBeenCalledWith({ type: 'set-sound', enabled: true, volume: 90 });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
