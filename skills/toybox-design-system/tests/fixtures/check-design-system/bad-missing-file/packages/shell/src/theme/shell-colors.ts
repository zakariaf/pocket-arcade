// packages/shell/src/theme/shell-colors.ts
import type { ColorScheme } from './theme-types.ts';

/** Toybox colours that no game repaints; they follow only the light/dark scheme. */
export type ShellColors = {
  readonly success: string;
  readonly warning: string;
  /** Tint behind destructive icons, the hold-to-confirm fill, the Premium error panel. */
  readonly dangerFill: string;
  /** Sticker paper, flags, the "Today" tag, gold icon tiles, Premium art, confetti. */
  readonly gold: string;
  /** The white die-cut ring around stickers, flags, art tiles and cut logos. */
  readonly cut: string;
  /** Outline and text of printed parts (stickers, flags, art tiles, logos) in both schemes. */
  readonly toyInk: string;
  readonly toastBackground: string;
  readonly toastText: string;
  /** Dims the screen under dialogs, the pause dialog and sheets. */
  readonly scrim: string;
  /** Row separators, the score-panel rule and stat-list rules. */
  readonly line: string;
  readonly adBackground: string;
  readonly adLine: string;
  readonly adText: string;
};

export const SHELL_COLORS: Readonly<Record<ColorScheme, ShellColors>> = {
  light: {
    success: '#17804A',
    warning: '#8A5A00',
    dangerFill: '#FFD9DD',
    gold: '#FFC928',
    cut: '#FFFFFF',
    toyInk: '#1D1B3A',
    toastBackground: '#1D1B3A',
    toastText: '#F8FBFF',
    scrim: 'rgba(29,27,58,.55)',
    line: 'rgba(29,27,58,.14)',
    adBackground: '#E6E9ED',
    adLine: '#8D949E',
    adText: '#474C55',
  },
  dark: {
    success: '#7EE3A6',
    warning: '#FFC95C',
    dangerFill: '#4A1F3A',
    gold: '#FFC928',
    cut: '#FFFFFF',
    toyInk: '#1D1B3A',
    toastBackground: '#F4F2FF',
    toastText: '#1B1943',
    scrim: 'rgba(3,2,12,.7)',
    line: 'rgba(228,224,255,.16)',
    adBackground: '#2A2C38',
    adLine: '#6B7080',
    adText: '#C3C6D6',
  },
};
