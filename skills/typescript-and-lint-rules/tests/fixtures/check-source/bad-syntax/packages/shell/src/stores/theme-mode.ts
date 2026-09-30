// packages/shell/src/stores/theme-mode.ts
export enum ThemeMode {
  Light,
  Dark,
}

export interface ThemeState {
  readonly mode: ThemeMode;
}

export namespace Themes {
  export const DEFAULT = 1;
}

export class ThemeHolder {
  constructor(private readonly state: ThemeState) {}
}

export function parse(json: any): ThemeState {
  return json as ThemeState;
}

export function first(list: readonly ThemeState[]): ThemeState {
  return list[0]!;
}

export default parse;
