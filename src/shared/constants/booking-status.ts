import { z } from 'zod';

// Lives in shared/ because shared/db/schema.ts types its columns with these unions.
export const BOOKING_STATUS = {
  PENDING_PAYMENT: 'pending_payment', // created; holds NO seat
  CONFIRMED: 'confirmed',             // charged and seat claimed under the class row lock
  PAYMENT_FAILED: 'payment_failed',   // charge declined; retryable
  CANCELLED: 'cancelled',             // terminal; see cancellationReason
} as const;
export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];
export const bookingStatusSchema = z.enum(BOOKING_STATUS);

export const PAYMENT_STATUS = {
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
export const paymentStatusSchema = z.enum(PAYMENT_STATUS);

export const CANCELLATION_REASON = {
  CLASS_FULL: 'class_full',   // seat was gone at confirm time (never charged)
  DUPLICATE: 'duplicate',     // child already confirmed in this class via another booking
} as const;
export type CancellationReason = (typeof CANCELLATION_REASON)[keyof typeof CANCELLATION_REASON];
export const cancellationReasonSchema = z.enum(CANCELLATION_REASON);

// A booking that can still be paid.
const PAYABLE_STATUSES = [BOOKING_STATUS.PENDING_PAYMENT, BOOKING_STATUS.PAYMENT_FAILED] as const;
// A booking that blocks a new one for the same child + class.
export const LIVE_STATUSES = [...PAYABLE_STATUSES, BOOKING_STATUS.CONFIRMED] as const;

export function isPayable(status: BookingStatus): boolean {
  return PAYABLE_STATUSES.some((s) => s === status);
}
