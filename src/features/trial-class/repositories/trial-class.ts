import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { conn } from '@/shared/lib/db/db';
import type { DbTransaction } from '@/shared/lib/db/db';
import { bookings, parents, students, trialClasses } from '@/shared/db/schema';
import { BOOKING_STATUS } from '@/shared/constants/booking-status';
import type { RosterRow } from '@/features/trial-class/dtos/v1/responses/roster';

export const trialClassRepo = {
  async findAllWithConfirmedCount(tx?: DbTransaction) {
    return conn(tx)
      .select({
        id: trialClasses.id,
        subject: trialClasses.subject,
        startsAt: trialClasses.startsAt,
        capacity: trialClasses.capacity,
        confirmedCount: sql<number>`count(${bookings.id})::int`,
      })
      .from(trialClasses)
      .leftJoin(
        bookings,
        and(eq(bookings.trialClassId, trialClasses.id), eq(bookings.status, BOOKING_STATUS.CONFIRMED)),
      )
      .groupBy(trialClasses.id)
      .orderBy(asc(trialClasses.startsAt));
  },

  // `confirmed` is terminal, so a confirmed booking's updatedAt is its confirmation time.
  async findRoster(trialClassId: string, tx?: DbTransaction): Promise<RosterRow[]> {
    return conn(tx)
      .select({
        bookingId: bookings.id,
        studentId: students.id,
        studentName: students.name,
        parentId: parents.id,
        parentName: parents.name,
        confirmedAt: bookings.updatedAt,
      })
      .from(bookings)
      .innerJoin(students, eq(students.id, bookings.studentId))
      .innerJoin(parents, eq(parents.id, students.parentId))
      .where(and(eq(bookings.trialClassId, trialClassId), eq(bookings.status, BOOKING_STATUS.CONFIRMED)))
      .orderBy(asc(bookings.updatedAt));
  },
};
