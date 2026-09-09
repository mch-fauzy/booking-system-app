import { describe, it, expect } from 'vitest';
import { isUniqueViolation } from './pg-error';

describe('isUniqueViolation', () => {
  it('detects a direct pg error code', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });
  it('detects a wrapped cause code (DrizzleQueryError)', () => {
    expect(isUniqueViolation({ cause: { code: '23505' } })).toBe(true);
  });
  it('ignores other codes and non-objects', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(new Error('x'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
