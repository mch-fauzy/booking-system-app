import type { z } from 'zod';
import { clientResponseSchema } from '@/shared/dtos/responses/client-response';
import type { ApiError } from '@/shared/types/response';

export class ApiClientError extends Error {
  constructor(readonly status: number, message: string, readonly data?: unknown) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// POST JSON to the Hono API, parse the { message, data } envelope, return `data`.
export async function postJson<T extends z.ZodTypeAny>(url: string, body: unknown, dataSchema: T): Promise<z.infer<T>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json: unknown = await res.json();
  if (!res.ok) {
    const err = json as ApiError;
    throw new ApiClientError(res.status, err.message, err.data);
  }
  const envelope = clientResponseSchema.parse(json);
  return dataSchema.parse(envelope.data);
}
