import Link from 'next/link';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { BOOKING_STATUS, CANCELLATION_REASON, isPayable, type BookingStatus, type CancellationReason } from '@/shared/constants/booking-status';
import { formatDateTime } from '@/shared/utils/format-date-time/format-date-time';
import type { BookingResponse } from '@/features/booking/dtos/v1/responses/booking';

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  payment_failed: 'Payment failed',
  cancelled: 'Cancelled',
};

const CANCELLATION_LABEL: Record<CancellationReason, string> = {
  [CANCELLATION_REASON.CLASS_FULL]: 'The last seat was taken before payment completed. You were not charged.',
  [CANCELLATION_REASON.DUPLICATE]: 'This child already has a confirmed seat in this class.',
};

export function BookingStatus({ booking }: { booking: BookingResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4">
          <span>{booking.trialClass.subject}</span>
          <Badge variant={booking.status === BOOKING_STATUS.CONFIRMED ? 'default' : 'secondary'}>{STATUS_LABEL[booking.status]}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Child: {booking.student.name}</p>
        <p>Starts: {formatDateTime(booking.trialClass.startsAt)}</p>
        {booking.cancellationReason ? <p className="text-muted-foreground">{CANCELLATION_LABEL[booking.cancellationReason]}</p> : null}
        {booking.paymentAttempts.length > 0 ? (
          <ul className="space-y-1">
            {booking.paymentAttempts.map((a) => (
              <li key={a.id}>•••• {a.cardLast4} — {a.status} — {formatDateTime(a.createdAt)}</li>
            ))}
          </ul>
        ) : <p className="text-muted-foreground">No payment attempts yet.</p>}
        {isPayable(booking.status) ? (
          <Link className="underline" href={`/bookings/${booking.id}/pay`}>
            {booking.status === BOOKING_STATUS.PAYMENT_FAILED ? 'Retry payment' : 'Pay now'}
          </Link>
        ) : null}
        <Link className="block underline" href="/">Book another trial</Link>
      </CardContent>
    </Card>
  );
}
