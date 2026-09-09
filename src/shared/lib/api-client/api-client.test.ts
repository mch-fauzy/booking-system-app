import { describe, it, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { postJson, ApiClientError } from './api-client';

afterEach(() => vi.restoreAllMocks());

describe('postJson', () => {
  it('parses the envelope and returns data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'ok', data: { id: 'x' } }), { status: 201 }));
    await expect(postJson('/api/v1/things', { a: 1 }, z.object({ id: z.string() }))).resolves.toEqual({ id: 'x' });
  });

  it('throws ApiClientError with status, message and data on non-2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'Conflict', data: { existingBookingId: 'b1' } }), { status: 409 }));
    const err = await postJson('/x', {}, z.unknown()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).toMatchObject({ status: 409, message: 'Conflict', data: { existingBookingId: 'b1' } });
  });
});
