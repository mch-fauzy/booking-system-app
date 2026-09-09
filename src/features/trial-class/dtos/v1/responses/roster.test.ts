import { describe, it, expect } from 'vitest';
import { mapRoster, rosterResponseSchema } from './roster';
import { mapTrialClass } from './trial-class';

const trialClass = mapTrialClass({
  id: '11111111-1111-4111-8111-111111111111',
  subject: 'Math',
  startsAt: new Date('2026-10-01T09:00:00.000Z'),
  capacity: 4,
  confirmedCount: 1,
});

const row = {
  bookingId: '22222222-2222-4222-8222-222222222222',
  studentId: '33333333-3333-4333-8333-333333333333',
  studentName: 'Zara Rahman',
  parentId: '44444444-4444-4444-8444-444444444444',
  parentName: 'Aisha Rahman',
  confirmedAt: new Date('2026-10-01T09:05:00.000Z'),
};

describe('mapRoster', () => {
  it('nests student and parent and renders confirmedAt as ISO', () => {
    const dto = mapRoster(trialClass, [row]);
    expect(dto.trialClass.subject).toBe('Math');
    expect(dto.entries[0]).toEqual({
      bookingId: row.bookingId,
      student: { id: row.studentId, name: 'Zara Rahman' },
      parent: { id: row.parentId, name: 'Aisha Rahman' },
      confirmedAt: '2026-10-01T09:05:00.000Z',
    });
    expect(rosterResponseSchema.safeParse(dto).success).toBe(true);
  });

  it('renders an empty roster', () => {
    const dto = mapRoster(trialClass, []);
    expect(dto.entries).toEqual([]);
    expect(rosterResponseSchema.safeParse(dto).success).toBe(true);
  });
});
