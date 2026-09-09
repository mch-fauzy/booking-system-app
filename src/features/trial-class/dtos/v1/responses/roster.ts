import { z } from 'zod';
import { trialClassResponseSchema, type TrialClassResponse } from './trial-class';

const rosterEntrySchema = z.object({
  bookingId: z.uuid(),
  student: z.object({ id: z.uuid(), name: z.string() }),
  parent: z.object({ id: z.uuid(), name: z.string() }),
  confirmedAt: z.iso.datetime({ precision: 3 }),
});

export const rosterResponseSchema = z.object({
  trialClass: trialClassResponseSchema,
  entries: z.array(rosterEntrySchema),
});
export type RosterResponse = z.infer<typeof rosterResponseSchema>;

export interface RosterRow {
  bookingId: string;
  studentId: string;
  studentName: string;
  parentId: string;
  parentName: string;
  confirmedAt: Date;
}

export function mapRoster(trialClass: TrialClassResponse, rows: RosterRow[]): RosterResponse {
  return {
    trialClass,
    entries: rows.map((r) => ({
      bookingId: r.bookingId,
      student: { id: r.studentId, name: r.studentName },
      parent: { id: r.parentId, name: r.parentName },
      confirmedAt: r.confirmedAt.toISOString(),
    })),
  };
}
