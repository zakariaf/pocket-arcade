// packages/shell/src/config/external-links.ts: the only place for OS hand-off links (N3 exemption).
export function privacyPolicyUrl(host: string, path: string): string {
  return `https://${host}${path}`;
}

export const SUPPORT_MAIL = 'mailto:support@example.com';
export const STORE_PAGE = 'https://apps.apple.com/app/id0000000000';
