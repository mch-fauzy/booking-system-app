// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookingForm } from './booking-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const STUDENT = '22222222-2222-4222-8222-222222222222';
const parents = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Aisha', students: [{ id: STUDENT, name: 'Zara' }] }];
const classes = [
  { id: '33333333-3333-4333-8333-333333333333', subject: 'Math – Fractions', startsAt: '2030-01-01T09:00:00.000Z', capacity: 4, confirmedCount: 3, seatsLeft: 1 },
  { id: '44444444-4444-4444-8444-444444444444', subject: 'Science – Space', startsAt: '2030-01-02T09:00:00.000Z', capacity: 4, confirmedCount: 4, seatsLeft: 0 },
];

beforeEach(() => { push.mockReset(); vi.restoreAllMocks(); });

async function fillAndSubmit() {
  await userEvent.selectOptions(screen.getByLabelText(/child/i), STUDENT);
  await userEvent.click(screen.getByRole('radio', { name: /fractions/i }));
  await userEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
}

describe('BookingForm', () => {
  it('posts the booking and navigates to payment', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      message: 'ok',
      data: {
        id: '55555555-5555-4555-8555-555555555555', status: 'pending_payment', cancellationReason: null,
        student: { id: STUDENT, name: 'Zara' },
        trialClass: { id: classes[0].id, subject: 'Math – Fractions', startsAt: classes[0].startsAt },
        paymentAttempts: [], createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-01T00:00:00.000Z',
      },
    }), { status: 201 }));
    render(<BookingForm parents={parents} classes={classes} />);
    await fillAndSubmit();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/bookings/55555555-5555-4555-8555-555555555555/pay'));
  });

  it('shows the API 409 message inline with a link to the existing booking', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      message: 'This child already has a booking for this trial class',
      data: { existingBookingId: '66666666-6666-4666-8666-666666666666' },
    }), { status: 409 }));
    render(<BookingForm parents={parents} classes={classes} />);
    await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/already has a booking/i);
    expect(screen.getByRole('link', { name: /view existing booking/i })).toHaveAttribute('href', '/bookings/66666666-6666-4666-8666-666666666666');
    expect(push).not.toHaveBeenCalled();
  });

  it('disables full classes', () => {
    render(<BookingForm parents={parents} classes={classes} />);
    expect(screen.getByRole('radio', { name: /space/i })).toBeDisabled();
  });
});
