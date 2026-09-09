// npm run db:seed — truncates everything, then books through the real service path so statuses
// and payment attempts come from the same code the app runs.
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db/db';
import { parents, students, trialClasses } from '@/shared/db/schema';
import { bookingService } from '@/features/booking/services/booking';
import { SEED_BOOKINGS, SEED_CLASSES, SEED_PARENTS } from './seed-data';

async function seed(): Promise<void> {
  await db.execute(sql`TRUNCATE payment_attempts, bookings, students, trial_classes, parents CASCADE`);

  const studentIdByName = new Map<string, string>();
  for (const p of SEED_PARENTS) {
    const [parent] = await db.insert(parents).values({ name: p.name, email: p.email }).returning();
    const kids = await db.insert(students).values(p.students.map((name) => ({ parentId: parent.id, name }))).returning();
    for (const k of kids) studentIdByName.set(k.name, k.id);
  }

  const classIdBySubject = new Map<string, string>();
  for (const c of await db.insert(trialClasses).values([...SEED_CLASSES]).returning()) {
    classIdBySubject.set(c.subject, c.id);
  }

  for (const b of SEED_BOOKINGS) {
    const created = await bookingService.create({
      studentId: studentIdByName.get(b.student)!,
      trialClassId: classIdBySubject.get(b.classSubject)!,
    });
    const paid = await bookingService.pay(created.id, { cardNumber: b.card });
    console.log(`${b.student.padEnd(14)} ${b.classSubject.padEnd(22)} ${paid.status}`);
  }
  console.log('\nSeeded. Last-seat demo: book Leo Tan and Sofia Lim into "Math – Fractions" from two tabs, pay both.');
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
