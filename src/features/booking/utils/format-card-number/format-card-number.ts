import { CARD_GROUP_SIZE, CARD_MAX_DIGITS } from '@/features/booking/constants/card';

// Keeps only digits, caps the length, and groups in fours: "4242424242424242" -> "4242 4242 4242 4242".
export function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, CARD_MAX_DIGITS);
  return digits.replace(new RegExp(`(.{${CARD_GROUP_SIZE}})(?=.)`, 'g'), '$1 ');
}
