// packages/shell/src/screens/settings/privacy/privacy-policy-view.test.tsx
import { screen } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { PrivacyPolicyView } from './privacy-policy-view.tsx';

describe('PrivacyPolicyView', () => {
  it('draws the S11c summary, five sections and the updated line', async () => {
    await renderWithShell(
      <PrivacyPolicyView
        model={{
          gameName: 'Line Siege',
          emailText: 'support@example.com',
          updatedDateText: '27 September 2026',
          isReducedMotion: false,
          onBack: jest.fn(),
        }}
      />,
    );

    const sections = ['game', 'ads', 'purchase', 'backup', 'contact'].flatMap((id) => [
      `privacy-policy.section.${id}`,
      `privacy-policy.section.${id}.title`,
      `privacy-policy.section.${id}.body`,
    ]);
    for (const testID of [
      'privacy-policy.screen',
      'privacy-policy.top-bar.title',
      'privacy-policy.summary-card',
      'privacy-policy.summary-card.art',
      'privacy-policy.summary-card.label',
      'privacy-policy.updated',
      ...sections,
    ]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    expect(screen.getByTestId('privacy-policy.section.contact.body')).toHaveTextContent(
      /support@example\.com/,
    );

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
