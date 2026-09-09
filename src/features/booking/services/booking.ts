import 'server-only';
import { HTTPException } from 'hono/http-exception';
import { ErrorMessageConstant } from '@/shared/constants/messages';
import { ConflictException } from '@/shared/lib/exceptions/conflict-exception';
import { db } from '@/shared/lib/db/db';
import { BOOKING_STATUS, CANCELLATION_REASON, PAYMENT_STATUS, isPayable } from '@/shared/constants/booking-status';
import { bookingRepo } from '@/features/booking/repositories/booking';
import { bookingTrialClassRepo } from '@/features/booking/repositories/trial-class';
import { paymentAttemptRepo } from '@/features/booking/repositories/payment-attempt';
import { parentRepo, type ParentWithStudents } from '@/features/booking/repositories/parent';
import { chargeMock } from '@/features/booking/utils/charge-mock/charge-mock';
import { mapBooking, type BookingResponse } from '@/features/booking/dtos/v1/responses/booking';
import type { CreateBookingRequest } from '@/features/booking/dtos/v1/requests/create-booking';
import type { PayBookingRequest } from '@/features/booking/dtos/v1/requests/pay-booking';

type PayOutcome = 'confirmed' | 'payment_failed' | 'class_full' | 'duplicate';

async function getBookingDetail(id: string): Promise<BookingResponse> {
  const detail = await bookingRepo.findDetail(id);
  if (!detail) throw new HTTPException(404, { message: ErrorMessageConstant.DataEntityNotFound('Booking') });
  return mapBooking(detail);
}

// Class row locked first, seat checked BEFORE the charge. class_full / duplicate write `cancelled`
// and RETURN (not throw) so that write survives the commit; pay() throws the 409 after.
async function payInTransaction(bookingId: string, input: PayBookingRequest): Promise<PayOutcome> {
  // READ COMMITTED is load-bearing: each statement re-snapshots, so the count taken after the lock
  // wait sees the winner's committed row. REPEATABLE READ would abort with 40001 and need retries.
  return db.transaction(async (tx) => {
    const booking = await bookingRepo.findById(bookingId, tx);
    if (!booking) throw new HTTPException(404, { message: ErrorMessageConstant.DataEntityNotFound('Booking') });
    if (!isPayable(booking.status)) throw new ConflictException(ErrorMessageConstant.BookingNotPayable());

    const trialClass = await bookingTrialClassRepo.lockForConfirm(booking.trialClassId, tx);
    if (!trialClass) throw new HTTPException(404, { message: ErrorMessageConstant.DataEntityNotFound('Trial class') });

    if (await bookingRepo.hasConfirmedForStudentClass(booking.studentId, booking.trialClassId, tx)) {
      await bookingRepo.update(bookingId, { status: BOOKING_STATUS.CANCELLED, cancellationReason: CANCELLATION_REASON.DUPLICATE }, tx);
      return 'duplicate';
    }

    const confirmedCount = await bookingRepo.countConfirmed(trialClass.id, tx);
    if (confirmedCount >= trialClass.capacity) {
      await bookingRepo.update(bookingId, { status: BOOKING_STATUS.CANCELLED, cancellationReason: CANCELLATION_REASON.CLASS_FULL }, tx);
      return 'class_full';
    }

    const charge = chargeMock(input.cardNumber);
    await paymentAttemptRepo.create({ bookingId, status: charge.status, cardLast4: charge.cardLast4 }, tx);
    if (charge.status === PAYMENT_STATUS.FAILED) {
      await bookingRepo.update(bookingId, { status: BOOKING_STATUS.PAYMENT_FAILED }, tx);
      return 'payment_failed';
    }
    await bookingRepo.update(bookingId, { status: BOOKING_STATUS.CONFIRMED }, tx); // unique index backstop lives here
    return 'confirmed';
  }, { isolationLevel: 'read committed' });
}

export const bookingService = {
  async listParents(): Promise<ParentWithStudents[]> {
    return parentRepo.findAllWithStudents();
  },

  async getById(id: string): Promise<BookingResponse> {
    return getBookingDetail(id);
  },

  // A pending booking holds NO seat. 409 if the child already has a live booking for this class.
  async create(input: CreateBookingRequest): Promise<BookingResponse> {
    const student = await parentRepo.findStudent(input.studentId);
    if (!student) throw new HTTPException(404, { message: ErrorMessageConstant.DataEntityNotFound('Student') });
    const trialClass = await bookingTrialClassRepo.findById(input.trialClassId);
    if (!trialClass) throw new HTTPException(404, { message: ErrorMessageConstant.DataEntityNotFound('Trial class') });

    const existing = await bookingRepo.findLiveForStudentClass(input.studentId, input.trialClassId);
    if (existing) throw new ConflictException(ErrorMessageConstant.DuplicateBooking(), { existingBookingId: existing.id });

    const created = await bookingRepo.create(input);
    return getBookingDetail(created.id);
  },

  async pay(id: string, input: PayBookingRequest): Promise<BookingResponse> {
    const outcome = await payInTransaction(id, input);
    if (outcome === 'class_full') throw new ConflictException(ErrorMessageConstant.ClassFull());
    if (outcome === 'duplicate') throw new ConflictException(ErrorMessageConstant.DuplicateBooking());
    return getBookingDetail(id);
  },
};
