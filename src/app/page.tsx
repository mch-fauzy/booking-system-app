import { bookingService } from '@/features/booking/services/booking';
import { trialClassService } from '@/features/trial-class/services/trial-class';
import { BookingForm } from '@/features/booking/components/booking-form';

export const dynamic = 'force-dynamic';

export default async function BookPage() {
  const [parents, classes] = await Promise.all([bookingService.listParents(), trialClassService.list()]);
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Book a trial class</h1>
      <BookingForm parents={parents} classes={classes} />
    </div>
  );
}
