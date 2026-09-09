// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookingStatus } from './booking-status';
import type { BookingResponse } from '@/features/booking/dtos/v1/responses/booking';

const base: BookingResponse = {
  id: '55555555-5555-4555-8555-555555555555',
  status: 'pending_payment',
  cancellationReason: null,
  student: { id: '22222222-2222-4222-8222-222222222222', name: 'Sofia Lim' },
  trialClass: { id: '33333333-3333-4333-8333-333333333333', subject: 'Math – Fractions', startsAt: '2030-01-01T09:00:00.000Z' },
  paymentAttempts: [],
  createdAt: '2030-01-01T00:00:00.000Z',
  updatedAt: '2030-01-01T00:00:00.000Z',
};

describe('BookingStatus', () => {
  it('offers payment and shows an empty attempts state while pending', () => {
    render(<BookingStatus booking={base} />);
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
    expect(screen.getByText(/no payment attempts yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pay now/i })).toBeInTheDocument();
  });

  it('offers a retry and lists attempts after a declined payment', () => {
    render(<BookingStatus booking={{
      ...base,
      status: 'payment_failed',
      paymentAttempts: [{ id: '44444444-4444-4444-8444-444444444444', status: 'failed', cardLast4: '0000', createdAt: '2030-01-01T00:05:00.000Z' }],
    }} />);
    expect(screen.getByText('Payment failed')).toBeInTheDocument();
    expect(screen.getByText(/0000/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /retry payment/i })).toBeInTheDocument();
  });

  it('explains a class_full cancellation and offers no payment link', () => {
    render(<BookingStatus booking={{ ...base, status: 'cancelled', cancellationReason: 'class_full' }} />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText(/last seat was taken.*not charged/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /pay/i })).not.toBeInTheDocument();
  });

  it('explains a duplicate cancellation', () => {
    render(<BookingStatus booking={{ ...base, status: 'cancelled', cancellationReason: 'duplicate' }} />);
    expect(screen.getByText(/already has a confirmed seat/i)).toBeInTheDocument();
  });

  it('shows confirmed without a payment link', () => {
    render(<BookingStatus booking={{ ...base, status: 'confirmed' }} />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /pay/i })).not.toBeInTheDocument();
  });
});
