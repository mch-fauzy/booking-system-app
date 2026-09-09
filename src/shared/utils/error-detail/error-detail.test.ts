import { describe, it, expect } from 'vitest';
import { errorDetail } from './error-detail';

describe('errorDetail', () => {
  it('suppresses the message in production so a 500 never leaks internals', () => {
    expect(errorDetail(new Error('connection string leaked'), true)).toBeNull();
  });
  it('returns the message outside production', () => {
    expect(errorDetail(new Error('boom'), false)).toBe('boom');
  });
  it('stringifies a non-Error', () => {
    expect(errorDetail('plain string', false)).toBe('plain string');
  });
});
