// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RosterTable } from './roster-table';
import type { RosterResponse } from '@/features/trial-class/dtos/v1/responses/roster';

const trialClass = {
  id: '11111111-1111-4111-8111-111111111111',
  subject: 'Math – Fractions',
  startsAt: '2030-01-01T09:00:00.000Z',
  capacity: 4,
  confirmedCount: 1,
  seatsLeft: 3,
};

const roster: RosterResponse = {
  trialClass,
  entries: [{
    bookingId: '22222222-2222-4222-8222-222222222222',
    student: { id: '33333333-3333-4333-8333-333333333333', name: 'Sofia Lim' },
    parent: { id: '44444444-4444-4444-8444-444444444444', name: 'Priya Lim' },
    confirmedAt: '2030-01-01T09:05:00.000Z',
  }],
};

describe('RosterTable', () => {
  it('lists confirmed students with their parent', () => {
    render(<RosterTable roster={roster} />);
    expect(screen.getByText(/1\/4 confirmed/)).toBeInTheDocument();
    expect(screen.getByText('Sofia Lim')).toBeInTheDocument();
    expect(screen.getByText('Priya Lim')).toBeInTheDocument();
  });

  it('renders an explicit empty state', () => {
    render(<RosterTable roster={{ trialClass: { ...trialClass, confirmedCount: 0, seatsLeft: 4 }, entries: [] }} />);
    expect(screen.getByText(/no confirmed students yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
