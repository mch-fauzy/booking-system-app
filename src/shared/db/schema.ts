// NOT server-only: drizzle-kit imports this. Pure table metadata + relations.
// All tables live here because both features read `bookings` and features may not import each other.
import { pgTable, text, uuid, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { baseColumns, TIMESTAMP_MS } from '@/shared/db/base-columns';
import {
  BOOKING_STATUS,
  type BookingStatus,
  type CancellationReason,
  type PaymentStatus,
} from '@/shared/constants/booking-status';

const DEFAULT_CAPACITY = 4;

export const parents = pgTable('parents', {
  ...baseColumns,
  name: text('name').notNull(),
  email: text('email').notNull(),
});

export const students = pgTable('students', {
  ...baseColumns,
  parentId: uuid('parent_id').notNull().references(() => parents.id),
  name: text('name').notNull(),
}, (t) => [index('students_parent_id_idx').on(t.parentId)]);

export const trialClasses = pgTable('trial_classes', {
  ...baseColumns,
  subject: text('subject').notNull(),
  startsAt: timestamp('starts_at', TIMESTAMP_MS).notNull(),
  capacity: integer('capacity').notNull().default(DEFAULT_CAPACITY),
});

export const bookings = pgTable('bookings', {
  ...baseColumns,
  studentId: uuid('student_id').notNull().references(() => students.id),
  trialClassId: uuid('trial_class_id').notNull().references(() => trialClasses.id),
  status: text('status').$type<BookingStatus>().notNull().default(BOOKING_STATUS.PENDING_PAYMENT),
  cancellationReason: text('cancellation_reason').$type<CancellationReason>(),
}, (t) => [
  index('bookings_trial_class_status_idx').on(t.trialClassId, t.status),
  // DB backstop for invariant #2: one confirmed booking per (student, class). 23505 -> 409.
  uniqueIndex('bookings_one_confirmed_per_student_class')
    .on(t.studentId, t.trialClassId)
    .where(sql`${t.status} = 'confirmed'`),
]);

export const paymentAttempts = pgTable('payment_attempts', {
  ...baseColumns,
  bookingId: uuid('booking_id').notNull().references(() => bookings.id),
  status: text('status').$type<PaymentStatus>().notNull(),
  cardLast4: text('card_last4').notNull(),
}, (t) => [index('payment_attempts_booking_id_idx').on(t.bookingId)]);

// Relations power db.query.* nested reads (parents -> students, booking -> student/class/attempts).
export const parentsRelations = relations(parents, ({ many }) => ({ students: many(students) }));
export const studentsRelations = relations(students, ({ one, many }) => ({
  parent: one(parents, { fields: [students.parentId], references: [parents.id] }),
  bookings: many(bookings),
}));
export const trialClassesRelations = relations(trialClasses, ({ many }) => ({ bookings: many(bookings) }));
export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  student: one(students, { fields: [bookings.studentId], references: [students.id] }),
  trialClass: one(trialClasses, { fields: [bookings.trialClassId], references: [trialClasses.id] }),
  paymentAttempts: many(paymentAttempts),
}));
export const paymentAttemptsRelations = relations(paymentAttempts, ({ one }) => ({
  booking: one(bookings, { fields: [paymentAttempts.bookingId], references: [bookings.id] }),
}));
