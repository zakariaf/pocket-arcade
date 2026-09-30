// packages/shell/src/ui/icons/icon-paths.ts (fixture: play with one point moved inside its box)
export const ICON_PATHS = {
  'play': 'M8.32 3.28Q7.3 3.83 7.3 5L7.3 18.9Q7.3 20.07 8.32 20.62Q9.36 21.17 10.31 20.47L18.31 13.57Q21.13 12.99 21.13 11.95Q21.13 10.91 20.3 10.32L10.31 3.43Q9.36 2.73 8.32 3.28Z',
} as const;
export type IconName = keyof typeof ICON_PATHS;
export const DIRECTIONAL_ICONS: ReadonlySet<IconName> = new Set<IconName>(['back', 'chevron', 'forward', 'undo']);
