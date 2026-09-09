import { describe, it, expect } from 'vitest';
import { mapBooking, bookingResponseSchema } from './booking';

describe('mapBooking', () => {
  it('nests student, class and attempts with ISO dates', () => {
    const at = new Date('2026-10-01T09:05:00.000Z');
    const dto = mapBooking({
      id: '11111111-1111-4111-8111-111111111111',
      status: 'confirmed',
      cancellationReason: null,
      createdAt: at,
      updatedAt: at,
      studentId: '22222222-2222-4222-8222-222222222222',
      trialClassId: '33333333-3333-4333-8333-333333333333',
      student: { id: '22222222-2222-4222-8222-222222222222', name: 'Ana', parentId: '99999999-9999-4999-8999-999999999999', createdAt: at, updatedAt: at },
      trialClass: { id: '33333333-3333-4333-8333-333333333333', subject: 'Math', startsAt: at, capacity: 4, createdAt: at, updatedAt: at },
      paymentAttempts: [{ id: '44444444-4444-4444-8444-444444444444', bookingId: '11111111-1111-4111-8111-111111111111', status: 'succeeded', cardLast4: '4242', createdAt: at, updatedAt: at }],
    });
    expect(dto.trialClass.subject).toBe('Math');
    expect(dto.paymentAttempts[0].cardLast4).toBe('4242');
    expect(dto.createdAt).toBe('2026-10-01T09:05:00.000Z');
    expect(bookingResponseSchema.safeParse(dto).success).toBe(true);
  });
});
