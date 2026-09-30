// packages/shell/src/i18n/locale-data.ts
export async function loadCatalog(language: string): Promise<unknown> {
  return import(`./catalogs/${language}.json`);
}
