// packages/shell/src/ui/lists.test.tsx
import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import { PressFeedbackProvider } from '@e07/shell/app/press-feedback-context.tsx';
import { TEXT_ALIGN } from '@e07/shell/i18n/use-localized-text-style.ts';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { AppText } from './app-text.tsx';
import { Chip } from './chip.tsx';
import { IconTile } from './icon-tile.tsx';
import { ListGroup } from './list-group.tsx';
import { ListRow } from './list-row.tsx';
import { List } from './list.tsx';
import { NotePanel } from './note-panel.tsx';
import { OfferBox } from './offer-box.tsx';
import { PanelHeader } from './panel-header.tsx';
import { Panel } from './panel.tsx';
import { Slider } from './slider.tsx';
import { SubRow } from './sub-row.tsx';

import type { ReactNode } from 'react';

const COLORS = TEST_PALETTE.standard.light;

/** S11's "Remove ads" row: a strong (Bold, normal ink) label. */
function StrongRow(): ReactNode {
  return (
    <List testID="settings.premium-list">
      <ListRow
        label="Remove ads – €1.99"
        end="chevron"
        icon="crown"
        iconPaint="gold"
        isStrong
        onPress={jest.fn()}
        testID="settings.remove-ads-row"
        isFirst
        isReducedMotion={false}
      />
    </List>
  );
}

describe('ListGroup and ListRow', () => {
  // Line heights sit on the device pixel grid; the parity device draws 3 pixels per point.
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
  });

  it('renders a tabbed group whose rows are a button, a switch and a danger button', async () => {
    const onLanguage = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <ListGroup title="Sound and feel" icon="sound" testID="settings.group.sound">
        <ListRow
          label="Language"
          value="System (English)"
          end="chevron"
          icon="globe"
          onPress={onLanguage}
          testID="settings.language-row"
          isFirst
          isReducedMotion={false}
        />
        <ListRow
          label="Music"
          end="toggle"
          isOn={false}
          icon="music"
          onPress={jest.fn()}
          testID="settings.music-switch"
          isReducedMotion
        />
        <SubRow label="Volume" testID="settings.music-volume-row">
          <Slider
            value={0.4}
            onChange={jest.fn()}
            label="Volume"
            testID="settings.music-volume-slider"
          />
        </SubRow>
        <ListRow
          label="Reset all progress"
          end="chevron"
          icon="trash"
          isDanger
          onPress={jest.fn()}
          testID="settings.reset-progress-row"
          isReducedMotion={false}
        />
      </ListGroup>,
    );

    expect(screen.getByRole('header', { name: 'Sound and feel' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: /Language/ }));
    expect(onLanguage).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('switch', { name: /Music/ })).not.toBeChecked();
    expect(screen.getByTestId('settings.reset-progress-row.label')).toHaveStyle({
      color: COLORS.danger,
      fontFamily: 'Rubik-Bold',
      lineHeight: 67 / 3, // 17 x 1.32 on the 3x grid, like every row label
    });
    expect(screen.getByTestId('settings.language-row.value')).toHaveStyle({
      color: COLORS.textMuted,
    });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws a strong row label in Bold ink at the row line height', async () => {
    await renderWithShell(<StrongRow />);

    expect(screen.getByTestId('settings.remove-ads-row.label')).toHaveStyle({
      color: COLORS.text,
      fontFamily: 'Rubik-Bold',
      fontSize: 17,
      lineHeight: 67 / 3, // 17 x 1.32
    });
  });

  it('keeps the Arabic-script row line height for a strong label in Persian', async () => {
    await renderWithShell(<StrongRow />, { language: 'fa' });

    expect(screen.getByTestId('settings.remove-ads-row.label')).toHaveStyle({
      fontFamily: 'Vazirmatn-Bold',
      lineHeight: 77 / 3, // 17 x 1.5
    });
  });

  it('lays an English label left to right in a Persian row when it says so (S15, L13)', async () => {
    await renderWithShell(
      <List testID="debug.list">
        <ListRow
          label="Force language, direction and digits"
          labelDirection="ltr"
          value="fa · rtl · ۱۲۳"
          end="chevron"
          onPress={jest.fn()}
          testID="debug.force-locale-row"
          isFirst
          isReducedMotion={false}
        />
      </List>,
      { language: 'fa' },
    );

    // Still the row label of a Persian layout (Vazirmatn 17, line height 1.5), aligned to its start.
    expect(screen.getByTestId('debug.force-locale-row.label')).toHaveStyle({
      fontFamily: 'Vazirmatn-Regular',
      lineHeight: 77 / 3,
      writingDirection: 'ltr',
      textAlign: TEXT_ALIGN.start,
    });
    expect(screen.getByTestId('debug.force-locale-row.value')).toHaveStyle({
      writingDirection: 'rtl',
    });
  });

  it('lets a radio row report its selected state', async () => {
    await renderWithShell(
      <List testID="settings-language.list">
        <ListRow
          label="Deutsch"
          labelLanguage="de"
          end="radio"
          isSelected
          onPress={jest.fn()}
          testID="settings-language.language-row.de"
          isFirst
          isReducedMotion={false}
        />
      </List>,
    );

    expect(screen.getByRole('radio', { name: /Deutsch/ })).toBeSelected();
  });

  it('plays the tap feedback on a button row but leaves a switch row to its handler', async () => {
    const calls: string[] = [];
    const user = userEvent.setup();
    await renderWithShell(
      <PressFeedbackProvider onPress={() => calls.push('tap')}>
        <List testID="settings.group.about.list">
          <ListRow
            label="About"
            end="chevron"
            onPress={() => calls.push('about')}
            testID="settings.about-row"
            isFirst
            isReducedMotion={false}
          />
          <ListRow
            label="Hints"
            end="toggle"
            isOn
            onPress={() => calls.push('hints')}
            testID="settings.hints-switch"
            isReducedMotion={false}
          />
        </List>
      </PressFeedbackProvider>,
    );

    await user.press(screen.getByRole('button', { name: /About/ }));
    await user.press(screen.getByRole('switch', { name: /Hints/ }));

    expect(calls).toStrictEqual(['tap', 'about', 'hints']);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});

