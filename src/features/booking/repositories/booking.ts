import 'server-only';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { conn } from '@/shared/lib/db/db';
import type { DbTransaction } from '@/shared/lib/db/db';
import { bookings, paymentAttempts } from '@/shared/db/schema';
import { BOOKING_STATUS, LIVE_STATUSES, type BookingStatus, type CancellationReason } from '@/shared/constants/booking-status';
import type { BookingDetail } from '@/features/booking/dtos/v1/responses/booking';

type BookingRow = typeof bookings.$inferSelect;

export const bookingRepo = {
  async findById(id: string, tx?: DbTransaction): Promise<BookingRow | undefined> {
    return conn(tx).query.bookings.findFirst({ where: eq(bookings.id, id) });
  },

  async findDetail(id: string, tx?: DbTransaction): Promise<BookingDetail | undefined> {
    return conn(tx).query.bookings.findFirst({
      where: eq(bookings.id, id),
      with: { student: true, trialClass: true, paymentAttempts: { orderBy: asc(paymentAttempts.createdAt) } },
    });
  },

  // Oldest live (pending, failed-but-retryable, or confirmed) booking for this child + class.
  async findLiveForStudentClass(studentId: string, trialClassId: string, tx?: DbTransaction): Promise<BookingRow | undefined> {
    return conn(tx).query.bookings.findFirst({
      where: and(eq(bookings.studentId, studentId), eq(bookings.trialClassId, trialClassId), inArray(bookings.status, [...LIVE_STATUSES])),
      orderBy: asc(bookings.createdAt),
    });
  },

  async hasConfirmedForStudentClass(studentId: string, trialClassId: string, tx?: DbTransaction): Promise<boolean> {
    const row = await conn(tx).query.bookings.findFirst({
      where: and(eq(bookings.studentId, studentId), eq(bookings.trialClassId, trialClassId), eq(bookings.status, BOOKING_STATUS.CONFIRMED)),
      columns: { id: true },
    });
    return row !== undefined;
  },

  async countConfirmed(trialClassId: string, tx?: DbTransaction): Promise<number> {
    const [row] = await conn(tx)
      .select({ n: count() })
      .from(bookings)
      .where(and(eq(bookings.trialClassId, trialClassId), eq(bookings.status, BOOKING_STATUS.CONFIRMED)));
    return row.n;
  },

  async create(values: { studentId: string; trialClassId: string }, tx?: DbTransaction): Promise<BookingRow> {
    const [row] = await conn(tx).insert(bookings).values(values).returning();
    return row;
  },

  async update(
    id: string,
    patch: { status: BookingStatus; cancellationReason?: CancellationReason },
    tx?: DbTransaction,
  ): Promise<BookingRow> {
    const [row] = await conn(tx).update(bookings).set(patch).where(eq(bookings.id, id)).returning();
    return row;
  },
};
