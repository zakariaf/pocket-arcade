// packages/tooling/src/asc/asc-client.ts (excerpt)
export function describeFailure(status: number, code: string): string {
  const message = `App Store Connect answered ${status} (${code})`;
  console.error(message);
  return message;
}
