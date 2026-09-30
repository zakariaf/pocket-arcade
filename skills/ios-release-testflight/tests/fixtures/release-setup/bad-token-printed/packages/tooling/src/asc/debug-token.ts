// Wrong: a JWT in a log is a credential leak.
export function debugToken(token: string): void {
  console.log('ASC token', token);
}
