import { describe, it, expect } from 'vitest';
import { formatDateTime } from './format-date-time';

describe('formatDateTime', () => {
  it('renders a stable string for a given ISO instant', () => {
    const out = formatDateTime('2026-10-01T09:00:00.000Z');
    expect(out).toMatch(/2026/);
    expect(out).toBe(formatDateTime('2026-10-01T09:00:00.000Z'));
  });
});
