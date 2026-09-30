// packages/shell/src/screens/home/home-top-bar.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { BrandLock } from '@e07/shell/ui/brand-lock.tsx';
import { IconButton } from '@e07/shell/ui/icon-button.tsx';
import { LogoTile } from '@e07/shell/ui/logo-tile.tsx';
import { Sticker } from '@e07/shell/ui/sticker.tsx';
import { TopBar } from '@e07/shell/ui/top-bar.tsx';

import type { HomeModel } from './home-model.ts';
import type { ReactNode } from 'react';

export type HomeTopBarProps = {
  readonly model: Pick<HomeModel, 'logo' | 'gameName' | 'isPremium' | 'isReducedMotion'>;
  readonly onOpenSettings: () => void;
};

/**
 * S4 top bar: the brand lock at the start (logo tile 46, the game name, and for Premium owners
 * the xs gold "Premium" sticker under it) and the settings gear at the end. No back button.
 */
export function HomeTopBar({ model, onOpenSettings }: HomeTopBarProps): ReactNode {
  const t = useT();
  const badge = (
    <Sticker
      testID="home.premium-badge"
      text={t('home.premium-badge.label')}
      size="xs"
      icon="crown"
      tiltDeg={-5}
    />
  );
  return (
    <TopBar
      testID="home.top-bar"
      isReducedMotion={model.isReducedMotion}
      start={
        <BrandLock
          testID="home.brand-lock"
          nameTestID="home.game-name"
          gameName={model.gameName}
          logo={<LogoTile testID="home.logo" logo={model.logo} variant="home" />}
          {...(model.isPremium ? { badge } : {})}
        />
      }
      end={
        <IconButton
          testID="home.settings-button"
          icon="gear"
          label={t('common.settings')}
          onPress={onOpenSettings}
          isReducedMotion={model.isReducedMotion}
        />
      }
    />
  );
}
