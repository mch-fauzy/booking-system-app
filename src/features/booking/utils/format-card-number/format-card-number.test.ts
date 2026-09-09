import { describe, it, expect } from 'vitest';
import { formatCardNumber } from './format-card-number';

describe('formatCardNumber', () => {
  it('groups digits in fours as the user types', () => {
    expect(formatCardNumber('4')).toBe('4');
    expect(formatCardNumber('4242')).toBe('4242');
    expect(formatCardNumber('42424')).toBe('4242 4');
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
  });

  it('drops every non-digit, so letters and dashes cannot be entered', () => {
    expect(formatCardNumber('4242-4242-4242-4242')).toBe('4242 4242 4242 4242');
    expect(formatCardNumber('abcd')).toBe('');
    expect(formatCardNumber('42a4b2')).toBe('4242');
  });

  it('caps at the maximum card length', () => {
    expect(formatCardNumber('9'.repeat(30))).toBe('9999 9999 9999 9999 999');
  });

  it('is idempotent, so re-formatting already formatted input is stable', () => {
    const once = formatCardNumber('4242424242424242');
    expect(formatCardNumber(once)).toBe(once);
  });
});
