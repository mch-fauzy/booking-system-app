import { z } from 'zod';
import {
  bookingStatusSchema,
  cancellationReasonSchema,
  paymentStatusSchema,
} from '@/shared/constants/booking-status';
import type { bookings, paymentAttempts, students, trialClasses } from '@/shared/db/schema';

export const bookingResponseSchema = z.object({
  id: z.uuid(),
  status: bookingStatusSchema,
  cancellationReason: cancellationReasonSchema.nullable(),
  student: z.object({ id: z.uuid(), name: z.string() }),
  trialClass: z.object({ id: z.uuid(), subject: z.string(), startsAt: z.iso.datetime({ precision: 3 }) }),
  paymentAttempts: z.array(z.object({
    id: z.uuid(),
    status: paymentStatusSchema,
    cardLast4: z.string(),
    createdAt: z.iso.datetime({ precision: 3 }),
  })),
  createdAt: z.iso.datetime({ precision: 3 }),
  updatedAt: z.iso.datetime({ precision: 3 }),
});
export type BookingResponse = z.infer<typeof bookingResponseSchema>;

// Shape returned by bookingRepo.findDetail (db.query with relations).
export type BookingDetail = typeof bookings.$inferSelect & {
  student: typeof students.$inferSelect;
  trialClass: typeof trialClasses.$inferSelect;
  paymentAttempts: (typeof paymentAttempts.$inferSelect)[];
};

export function mapBooking(b: BookingDetail): BookingResponse {
  return {
    id: b.id,
    status: b.status,
    cancellationReason: b.cancellationReason,
    student: { id: b.student.id, name: b.student.name },
    trialClass: { id: b.trialClass.id, subject: b.trialClass.subject, startsAt: b.trialClass.startsAt.toISOString() },
    paymentAttempts: b.paymentAttempts.map((a) => ({
      id: a.id,
      status: a.status,
      cardLast4: a.cardLast4,
      createdAt: a.createdAt.toISOString(),
    })),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}
