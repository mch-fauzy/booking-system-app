import { orNotFound } from '@/shared/lib/next/not-found';
import { bookingService } from '@/features/booking/services/booking';
import { BookingStatus } from '@/features/booking/components/booking-status';

export const dynamic = 'force-dynamic';

export default async function BookingPage({ params }: PageProps<'/bookings/[id]'>) {
  const { id } = await params;
  const booking = await orNotFound(bookingService.getById(id));
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">Your booking</h1>
      <BookingStatus booking={booking} />
    </div>
  );
}
