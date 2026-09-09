export const SEED_CARDS = { OK: '4242424242424242', DECLINE: '4000000000000000' } as const;

export const SEED_PARENTS = [
  { name: 'Aisha Rahman', email: 'aisha@example.com', students: ['Zara Rahman', 'Omar Rahman'] },
  { name: 'Daniel Tan', email: 'daniel@example.com', students: ['Mia Tan', 'Leo Tan'] },
  { name: 'Priya Lim', email: 'priya@example.com', students: ['Sofia Lim'] },
] as const;

function daysFromNow(days: number, hourUtc: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d;
}

export const SEED_CLASSES = [
  { subject: 'Science – Volcanoes', startsAt: daysFromNow(3, 9) },  // seats available
  { subject: 'Math – Fractions', startsAt: daysFromNow(4, 10) },    // exactly 3 confirmed -> last seat
  { subject: 'Science – Space', startsAt: daysFromNow(5, 11) },     // full
] as const;

// Applied in order through bookingService.create + pay so every row takes the real path.
export const SEED_BOOKINGS = [
  { student: 'Zara Rahman', classSubject: 'Science – Volcanoes', card: SEED_CARDS.OK },
  { student: 'Leo Tan', classSubject: 'Science – Volcanoes', card: SEED_CARDS.DECLINE }, // payment failure case
  { student: 'Zara Rahman', classSubject: 'Math – Fractions', card: SEED_CARDS.OK },
  { student: 'Omar Rahman', classSubject: 'Math – Fractions', card: SEED_CARDS.OK },
  { student: 'Mia Tan', classSubject: 'Math – Fractions', card: SEED_CARDS.OK },
  { student: 'Zara Rahman', classSubject: 'Science – Space', card: SEED_CARDS.OK },
  { student: 'Omar Rahman', classSubject: 'Science – Space', card: SEED_CARDS.OK },
  { student: 'Mia Tan', classSubject: 'Science – Space', card: SEED_CARDS.OK },
  { student: 'Leo Tan', classSubject: 'Science – Space', card: SEED_CARDS.OK },
] as const;
