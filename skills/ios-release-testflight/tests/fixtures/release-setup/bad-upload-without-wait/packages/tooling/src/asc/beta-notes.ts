// packages/tooling/src/asc/beta-notes.ts
// Sets TestFlight "What to Test" (whatsNew) for one build through the App Store Connect REST API:
// PATCH the existing en-US beta build localization, or POST one when none exists.
import { ascRequest, type AscResponse } from '@e07/tooling/asc/asc-client.ts';

export type BetaLocalization = { readonly id: string; readonly locale: string };

export function localizationsPath(buildId: string): string {
  return `/v1/builds/${encodeURIComponent(buildId)}/betaBuildLocalizations`;
}

export function patchWhatsNewBody(localizationId: string, whatsNew: string): unknown {
  return {
    data: { type: 'betaBuildLocalizations', id: localizationId, attributes: { whatsNew } },
  };
}

export function createWhatsNewBody(buildId: string, whatsNew: string): unknown {
  return {
    data: {
      type: 'betaBuildLocalizations',
      attributes: { locale: 'en-US', whatsNew },
      relationships: { build: { data: { type: 'builds', id: buildId } } },
    },
  };
}

function read(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
}

/** The en-US localization in a GET .../betaBuildLocalizations answer, if there is one. */
export function findEnglishLocalization(json: unknown): BetaLocalization | null {
  const data = read(json, 'data');
  const items: unknown[] = Array.isArray(data) ? data : [];
  for (const item of items) {
    const id = read(item, 'id');
    const locale = read(read(item, 'attributes'), 'locale');
    if (typeof id === 'string' && locale === 'en-US') {
      return { id, locale };
    }
  }
  return null;
}

function assertOk(response: AscResponse, what: string): void {
  if (!response.ok) {
    const codes = response.errors.map((error) => error.code).join(', ');
    throw new Error(`${what}: App Store Connect answered ${String(response.status)} (${codes})`);
  }
}

export async function setWhatsNew(token: string, buildId: string, whatsNew: string): Promise<void> {
  const list = await ascRequest(token, { method: 'GET', path: localizationsPath(buildId) });
  assertOk(list, 'reading beta build localizations');
  const english = list.ok ? findEnglishLocalization(list.json) : null;
  const response =
    english === null
      ? await ascRequest(token, {
          method: 'POST',
          path: '/v1/betaBuildLocalizations',
          body: createWhatsNewBody(buildId, whatsNew),
        })
      : await ascRequest(token, {
          method: 'PATCH',
          path: `/v1/betaBuildLocalizations/${encodeURIComponent(english.id)}`,
          body: patchWhatsNewBody(english.id, whatsNew),
        });
  assertOk(response, 'setting What to Test');
}
