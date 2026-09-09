import { redirect } from 'next/navigation';
import { orNotFound } from '@/shared/lib/next/not-found';
import { isPayable } from '@/shared/constants/booking-status';
import { bookingService } from '@/features/booking/services/booking';
import { PaymentForm } from '@/features/booking/components/payment-form';

export const dynamic = 'force-dynamic';

export default async function PayPage({ params }: PageProps<'/bookings/[id]/pay'>) {
  const { id } = await params;
  const booking = await orNotFound(bookingService.getById(id));
  if (!isPayable(booking.status)) redirect(`/bookings/${id}`);
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">Payment</h1>
      <p className="text-sm text-muted-foreground">{booking.student.name} — {booking.trialClass.subject}</p>
      <PaymentForm bookingId={id} />
    </div>
  );
}
