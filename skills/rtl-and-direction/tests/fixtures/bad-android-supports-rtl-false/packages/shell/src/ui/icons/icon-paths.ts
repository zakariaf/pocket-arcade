export const ICON_PATHS = {
  back: 'M10.5 5 3.8 12l6.7 7M4.6 12h15.6',
  chevron: 'm9.2 5.2 6.8 6.8-6.8 6.8',
  play: 'M8 5v14l11-7z',
  'star-filled': 'M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
} as const;

export type IconName = keyof typeof ICON_PATHS;

/** Icons that point along the reading direction flip in RTL. */
export const DIRECTIONAL_ICONS: ReadonlySet<IconName> = new Set<IconName>(['back', 'chevron']);
