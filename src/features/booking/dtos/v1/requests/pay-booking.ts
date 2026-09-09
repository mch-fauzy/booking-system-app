import { z } from 'zod';
import { CARD_MAX_DIGITS, CARD_MIN_DIGITS } from '@/features/booking/constants/card';

// The form submits grouped digits ("4242 4242 4242 4242"); strip separators before validating.
export const payBookingSchema = z.object({
  cardNumber: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ''))
    .pipe(
      z.string().regex(new RegExp(`^\\d{${CARD_MIN_DIGITS},${CARD_MAX_DIGITS}}$`), {
        error: `Card number must be ${CARD_MIN_DIGITS}–${CARD_MAX_DIGITS} digits`,
      }),
    ),
});
export type PayBookingRequest = z.infer<typeof payBookingSchema>;
export type PayBookingInput = z.input<typeof payBookingSchema>;
