// packages/shell/src/app/localized-root.test.tsx
import { act, screen } from '@testing-library/react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { AppText } from '@e07/shell/ui/app-text.tsx';

import { LocalizedRoot } from './localized-root.tsx';

import type { ReactNode } from 'react';

const ENGLISH_PHONE = [{ languageCode: 'en', languageScriptCode: null }];
const NO_GAME = { en: {}, de: {}, fa: {}, ckb: {} };

function StarsProbe(): ReactNode {
  const t = useT();
  return (
    <AppText text={t('stats.levels.stars-value', { earned: 12, total: 90 })} testID="probe.stars" />
  );
}

function throwError(error: Error): never {
  throw error;
}

async function renderProbe(): Promise<Awaited<ReturnType<typeof renderWithShell>>> {
  return renderWithShell(
    <LocalizedRoot deviceLocales={ENGLISH_PHONE} gameCatalogs={NO_GAME} onError={throwError}>
      <StarsProbe />
    </LocalizedRoot>,
  );
}

describe('LocalizedRoot', () => {
  it('follows the phone while the language is System', async () => {
    await renderProbe();
    expect(screen.getByTestId('probe.stars')).toHaveTextContent('12 / 90');
  });

  it('switches language and digits as soon as the settings change', async () => {
    const { stores } = await renderProbe();
    await act(() => {
      stores.settings.getState().dispatch({ type: 'set-language', language: 'fa' });
    });
    expect(screen.getByTestId('probe.stars')).toHaveTextContent('۱۲ / ۹۰');
    await act(() => {
      stores.settings.getState().dispatch({ type: 'set-digits', digits: 'latin' });
    });
    expect(screen.getByTestId('probe.stars')).toHaveTextContent('12 / 90');
  });
});
