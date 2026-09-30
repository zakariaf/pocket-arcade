// packages/tooling/src/report/print-report.ts
/** Prints one line per finding; tooling may log (Node code). */
export function printReport(lines: readonly string[]): void {
  for (const line of lines) {
    console.log(line);
  }
}
