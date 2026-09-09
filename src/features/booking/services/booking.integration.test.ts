import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/shared/lib/db/db';
import { parents, students, trialClasses, bookings, paymentAttempts } from '@/shared/db/schema';
import { BOOKING_STATUS } from '@/shared/constants/booking-status';
import { resetFixture } from '@/shared/lib/db/reset-fixture';
import { bookingService } from './booking';

// The service owns its transactions, so these tests commit real rows and clean up after.
const FIXTURE = { parentEmail: 'test-parent@example.com', classSubject: 'Test Class' };
const fixture = { parentId: '', studentIds: [] as string[], classId: '' };

// One transaction: attempts and their bookings must go together, or a concurrent insert between
// the two deletes leaves an orphan attempt and the booking delete trips the FK.
async function deleteBookingsForClass(classId: string) {
  await db.transaction(async (tx) => {
    const rows = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.trialClassId, classId));
    const ids = rows.map((b) => b.id);
    if (ids.length === 0) return;
    await tx.delete(paymentAttempts).where(inArray(paymentAttempts.bookingId, ids));
    await tx.delete(bookings).where(inArray(bookings.id, ids));
  });
}

beforeAll(async () => {
  await resetFixture(FIXTURE); // a previous run killed mid-file leaves rows behind
  const [p] = await db.insert(parents).values({ name: 'Test Parent', email: FIXTURE.parentEmail }).returning();
  const kids = await db.insert(students).values(
    ['Kid 1', 'Kid 2', 'Kid 3', 'Kid 4', 'Kid 5'].map((name) => ({ parentId: p.id, name })),
  ).returning();
  const [c] = await db.insert(trialClasses).values({ subject: FIXTURE.classSubject, startsAt: new Date('2030-01-01T00:00:00Z') }).returning();
  fixture.parentId = p.id;
  fixture.studentIds = kids.map((k) => k.id);
  fixture.classId = c.id;
});

afterAll(async () => {
  await resetFixture(FIXTURE);
});

const NIL_UUID = '00000000-0000-4000-8000-000000000000';

describe('bookingService.create', () => {
  it('creates a pending_payment booking with no attempts', async () => {
    await deleteBookingsForClass(fixture.classId);
    const b = await bookingService.create({ studentId: fixture.studentIds[0], trialClassId: fixture.classId });
    expect(b.status).toBe(BOOKING_STATUS.PENDING_PAYMENT);
    expect(b.paymentAttempts).toEqual([]);
    expect(b.student.name).toBe('Kid 1');
  });

  it('rejects a second live booking for the same child and class with 409 + existing id', async () => {
    await deleteBookingsForClass(fixture.classId);
    const first = await bookingService.create({ studentId: fixture.studentIds[0], trialClassId: fixture.classId });
    await expect(bookingService.create({ studentId: fixture.studentIds[0], trialClassId: fixture.classId }))
      .rejects.toMatchObject({ status: 409, data: { existingBookingId: first.id } });
  });

  it('404s on unknown student or class', async () => {
    await expect(bookingService.create({ studentId: NIL_UUID, trialClassId: fixture.classId })).rejects.toMatchObject({ status: 404 });
    await expect(bookingService.create({ studentId: fixture.studentIds[0], trialClassId: NIL_UUID })).rejects.toMatchObject({ status: 404 });
  });
});

const GOOD_CARD = { cardNumber: '4242424242424242' };
const BAD_CARD = { cardNumber: '4000000000000000' };

async function confirmedCount() {
  const rows = await db.select().from(bookings).where(eq(bookings.trialClassId, fixture.classId));
  return rows.filter((b) => b.status === BOOKING_STATUS.CONFIRMED).length;
}

function book(studentIdx: number) {
  return bookingService.create({ studentId: fixture.studentIds[studentIdx], trialClassId: fixture.classId });
}

describe('bookingService.pay', () => {
  it('confirms on success and records a succeeded attempt with last4', async () => {
    await deleteBookingsForClass(fixture.classId);
    const b = await book(0);
    const paid = await bookingService.pay(b.id, GOOD_CARD);
    expect(paid.status).toBe(BOOKING_STATUS.CONFIRMED);
    expect(paid.paymentAttempts).toMatchObject([{ status: 'succeeded', cardLast4: '4242' }]);
  });

  it('invariant 3: a declined payment records the attempt and never confirms; a retry can succeed', async () => {
    await deleteBookingsForClass(fixture.classId);
    const b = await book(0);
    const failed = await bookingService.pay(b.id, BAD_CARD);
    expect(failed.status).toBe(BOOKING_STATUS.PAYMENT_FAILED);
    expect(await confirmedCount()).toBe(0);
    const retried = await bookingService.pay(b.id, GOOD_CARD);
    expect(retried.status).toBe(BOOKING_STATUS.CONFIRMED);
    expect(retried.paymentAttempts.map((a) => a.status)).toEqual(['failed', 'succeeded']);
  });

  it('409 when paying a confirmed booking again', async () => {
    await deleteBookingsForClass(fixture.classId);
    const b = await book(0);
    await bookingService.pay(b.id, GOOD_CARD);
    await expect(bookingService.pay(b.id, GOOD_CARD)).rejects.toMatchObject({ status: 409 });
  });

  it('invariant 1: the 5th confirmation is rejected, the booking is cancelled (class_full) and never charged', async () => {
    await deleteBookingsForClass(fixture.classId);
    for (let i = 0; i < 4; i++) await bookingService.pay((await book(i)).id, GOOD_CARD);
    const fifth = await book(4);
    await expect(bookingService.pay(fifth.id, GOOD_CARD)).rejects.toMatchObject({ status: 409 });
    expect(await confirmedCount()).toBe(4);
    const after = await bookingService.getById(fifth.id);
    expect(after.status).toBe(BOOKING_STATUS.CANCELLED);
    expect(after.cancellationReason).toBe('class_full');
    expect(after.paymentAttempts).toEqual([]);
  });

  it('invariant 2: a child cannot be confirmed twice for the same class', async () => {
    await deleteBookingsForClass(fixture.classId);
    const first = await book(0);
    await bookingService.pay(first.id, GOOD_CARD);
    // Bypass the create-time guard: insert a second pending row directly.
    const [second] = await db.insert(bookings)
      .values({ studentId: fixture.studentIds[0], trialClassId: fixture.classId })
      .returning();
    await expect(bookingService.pay(second.id, GOOD_CARD)).rejects.toMatchObject({ status: 409 });
    expect(await confirmedCount()).toBe(1);
    expect((await bookingService.getById(second.id)).cancellationReason).toBe('duplicate');
  });

  it('invariant 4: last-seat race — two concurrent payments, exactly one confirmed', async () => {
    await deleteBookingsForClass(fixture.classId);
    for (let i = 0; i < 3; i++) await bookingService.pay((await book(i)).id, GOOD_CARD);
    const a = await book(3);
    const b = await book(4);

    const results = await Promise.allSettled([
      bookingService.pay(a.id, GOOD_CARD),
      bookingService.pay(b.id, GOOD_CARD),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ status: 409 });
    expect(await confirmedCount()).toBe(4);

    const statuses = [await bookingService.getById(a.id), await bookingService.getById(b.id)].map((x) => x.status).sort();
    expect(statuses).toEqual([BOOKING_STATUS.CANCELLED, BOOKING_STATUS.CONFIRMED]);
  });
});
