'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Label } from '@/shared/components/ui/label';
import { cn } from '@/shared/utils/cn/cn';
import { formatDateTime } from '@/shared/utils/format-date-time/format-date-time';
import { postJson, ApiClientError } from '@/shared/lib/api-client/api-client';
import { createBookingSchema, type CreateBookingRequest } from '@/features/booking/dtos/v1/requests/create-booking';
import { bookingResponseSchema } from '@/features/booking/dtos/v1/responses/booking';

interface Parent { id: string; name: string; students: { id: string; name: string }[] }
// Only what the form renders — declaring it here keeps `booking` from importing `trial-class`.
// A TrialClassResponse satisfies it structurally; `app/` composes the two features.
interface TrialClassOption { id: string; subject: string; startsAt: string; seatsLeft: number }
interface BookingFormProps { parents: Parent[]; classes: TrialClassOption[] }
interface SubmitError { message: string; existingBookingId?: string }

const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs';

// Parent choice is UI-only (narrows the child list); the request carries studentId + trialClassId.
export function BookingForm({ parents, classes }: BookingFormProps) {
  const router = useRouter();
  const [parentId, setParentId] = useState(parents[0]?.id ?? '');
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const form = useForm<CreateBookingRequest>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: { studentId: '', trialClassId: '' },
  });
  const { errors, isSubmitting } = form.formState;
  const students = parents.find((p) => p.id === parentId)?.students ?? [];

  async function onSubmit(values: CreateBookingRequest) {
    setSubmitError(null);
    try {
      const booking = await postJson('/api/v1/bookings', values, bookingResponseSchema);
      router.push(`/bookings/${booking.id}/pay`);
    } catch (e) {
      if (!(e instanceof ApiClientError)) throw e;
      const data = e.data as { existingBookingId?: string } | undefined;
      setSubmitError({ message: e.message, existingBookingId: data?.existingBookingId });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="parent">Parent</Label>
        <select id="parent" className={selectClass} value={parentId}
          onChange={(e) => { setParentId(e.target.value); form.resetField('studentId'); }}>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="studentId">Child</Label>
        <select id="studentId" className={selectClass} {...form.register('studentId')}>
          <option value="">Select a child…</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {errors.studentId ? <p className="text-sm text-destructive">{errors.studentId.message}</p> : null}
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Trial class</legend>
        {classes.map((c) => {
          const full = c.seatsLeft === 0;
          return (
            <label key={c.id} className={cn('flex cursor-pointer items-center gap-3 rounded-md border p-3', full && 'cursor-not-allowed opacity-50')}>
              <input type="radio" value={c.id} disabled={full} {...form.register('trialClassId')} />
              <span className="flex-1">
                <span className="font-medium">{c.subject}</span>
                <span className="block text-xs text-muted-foreground">{formatDateTime(c.startsAt)}</span>
              </span>
              <Badge variant={full ? 'secondary' : 'default'}>{full ? 'Full' : `${c.seatsLeft} left`}</Badge>
            </label>
          );
        })}
        {errors.trialClassId ? <p className="text-sm text-destructive">{errors.trialClassId.message}</p> : null}
      </fieldset>

      {submitError ? (
        <p role="alert" className="text-sm text-destructive">
          {submitError.message}{' '}
          {submitError.existingBookingId ? (
            <Link className="underline" href={`/bookings/${submitError.existingBookingId}`}>View existing booking</Link>
          ) : null}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Booking…' : 'Continue to payment'}</Button>
    </form>
  );
}
