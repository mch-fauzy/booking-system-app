import 'server-only';
import { conn } from '@/shared/lib/db/db';
import type { DbTransaction } from '@/shared/lib/db/db';
import { paymentAttempts } from '@/shared/db/schema';
import type { PaymentStatus } from '@/shared/constants/booking-status';

export const paymentAttemptRepo = {
  async create(values: { bookingId: string; status: PaymentStatus; cardLast4: string }, tx?: DbTransaction) {
    const [row] = await conn(tx).insert(paymentAttempts).values(values).returning();
    return row;
  },
};
