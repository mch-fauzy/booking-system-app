import { describe, it, expect } from 'vitest';
import { BOOKING_STATUS, isPayable, bookingStatusSchema, LIVE_STATUSES } from './booking-status';

describe('booking status', () => {
  it('pending_payment and payment_failed are payable; confirmed and cancelled are not', () => {
    expect(isPayable(BOOKING_STATUS.PENDING_PAYMENT)).toBe(true);
    expect(isPayable(BOOKING_STATUS.PAYMENT_FAILED)).toBe(true);
    expect(isPayable(BOOKING_STATUS.CONFIRMED)).toBe(false);
    expect(isPayable(BOOKING_STATUS.CANCELLED)).toBe(false);
  });
  it('live statuses exclude cancelled', () => {
    expect(LIVE_STATUSES).not.toContain(BOOKING_STATUS.CANCELLED);
  });
  it('schema rejects unknown status', () => {
    expect(bookingStatusSchema.safeParse('paid').success).toBe(false);
    expect(bookingStatusSchema.safeParse('confirmed').success).toBe(true);
  });
});
