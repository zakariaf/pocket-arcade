// packages/shell/src/screens/settings/about/about-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { AboutView } from './about-view.tsx';

import type { AboutModel } from './about-view.tsx';
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

const LOGO: LogoArt = { layers: [{ role: 'p', d: 'M22 2.5H26V17.5H22Z' }] };

const MODEL: AboutModel = {
  logo: LOGO,
  gameName: 'Line Siege',
  tagline: 'Clear lines. Fire beams. Hold the wall.',
  versionText: '1.0.0 (8)',
  emailText: 'support@example.com',
  isReducedMotion: false,
  onBack: jest.fn(),
  onContact: jest.fn(),
  onOpenLicences: jest.fn(),
};

describe('AboutView', () => {
  it('draws every S11b element with its design testID and opens Licences', async () => {
    const user = userEvent.setup();
    await renderWithShell(<AboutView model={MODEL} />);

    for (const testID of [
      'about.screen',
      'about.top-bar.title',
      'about.header',
      'about.logo',
      'about.game-name',
      'about.tagline',
      'about.version-chip',
      'about.facts-list',
      'about.made-with-row.icon',
      'about.offline-row.label',
      'about.art-sound-row.label',
      'about.support-card.title',
      'about.support-card.body',
      'about.links-list',
      'about.contact-row.label',
      'about.licences-row.icon',
    ]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    await user.press(screen.getByTestId('about.licences-row'));

    expect(MODEL.onOpenLicences).toHaveBeenCalledTimes(1);

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  // Spec S11b: About and credits: game name, version, "Made with Claude Code", support e-mail.
  // The three facts are plain rows (a chevron would promise a tap that does nothing).
  it('says Made with Claude Code and lists the three facts as plain rows (spec S11b)', async () => {
    await renderWithShell(<AboutView model={MODEL} />);

    expect(screen.getByTestId('about.made-with-row.label')).toHaveTextContent(
      'Made with Claude Code',
    );
    const buttons = screen
      .getAllByRole('button')
      .map((element) => element.props['testID'] as unknown);
    expect(buttons).toStrictEqual([
      'about.top-bar.back-button',
      'about.contact-row',
      'about.licences-row',
    ]);
    for (const fact of ['about.made-with-row', 'about.offline-row', 'about.art-sound-row']) {
      expect(screen.getByTestId(fact)).toBeOnTheScreen();
    }
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
