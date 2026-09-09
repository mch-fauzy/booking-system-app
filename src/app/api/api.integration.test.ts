import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/shared/lib/db/db';
import { app, v1 } from '@/shared/lib/api/api';
import { parents, students, trialClasses, bookings, paymentAttempts } from '@/shared/db/schema';
import { BOOKING_STATUS } from '@/shared/constants/booking-status';
import { bookingRouter } from '@/features/booking/api/v1/booking';
import { trialClassRouter } from '@/features/trial-class/api/v1/trial-class';
import { resetFixture } from '@/shared/lib/db/reset-fixture';

// Exercises the real HTTP surface: router -> validate() -> service -> repo -> DTO -> envelope,
// including the status codes and error shapes app.onError produces.
v1.route('/bookings', bookingRouter);
v1.route('/trial-classes', trialClassRouter);
app.route('/v1', v1);

const FIXTURE = { parentEmail: 'api-parent@example.com', classSubject: 'Api Class' };
const fixture = { parentId: '', studentIds: [] as string[], classId: '' };
const NIL_UUID = '00000000-0000-4000-8000-000000000000';

const post = (path: string, body: unknown) =>
  app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function clearBookings() {
  const rows = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.trialClassId, fixture.classId));
  const ids = rows.map((b) => b.id);
  if (ids.length === 0) return;
  await db.delete(paymentAttempts).where(inArray(paymentAttempts.bookingId, ids));
  await db.delete(bookings).where(inArray(bookings.id, ids));
}

beforeAll(async () => {
  await resetFixture(FIXTURE); // a previous run killed mid-file leaves rows behind
  const [p] = await db.insert(parents).values({ name: 'Api Parent', email: FIXTURE.parentEmail }).returning();
  const kids = await db.insert(students).values([{ parentId: p.id, name: 'Api Kid' }]).returning();
  const [c] = await db.insert(trialClasses).values({ subject: FIXTURE.classSubject, startsAt: new Date('2030-02-01T00:00:00Z') }).returning();
  fixture.parentId = p.id;
  fixture.studentIds = kids.map((k) => k.id);
  fixture.classId = c.id;
});

afterAll(async () => {
  await resetFixture(FIXTURE);
});

describe('GET /api/v1/trial-classes', () => {
  it('returns the envelope with seatsLeft', async () => {
    const res = await app.request('/api/v1/trial-classes');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { message: string; data: { id: string; seatsLeft: number }[] };
    expect(body.message).toMatch(/retrieved/i);
    expect(body.data.find((c) => c.id === fixture.classId)?.seatsLeft).toBe(4);
  });
});

describe('POST /api/v1/bookings', () => {
  it('422s on an invalid body with a path/messages array', async () => {
    const res = await post('/api/v1/bookings', { studentId: 'nope', trialClassId: 'nope' });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors: { path: string; messages: string[] }[] };
    expect(body.errors.map((e) => e.path)).toContain('studentId');
  });

  it('404s on an unknown student', async () => {
    const res = await post('/api/v1/bookings', { studentId: NIL_UUID, trialClassId: fixture.classId });
    expect(res.status).toBe(404);
  });

  it('creates with 201, then 409s the duplicate carrying existingBookingId', async () => {
    await clearBookings();
    const created = await post('/api/v1/bookings', { studentId: fixture.studentIds[0], trialClassId: fixture.classId });
    expect(created.status).toBe(201);
    const { data } = (await created.json()) as { data: { id: string; status: string } };
    expect(data.status).toBe(BOOKING_STATUS.PENDING_PAYMENT);

    const dup = await post('/api/v1/bookings', { studentId: fixture.studentIds[0], trialClassId: fixture.classId });
    expect(dup.status).toBe(409);
    const dupBody = (await dup.json()) as { data: { existingBookingId: string } };
    expect(dupBody.data.existingBookingId).toBe(data.id);
  });
});

describe('GET /api/v1/bookings/:id', () => {
  it('422s on a non-uuid param and 404s on an unknown id', async () => {
    expect((await app.request('/api/v1/bookings/not-a-uuid')).status).toBe(422);
    expect((await app.request(`/api/v1/bookings/${NIL_UUID}`)).status).toBe(404);
  });
});

describe('POST /api/v1/bookings/:id/payments', () => {
  it('returns 201 for a declined charge and 201 again for the successful retry', async () => {
    await clearBookings();
    const created = await post('/api/v1/bookings', { studentId: fixture.studentIds[0], trialClassId: fixture.classId });
    const { data } = (await created.json()) as { data: { id: string } };

    const declined = await post(`/api/v1/bookings/${data.id}/payments`, { cardNumber: '4000000000000000' });
    expect(declined.status).toBe(201);
    const declinedBody = (await declined.json()) as { message: string; data: { status: string } };
    expect(declinedBody.data.status).toBe(BOOKING_STATUS.PAYMENT_FAILED);
    expect(declinedBody.message).toMatch(/declined/i);

    const ok = await post(`/api/v1/bookings/${data.id}/payments`, { cardNumber: '4242 4242 4242 4242' });
    expect(ok.status).toBe(201);
    const okBody = (await ok.json()) as { data: { status: string; paymentAttempts: unknown[] } };
    expect(okBody.data.status).toBe(BOOKING_STATUS.CONFIRMED);
    expect(okBody.data.paymentAttempts).toHaveLength(2);
  });

  it('404s payments for an unknown booking', async () => {
    const res = await app.request(`/api/v1/bookings/${NIL_UUID}/payments`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cardNumber: '4242424242424242' }),
    });
    expect(res.status).toBe(404);
  });

  it('422s on a malformed card number', async () => {
    await clearBookings();
    const created = await post('/api/v1/bookings', { studentId: fixture.studentIds[0], trialClassId: fixture.classId });
    const { data } = (await created.json()) as { data: { id: string } };
    expect((await post(`/api/v1/bookings/${data.id}/payments`, { cardNumber: 'abcd' })).status).toBe(422);
  });
});

describe('GET /api/v1/trial-classes/:id/roster', () => {
  it('returns the class with its confirmed entries', async () => {
    await clearBookings();
    const created = await post('/api/v1/bookings', { studentId: fixture.studentIds[0], trialClassId: fixture.classId });
    const { data } = (await created.json()) as { data: { id: string } };
    await post(`/api/v1/bookings/${data.id}/payments`, { cardNumber: '4242424242424242' });

    const res = await app.request(`/api/v1/trial-classes/${fixture.classId}/roster`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { trialClass: { confirmedCount: number }; entries: { student: { name: string } }[] } };
    expect(body.data.trialClass.confirmedCount).toBe(1);
    expect(body.data.entries[0].student.name).toBe('Api Kid');
  });

  it('404s an unknown class', async () => {
    expect((await app.request(`/api/v1/trial-classes/${NIL_UUID}/roster`)).status).toBe(404);
  });
});
