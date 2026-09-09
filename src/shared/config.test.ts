import { describe, it, expect } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadConfig({ NODE_ENV: 'test' })).toThrow(/DATABASE_URL/);
  });

  it('flags production', () => {
    const c = loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x' });
    expect(c.isProduction).toBe(true);
    expect(c.database.url).toBe('postgres://x');
  });
});
