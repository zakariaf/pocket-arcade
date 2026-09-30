// packages/tooling/src/asc/asc-client.ts
// Tooling only: packages/tooling is outside the N3 lint zone (the app never calls this).
const ASC_BASE_URL = 'https://api.appstoreconnect.apple.com';

export type AscRequest = {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly body?: unknown;
};

export type AscError = { readonly code: string; readonly detail: string };

export type AscResponse =
  | { readonly ok: true; readonly status: number; readonly json: unknown }
  | { readonly ok: false; readonly status: number; readonly errors: readonly AscError[] };

function readField(value: unknown, key: string): string {
  if (typeof value !== 'object' || value === null || !(key in value)) {
    return '';
  }
  const field: unknown = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : '';
}

function parseErrors(json: unknown): readonly AscError[] {
  const list: unknown =
    typeof json === 'object' && json !== null ? Reflect.get(json, 'errors') : undefined;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((item: unknown) => ({
    code: readField(item, 'code'),
    detail: readField(item, 'detail'),
  }));
}

export async function ascRequest(token: string, request: AscRequest): Promise<AscResponse> {
  const response = await fetch(`${ASC_BASE_URL}${request.path}`, {
    method: request.method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
  });
  const text = await response.text();
  const json: unknown = text === '' ? null : JSON.parse(text);
  if (response.ok) {
    return { ok: true, status: response.status, json };
  }
  return { ok: false, status: response.status, errors: parseErrors(json) };
}
