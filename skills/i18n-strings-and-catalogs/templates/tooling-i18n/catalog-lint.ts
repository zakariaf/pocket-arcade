// packages/tooling/src/i18n/catalog-lint.ts
// Lints the four catalogs of one directory. The CLI is verify-catalogs.ts (`npm run i18n:verify`).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { lintMessage, missingGameKeys } from './catalog-lint-rules.ts';

import type { Language, Namespace } from './catalog-lint-rules.ts';

const LANGUAGES: readonly Language[] = ['en', 'de', 'fa', 'ckb'];

function readCatalog(dir: string, language: Language): Record<string, string> {
  const parsed: unknown = JSON.parse(readFileSync(join(dir, `${language}.json`), 'utf8'));
  if (typeof parsed !== 'object' || parsed === null)
    throw new Error(`${dir}/${language}.json: not an object`);
  return parsed as Record<string, string>;
}

// Catalog files keep their keys sorted alphabetically (stable diffs).
function sortProblem(dir: string, language: Language, keys: readonly string[]): string[] {
  const sorted = [...keys].sort();
  const isSorted = keys.every((key, index) => key === sorted[index]);
  return isSorted ? [] : [`${dir}/${language}.json: keys are not sorted alphabetically`];
}

export function lintDirectory(dir: string, namespace: Namespace): string[] {
  const report: string[] = [];
  for (const language of LANGUAGES) {
    const catalog = readCatalog(dir, language);
    report.push(...sortProblem(dir, language, Object.keys(catalog)));
    for (const problem of missingGameKeys(namespace, Object.keys(catalog))) {
      report.push(`${dir}/${language}.json: ${problem}`);
    }
    for (const [key, message] of Object.entries(catalog)) {
      for (const problem of lintMessage({ language, key, message, namespace })) {
        report.push(`${dir}/${language}.json  ${key}: ${problem}`);
      }
    }
  }
  return report;
}
