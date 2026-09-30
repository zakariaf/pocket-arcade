// packages/shell/src/screens/home/home-title.tsx
import { T } from '@demo/shell/i18n/t.tsx';

/** The Home title and the play button label. */
export function HomeTitle({ t }: { readonly t: (key: string) => string }): React.JSX.Element {
  const isStoreBuild = process.env.EXPO_PUBLIC_APP_VARIANT === 'store';
  return (
    <T id="home.title" testID="home.title" label={t('home.play-button.label')} hidden={isStoreBuild} />
  );
}
