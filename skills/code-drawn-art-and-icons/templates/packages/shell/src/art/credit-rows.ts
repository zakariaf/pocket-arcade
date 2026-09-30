// packages/shell/src/art/credit-rows.ts
import type { CreditEntry, CreditKind } from './credit-entry.ts';

/** The S11d groups a game's own rows join (group ids of the licences screen). */
export type CreditGroup = 'fonts' | 'software' | 'sounds';

/** One S11d row as the licences screen lists it; names and licences are never translated. */
export type CreditRow = {
  /** Kebab-case and prefixed with "game-", so the row testID never clashes with a Shell row. */
  readonly key: string;
  readonly group: CreditGroup;
  readonly name: string;
  readonly version: string;
  readonly licence: string;
};

/** Word lists and libraries are listed with the open-source components. */
const GROUP_OF: Readonly<Record<CreditKind, CreditGroup>> = {
  font: 'fonts',
  sound: 'sounds',
  'word-list': 'software',
  'native-library': 'software',
  'npm-package': 'software',
};

function kebab(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The game's GameArt.credits as S11d rows. The licences screen appends them after the Shell's
 * own rows: [...shellLicenceEntries(t), ...creditRowsOf(host.credits)].
 */
export function creditRowsOf(credits: readonly CreditEntry[]): CreditRow[] {
  return credits.map((credit) => ({
    key: `game-${kebab(credit.name)}`,
    group: GROUP_OF[credit.kind],
    name: credit.name,
    version: credit.version,
    licence: credit.license,
  }));
}
