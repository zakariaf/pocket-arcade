// packages/shell/src/ui/button-paint.ts
import type { TextTone } from './app-text.tsx';
import type { Theme } from '@e07/shell/theme/theme-types.ts';

/** primary = accent "go"; secondary = surface; pop = the second game paint; danger = surface + danger ink. */
export type RaisedKind = 'primary' | 'secondary' | 'pop' | 'danger';

export type KindPaint = {
  readonly fill: string;
  /** Icons and busy blocks on the face. */
  readonly content: string;
  readonly edge: string;
  /** AppText tone for the label. */
  readonly tone: TextTone;
};

/** Face paint of a raised key per kind; disabled keys switch to textMuted content. */
export function kindPaint(theme: Theme, kind: RaisedKind, isDisabled: boolean): KindPaint {
  const { colors } = theme;
  if (isDisabled) {
    return {
      fill: colors.sunken,
      content: colors.textMuted,
      edge: colors.textMuted,
      tone: 'muted',
    };
  }
  switch (kind) {
    case 'primary':
      return {
        fill: colors.primary,
        content: colors.onPrimary,
        edge: colors.border,
        tone: 'onPrimary',
      };
    case 'secondary':
      return { fill: colors.surface, content: colors.icon, edge: colors.border, tone: 'default' };
    case 'pop':
      return { fill: colors.pop, content: colors.onPop, edge: colors.border, tone: 'onPop' };
    case 'danger':
      return { fill: colors.surface, content: colors.danger, edge: colors.danger, tone: 'danger' };
  }
}
