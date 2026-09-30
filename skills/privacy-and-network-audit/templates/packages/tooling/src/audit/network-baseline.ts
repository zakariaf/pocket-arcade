// packages/tooling/src/audit/network-baseline.ts
// Baselines live in packages/tooling/network-audit/*.json (a Gate-Change path: owner approval).
// Every entry carries a reason; an unknown finding fails, a stale entry is reported.
export type BaselineEntry = { readonly categories: readonly string[]; readonly reason: string };
export type Baseline = Readonly<Record<string, BaselineEntry>>;
export type Findings = ReadonlyMap<string, ReadonlySet<string>>;

export function compareToBaseline(findings: Findings, baseline: Baseline): string[] {
  const problems: string[] = [];
  for (const [owner, categories] of findings) {
    const allowed = new Set(baseline[owner]?.categories ?? []);
    const extra = [...categories].filter((category) => !allowed.has(category));
    if (extra.length > 0) problems.push(`NEW ${owner}: ${extra.join(', ')} (not in baseline)`);
  }
  for (const owner of Object.keys(baseline)) {
    if (!findings.has(owner)) problems.push(`STALE ${owner}: in baseline but not found`);
  }
  return problems;
}

export function addFinding(
  findings: Map<string, Set<string>>,
  owner: string,
  category: string,
): void {
  const set = findings.get(owner) ?? new Set<string>();
  set.add(category);
  findings.set(owner, set);
}
