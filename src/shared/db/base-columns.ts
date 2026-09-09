// NOT server-only: pure column metadata imported by drizzle-kit.
import { uuid, timestamp } from 'drizzle-orm/pg-core';

export const TIMESTAMP_MS = { withTimezone: true, mode: 'date', precision: 3 } as const;

export const baseColumns = {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', TIMESTAMP_MS).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', TIMESTAMP_MS)
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};
