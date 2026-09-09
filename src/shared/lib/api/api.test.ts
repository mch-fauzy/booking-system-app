import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { app, v1 } from './api';
import { ValidationException } from '@/shared/lib/exceptions/validation-exception';
import { ConflictException } from '@/shared/lib/exceptions/conflict-exception';

// Routes registered directly on app so this test depends on no feature.
app.get('/__boom-404', () => { throw new HTTPException(404, { message: 'Thing not found' }); });
app.get('/__boom-500', () => { throw new Error('unexpected'); });
app.get('/__boom-validation', () => { throw new ValidationException([{ path: 'name', messages: ['Required'] }]); });
app.get('/__boom-conflict', () => { throw new ConflictException('Already exists', { existingId: 'abc' }); });
app.get('/__boom-unique', () => { throw Object.assign(new Error('duplicate key'), { code: '23505' }); });
app.get('/__ok', (c) => c.json({ message: 'OK', data: { hello: 'world' } }));

const testRouter = new Hono();
testRouter.get('/ping', (c) => c.json({ message: 'pong', data: null }));
v1.route('/test', testRouter);
app.route('/v1', v1);

describe('root Hono app', () => {
  it('responds 200 on a happy-path route', async () => {
    const res = await app.request('/api/__ok');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: { hello: string } }).data.hello).toBe('world');
  });

  it('v1 sub-router is reachable after attaching', async () => {
    expect((await app.request('/api/v1/test/ping')).status).toBe(200);
  });

  it('formats a 404 HTTPException as { message }', async () => {
    const res = await app.request('/api/__boom-404');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { message: string }).message).toBe('Thing not found');
  });

  it('maps an unexpected Error to 500', async () => {
    expect((await app.request('/api/__boom-500')).status).toBe(500);
  });

  it('returns 404 on an unknown route via notFound', async () => {
    expect((await app.request('/api/does-not-exist-at-all')).status).toBe(404);
  });

  it('formats a ValidationException as 422 with errors array', async () => {
    const res = await app.request('/api/__boom-validation');
    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors: { path: string; messages: string[] }[] };
    expect(body.errors[0]).toEqual({ path: 'name', messages: ['Required'] });
  });

  it('formats a ConflictException as 409 with its data', async () => {
    const res = await app.request('/api/__boom-conflict');
    expect(res.status).toBe(409);
    const body = (await res.json()) as { message: string; data: { existingId: string } };
    expect(body.message).toBe('Already exists');
    expect(body.data.existingId).toBe('abc');
  });

  it('maps a pg unique violation to 409', async () => {
    expect((await app.request('/api/__boom-unique')).status).toBe(409);
  });
});
