import { PAYMENT_STATUS, type PaymentStatus } from '@/shared/constants/booking-status';

const DECLINE_SUFFIX = '0000';

// Deterministic stand-in for a payment provider: …0000 declines, everything else succeeds.
export function chargeMock(cardNumber: string): { status: PaymentStatus; cardLast4: string } {
  return {
    status: cardNumber.endsWith(DECLINE_SUFFIX) ? PAYMENT_STATUS.FAILED : PAYMENT_STATUS.SUCCEEDED,
    cardLast4: cardNumber.slice(-4),
  };
}
