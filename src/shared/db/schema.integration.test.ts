import { describe, it, expect } from 'vitest';
import { withRollback } from '@/shared/lib/db/with-rollback';
import { parents, students, trialClasses, bookings } from '@/shared/db/schema';
import { BOOKING_STATUS } from '@/shared/constants/booking-status';
import { isUniqueViolation } from '@/shared/utils/pg-error/pg-error';

describe('bookings partial unique index (DB backstop)', () => {
  it('rejects a second confirmed booking for the same student and class; non-confirmed duplicates are allowed', async () => {
    await withRollback(async (tx) => {
      const [p] = await tx.insert(parents).values({ name: 'P', email: 'p@example.com' }).returning();
      const [s] = await tx.insert(students).values({ parentId: p.id, name: 'S' }).returning();
      const [c] = await tx.insert(trialClasses).values({ subject: 'Sci', startsAt: new Date() }).returning();

      await tx.insert(bookings).values({ studentId: s.id, trialClassId: c.id, status: BOOKING_STATUS.CONFIRMED });
      await tx.insert(bookings).values({ studentId: s.id, trialClassId: c.id, status: BOOKING_STATUS.CANCELLED });

      // The failing statement aborts the tx; withRollback discards it anyway. Nothing runs after this.
      const attempt = tx.insert(bookings).values({ studentId: s.id, trialClassId: c.id, status: BOOKING_STATUS.CONFIRMED });
      await expect(attempt).rejects.toSatisfy(isUniqueViolation);
    });
  });
});
