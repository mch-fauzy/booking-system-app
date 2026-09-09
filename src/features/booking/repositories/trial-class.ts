import 'server-only';
import { eq } from 'drizzle-orm';
import { conn } from '@/shared/lib/db/db';
import type { DbTransaction } from '@/shared/lib/db/db';
import { trialClasses } from '@/shared/db/schema';

type TrialClassRow = typeof trialClasses.$inferSelect;

// The booking feature's own view of trial_classes: existence check + the ONE row lock in the app.
export const bookingTrialClassRepo = {
  async findById(id: string, tx?: DbTransaction): Promise<TrialClassRow | undefined> {
    return conn(tx).query.trialClasses.findFirst({ where: eq(trialClasses.id, id) });
  },

  // FOR NO KEY UPDATE: serializes confirmations for this class without blocking FK inserts
  // (a new pending booking referencing the class only needs KEY SHARE).
  async lockForConfirm(id: string, tx: DbTransaction): Promise<TrialClassRow | undefined> {
    const rows = await tx.select().from(trialClasses).where(eq(trialClasses.id, id)).for('no key update');
    return rows[0];
  },
};