describe('Panels', () => {
  it('draws a flat panel with a heading and an icon tile', async () => {
    await renderWithShell(
      <Panel testID="stats.overview-card">
        <PanelHeader
          title="Overview"
          testID="stats.overview-card.title"
          leading={<IconTile icon="stats" size="statHeader" testID="stats.overview-card.icon" />}
        />
        <AppText text="58" variant="number" />
      </Panel>,
    );

    expect(screen.getByRole('header', { name: 'Overview' })).toBeOnTheScreen();
    expect(screen.getByTestId('stats.overview-card')).toHaveStyle({
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
    });
  });

  it('draws a locked pack with a dashed ink edge on the sunken fill, as the design does', async () => {
    await renderWithShell(
      <Panel testID="levels.pack.2" tone="locked">
        <AppText text="Pack 2" variant="heading" />
      </Panel>,
    );

    expect(screen.getByTestId('levels.pack.2')).toHaveStyle({
      borderStyle: 'dashed',
      borderColor: COLORS.border,
      backgroundColor: COLORS.sunken,
    });
  });

  it('paints the error note with a danger edge', async () => {
    await renderWithShell(
      <NotePanel icon="alert" text="Something went wrong." isError testID="premium.error-note" />,
    );

    expect(screen.getByTestId('premium.error-note')).toHaveStyle({ borderColor: COLORS.danger });
    expect(screen.getByTestId('premium.error-note.label')).toHaveTextContent(
      'Something went wrong.',
    );
  });

  it('shrinks a one-line note to its text and lets a longer note fill the row (.note-p <p>)', async () => {
    await renderWithShell(<NotePanel icon="wifi-off" text="Go online." testID="premium.note" />);
    const label = screen.getByTestId('premium.note.label');
    expect(label.parent).toHaveStyle({ flex: 1 });

    await fireEvent(label, 'textLayout', { nativeEvent: { lines: [{ width: 80 }] } });
    expect(screen.getByTestId('premium.note.label').parent).toHaveStyle({ flexShrink: 1 });
    expect(screen.getByTestId('premium.note.label').parent).not.toHaveStyle({ flex: 1 });

    await fireEvent(screen.getByTestId('premium.note.label'), 'textLayout', {
      nativeEvent: { lines: [{ width: 300 }, { width: 40 }] },
    });
    expect(screen.getByTestId('premium.note.label').parent).toHaveStyle({ flex: 1 });
  });

  it('frames an offer with a dashed edge and shows chips as text', async () => {
    await renderWithShell(
      <OfferBox testID="result.offer">
        <Chip text="Level 12" testID="result.chip" />
      </OfferBox>,
    );

    expect(screen.getByTestId('result.offer')).toHaveStyle({ borderStyle: 'dashed' });
    // The chip box (padding and edge) carries the testID and reads as one text element.
    const chip = screen.getByTestId('result.chip');
    expect(chip).toHaveTextContent('Level 12');
    expect(chip).toHaveAccessibleName('Level 12');
    expect(chip).toHaveStyle({ borderWidth: 2, paddingInline: 12 });
  });
});
