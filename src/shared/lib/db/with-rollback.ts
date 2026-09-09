import { db } from '@/shared/lib/db/db';
import type { DbTransaction } from '@/shared/lib/db/db';

class Rollback extends Error {}

// Runs fn in a transaction that ALWAYS rolls back, so DB-backed tests leave no residue.
export async function withRollback(fn: (tx: DbTransaction) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}
