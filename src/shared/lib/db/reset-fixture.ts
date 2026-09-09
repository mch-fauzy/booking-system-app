import { eq, inArray } from 'drizzle-orm';
import { db } from '@/shared/lib/db/db';
import { bookings, parents, paymentAttempts, students, trialClasses } from '@/shared/db/schema';

interface FixtureKey {
  parentEmail: string;
  classSubject: string;
}

// Integration fixtures are torn down in afterAll, which never runs if the process is killed
// mid-file — leaving rows that show up in the app. Calling this at the START of beforeAll makes
// setup idempotent, so a crashed run self-heals on the next one. Matches only the fixture's own
// parent email and class subject, so seeded demo data is never touched.
export async function resetFixture({ parentEmail, classSubject }: FixtureKey): Promise<void> {
  const [parentRows, classRows] = await Promise.all([
    db.select({ id: parents.id }).from(parents).where(eq(parents.email, parentEmail)),
    db.select({ id: trialClasses.id }).from(trialClasses).where(eq(trialClasses.subject, classSubject)),
  ]);
  const parentIds = parentRows.map((r) => r.id);
  const classIds = classRows.map((r) => r.id);

  const studentIds = parentIds.length
    ? (await db.select({ id: students.id }).from(students).where(inArray(students.parentId, parentIds))).map((r) => r.id)
    : [];

  const bookingIds = new Set<string>();
  for (const where of [
    classIds.length ? inArray(bookings.trialClassId, classIds) : undefined,
    studentIds.length ? inArray(bookings.studentId, studentIds) : undefined,
  ]) {
    if (!where) continue;
    for (const row of await db.select({ id: bookings.id }).from(bookings).where(where)) bookingIds.add(row.id);
  }

  const ids = [...bookingIds];
  if (ids.length) {
    await db.delete(paymentAttempts).where(inArray(paymentAttempts.bookingId, ids));
    await db.delete(bookings).where(inArray(bookings.id, ids));
  }
  if (studentIds.length) await db.delete(students).where(inArray(students.id, studentIds));
  if (classIds.length) await db.delete(trialClasses).where(inArray(trialClasses.id, classIds));
  if (parentIds.length) await db.delete(parents).where(inArray(parents.id, parentIds));
}
