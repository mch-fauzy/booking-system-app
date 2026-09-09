import { z } from 'zod';

export const createBookingSchema = z.object({
  studentId: z.uuid({ error: 'Choose a child' }),
  trialClassId: z.uuid({ error: 'Choose a trial class' }),
});
export type CreateBookingRequest = z.infer<typeof createBookingSchema>;
