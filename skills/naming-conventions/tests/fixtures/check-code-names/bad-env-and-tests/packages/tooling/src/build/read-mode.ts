// packages/tooling/src/build/read-mode.ts
/** Reads the ads mode. */
export function readMode(): string | undefined {
  return process.env.adsMode;
}
