// packages/tooling/src/sims/write-sim-report.ts
import { writeFileSync } from 'node:fs';

/** Writes a bot-run summary for the owner report (Node only). */
export function writeSimReport(path: string, text: string): void {
  writeFileSync(path, text);
}
