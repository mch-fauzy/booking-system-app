import { z } from 'zod';
import type { trialClasses } from '@/shared/db/schema';

export const trialClassResponseSchema = z.object({
  id: z.uuid(),
  subject: z.string(),
  startsAt: z.iso.datetime({ precision: 3 }),
  capacity: z.number().int(),
  confirmedCount: z.number().int(),
  seatsLeft: z.number().int(),
});
export type TrialClassResponse = z.infer<typeof trialClassResponseSchema>;

type TrialClassWithCount = Pick<typeof trialClasses.$inferSelect, 'id' | 'subject' | 'startsAt' | 'capacity'> & {
  confirmedCount: number;
};

export function mapTrialClass(row: TrialClassWithCount): TrialClassResponse {
  return {
    id: row.id,
    subject: row.subject,
    startsAt: row.startsAt.toISOString(),
    capacity: row.capacity,
    confirmedCount: row.confirmedCount,
    seatsLeft: Math.max(0, row.capacity - row.confirmedCount),
  };
}
