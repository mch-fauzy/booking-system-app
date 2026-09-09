import { describe, it, expect } from 'vitest';
import { chargeMock } from './charge-mock';

describe('chargeMock', () => {
  it('declines cards ending in 0000 and approves others, returning last4', () => {
    expect(chargeMock('4000000000000000')).toEqual({ status: 'failed', cardLast4: '0000' });
    expect(chargeMock('4242424242424242')).toEqual({ status: 'succeeded', cardLast4: '4242' });
  });
});
