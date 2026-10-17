import type { ApiError } from '@amprex/shared';
import { getToken, clearSession } from './session';

/** Error thrown for any non-2xx answer; carries the API's { code, message(fa), details }. */
export class ApiRequestError extends Error implements ApiError {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

const NETWORK_ERROR = 'ارتباط با سرور برقرار نشد.';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  /** Send the staff/technician token if there is one (default true). */
  auth?: boolean;
  signal?: AbortSignal;
}

/** Calls /api/* on the web origin; next.config rewrites it to the Nest API. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const url = `/api${path}${params.size ? `?${params}` : ''}`;
  const token = opts.auth === false ? null : getToken();

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...opts.headers,
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiRequestError(0, 'NETWORK_ERROR', NETWORK_ERROR);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    if (res.status === 401 && token) clearSession();
    const body = (data ?? {}) as Partial<ApiError>;
    throw new ApiRequestError(
      res.status,
      body.code ?? `HTTP_${res.status}`,
      body.message ?? NETWORK_ERROR,
      body.details,
      res.headers.get('x-request-id') ?? undefined,
    );
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
