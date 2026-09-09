import { describe, it, expect } from 'vitest';
import { SEED_CLASSES, SEED_BOOKINGS, SEED_PARENTS, SEED_CARDS } from './seed-data';

describe('seed data', () => {
  const confirmedIn = (subject: string) =>
    SEED_BOOKINGS.filter((b) => b.classSubject === subject && b.card === SEED_CARDS.OK).length;

  it('covers available, exactly-3, and full classes plus one declined card', () => {
    expect(SEED_CLASSES.map((c) => c.subject)).toEqual(['Science – Volcanoes', 'Math – Fractions', 'Science – Space']);
    expect(confirmedIn('Science – Volcanoes')).toBe(1);
    expect(confirmedIn('Math – Fractions')).toBe(3);
    expect(confirmedIn('Science – Space')).toBe(4);
    expect(SEED_BOOKINGS.filter((b) => b.card === SEED_CARDS.DECLINE)).toHaveLength(1);
  });

  it('leaves at least two children free for the Fractions last-seat demo', () => {
    const all = SEED_PARENTS.flatMap((p) => p.students);
    const inFractions: string[] = SEED_BOOKINGS.filter((b) => b.classSubject === 'Math – Fractions').map((b) => b.student);
    expect(all.filter((s) => !inFractions.includes(s)).length).toBeGreaterThanOrEqual(2);
  });
});
