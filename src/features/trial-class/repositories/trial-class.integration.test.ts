import { describe, it, expect } from 'vitest';
import { withRollback } from '@/shared/lib/db/with-rollback';
import { parents, students, trialClasses, bookings } from '@/shared/db/schema';
import { BOOKING_STATUS } from '@/shared/constants/booking-status';
import { trialClassRepo } from './trial-class';
import { mapTrialClass } from '@/features/trial-class/dtos/v1/responses/trial-class';

describe('trialClassRepo', () => {
  it('counts only confirmed bookings and lists only confirmed students in the roster', async () => {
    await withRollback(async (tx) => {
      const [p] = await tx.insert(parents).values({ name: 'P', email: 'p@example.com' }).returning();
      const [s1, s2] = await tx.insert(students).values([
        { parentId: p.id, name: 'A' }, { parentId: p.id, name: 'B' },
      ]).returning();
      const [c] = await tx.insert(trialClasses).values({ subject: 'Sci', startsAt: new Date() }).returning();
      await tx.insert(bookings).values([
        { studentId: s1.id, trialClassId: c.id, status: BOOKING_STATUS.CONFIRMED },
        { studentId: s2.id, trialClassId: c.id, status: BOOKING_STATUS.PENDING_PAYMENT },
      ]);

      const mine = (await trialClassRepo.findAllWithConfirmedCount(tx)).find((x) => x.id === c.id)!;
      expect(mine.confirmedCount).toBe(1);
      expect(mapTrialClass(mine).seatsLeft).toBe(3);

      const roster = await trialClassRepo.findRoster(c.id, tx);
      expect(roster.map((r) => r.studentName)).toEqual(['A']);
    });
  });
});
