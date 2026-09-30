// packages/tooling/src/asc/asc-types.ts
/** App Store Connect resource types are camelCase: tooling is exempt from the kind rule. */
export const BUILD_RESOURCE = { type: 'betaBuildLocalizations' } as const;
export function isSqlReady(isOpen: boolean): boolean {
  return isOpen;
}
