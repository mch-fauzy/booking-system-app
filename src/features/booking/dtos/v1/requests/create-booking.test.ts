import { describe, it, expect } from 'vitest';
import { createBookingSchema } from './create-booking';

describe('createBookingSchema', () => {
  it('requires two uuids', () => {
    expect(createBookingSchema.safeParse({ studentId: 'x', trialClassId: 'y' }).success).toBe(false);
    expect(createBookingSchema.safeParse({
      studentId: '11111111-1111-4111-8111-111111111111',
      trialClassId: '22222222-2222-4222-8222-222222222222',
    }).success).toBe(true);
  });
});
