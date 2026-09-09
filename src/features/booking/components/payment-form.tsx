'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { postJson, ApiClientError } from '@/shared/lib/api-client/api-client';
import { payBookingSchema, type PayBookingInput } from '@/features/booking/dtos/v1/requests/pay-booking';
import { CARD_INPUT_MAX_LENGTH, CARD_MAX_DIGITS, CARD_MIN_DIGITS } from '@/features/booking/constants/card';
import { formatCardNumber } from '@/features/booking/utils/format-card-number/format-card-number';
import { bookingResponseSchema } from '@/features/booking/dtos/v1/responses/booking';

interface PaymentFormProps { bookingId: string }

// Success and decline both return 201 (the booking status carries the outcome);
// class-full / duplicate / not-payable arrive as 409 and are shown inline.
export function PaymentForm({ bookingId }: PaymentFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<PayBookingInput>({ resolver: zodResolver(payBookingSchema), defaultValues: { cardNumber: '' } });
  const { errors, isSubmitting } = form.formState;
  const cardField = form.register('cardNumber');

  // Reformat before react-hook-form reads the event, so letters and separators can never be typed.
  function handleCardChange(e: ChangeEvent<HTMLInputElement>) {
    e.target.value = formatCardNumber(e.target.value);
    void cardField.onChange(e);
  }

  async function onSubmit(values: PayBookingInput) {
    setSubmitError(null);
    try {
      await postJson(`/api/v1/bookings/${bookingId}/payments`, values, bookingResponseSchema);
      router.push(`/bookings/${bookingId}`);
    } catch (e) {
      if (!(e instanceof ApiClientError)) throw e;
      setSubmitError(e.message);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="cardNumber">Card number</Label>
        <Input
          id="cardNumber"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4242 4242 4242 4242"
          maxLength={CARD_INPUT_MAX_LENGTH}
          aria-describedby="cardNumber-hint"
          aria-invalid={errors.cardNumber ? true : undefined}
          {...cardField}
          onChange={handleCardChange}
        />
        <p id="cardNumber-hint" className="text-xs text-muted-foreground">
          {CARD_MIN_DIGITS}–{CARD_MAX_DIGITS} digits, spaces added automatically. Test mode: a number
          ending in 0000 is declined, anything else succeeds.
        </p>
        {errors.cardNumber ? <p className="text-sm text-destructive">{errors.cardNumber.message}</p> : null}
      </div>
      {submitError ? (
        <p role="alert" className="text-sm text-destructive">
          {submitError} <Link className="underline" href={`/bookings/${bookingId}`}>View booking</Link>
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Paying…' : 'Pay'}</Button>
    </form>
  );
}
