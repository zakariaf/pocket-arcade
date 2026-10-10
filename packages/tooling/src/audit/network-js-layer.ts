// packages/tooling/src/audit/network-js-layer.ts
// Layer B: which shipped JS modules can open a connection. Input: `expo export` source map.
import { packageOf } from './bundle-modules.ts';
import { addFinding } from './network-baseline.ts';

import type { BundleModule } from './bundle-modules.ts';
import type { Findings } from './network-baseline.ts';

const JS_PATTERNS: Readonly<Record<string, RegExp>> = {
  fetch: /\bfetch\(/,
  xhr: /new XMLHttpRequest\b/,
  webSocket: /new WebSocket\(/,
  eventSource: /new EventSource\(/,
  beacon: /\bsendBeacon\(/,
  remoteUrl: /['"`]https?:\/\/(?!localhost|127\.0\.0\.1)[^'"`\s]+/,
};

/**
 * The one first-party file allowed to hold OS hand-off links (store page, privacy policy, mailto:).
 * It is exactly the file the ESLint remote-URL rule exempts, and only for remoteUrl: a fetch()
 * there is still first-party network code.
 */
const EXTERNAL_LINKS_FILE = 'packages/shell/src/config/external-links.ts';

function isExternalLinks(source: string): boolean {
  return source === EXTERNAL_LINKS_FILE || source.endsWith(`/${EXTERNAL_LINKS_FILE}`);
}

// First-party modules (no node_modules in the path) must have zero findings: fail directly.
export function jsNetworkFindings(modules: readonly BundleModule[]): {
  readonly findings: Findings;
  readonly firstParty: readonly string[];
} {
  const findings = new Map<string, Set<string>>();
  const firstParty: string[] = [];
  for (const { source, content } of modules) {
    const owner = packageOf(source);
    for (const [category, pattern] of Object.entries(JS_PATTERNS)) {
      if (!pattern.test(content)) continue;
      if (owner === null && category === 'remoteUrl' && isExternalLinks(source)) continue;
      if (owner === null) firstParty.push(`${source}: ${category}`);
      else addFinding(findings, owner, category);
    }
  }
  return { findings, firstParty };
}
