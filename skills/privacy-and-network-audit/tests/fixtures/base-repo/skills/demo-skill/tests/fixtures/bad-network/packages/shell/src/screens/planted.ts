// A skill fixture with planted N3 findings: the in-repo skill library is outside layer A (it scans
// apps/*/src and packages/*/src only), so audit-repo stays silent about it.
export function planted(): Promise<Response> {
  return fetch('https://example.com/planted');
}
