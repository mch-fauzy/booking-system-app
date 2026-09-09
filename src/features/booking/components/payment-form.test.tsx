// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentForm } from './payment-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const ID = '55555555-5555-4555-8555-555555555555';

const bookingBody = (status: string) => JSON.stringify({
  message: 'ok',
  data: {
    id: ID, status, cancellationReason: null,
    student: { id: '22222222-2222-4222-8222-222222222222', name: 'Zara' },
    trialClass: { id: '33333333-3333-4333-8333-333333333333', subject: 'Math', startsAt: '2030-01-01T09:00:00.000Z' },
    paymentAttempts: [], createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-01T00:00:00.000Z',
  },
});

beforeEach(() => { push.mockReset(); vi.restoreAllMocks(); });

async function pay(card: string) {
  await userEvent.type(screen.getByLabelText(/card number/i), card);
  await userEvent.click(screen.getByRole('button', { name: /^pay$/i }));
}

describe('PaymentForm', () => {
  it('navigates to the status page on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(bookingBody('confirmed'), { status: 201 }));
    render(<PaymentForm bookingId={ID} />);
    await pay('4242424242424242');
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/bookings/${ID}`));
  });

  it('shows a 409 (class full) inline with a link to the booking', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'Trial class is full' }), { status: 409 }));
    render(<PaymentForm bookingId={ID} />);
    await pay('4242424242424242');
    expect(await screen.findByRole('alert')).toHaveTextContent(/full/i);
    expect(screen.getByRole('link', { name: /view booking/i })).toHaveAttribute('href', `/bookings/${ID}`);
  });

  it('ignores letters and separators as they are typed', async () => {
    render(<PaymentForm bookingId={ID} />);
    const input = screen.getByLabelText(/card number/i);
    await userEvent.type(input, 'abcd');
    expect(input).toHaveValue('');
    await userEvent.type(input, '4242-4242');
    expect(input).toHaveValue('4242 4242');
  });

  it('groups digits in fours and caps the length', async () => {
    render(<PaymentForm bookingId={ID} />);
    const input = screen.getByLabelText(/card number/i);
    await userEvent.type(input, '9'.repeat(25));
    expect(input).toHaveValue('9999 9999 9999 9999 999');
  });

  it('rejects a too-short card client-side without calling the API', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    render(<PaymentForm bookingId={ID} />);
    await pay('4242');
    expect(await screen.findByText('Card number must be 12–19 digits')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('tells the user the accepted length up front', () => {
    render(<PaymentForm bookingId={ID} />);
    expect(screen.getByText(/12–19 digits, spaces added automatically/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/card number/i)).toHaveAttribute('inputmode', 'numeric');
  });
});
