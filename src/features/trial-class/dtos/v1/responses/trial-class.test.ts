import { describe, it, expect } from 'vitest';
import { mapTrialClass, trialClassResponseSchema } from './trial-class';

const row = {
  id: '11111111-1111-4111-8111-111111111111',
  subject: 'Math',
  startsAt: new Date('2026-10-01T09:00:00.000Z'),
  capacity: 4,
  confirmedCount: 3,
};

describe('mapTrialClass', () => {
  it('derives seatsLeft and ISO dates', () => {
    const dto = mapTrialClass(row);
    expect(dto.seatsLeft).toBe(1);
    expect(dto.startsAt).toBe('2026-10-01T09:00:00.000Z');
    expect(trialClassResponseSchema.safeParse(dto).success).toBe(true);
  });
  it('clamps seatsLeft at zero', () => {
    expect(mapTrialClass({ ...row, confirmedCount: 9 }).seatsLeft).toBe(0);
  });
});
