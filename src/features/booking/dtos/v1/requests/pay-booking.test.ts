import { describe, it, expect } from 'vitest';
import { payBookingSchema } from './pay-booking';

describe('payBookingSchema', () => {
  it('accepts 12–19 digits and strips spaces', () => {
    const r = payBookingSchema.safeParse({ cardNumber: '4242 4242 4242 4242' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.cardNumber).toBe('4242424242424242');
  });
  it('rejects letters and short numbers', () => {
    expect(payBookingSchema.safeParse({ cardNumber: '4242abcd' }).success).toBe(false);
    expect(payBookingSchema.safeParse({ cardNumber: '4242' }).success).toBe(false);
  });
});
